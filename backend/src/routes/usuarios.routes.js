/**
 * usuarios.routes.js - CRUD de usuarios con soporte para 7 roles + foto de perfil.
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");
const store = require("../data/store");
const { verificarToken, hashPassword } = require("../middleware/auth");
const { requireRoles, ROLES } = require("../middleware/roles");
const { saveFile } = require("../services/storage.service");
const { getAllowedSucursalIds, canAccessUsuario } = require("../utils/access-scope");
const notifService = require("../services/notificaciones.service");

// Multer para importación CSV
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"];
    if (permitidos.includes(file.mimetype) || file.originalname.endsWith(".csv")) cb(null, true);
    else cb(new Error("Solo se permiten archivos CSV"));
  },
});

// Solo el supervisor y el administrador reciben notificación de cambio de contraseña.
// El empleado realiza el cambio por sí mismo; estas cuentas solo lo visualizan.
const ROLES_RECIBEN_CAMBIO_PASSWORD = [
  "supervisor_sucursales",
  "agente_soporte_ti",
  "super_admin",
];

// Multer en memoria para foto de empleado (máx 5 MB, solo imágenes)
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ["image/jpeg", "image/png", "image/webp"];
    if (permitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se permiten imágenes JPG, PNG o WebP"));
  },
});

router.use(verificarToken);

/** Roles que pueden VER empleados */
const ROLES_PUEDEN_VER      = [ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.SUPERVISOR_SUCURSALES];
/** Roles que pueden CREAR/EDITAR empleados */
const ROLES_PUEDEN_GESTIONAR = [ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.NOMINAS];
/** Roles que pueden ELIMINAR empleados */
const ROLES_PUEDEN_ELIMINAR  = [ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.NOMINAS];

/**
 * Valida que la contraseña cumpla los requisitos de seguridad:
 * mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial.
 * Retorna un mensaje de error o null si es válida.
 */
