/**
 * auth.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Rutas de autenticación: login, perfil, recuperación de contraseña.
 * El restablecimiento lo inicia el propio usuario; se le envía un correo
 * con enlace de un solo uso (válido 1 hora).
 * Los supervisores y admin reciben también una notificación interna como testigos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express   = require("express");
const router    = express.Router();
const crypto    = require("crypto");
const { v4: uuidv4 } = require("uuid");
const store     = require("../data/store");
const { generarToken, verificarToken, compararPassword, hashPassword } = require("../middleware/auth");
const { ROLES } = require("../middleware/roles");
const { pool, DB_ENABLED } = require("../config/db");
const notifService  = require("../services/notificaciones.service");
const emailService  = require("../services/email.service");

// ─── Utilidades TOTP (RFC 6238 / Google Authenticator) — sin dependencias extra ─
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let output = "";
  let bits = 0;
  let bitsCount = 0;
  for (const byte of buffer) {
    bits = (bits << 8) | byte;
    bitsCount += 8;
    while (bitsCount >= 5) {
      bitsCount -= 5;
      output += BASE32_CHARS[(bits >> bitsCount) & 31];
    }
  }
  if (bitsCount > 0) output += BASE32_CHARS[(bits << (5 - bitsCount)) & 31];
  while (output.length % 8 !== 0) output += "=";
  return output;
}

function base32Decode(str) {
  str = str.replace(/=/g, "").toUpperCase();
  const bytes = [];
  let bits = 0;
  let bitsCount = 0;
  for (const char of str) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    bits = (bits << 5) | val;
    bitsCount += 5;
    if (bitsCount >= 8) {
      bitsCount -= 8;
      bytes.push((bits >> bitsCount) & 255);
    }
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, window = 0) {
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 30000) + window;
    const buf = Buffer.alloc(8);
    // Write counter as big-endian 64-bit (split into two 32-bit parts)
    const high = Math.floor(counter / 0x100000000);
    const low  = counter >>> 0;
    buf.writeUInt32BE(high, 0);
    buf.writeUInt32BE(low,  4);
    const hmac = crypto.createHmac("sha1", key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = (
      ((hmac[offset]     & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) <<  8) |
       (hmac[offset + 3] & 0xff)
    ) % 1000000;
    return code.toString().padStart(6, "0");
  } catch {
    return null;
  }
}

function verifyTOTP(secret, token) {
  if (!secret || !token) return false;
  for (let w = -1; w <= 1; w++) {
    if (generateTOTP(secret, w) === token) return true;
  }
  return false;
}

function generateTOTPSecret() {
  return base32Encode(crypto.randomBytes(20)).replace(/=/g, "");
}

function getTOTPUri(secret, email, issuer = "Kronos") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ─── Protección brute-force: bloqueo de cuenta por intentos fallidos ─────────
// Map: email.toLowerCase() → { count: number, lockedUntil: timestamp|null }
const loginAttempts = new Map();
// ⚠️  DESHABILITADO EN DESARROLLO — cambiar a 5 en producción
const LOCK_THRESHOLD    = Infinity;         // sin bloqueo en desarrollo
const LOCK_DURATION_MS  = 15 * 60 * 1000;  // 15 minutos de bloqueo (producción)

/** Limpia entradas expiradas cada 30 minutos */
setInterval(() => {
  const ahora = Date.now();
  for (const [key, data] of loginAttempts) {
    if (data.lockedUntil && data.lockedUntil < ahora) loginAttempts.delete(key);
  }
}, 30 * 60 * 1000);

// ─── Sesiones 2FA pendientes ─────────────────────────────────────────────────
const pending2FA = new Map();

