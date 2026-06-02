/**
 * auth.js  (middleware)
 * ─────────────────────────────────────────────────────────────────────────────
 * Middleware de autenticación basado en JWT.
 * La autorización por rol se maneja con requireRoles() de roles.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const _JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!_JWT_SECRET_ENV) {
  if (process.env.NODE_ENV === "production") {
    console.error("\n🚨 FATAL: JWT_SECRET no está configurado en .env. El servidor no puede iniciar en producción sin él.\n");
    process.exit(1);
  }
  console.warn(
    "\n⚠️  ADVERTENCIA DE SEGURIDAD: JWT_SECRET no está en .env\n" +
    "   Se usa clave temporal de desarrollo. NUNCA uses esto en producción.\n" +
    "   Agrega JWT_SECRET=<clave-segura-aleatoria> a tu archivo .env\n"
  );
}
const JWT_SECRET = _JWT_SECRET_ENV || "access_control_secret_2025_DEV_ONLY";

/**
 * verificarToken
 * Extrae y valida el JWT del header Authorization.
 * Inyecta req.user = { id, email, rol, sucursalId, nombre } si es válido.
 */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};

/**
 * generarToken
 * Crea un JWT firmado con los datos del usuario.
 * Para medico_de_guardia incluye sucursalId de sesión (no persiste en BD).
 *
 * @param {object} usuario - { id, email, rol, sucursalId, nombre }
 * @param {string|null} sucursalIdLogin - Sucursal de sesión para medico_de_guardia
 * @returns {string} JWT con expiración de 8 horas
 */
const generarToken = (usuario, sucursalIdLogin = null, puedeEditar = true) => {
  const sucursalId = sucursalIdLogin || usuario.sucursalId;
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      sucursalId,
      nombre: usuario.nombre,
      puedeEditar,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
};

/**
 * hashPassword — hashea una contraseña con bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = (password) => bcrypt.hash(password, 10);

/**
 * verificarPassword — compara texto plano con hash bcrypt
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const verificarPassword = (password, hash) => bcrypt.compare(password, hash);

/**
 * compararPassword — compatibilidad: soporta hash bcrypt y texto plano durante migración
 * @param {string} password - texto ingresado por usuario
 * @param {string} stored   - valor guardado (puede ser hash o texto plano)
 * @returns {Promise<boolean>}
 */
const compararPassword = async (password, stored) => {
  // Si empieza con $2b$ es un hash bcrypt
  if (stored && stored.startsWith("$2")) {
    return bcrypt.compare(password, stored);
  }
  // Texto plano (datos de prueba en desarrollo)
  return password === stored;
};

module.exports = {
  verificarToken,
  generarToken,
  hashPassword,
  verificarPassword,
  compararPassword,
  // Mantener compatibilidad con código existente que usa soloAdmin
  soloAdmin: (req, res, next) => {
    if (!["super_admin", "agente_soporte_ti"].includes(req.user?.rol)) {
      return res.status(403).json({ error: "Acceso restringido a administradores" });
    }
    next();
  },
  soloAdminOSupervisor: (req, res, next) => {
    if (!["super_admin", "agente_soporte_ti", "supervisor_sucursales"].includes(req.user?.rol)) {
      return res.status(403).json({ error: "Acceso restringido" });
    }
    next();
  },
};