const validarPassword = (password) => {
  if (!password || typeof password !== "string") return "La contraseña es obligatoria.";
  if (password.length < 8)          return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(password))      return "La contraseña debe incluir al menos una letra mayúscula.";
  if (!/[a-z]/.test(password))      return "La contraseña debe incluir al menos una letra minúscula.";
  if (!/[0-9]/.test(password))      return "La contraseña debe incluir al menos un número.";
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?`~]/.test(password))
    return "La contraseña debe incluir al menos un carácter especial (!@#$%^&* etc.).";
  return null;
};

/** GET /api/usuarios/plantilla-importacion — Descarga plantilla CSV */
router.get("/plantilla-importacion", requireRoles(...ROLES_PUEDEN_GESTIONAR), (req, res) => {
  const headers = [
    "nombre", "apellido", "email", "password", "sexo", "edad",
    "telefono", "rol", "tipo", "sucursalId", "puestoId",
    "horarioId", "grupoId", "departamento", "area",
  ];
  const ejemplo = [
    "Juan", "Pérez", "juan.perez@empresa.com", "Password123!", "M", "30",
    "5512345678", "medico_titular", "sucursal", "", "", "", "", "Operaciones", "Médica",
  ];
  const csvContent = [headers.join(","), ejemplo.join(",")].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=plantilla_empleados.csv");
  return res.send("\uFEFF" + csvContent); // BOM para Excel
});

/** POST /api/usuarios/importar — Importación masiva desde CSV */
router.post("/importar", requireRoles(...ROLES_PUEDEN_GESTIONAR), uploadCsv.single("archivo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Se requiere un archivo CSV" });

  const lineas = req.file.buffer.toString("utf-8")
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\uFEFF/, "").trim())
    .filter((l) => l.length > 0);

  if (lineas.length < 2) {
    return res.status(400).json({ error: "El archivo CSV debe tener encabezado y al menos una fila de datos" });
  }

  const encabezados = lineas[0].split(",").map((h) => h.trim());
  const requeridos = ["nombre", "email", "password", "sexo", "edad"];
  for (const campo of requeridos) {
    if (!encabezados.includes(campo)) {
      return res.status(400).json({ error: `Columna requerida ausente: ${campo}` });
    }
  }

  const importados = [];
  const errores = [];

  for (let i = 1; i < lineas.length; i++) {
    const valores = lineas[i].split(",").map((v) => v.trim());
    const fila = {};
    encabezados.forEach((h, idx) => { fila[h] = valores[idx] || ""; });

    const numFila = i + 1;
    try {
      const { nombre, apellido, email, password, sexo, edad, telefono, rol, tipo,
              sucursalId, puestoId, horarioId, grupoId, departamento, area } = fila;

      if (!nombre) throw new Error("nombre es obligatorio");
      if (!email)  throw new Error("email es obligatorio");
      if (!password) throw new Error("password es obligatorio");
      if (!sexo)   throw new Error("sexo es obligatorio");
      if (!edad)   throw new Error("edad es obligatorio");

      if (store.getUsuarioByEmail(email)) throw new Error("El email ya está registrado");

      const tipoEmpleado = tipo || "sucursal";
      const esCorporativo = tipoEmpleado === "corporativo";
      if (!esCorporativo && sucursalId && !store.getSucursalById(sucursalId)) {
        throw new Error(`Sucursal '${sucursalId}' no encontrada`);
      }
      if (puestoId && !store.getPuestoById(puestoId)) throw new Error(`Puesto '${puestoId}' no encontrado`);

      const hashedPassword = await hashPassword(password);
      const nuevo = store.createUsuario({
        nombre, apellido: apellido || "", email, password: hashedPassword,
        sexo, edad: parseInt(edad, 10) || 0,
        telefono: telefono || null,
        rol: rol || "medico_titular",
        tipo: tipoEmpleado,
        sucursalId: esCorporativo ? null : (sucursalId || null),
        puestoId: puestoId || null,
        horarioId: horarioId || null,
        grupoId: grupoId || null,
        departamento: departamento || null,
        area: area || null,
      });
      importados.push({ fila: numFila, email, id: nuevo.id });
    } catch (err) {
      errores.push({ fila: numFila, email: fila.email || "?", error: err.message });
    }
  }

  return res.status(200).json({
    importados: importados.length,
    errores: errores.length,
    detalle: { importados, errores },
  });
});

/** GET /api/usuarios/verificar-email?email=xxx&excluirId=yyy
 *  Verifica en tiempo real si un email ya está en uso.
 *  excluirId: ID del usuario que se está editando (para no marcarlo como duplicado).
 */
router.get("/verificar-email", requireRoles(...ROLES_PUEDEN_VER), (req, res) => {
  const { email, excluirId } = req.query;
  if (!email) return res.json({ disponible: true });
  const existe = store.getUsuarios({}).find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== excluirId
  );
  return res.json({ disponible: !existe });
});

router.get("/", requireRoles(...ROLES_PUEDEN_VER), (req, res) => {
  const filtros = {};
  const allowedSucursalIds = getAllowedSucursalIds(req.user, store);
  if (req.query.sucursalId) filtros.sucursalId = req.query.sucursalId;
  if (req.query.rol) filtros.rol = req.query.rol;
  if (req.query.grupoId) filtros.grupoId = req.query.grupoId;
  if (req.query.tipo && ["corporativo", "sucursal"].includes(req.query.tipo)) {
    filtros.tipo = req.query.tipo;
  }
  if (allowedSucursalIds !== null && filtros.sucursalId && !allowedSucursalIds.includes(filtros.sucursalId)) {
    return res.status(403).json({ error: "No tienes acceso a la sucursal solicitada" });
  }

  let lista = store.getUsuarios(filtros);
  if (allowedSucursalIds !== null) {
    const permitidas = new Set(allowedSucursalIds);
    lista = lista.filter((usuario) => usuario.sucursalId && permitidas.has(usuario.sucursalId));
  }

  // ── Búsqueda por texto (nombre, apellido, email, puesto) ──────────────
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    lista = lista.filter((u) =>
      `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(q)
    );
  }

  // ── Filtro activo/inactivo ────────────────────────────────────────────
  if (req.query.activo !== undefined) {
    const activo = req.query.activo !== "false";
    lista = lista.filter((u) => u.activo === activo);
  }

  const enriquecida = lista.map((u) => {
    const puesto  = u.puestoId    ? store.getPuestoById(u.puestoId)       : null;
    const horario = u.horarioId   ? store.getHorarioById(u.horarioId)     : null;
    const jefe    = u.jefeInmediatoId ? store.getUsuarioById(u.jefeInmediatoId) : null;
    return {
      ...u,
      puestoNombre:       puesto?.nombre  || "N/A",
      horarioNombre:      horario?.nombre || "Sin horario",
      jefeInmediatoNombre: jefe ? `${jefe.nombre} ${jefe.apellido}` : null,
    };
  });

  // ── Paginación server-side (opcional) ────────────────────────────────
  // Si se pasa ?page y ?limit, devuelve sólo esa página junto con metadatos.
  // Sin esos parámetros devuelve toda la lista (retrocompatible).
  const page  = parseInt(req.query.page,  10);
  const limit = parseInt(req.query.limit, 10);

  if (!isNaN(page) && !isNaN(limit) && limit > 0) {
    const total   = enriquecida.length;
    const pages   = Math.ceil(total / limit);
    const offset  = (page - 1) * limit;
    const datos   = enriquecida.slice(offset, offset + limit);
    return res.json({ data: datos, total, page, pages, limit });
  }

  return res.json(enriquecida);
});