setInterval(() => {
  const ahora = Date.now();
  for (const [key, data] of pending2FA) {
    if (data.expiresAt < ahora) pending2FA.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Helper: obtener puedeEditar del rol ──────────────────────────────────────
/**
 * Consulta si el rol del usuario tiene `puede_editar = 1` en la tabla roles.
 * Devuelve `true` como default seguro si la DB no está disponible.
 */
async function fetchPuedeEditar(rolClave) {
  try {
    if (DB_ENABLED && pool) {
      const [rows] = await pool.query(
        "SELECT puede_editar FROM roles WHERE clave = ? LIMIT 1",
        [rolClave]
      );
      if (rows.length > 0) return rows[0].puede_editar === 1;
    }
  } catch (_) { /* silencioso */ }
  // Roles base que siempre pueden editar aunque la DB falle
  const SIEMPRE_EDITAN = ["super_admin", "administrador_general", "agente_soporte_ti"];
  return SIEMPRE_EDITAN.includes(rolClave);
}

// ─── Reset tokens (en memoria, TTL 1 hora) ────────────────────────────────────
// token (UUID) → { userId, expires: Date }
const resetTokens = new Map();

/** Limpia tokens expirados periódicamente (cada 15 min) */
setInterval(() => {
  const ahora = Date.now();
  for (const [token, data] of resetTokens) {
    if (data.expires < ahora) resetTokens.delete(token);
  }
}, 15 * 60 * 1000);

// Roles que reciben notificación interna cuando alguien solicita restablecimiento
const ROLES_RECIBEN_RESET = [
  ROLES.SUPERVISOR_SUCURSALES,
  ROLES.AGENTE_SOPORTE_TI,
  ROLES.SUPER_ADMIN,
];

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Autentica un usuario. Para medico_de_guardia, requiere sucursalIdLogin.
 */
router.post("/login", async (req, res) => {
  const { email, password, sucursalIdLogin } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  const attemptKey = email.toLowerCase().trim();
  const attempts   = loginAttempts.get(attemptKey) || { count: 0, lockedUntil: null };

  // ── Verificar bloqueo activo ────────────────────────────────────────────
  if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
    const minutosRestantes = Math.ceil((attempts.lockedUntil - Date.now()) / 60_000);
    return res.status(429).json({
      error: `Cuenta bloqueada por demasiados intentos fallidos. Intenta nuevamente en ${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""}.`,
    });
  }

  const usuario = store.getUsuarioByEmail(email);
  const passwordValida = usuario
    ? await compararPassword(password, usuario.password)
    : false;

  if (!usuario || !passwordValida) {
    // Incrementar contador de intentos fallidos
    attempts.count++;
    if (attempts.count >= LOCK_THRESHOLD) {
      attempts.lockedUntil = Date.now() + LOCK_DURATION_MS;
      attempts.count = 0;
      loginAttempts.set(attemptKey, attempts);
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.`,
      });
    }
    loginAttempts.set(attemptKey, attempts);
    const restantes = LOCK_THRESHOLD - attempts.count;
    return res.status(401).json({
      error: `Credenciales incorrectas. ${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""} antes del bloqueo.`,
    });
  }

  // Login exitoso: limpiar intentos fallidos
  loginAttempts.delete(attemptKey);

  if (!usuario.activo) {
    return res.status(403).json({ error: "Usuario desactivado. Contacta a soporte." });
  }

  // Médico de guardia debe seleccionar sucursal en cada sesión
  if (usuario.rol === ROLES.MEDICO_DE_GUARDIA) {
    if (!sucursalIdLogin) {
      const sucursales = store.getSucursales().filter((s) => s.activa);
      return res.status(200).json({
        requiresBranchSelection: true,
        sucursales,
        mensaje: "Como médico de guardia, debes seleccionar la sucursal en la que te encuentras hoy.",
      });
    }
    const sucursal = store.getSucursalById(sucursalIdLogin);
    if (!sucursal || !sucursal.activa) {
      return res.status(400).json({ error: "Sucursal seleccionada no válida" });
    }
  }

  // Si tiene 2FA habilitado, emitir un desafío en lugar del token completo
  if (usuario.totpHabilitado && usuario.totpSecret) {
    const challengeId = uuidv4();
    pending2FA.set(challengeId, {
      userId: usuario.id,
      sucursalIdLogin: usuario.rol === ROLES.MEDICO_DE_GUARDIA ? sucursalIdLogin : null,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
    });
    return res.json({
      requires2FA: true,
      challengeId,
      mensaje: "Ingresa el código de tu aplicación de autenticación (Google Authenticator, Authy, etc.).",
    });
  }

  const puedeEditar = await fetchPuedeEditar(usuario.rol);
  const token = generarToken(
    usuario,
    usuario.rol === ROLES.MEDICO_DE_GUARDIA ? sucursalIdLogin : null,
    puedeEditar
  );

  const { password: _, ...datosUsuario } = usuario;
  return res.json({ token, usuario: { ...datosUsuario, puedeEditar } });
});

// ─── Perfil ───────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Devuelve el perfil del usuario autenticado.
 */
router.get("/me", verificarToken, (req, res) => {
  const usuario = store.getUsuarioById(req.user.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  const { password: _, ...datosUsuario } = usuario;
  return res.json({ ...datosUsuario, sucursalId: req.user.sucursalId });
});

// ─── Olvidé mi contraseña ─────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Genera un token y envía un correo al usuario con el enlace de restablecimiento.
 * También notifica internamente a supervisores/admins como testigos.
 * No revela si el email existe (seguridad anti-enumeración).
 *
 * Body: { email }
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "El email es requerido" });
  }

  const usuario = store.getUsuarioByEmail(email);

  if (usuario && usuario.activo) {
    // Generar token único con TTL de 1 hora
    const token   = uuidv4();
    const expires = Date.now() + 3_600_000; // 1 hora
    resetTokens.set(token, { userId: usuario.id, expires });

    // Enviar correo al usuario
    try {
      await emailService.enviarCorreoReset(
        usuario.email,
        usuario.nombre,
        token
      );
    } catch (err) {
      console.error("[forgot-password] Error al enviar correo:", err.message);
      // No bloqueamos la respuesta; igual notificamos a admins
    }

    // Notificación interna a supervisores/admins como testigos
    const admins = store.getUsuarios({ activo: true })
      .filter((u) => ROLES_RECIBEN_RESET.includes(u.rol));
    admins.forEach((admin) => {
      notifService.crearNotificacion({
        paraUsuarioId: admin.id,
        deUsuarioId:   usuario.id,
        tipo:          "alerta",
        titulo:        "Solicitud de restablecimiento de contraseña",
        mensaje:       `${usuario.nombre} ${usuario.apellido} (${usuario.email}) solicitó restablecer su contraseña. Se envió un enlace a su correo.`,
        referenciaId:  usuario.id,
      });
    });
  }

  // Siempre la misma respuesta independientemente de si el email existe
  return res.json({
    mensaje: "Si el correo está registrado, recibirás un enlace en tu bandeja de entrada.",
  });
});

// ─── Restablecer contraseña ───────────────────────────────────────────────────

/**
 * POST /api/auth/reset-password
 * Valida el token y actualiza la contraseña del usuario.
 *
 * Body: { token, password }
 */
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Token y nueva contraseña son requeridos" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  const datos = resetTokens.get(token);

  if (!datos) {
    return res.status(400).json({ error: "El enlace no es válido o ya fue utilizado" });
  }

  if (datos.expires < Date.now()) {
    resetTokens.delete(token);
    return res.status(400).json({ error: "El enlace ha expirado. Solicita uno nuevo." });
  }

  const usuario = store.getUsuarioById(datos.userId);
  if (!usuario || !usuario.activo) {
    resetTokens.delete(token);
    return res.status(400).json({ error: "Usuario no encontrado o inactivo" });
  }

  // Hashear y guardar la nueva contraseña
  const hash = await hashPassword(password);
  store.updateUsuario(usuario.id, { password: hash });

  // Invalidar el token después de un solo uso
  resetTokens.delete(token);

  // Notificar a admins del cambio exitoso
  const admins = store.getUsuarios({ activo: true })
    .filter((u) => ROLES_RECIBEN_RESET.includes(u.rol));
  admins.forEach((admin) => {
    notifService.crearNotificacion({
      paraUsuarioId: admin.id,
      deUsuarioId:   usuario.id,
      tipo:          "info",
      titulo:        "Contraseña restablecida",
      mensaje:       `${usuario.nombre} ${usuario.apellido} restableció su contraseña exitosamente.`,
      referenciaId:  usuario.id,
    });
  });

  return res.json({ mensaje: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." });
});

// ─── 2FA: Verificar código en el flujo de login ───────────────────────────────

/**
 * POST /api/auth/2fa/verify-login
 * Verifica el código TOTP después del desafío de login.
 * Body: { challengeId, code }
 */
router.post("/2fa/verify-login", async (req, res) => {
  const { challengeId, code } = req.body;
  if (!challengeId || !code) {
    return res.status(400).json({ error: "challengeId y code son requeridos" });
  }

  const datos = pending2FA.get(challengeId);
  if (!datos || datos.expiresAt < Date.now()) {
    pending2FA.delete(challengeId);
    return res.status(400).json({ error: "El desafío expiró o no es válido. Inicia sesión nuevamente." });
  }

  const usuario = store.getUsuarioById(datos.userId);
  if (!usuario || !usuario.activo) {
    pending2FA.delete(challengeId);
    return res.status(400).json({ error: "Usuario no encontrado" });
  }

  if (!verifyTOTP(usuario.totpSecret, String(code).trim())) {
    return res.status(401).json({ error: "Código incorrecto. Verifica la hora de tu dispositivo." });
  }

  pending2FA.delete(challengeId);

  const puedeEditar = await fetchPuedeEditar(usuario.rol);
  const token = generarToken(usuario, datos.sucursalIdLogin, puedeEditar);
  const { password: _, ...datosUsuario } = usuario;
  return res.json({ token, usuario: { ...datosUsuario, puedeEditar } });
});

// ─── 2FA: Configurar por primera vez ─────────────────────────────────────────

/**
 * POST /api/auth/2fa/setup
 * Genera un secreto TOTP y devuelve la URI para QR code.
 * El secreto NO se guarda aún hasta que el usuario lo confirme.
 */
router.post("/2fa/setup", verificarToken, (req, res) => {
  const usuario = store.getUsuarioById(req.user.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  const secret = generateTOTPSecret();
  const otpauthUri = getTOTPUri(secret, usuario.email);

  // Guardar temporalmente el secreto pendiente de verificación
  pending2FA.set(`setup:${req.user.id}`, {
    secret,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos
  });

  return res.json({
    secret,
    otpauthUri,
    instrucciones: "Escanea el código QR con Google Authenticator o Authy. Luego confirma con POST /api/auth/2fa/confirm",
  });
});

/**
 * POST /api/auth/2fa/confirm
 * Confirma que el código TOTP es correcto y activa el 2FA en la cuenta.
 * Body: { code }
 */
router.post("/2fa/confirm", verificarToken, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "El código es requerido" });

  const datos = pending2FA.get(`setup:${req.user.id}`);
  if (!datos || datos.expiresAt < Date.now()) {
    pending2FA.delete(`setup:${req.user.id}`);
    return res.status(400).json({ error: "La sesión de configuración expiró. Inicia el proceso nuevamente." });
  }

  if (!verifyTOTP(datos.secret, String(code).trim())) {
    return res.status(400).json({ error: "Código incorrecto. Verifica que tu aplicación muestre el código actual." });
  }

  // Guardar el secreto en la cuenta
  store.updateUsuario(req.user.id, { totpSecret: datos.secret, totpHabilitado: true });
  pending2FA.delete(`setup:${req.user.id}`);

  return res.json({ mensaje: "Autenticación de doble factor activada correctamente." });
});

/**
 * POST /api/auth/2fa/disable
 * Desactiva el 2FA en la cuenta. Requiere confirmar con código actual.
 * Body: { code }
 */
router.post("/2fa/disable", verificarToken, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "El código es requerido para desactivar 2FA" });

  const usuario = store.getUsuarioById(req.user.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!usuario.totpHabilitado || !usuario.totpSecret) {
    return res.status(400).json({ error: "El 2FA no está habilitado en tu cuenta" });
  }

  if (!verifyTOTP(usuario.totpSecret, String(code).trim())) {
    return res.status(401).json({ error: "Código incorrecto" });
  }

  store.updateUsuario(req.user.id, { totpSecret: null, totpHabilitado: false });
  return res.json({ mensaje: "Autenticación de doble factor desactivada correctamente." });
});

/**
 * GET /api/auth/2fa/status
 * Devuelve si el usuario tiene 2FA habilitado.
 */
router.get("/2fa/status", verificarToken, (req, res) => {
  const usuario = store.getUsuarioById(req.user.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ habilitado: !!usuario.totpHabilitado });
});

/**
 * GET /api/auth/avatar?email=xxx
 * Endpoint público: devuelve solo la fotoUrl del usuario por email.
 * No requiere autenticación — solo expone una URL de imagen, sin datos sensibles.
 */
router.get("/avatar", (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ fotoUrl: null });
  const usuario = store.getUsuarioByEmail(email.trim().toLowerCase());
  return res.json({ fotoUrl: usuario?.fotoUrl || null });
});

module.exports = router;
