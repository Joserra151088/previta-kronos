const DEFAULT_MODULES_BY_ROLE = {
  // Acceso completo a TODO, incluyendo gestión de licencias
  administrador_general: [
    "dashboard", "eventos", "incidencias", "reportes", "sucursales", "empleados",
    "grupos", "mapa", "administracion", "auditoria", "logs", "notificaciones",
    "vacaciones", "incapacidades", "calendario", "organigrama", "horarios", "licencias",
    "desarrollo_organizacional",
  ],
  super_admin: [
    "dashboard", "eventos", "incidencias", "reportes", "sucursales", "empleados",
    "grupos", "mapa", "administracion", "auditoria", "logs", "notificaciones",
    "vacaciones", "incapacidades", "calendario", "organigrama", "horarios", "licencias",
    "desarrollo_organizacional",
  ],
  agente_soporte_ti: [
    "dashboard", "eventos", "incidencias", "reportes", "sucursales", "empleados",
    "grupos", "mapa", "administracion", "logs", "notificaciones",
    "vacaciones", "incapacidades", "calendario", "organigrama", "horarios",
  ],
  supervisor_sucursales: [
    "dashboard", "eventos", "incidencias", "reportes", "empleados",
    "grupos", "mapa", "notificaciones", "vacaciones", "incapacidades", "calendario", "organigrama",
  ],
  agente_control_asistencia: [
    "dashboard", "eventos", "incidencias", "reportes", "mapa",
    "notificaciones", "vacaciones", "incapacidades", "calendario",
  ],
  nominas: [
    "dashboard", "incidencias", "empleados", "reportes",
    "notificaciones", "vacaciones", "incapacidades", "horarios",
  ],
  visor_reportes: ["dashboard", "reportes", "mapa", "notificaciones"],
  medico_titular:   ["dashboard", "incidencias", "notificaciones"],
  medico_de_guardia: ["dashboard", "incidencias", "notificaciones"],
  desarrollo_organizacional: ["dashboard", "desarrollo_organizacional", "notificaciones"],
};

export const getModulesForUser = (usuario) => {
  if (!usuario) return [];
  const roleDefaults = DEFAULT_MODULES_BY_ROLE[usuario.rol] || [];
  // Merge token modules with role defaults so role-based access is always complete
  // even when the JWT doesn't carry a modulos array
  if (Array.isArray(usuario.modulos) && usuario.modulos.length > 0) {
    return [...new Set([...usuario.modulos, ...roleDefaults])];
  }
  return roleDefaults;
};

export const hasModuleAccess = (usuario, moduleKey) => {
  if (!moduleKey) return true;
  return getModulesForUser(usuario).includes(moduleKey);
};