router.get("/puestos", (req, res) => res.json(store.getPuestos()));

router.get("/:id", (req, res) => {
  const usuario = store.getUsuarioById(req.params.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!canAccessUsuario(req.user, usuario, store)) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  const { password, ...datos } = usuario;
  const puesto = datos.puestoId ? store.getPuestoById(datos.puestoId) : null;
  return res.json({ ...datos, puestoNombre: puesto?.nombre || "N/A" });
});

router.post("/", requireRoles(...ROLES_PUEDEN_GESTIONAR), async (req, res) => {
  const { nombre, apellido, email, password, sexo, edad, puestoId, sucursalId, rol, horarioId, grupoId, tipo, departamento, datosExtra, jefeInmediatoId, area, fechaNacimiento, fechaInicioActividades, usaHorarioPuesto, configDiasHorario } = req.body;
  const tipoEmpleado = tipo || "sucursal";
  const esCorporativo = tipoEmpleado === "corporativo";
  if (!nombre || !email || !password || !sexo || !edad)
    return res.status(400).json({ error: "nombre, email, password, sexo y edad son obligatorios" });
  const pwError = validarPassword(password);
  if (pwError) return res.status(400).json({ error: pwError, campo: "password" });
  if (!esCorporativo && !sucursalId)
    return res.status(400).json({ error: "sucursalId es obligatorio para empleados de sucursal" });
  if (req.user.rol === ROLES.AGENTE_SOPORTE_TI && rol && rol !== ROLES.MEDICO_TITULAR)
    return res.status(403).json({ error: "Solo puedes registrar médicos titulares" });
  if (store.getUsuarioByEmail(email)) return res.status(409).json({ error: "El email ya está registrado" });
  if (!esCorporativo && sucursalId && !store.getSucursalById(sucursalId))
    return res.status(400).json({ error: "La sucursal especificada no existe" });
  if (puestoId && !store.getPuestoById(puestoId)) return res.status(400).json({ error: "El puesto no existe" });
  const hashedPassword = await hashPassword(password);
  let horarioFinal = horarioId || null;
  // Herencia de horario desde el puesto si el usuario no trae uno explícito
  if (!horarioFinal && puestoId) {
    const puesto = store.getPuestoById(puestoId);
    if (puesto?.horarioId) horarioFinal = puesto.horarioId;
  }

  // Empleados corporativos pueden tener sucursal si es de tipo corporativo
  const sucursalFinal = (() => {
    if (!sucursalId) return null;
    const suc = store.getSucursalById(sucursalId);
    if (!suc) return null;
    // Si el tipo del empleado es corporativo, solo aceptar sucursal corporativa
    if (esCorporativo && suc.tipo !== "corporativo") return null;
    return sucursalId;
  })();

  const nuevo = store.createUsuario({
    nombre, apellido: apellido || "", email, password: hashedPassword, sexo,
    edad: parseInt(edad, 10), puestoId: puestoId || null,
    sucursalId: sucursalFinal,
    rol: rol || "medico_titular", horarioId: horarioFinal, grupoId: grupoId || null,
    tipo: tipoEmpleado,
    ...(departamento !== undefined && { departamento }),
    ...(datosExtra !== undefined && { datosExtra }),
    ...(jefeInmediatoId !== undefined && { jefeInmediatoId: jefeInmediatoId || null }),
    ...(area !== undefined && { area: area || null }),
    ...(fechaNacimiento !== undefined && { fechaNacimiento: fechaNacimiento || null }),
    ...(fechaInicioActividades !== undefined && { fechaInicioActividades: fechaInicioActividades || null }),
    usaHorarioPuesto: !!(usaHorarioPuesto === true || usaHorarioPuesto === "true" || usaHorarioPuesto === 1),
    ...(configDiasHorario !== undefined && { configDiasHorario: Array.isArray(configDiasHorario) ? configDiasHorario : null }),
  });
  return res.status(201).json(nuevo);
});

