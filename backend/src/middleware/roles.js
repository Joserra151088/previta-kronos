/**
 * roles.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Constantes de roles del sistema y middleware de autorización por rol.
 * Usar ROLES.* en lugar de strings literales evita errores de tipeo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ROLES = {
  ADMINISTRADOR_GENERAL: "administrador_general", // Acceso total, gestiona licencias
  SUPER_ADMIN: "super_admin",
  AGENTE_SOPORTE_TI: "agente_soporte_ti",
  SUPERVISOR_SUCURSALES: "supervisor_sucursales",
  AGENTE_CONTROL_ASISTENCIA: "agente_control_asistencia",
  VISOR_REPORTES: "visor_reportes",
  MEDICO_TITULAR: "medico_titular",
  MEDICO_DE_GUARDIA: "medico_de_guardia",
  NOMINAS: "nominas",
  DESARROLLO_ORGANIZACIONAL: "desarrollo_organizacional",
};

/** Todos los roles con acceso completo a la app (excepto solo-reportes y médicos) */
const ROLES_ADMIN = [ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI];

/** Roles que pueden gestionar empleados y grupos */
const ROLES_GESTION = [ROLES.ADMINISTRADOR_GENERAL, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.SUPERVISOR_SUCURSALES, ROLES.NOMINAS];

/** Roles con acceso a reportes */
const ROLES_REPORTES = [
  ROLES.ADMINISTRADOR_GENERAL,
  ROLES.SUPER_ADMIN,
  ROLES.SUPERVISOR_SUCURSALES,
  ROLES.AGENTE_CONTROL_ASISTENCIA,
  ROLES.VISOR_REPORTES,
];

/** Roles que pueden enviar notificaciones */
const ROLES_NOTIFICACIONES = [
  ROLES.ADMINISTRADOR_GENERAL,
  ROLES.SUPER_ADMIN,
  ROLES.AGENTE_SOPORTE_TI,
  ROLES.SUPERVISOR_SUCURSALES,
  ROLES.AGENTE_CONTROL_ASISTENCIA,
];

/** Roles de empleados médicos */
const ROLES_MEDICOS = [ROLES.MEDICO_TITULAR, ROLES.MEDICO_DE_GUARDIA];

/** Todos los roles del sistema */
const TODOS_LOS_ROLES = Object.values(ROLES);

/**
 * requireRoles
 * Factory de middleware de autorización.
 * Genera un middleware que permite el acceso solo a los roles especificados.
 * Debe usarse DESPUÉS de verificarToken.
 *
 * @param {...string} roles - Roles permitidos
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post("/", verificarToken, requireRoles(ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI), handler)
 */
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.rol)) {
    return res.status(403).json({
      error: "Acceso denegado. No tienes permisos para esta acción.",
      rolesRequeridos: roles,
      tuRol: req.user?.rol || "no autenticado",
    });
  }
  next();
};

module.exports = {
  ROLES,
  ROLES_ADMIN,
  ROLES_GESTION,
  ROLES_REPORTES,
  ROLES_NOTIFICACIONES,
  ROLES_MEDICOS,
  TODOS_LOS_ROLES,
  requireRoles,
};
