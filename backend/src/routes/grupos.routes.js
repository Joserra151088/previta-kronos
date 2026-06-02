/**
 * grupos.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Grupos de SUCURSALES asignados a un supervisor_sucursales.
 * Un grupo agrupa varias sucursales y le otorga a su supervisor visibilidad
 * sobre todas las incidencias y asistencias de esas sucursales.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require("express");
const router = express.Router();
const store = require("../data/store");
const { verificarToken } = require("../middleware/auth");
const { requireRoles, ROLES } = require("../middleware/roles");

router.use(verificarToken);

/** GET /api/grupos — Lista grupos (supervisor ve solo los suyos) */
router.get("/", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.SUPERVISOR_SUCURSALES), (req, res) => {
  const filtros = {};
  if (req.user.rol === ROLES.SUPERVISOR_SUCURSALES) filtros.supervisorId = req.user.id;

  const resultado = store.getGrupos(filtros).map((g) => {
    const supervisor = store.getUsuarioById(g.supervisorId);
    const sucursalIds = Array.isArray(g.sucursalIds) ? g.sucursalIds : [];
    const sucursales = sucursalIds
      .map((sid) => store.getSucursalById(sid))
      .filter(Boolean);
    return {
      ...g,
      supervisorNombre: supervisor ? `${supervisor.nombre} ${supervisor.apellido}` : "N/A",
      totalSucursales: sucursales.length,
      sucursalesNombres: sucursales.map((s) => s.nombre),
    };
  });
  return res.json(resultado);
});

/** GET /api/grupos/:id — Detalle de grupo con sucursales */
router.get("/:id", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.SUPERVISOR_SUCURSALES), (req, res) => {
  const grupo = store.getGrupoById(req.params.id);
  if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });
  if (req.user.rol === ROLES.SUPERVISOR_SUCURSALES && grupo.supervisorId !== req.user.id) {
    return res.status(403).json({ error: "No tienes acceso a este grupo" });
  }
  const sucursalIds = Array.isArray(grupo.sucursalIds) ? grupo.sucursalIds : [];
  const sucursalesDetalle = sucursalIds
    .map((sid) => store.getSucursalById(sid))
    .filter(Boolean)
    .map((s) => ({ id: s.id, nombre: s.nombre, ciudad: s.ciudad, activa: s.activa }));

  return res.json({ ...grupo, sucursalesDetalle });
});

/** POST /api/grupos — Crear grupo (super_admin) */
router.post("/", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN), (req, res) => {
  const { nombre, supervisorId, sucursalIds } = req.body;
  if (!nombre || !supervisorId) {
    return res.status(400).json({ error: "nombre y supervisorId son obligatorios" });
  }
  const supervisor = store.getUsuarioById(supervisorId);
  if (!supervisor || supervisor.rol !== ROLES.SUPERVISOR_SUCURSALES) {
    return res.status(400).json({ error: "El usuario especificado no es un supervisor válido" });
  }
  const nuevo = store.createGrupo({
    nombre,
    supervisorId,
    sucursalIds: Array.isArray(sucursalIds) ? sucursalIds : [],
  });
  return res.status(201).json(nuevo);
});

/** PUT /api/grupos/:id — Actualizar nombre / supervisor */
router.put("/:id", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR_SUCURSALES), (req, res) => {
  const grupo = store.getGrupoById(req.params.id);
  if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });
  if (req.user.rol === ROLES.SUPERVISOR_SUCURSALES && grupo.supervisorId !== req.user.id) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  const { nombre, supervisorId } = req.body;
  const actualizado = store.updateGrupo(req.params.id, {
    ...(nombre !== undefined && { nombre }),
    ...(supervisorId !== undefined && req.user.rol === ROLES.SUPER_ADMIN && { supervisorId }),
  });
  return res.json(actualizado);
});

/** PUT /api/grupos/:id/sucursales — Reemplaza la lista de sucursales del grupo */
router.put("/:id/sucursales", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR_SUCURSALES), (req, res) => {
  const grupo = store.getGrupoById(req.params.id);
  if (!grupo) return res.status(404).json({ error: "Grupo no encontrado" });
  if (req.user.rol === ROLES.SUPERVISOR_SUCURSALES && grupo.supervisorId !== req.user.id) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  const { sucursalIds } = req.body;
  if (!Array.isArray(sucursalIds)) {
    return res.status(400).json({ error: "sucursalIds debe ser un arreglo de IDs" });
  }
  // Validar que todas las sucursales existan
  const invalidas = sucursalIds.filter((sid) => !store.getSucursalById(sid));
  if (invalidas.length > 0) {
    return res.status(400).json({ error: `Sucursales no encontradas: ${invalidas.join(", ")}` });
  }
  const actualizado = store.updateGrupo(req.params.id, { sucursalIds });
  return res.json(actualizado);
});

/** DELETE /api/grupos/:id — Desactivar grupo (super_admin, agente_soporte_ti) */
router.delete("/:id", requireRoles(ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI), (req, res) => {
  // Validar que no haya usuarios asignados a este grupo
  const usuariosAsignados = store.getUsuarios({ grupoId: req.params.id, activo: true });
  if (usuariosAsignados.length > 0) {
    return res.status(409).json({
      error: `No se puede eliminar: hay ${usuariosAsignados.length} empleado(s) asignado(s) a este grupo.`,
    });
  }
  const ok = store.deleteGrupo(req.params.id);
  if (!ok) return res.status(404).json({ error: "Grupo no encontrado" });
  return res.json({ mensaje: "Grupo desactivado" });
});

module.exports = router;