router.put("/:id", async (req, res) => {
  const puedeGestionar = ROLES_PUEDEN_GESTIONAR.includes(req.user.rol); // super_admin | agente_soporte_ti
  const esPropioUsuario = req.user.id === req.params.id;
  if (!puedeGestionar && !esPropioUsuario) return res.status(403).json({ error: "Sin permiso" });
  let camposPermitidos = {};
  if (puedeGestionar) {
    const { nombre, apellido, email, sexo, edad, puestoId, sucursalId, rol, horarioId, grupoId, activo, tipo, departamento, datosExtra, jefeInmediatoId, area, fechaNacimiento, fechaInicioActividades, usaHorarioPuesto, configDiasHorario } = req.body;
    if (email !== undefined) {
      const existing = store.getUsuarioByEmail(email);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ error: "El email ya esta en uso" });
      }
    }
    camposPermitidos = {
      ...(nombre !== undefined && { nombre }), ...(apellido !== undefined && { apellido }),
      ...(email !== undefined && { email }),
      ...(sexo !== undefined && { sexo }), ...(edad !== undefined && { edad: parseInt(edad, 10) }),
      ...(puestoId !== undefined && { puestoId }), ...(sucursalId !== undefined && { sucursalId: sucursalId || null }),
      ...(horarioId !== undefined && { horarioId }), ...(grupoId !== undefined && { grupoId }),
      ...(activo !== undefined && req.user.rol === ROLES.SUPER_ADMIN && { activo }),
      ...(tipo !== undefined && { tipo }),
      ...(departamento !== undefined && { departamento }),
      ...(datosExtra !== undefined && { datosExtra }),
      ...(jefeInmediatoId !== undefined && { jefeInmediatoId: jefeInmediatoId || null }),
      ...(area !== undefined && { area: area || null }),
      ...(fechaNacimiento !== undefined && { fechaNacimiento: fechaNacimiento || null }),
      ...(fechaInicioActividades !== undefined && { fechaInicioActividades: fechaInicioActividades || null }),
      ...(usaHorarioPuesto !== undefined && { usaHorarioPuesto: !!(usaHorarioPuesto === true || usaHorarioPuesto === "true" || usaHorarioPuesto === 1) }),
      ...(configDiasHorario !== undefined && { configDiasHorario: Array.isArray(configDiasHorario) ? configDiasHorario : null }),
      ...(req.body.evaluacionesHabilitadas !== undefined && { evaluacionesHabilitadas: req.body.evaluacionesHabilitadas === true || req.body.evaluacionesHabilitadas === "true" }),
    };
    if (rol !== undefined && req.user.rol === ROLES.SUPER_ADMIN) camposPermitidos.rol = rol;
  }
  // Permitir al propio usuario actualizar sus datos de perfil
  if (esPropioUsuario && !puedeGestionar) {
    const { nombre, apellido, telefono } = req.body;
    if (nombre     !== undefined) camposPermitidos.nombre     = nombre;
    if (apellido   !== undefined) camposPermitidos.apellido   = apellido;
    if (telefono   !== undefined) camposPermitidos.telefono   = telefono;
    // email update: check uniqueness
    if (req.body.email !== undefined) {
      const existing = store.getUsuarioByEmail(req.body.email);
      if (existing && existing.id !== req.params.id)
        return res.status(409).json({ error: "El email ya está en uso" });
      camposPermitidos.email = req.body.email;
    }
  }
  const cambioPassword = !!req.body.password;
  if (cambioPassword) {
    const pwError = validarPassword(req.body.password);
    if (pwError) return res.status(400).json({ error: pwError, campo: "password" });
    camposPermitidos.password = await hashPassword(req.body.password);
  }
  if (Object.keys(camposPermitidos).length === 0) return res.status(400).json({ error: "No hay campos para actualizar" });
  const actualizado = store.updateUsuario(req.params.id, camposPermitidos);
  if (!actualizado) return res.status(404).json({ error: "Usuario no encontrado" });

  // Notificar a supervisores/admins cuando cambia la contraseña de un usuario
  if (cambioPassword) {
    const usuarioActualizado = store.getUsuarioById(req.params.id);
    const admins = store.getUsuarios({ activo: true }).filter((u) => ROLES_RECIBEN_CAMBIO_PASSWORD.includes(u.rol));
    admins.forEach((admin) => {
      if (admin.id !== req.params.id) {
        notifService.crearNotificacion({
          paraUsuarioId: admin.id,
          deUsuarioId: req.user.id,
          tipo: "alerta",
          titulo: "Cambio de contraseña",
          mensaje: `El usuario ${usuarioActualizado?.nombre || ""} ${usuarioActualizado?.apellido || ""} (${usuarioActualizado?.email || ""}) cambió su contraseña.`,
          referenciaId: req.params.id,
        });
      }
    });
  }

  return res.json(actualizado);
});

router.delete("/:id", requireRoles(...ROLES_PUEDEN_ELIMINAR), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
  }
  const ok = store.deleteUsuario(req.params.id);
  if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ mensaje: "Empleado eliminado correctamente" });
});

/**
 * DELETE /api/usuarios/:id/2fa
 * Restablece el segundo factor de autenticación de un usuario.
 * Solo accesible para super_admin, administrador_general y agente_soporte_ti.
 */
router.delete("/:id/2fa", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI), (req, res) => {
  const objetivo = store.getUsuarioById(req.params.id);
  if (!objetivo) return res.status(404).json({ error: "Usuario no encontrado" });

  store.updateUsuario(req.params.id, {
    totpHabilitado: false,
    totpSecret: null,
  });

  // Notificar al usuario afectado
  notifService.crearNotificacion({
    paraUsuarioId: req.params.id,
    deUsuarioId: req.user.id,
    tipo: "alerta",
    titulo: "Tu 2FA fue restablecido",
    mensaje: `Un administrador restableció tu segundo factor de autenticación. Vuelve a configurarlo en tu perfil.`,
    referenciaId: req.params.id,
  });

  return res.json({
    ok: true,
    mensaje: `2FA de ${objetivo.nombre} ${objetivo.apellido} restablecido correctamente.`,
  });
});

/**
 * PUT /api/usuarios/:id/foto
 * Sube o reemplaza la foto de perfil de un empleado.
 * Solo el propio usuario o un gestor puede cambiarla.
 */
router.put("/:id/foto", uploadFoto.single("foto"), async (req, res) => {
  try {
    const puedeGestionar = ROLES_PUEDEN_VER.includes(req.user.rol);
    const esPropioUsuario = req.user.id === req.params.id;
    if (!puedeGestionar && !esPropioUsuario)
      return res.status(403).json({ error: "Sin permiso" });
    if (!req.file)
      return res.status(400).json({ error: "No se recibió ninguna imagen" });

    const guardado = await saveFile(req.file);
    const actualizado = store.updateUsuario(req.params.id, { fotoUrl: guardado.url });
    if (!actualizado) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ fotoUrl: guardado.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
