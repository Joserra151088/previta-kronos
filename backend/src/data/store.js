/**
 * store.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Almacén de datos en memoria.
 * Para migrar a SQL: reemplazar las funciones de cada colección por llamadas ORM.
 * Los controladores (routes) no necesitan cambios al migrar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { v4: uuidv4 } = require("uuid");
const { pool, DB_ENABLED, testConnection, getExistingTables } = require("../config/db");

// ─── Tipos de registro de acceso ──────────────────────────────────────────────
const TIPOS_REGISTRO = {
  ENTRADA: "entrada",
  SALIDA_ALIMENTOS: "salida_alimentos",
  REGRESO_ALIMENTOS: "regreso_alimentos",
  SALIDA: "salida",
};

const newId = () => uuidv4();

const databaseState = {
  enabled: DB_ENABLED,
  connected: false,
  database: process.env.DB_NAME || "kronos",
  tables: new Set(),
  lastSyncAt: null,
  lastError: null,
};

let persistenceQueue = Promise.resolve();
let syncScheduled = false;
let writeActive = false;
let refreshInProgress = null;
let lastRefreshAt = 0;
const REFRESH_TTL_MS = 3000;

const toBool = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  return Number(value) === 1;
};

const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toIsoString = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === "string") {
    if (value.includes("T")) return value;
    if (value.includes(" ")) return value.replace(" ", "T");
    return `${value}T00:00:00.000Z`;
  }
  try {
    return new Date(value).toISOString();
  } catch {
    return fallback;
  }
};

const toMySqlDateTime = (value, fallback = null) => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const hasTable = (tableName) => databaseState.tables.has(tableName);

const trackDatabaseError = (error) => {
  databaseState.lastError = error?.message || String(error);
  databaseState.connected = false;
  console.error("[store] Error de sincronizacion MySQL:", databaseState.lastError);
};

const scheduleDatabaseSync = () => {
  if (!databaseState.connected || syncScheduled) return;
  syncScheduled = true;
  persistenceQueue = persistenceQueue
    .then(async () => {
      syncScheduled = false;
      writeActive = true;
      try {
        await persistDatabaseSnapshot();
        databaseState.lastSyncAt = new Date().toISOString();
      } finally {
        writeActive = false;
      }
    })
    .catch((error) => {
      syncScheduled = false;
      writeActive = false;
      trackDatabaseError(error);
    });
};

const refreshFromDatabaseIfNeeded = async (force = false) => {
  if (!databaseState.connected || !pool) return false;
  if (syncScheduled || writeActive) return false;

  const now = Date.now();
  if (!force && now - lastRefreshAt < REFRESH_TTL_MS) return false;
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      databaseState.tables = await getExistingTables();
      await loadDatabaseSnapshot();
      lastRefreshAt = Date.now();
      databaseState.lastError = null;
      return true;
    } catch (error) {
      trackDatabaseError(error);
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
};

// ─── Áreas (catálogo organizacional) ──────────────────────────────────────────
let areas = [
  { id: newId(), nombre: "Recursos Humanos",  descripcion: "Gestión de personal y nóminas", activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Tecnología",        descripcion: "Soporte TI y desarrollo de sistemas", activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Operaciones",       descripcion: "Operaciones y logística", activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Administración",    descripcion: "Administración general y finanzas", activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Ventas",            descripcion: "Área comercial y ventas", activo: true, creadoEn: new Date().toISOString() },
];

// ─── Puestos (catálogo dinámico) ──────────────────────────────────────────────
// horarioId: horario por defecto que se hereda al crear un usuario con este puesto
let puestos = [
  { id: newId(), nombre: "Gerente de Sucursal",  descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Subgerente",            descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Cajero",                descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Vendedor",              descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Almacenista",           descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Seguridad",             descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Limpieza",              descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Recursos Humanos",      descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Médico Titular",        descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Médico de Guardia",     descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Soporte TI",            descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Otro",                  descripcion: "", horarioId: null, activo: true, camposExtra: [], creadoEn: new Date().toISOString() },
];

// Backwards-compat: array de nombres para código antiguo
const PUESTOS = puestos.map((p) => p.nombre);
const refreshLegacyPuestos = () => {
  PUESTOS.splice(0, PUESTOS.length, ...puestos.map((puesto) => puesto.nombre));
};

// ─── Horarios ─────────────────────────────────────────────────────────────────
let horarios = [
  {
    id: newId(),
    nombre: "Turno Matutino",
    horaEntrada: "08:00",
    horaSalidaAlimentos: "14:00",   // Hora en que sale a comer
    horaRegresoAlimentos: "15:00",  // Hora en que regresa de comer
    horaSalida: "17:00",
    diasLaborales: [1, 2, 3, 4, 5], // Lunes-Viernes
    toleranciaMinutos: 10,
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Turno Vespertino",
    horaEntrada: "14:00",
    horaSalidaAlimentos: "19:00",
    horaRegresoAlimentos: "20:00",
    horaSalida: "22:00",
    diasLaborales: [1, 2, 3, 4, 5],
    toleranciaMinutos: 10,
    activo: true,
    creadoEn: new Date().toISOString(),
  },
];

// ─── Sucursales ───────────────────────────────────────────────────────────────
let sucursales = [
  {
    id: newId(),
    nombre: "Sucursal Centro",
    direccion: "Av. Juárez 100, Col. Centro",
    ciudad: "Ciudad de México",
    estado: "CDMX",
    tipo: "sucursal",
    activa: true,
    geocerca: { latitud: 19.4326, longitud: -99.1332, radio: 200 },
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Sucursal Norte",
    direccion: "Blvd. Manuel Ávila Camacho 200",
    ciudad: "Ciudad de México",
    estado: "CDMX",
    tipo: "sucursal",
    activa: true,
    geocerca: { latitud: 19.4794, longitud: -99.2067, radio: 150 },
    creadoEn: new Date().toISOString(),
  },
];

// ─── Usuarios ─────────────────────────────────────────────────────────────────
let usuarios = [
  {
    id: newId(),
    nombre: "Ana",
    apellido: "García López",
    email: "ana.garcia@empresa.com",
    password: "123456",
    sexo: "femenino",
    edad: 28,
    puestoId: puestos[0].id,
    sucursalId: sucursales[0].id,
    rol: "super_admin",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "sucursal",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Carlos",
    apellido: "Mendoza Ruiz",
    email: "carlos.mendoza@empresa.com",
    password: "123456",
    sexo: "masculino",
    edad: 35,
    puestoId: puestos[2].id,
    sucursalId: sucursales[0].id,
    rol: "supervisor_sucursales",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "sucursal",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Sofía",
    apellido: "Torres Vega",
    email: "sofia.torres@empresa.com",
    password: "123456",
    sexo: "femenino",
    edad: 24,
    puestoId: puestos[3].id,
    sucursalId: sucursales[1].id,
    rol: "medico_titular",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "sucursal",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Luis",
    apellido: "Ramírez Torres",
    email: "luis.ramirez@empresa.com",
    password: "123456",
    sexo: "masculino",
    edad: 30,
    puestoId: puestos[10].id,
    sucursalId: sucursales[0].id,
    rol: "agente_soporte_ti",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "sucursal",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "María",
    apellido: "López Sánchez",
    email: "maria.lopez@empresa.com",
    password: "123456",
    sexo: "femenino",
    edad: 27,
    puestoId: puestos[9].id,
    sucursalId: null, // medico_de_guardia no tiene sucursal fija
    rol: "medico_de_guardia",
    grupoId: null,
    horarioId: null,
    tipo: "corporativo",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Roberto",
    apellido: "Fuentes García",
    email: "roberto.fuentes@empresa.com",
    password: "123456",
    sexo: "masculino",
    edad: 33,
    puestoId: puestos[7].id,
    sucursalId: sucursales[0].id,
    rol: "agente_control_asistencia",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "sucursal",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  {
    id: newId(),
    nombre: "Patricia",
    apellido: "Morales Cruz",
    email: "patricia.morales@empresa.com",
    password: "123456",
    sexo: "femenino",
    edad: 31,
    puestoId: puestos[7].id,
    sucursalId: sucursales[0].id,
    rol: "visor_reportes",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "sucursal",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  // ── Desarrollo Organizacional ─────────────────────────────────────────────
  {
    id: newId(),
    nombre: "Valeria",
    apellido: "Herrera Díaz",
    email: "valeria.herrera@empresa.com",
    password: "123456",
    sexo: "femenino",
    edad: 32,
    puestoId: puestos[0].id,
    sucursalId: sucursales[0].id,
    rol: "desarrollo_organizacional",
    grupoId: null,
    horarioId: horarios[0].id,
    tipo: "corporativo",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
  // ── Administrador General del sistema ─────────────────────────────────────
  {
    id: "jose-ramon-estrada-0000-administrador",
    nombre: "José Ramón",
    apellido: "Estrada Rendón",
    email: "jose.estrada@previta.com.mx",
    password: "Previta2026",
    sexo: "masculino",
    edad: null,
    puestoId: null,
    sucursalId: null,
    rol: "administrador_general",
    grupoId: null,
    horarioId: null,
    tipo: "corporativo",
    activo: true,
    creadoEn: new Date().toISOString(),
  },
];

// ─── Grupos ───────────────────────────────────────────────────────────────────
let grupos = [];

// ─── Tipos de Incidencia ──────────────────────────────────────────────────────
// IDs fijos para tipos clave (deben coincidir con migration 003 seed)
const ID_TIPO_VACACIONES      = "vac-0000-0000-0000-000000000001";
const ID_TIPO_INCAPACIDAD     = "inc-0000-0000-0000-000000000001";
const ID_TIPO_INCAP_MAT       = "inc-0000-0000-0000-000000000002";

let tiposIncidencia = [
  // Tipos con categoriaBloqueo (bloquean el registro de asistencia cuando están aprobados)
  { id: ID_TIPO_VACACIONES,  nombre: "Vacaciones",                  descripcion: "Período vacacional conforme a la Ley Federal del Trabajo. Solo disponible con 1+ año de antigüedad.", requiereArchivo: false, categoriaBloqueo: "vacaciones",  activo: true, creadoEn: new Date().toISOString() },
  { id: ID_TIPO_INCAPACIDAD, nombre: "Incapacidad Médica",          descripcion: "Ausencia por incapacidad médica con constancia del IMSS o médico particular.",                        requiereArchivo: true,  categoriaBloqueo: "incapacidad",  activo: true, creadoEn: new Date().toISOString() },
  { id: ID_TIPO_INCAP_MAT,   nombre: "Incapacidad Maternidad/Paternidad", descripcion: "Licencia de maternidad (84 días) o paternidad (5 días) conforme a la ley.",                    requiereArchivo: true,  categoriaBloqueo: "incapacidad",  activo: true, creadoEn: new Date().toISOString() },
  // Tipos sin bloqueo
  { id: newId(), nombre: "Enfermedad",                descripcion: "Baja por enfermedad con o sin certificado médico", requiereArchivo: true,  categoriaBloqueo: null, activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Permiso Personal",          descripcion: "Ausencia justificada por motivos personales",       requiereArchivo: false, categoriaBloqueo: null, activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Ausencia Sin Goce de Sueldo", descripcion: "Falta injustificada sin pago",                   requiereArchivo: false, categoriaBloqueo: null, activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Duelo",                     descripcion: "Permiso por fallecimiento de familiar",             requiereArchivo: false, categoriaBloqueo: null, activo: true, creadoEn: new Date().toISOString() },
  { id: newId(), nombre: "Retardo Justificado",       descripcion: "Llegada tarde con justificación",                  requiereArchivo: false, categoriaBloqueo: null, activo: true, creadoEn: new Date().toISOString() },
];

// ─── Incidencias ──────────────────────────────────────────────────────────────
let incidencias = [];

// ─── Anuncios del panel lateral ────────────────────────────────────────────────
let anuncios = [];

// ─── Aclaraciones de horario ───────────────────────────────────────────────────
let aclaraciones = [];

// ─── Notificaciones ───────────────────────────────────────────────────────────
let notificaciones = [];

// ─── Configuración de acceso por rol ──────────────────────────────────────────
// Catálogo de módulos del sistema (corresponden a las rutas del frontend)
const MODULOS_SISTEMA = [
  { key: "dashboard",      label: "Inicio / Dashboard" },
  { key: "eventos",        label: "Eventos" },
  { key: "incidencias",    label: "Incidencias" },
  { key: "reportes",       label: "Reportes" },
  { key: "sucursales",     label: "Sucursales" },
  { key: "empleados",      label: "Empleados" },
  { key: "grupos",         label: "Grupos de Sucursales" },
  { key: "mapa",           label: "Mapa" },
  { key: "administracion", label: "Administración" },
  { key: "auditoria",      label: "Auditoría" },
  { key: "logs",           label: "Logs / Salud de Plataforma" },
  { key: "notificaciones", label: "Notificaciones" },
  { key: "vacaciones",     label: "Vacaciones" },
  { key: "incapacidades",  label: "Incapacidades" },
  { key: "calendario",     label: "Calendario" },
  { key: "organigrama",    label: "Organigrama" },
  { key: "horarios",       label: "Horarios" },
  { key: "desarrollo_organizacional", label: "Desarrollo Organizacional" },
];

// Mapa rol → módulos permitidos (configurable desde el panel de Admin)
// Lista completa de módulos para roles con acceso total
const MODULOS_ACCESO_TOTAL = [
  "dashboard","eventos","incidencias","reportes","sucursales","empleados","grupos","mapa",
  "administracion","auditoria","logs","notificaciones","vacaciones","incapacidades",
  "calendario","organigrama","horarios","desarrollo_organizacional",
];

let configuracionRoles = {
  administrador_general:       MODULOS_ACCESO_TOTAL,
  super_admin:                 MODULOS_ACCESO_TOTAL,
  agente_soporte_ti:           ["dashboard","eventos","incidencias","reportes","sucursales","empleados","grupos","mapa","administracion","logs","notificaciones","vacaciones","incapacidades","calendario","organigrama","horarios"],
  supervisor_sucursales:       ["dashboard","eventos","incidencias","reportes","empleados","grupos","mapa","notificaciones","vacaciones","incapacidades","calendario","organigrama"],
  agente_control_asistencia:   ["dashboard","eventos","incidencias","notificaciones","vacaciones","incapacidades","calendario"],
  visor_reportes:              ["dashboard","reportes","mapa","notificaciones"],
  medico_titular:              ["dashboard","incidencias","notificaciones"],
  medico_de_guardia:           ["dashboard","incidencias","notificaciones"],
  nominas:                     ["dashboard","incidencias","empleados","reportes","notificaciones","vacaciones","incapacidades","horarios"],
  desarrollo_organizacional:   ["dashboard","desarrollo_organizacional","notificaciones"],
};

/**
 * ROLE_DEFINITIONS — catálogo base de roles.
 * Cada entrada: clave → { nombre, puedeEditar }
 * puedeEditar controla si los usuarios con ese rol pueden crear/editar/eliminar registros.
 */
const ROLE_DEFINITIONS = {
  administrador_general:     { nombre: "Administrador General",          puedeEditar: true  },
  super_admin:               { nombre: "Super Administrador",            puedeEditar: true  },
  agente_soporte_ti:         { nombre: "Agente Soporte TI",              puedeEditar: true  },
  supervisor_sucursales:     { nombre: "Supervisor de Sucursales",       puedeEditar: true  },
  agente_control_asistencia: { nombre: "Agente Control de Asistencia",   puedeEditar: true  },
  nominas:                   { nombre: "Nóminas",                        puedeEditar: true  },
  visor_reportes:            { nombre: "Visor de Reportes",              puedeEditar: false },
  medico_titular:            { nombre: "Medico Titular",                 puedeEditar: false },
  medico_de_guardia:         { nombre: "Medico de Guardia",              puedeEditar: false },
  desarrollo_organizacional: { nombre: "Desarrollo Organizacional",      puedeEditar: false },
};

// ─── Registros de acceso ──────────────────────────────────────────────────────
const mkReg = (usuarioIdx, sucursalIdx, tipo, fecha, hora, fueraDeHorario = false, motivo = null) => ({
  id: newId(),
  usuarioId: usuarios[usuarioIdx].id,
  sucursalId: sucursalIdx !== null ? sucursales[sucursalIdx].id : null,
  tipo,
  fecha,
  hora,
  latitud:  sucursalIdx !== null ? sucursales[sucursalIdx].geocerca.latitud  : null,
  longitud: sucursalIdx !== null ? sucursales[sucursalIdx].geocerca.longitud : null,
  fueraDeHorario,
  motivoFueraHorario: motivo,
  esManual: false,
  captadoPor: null,
  editadoManual: false,
  editadoPor: null,
  editadoEn: null,
  motivoEdicionManual: "",
  manualOriginal: null,
  estadoAprobacion: null,
  aprobadoPor: null,
  aprobadoEn: null,
  creadoEn: new Date(`${fecha}T${hora}:00`).toISOString(),
});

let registros = [
  // ─── Semana 9-13 mar 2026 ────────────────────────────────────────────────────
  // 9 mar (lun) ─ Ana (completo), Carlos (completo), Sofía (completo), Luis (incompleto), Roberto (completo)
  mkReg(0, 0, "entrada",           "2026-03-09", "08:02"),
  mkReg(0, 0, "salida_alimentos",  "2026-03-09", "14:00"),
  mkReg(0, 0, "regreso_alimentos", "2026-03-09", "15:01"),
  mkReg(0, 0, "salida",            "2026-03-09", "17:03"),

  mkReg(1, 0, "entrada",           "2026-03-09", "08:05"),
  mkReg(1, 0, "salida_alimentos",  "2026-03-09", "14:02"),
  mkReg(1, 0, "regreso_alimentos", "2026-03-09", "15:05"),
  mkReg(1, 0, "salida",            "2026-03-09", "17:10"),

  mkReg(2, 1, "entrada",           "2026-03-09", "08:08"),
  mkReg(2, 1, "salida_alimentos",  "2026-03-09", "14:00"),
  mkReg(2, 1, "regreso_alimentos", "2026-03-09", "15:00"),
  mkReg(2, 1, "salida",            "2026-03-09", "17:05"),

  mkReg(3, 0, "entrada",           "2026-03-09", "08:15"),
  mkReg(3, 0, "salida_alimentos",  "2026-03-09", "14:10"),

  mkReg(5, 0, "entrada",           "2026-03-09", "07:55"),
  mkReg(5, 0, "salida_alimentos",  "2026-03-09", "14:00"),
  mkReg(5, 0, "regreso_alimentos", "2026-03-09", "15:00"),
  mkReg(5, 0, "salida",            "2026-03-09", "17:02"),

  // 10 mar (mar) ─ Ana (completo), Carlos (tarde ⚠️), Sofía (completo), Luis (completo), Roberto (sin salida final)
  mkReg(0, 0, "entrada",           "2026-03-10", "07:58"),
  mkReg(0, 0, "salida_alimentos",  "2026-03-10", "14:00"),
  mkReg(0, 0, "regreso_alimentos", "2026-03-10", "14:59"),
  mkReg(0, 0, "salida",            "2026-03-10", "17:00"),

  mkReg(1, 0, "entrada",           "2026-03-10", "09:30", true, "Tráfico en la ciudad"),
  mkReg(1, 0, "salida_alimentos",  "2026-03-10", "14:00"),
  mkReg(1, 0, "regreso_alimentos", "2026-03-10", "15:00"),
  mkReg(1, 0, "salida",            "2026-03-10", "17:30"),

  mkReg(2, 1, "entrada",           "2026-03-10", "08:10"),
  mkReg(2, 1, "salida_alimentos",  "2026-03-10", "14:00"),
  mkReg(2, 1, "regreso_alimentos", "2026-03-10", "15:00"),
  mkReg(2, 1, "salida",            "2026-03-10", "17:00"),

  mkReg(3, 0, "entrada",           "2026-03-10", "08:00"),
  mkReg(3, 0, "salida_alimentos",  "2026-03-10", "14:00"),
  mkReg(3, 0, "regreso_alimentos", "2026-03-10", "15:00"),
  mkReg(3, 0, "salida",            "2026-03-10", "17:05"),

  mkReg(5, 0, "entrada",           "2026-03-10", "08:00"),
  mkReg(5, 0, "salida_alimentos",  "2026-03-10", "14:00"),
  mkReg(5, 0, "regreso_alimentos", "2026-03-10", "15:00"),
  // Roberto sin salida el mar 10

  // 11 mar (mié) ─ Ana (completo), Carlos (completo), Sofía (AUSENTE), Luis (completo), Roberto (completo)
  mkReg(0, 0, "entrada",           "2026-03-11", "08:05"),
  mkReg(0, 0, "salida_alimentos",  "2026-03-11", "14:00"),
  mkReg(0, 0, "regreso_alimentos", "2026-03-11", "14:58"),
  mkReg(0, 0, "salida",            "2026-03-11", "17:00"),

  mkReg(1, 0, "entrada",           "2026-03-11", "08:08"),
  mkReg(1, 0, "salida_alimentos",  "2026-03-11", "14:00"),
  mkReg(1, 0, "regreso_alimentos", "2026-03-11", "15:00"),
  mkReg(1, 0, "salida",            "2026-03-11", "17:00"),

  mkReg(3, 0, "entrada",           "2026-03-11", "08:00"),
  mkReg(3, 0, "salida_alimentos",  "2026-03-11", "14:00"),
  mkReg(3, 0, "regreso_alimentos", "2026-03-11", "15:00"),
  mkReg(3, 0, "salida",            "2026-03-11", "17:00"),

  mkReg(5, 0, "entrada",           "2026-03-11", "08:00"),
  mkReg(5, 0, "salida_alimentos",  "2026-03-11", "14:00"),
  mkReg(5, 0, "regreso_alimentos", "2026-03-11", "15:00"),
  mkReg(5, 0, "salida",            "2026-03-11", "17:00"),

  // 12 mar (jue) ─ Ana (completo), Carlos (parcial), Sofía (completo), Luis (completo), Roberto (⚠️ salida tarde)
  mkReg(0, 0, "entrada",           "2026-03-12", "08:03"),
  mkReg(0, 0, "salida_alimentos",  "2026-03-12", "14:00"),
  mkReg(0, 0, "regreso_alimentos", "2026-03-12", "15:00"),
  mkReg(0, 0, "salida",            "2026-03-12", "17:00"),

  mkReg(1, 0, "entrada",           "2026-03-12", "08:00"),
  mkReg(1, 0, "salida_alimentos",  "2026-03-12", "14:00"),
  // Carlos sin regreso ni salida el jue 12

  mkReg(2, 1, "entrada",           "2026-03-12", "08:00"),
  mkReg(2, 1, "salida_alimentos",  "2026-03-12", "14:05"),
  mkReg(2, 1, "regreso_alimentos", "2026-03-12", "15:00"),
  mkReg(2, 1, "salida",            "2026-03-12", "17:00"),

  mkReg(3, 0, "entrada",           "2026-03-12", "08:00"),
  mkReg(3, 0, "salida_alimentos",  "2026-03-12", "14:00"),
  mkReg(3, 0, "regreso_alimentos", "2026-03-12", "15:00"),
  mkReg(3, 0, "salida",            "2026-03-12", "17:00"),

  mkReg(5, 0, "entrada",           "2026-03-12", "08:00"),
  mkReg(5, 0, "salida_alimentos",  "2026-03-12", "14:00"),
  mkReg(5, 0, "regreso_alimentos", "2026-03-12", "15:00"),
  mkReg(5, 0, "salida",            "2026-03-12", "19:30", true, "Cierre de inventario mensual"),
];

// ─── Auditoría ────────────────────────────────────────────────────────────────
let auditLog = [];
const MAX_AUDIT_LOG = 10000; // keep last 10k entries in memory

const createAuditEntry = (data) => {
  const entry = {
    id: newId(),
    timestamp: new Date().toISOString(),
    ...data,
  };
  auditLog.unshift(entry); // most recent first
  if (auditLog.length > MAX_AUDIT_LOG) auditLog = auditLog.slice(0, MAX_AUDIT_LOG);
  scheduleDatabaseSync();
  return entry;
};

const getAuditLog = (filtros = {}) => {
  let lista = [...auditLog];
  if (filtros.usuarioId) lista = lista.filter((e) => e.usuarioId === filtros.usuarioId);
  if (filtros.accion)    lista = lista.filter((e) => e.accion && e.accion.toLowerCase().includes(filtros.accion.toLowerCase()));
  if (filtros.desde)     lista = lista.filter((e) => e.timestamp >= filtros.desde);
  if (filtros.hasta)     lista = lista.filter((e) => e.timestamp <= filtros.hasta + "T23:59:59.999Z");
  if (filtros.metodo)    lista = lista.filter((e) => e.metodo === filtros.metodo.toUpperCase());
  const total = lista.length;
  const page  = parseInt(filtros.page  || 1, 10);
  const limit = parseInt(filtros.limit || 50, 10);
  const items = lista.slice((page - 1) * limit, page * limit);
  return { total, page, limit, items };
};

// ─── Configuración de empresa ─────────────────────────────────────────────────
let empresaConfig = {
  nombre:      "Control de Acceso",
  razonSocial: "",
  rfc:         "",
  domicilio:   "",
  telefono:    "",
  email:       "",
  logoUrl:     null,
  actualizadoEn: null,
};

const getEmpresaConfig = () => ({ ...empresaConfig });
const updateEmpresaConfig = (data) => {
  empresaConfig = { ...empresaConfig, ...data, actualizadoEn: new Date().toISOString() };
  scheduleDatabaseSync();
  return empresaConfig;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Áreas
// ─────────────────────────────────────────────────────────────────────────────

const getAreas = (soloActivos = true) =>
  soloActivos ? areas.filter((a) => a.activo) : areas;

const getAreaById = (id) => areas.find((a) => a.id === id) || null;

const createArea = (data) => {
  const nuevo = { id: newId(), activo: true, creadoEn: new Date().toISOString(), ...data };
  areas.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

const updateArea = (id, data) => {
  const idx = areas.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  areas[idx] = { ...areas[idx], ...data };
  scheduleDatabaseSync();
  return areas[idx];
};

const deleteArea = (id) => {
  const idx = areas.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  areas.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Puestos
// ─────────────────────────────────────────────────────────────────────────────

const getPuestos = (soloActivos = true) =>
  soloActivos ? puestos.filter((p) => p.activo) : puestos;

const getPuestoById = (id) => puestos.find((p) => p.id === id) || null;

const createPuesto = (data) => {
  const nuevo = { id: newId(), activo: true, creadoEn: new Date().toISOString(), ...data };
  puestos.push(nuevo);
  refreshLegacyPuestos();
  scheduleDatabaseSync();
  return nuevo;
};

const updatePuesto = (id, data) => {
  const idx = puestos.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  puestos[idx] = { ...puestos[idx], ...data };
  refreshLegacyPuestos();
  scheduleDatabaseSync();
  return puestos[idx];
};

const deletePuesto = (id) => {
  const idx = puestos.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  puestos.splice(idx, 1);
  refreshLegacyPuestos();
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Horarios
// ─────────────────────────────────────────────────────────────────────────────

const getHorarios = (soloActivos = true) =>
  soloActivos ? horarios.filter((h) => h.activo) : horarios;

const getHorarioById = (id) => horarios.find((h) => h.id === id) || null;

const createHorario = (data) => {
  const nuevo = { id: newId(), activo: true, creadoEn: new Date().toISOString(), ...data };
  horarios.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

const updateHorario = (id, data) => {
  const idx = horarios.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  horarios[idx] = { ...horarios[idx], ...data };
  scheduleDatabaseSync();
  return horarios[idx];
};

const deleteHorario = (id) => {
  const idx = horarios.findIndex((h) => h.id === id);
  if (idx === -1) return false;
  horarios.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Sucursales
// ─────────────────────────────────────────────────────────────────────────────

const getSucursales = () => sucursales;
const getSucursalById = (id) => sucursales.find((s) => s.id === id) || null;

const createSucursal = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), ...data };
  sucursales.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};

const updateSucursal = (id, data) => {
  const idx = sucursales.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sucursales[idx] = { ...sucursales[idx], ...data };
  scheduleDatabaseSync();
  return sucursales[idx];
};

const deleteSucursal = (id) => {
  const idx = sucursales.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  sucursales.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Usuarios
// ─────────────────────────────────────────────────────────────────────────────

const getUsuarios = (filtros = {}) => {
  let resultado = usuarios.map(({ password, ...u }) => u);
  if (filtros.sucursalId) resultado = resultado.filter((u) => u.sucursalId === filtros.sucursalId);
  if (filtros.rol) resultado = resultado.filter((u) => u.rol === filtros.rol);
  if (filtros.grupoId) resultado = resultado.filter((u) => u.grupoId === filtros.grupoId);
  if (filtros.activo !== undefined) resultado = resultado.filter((u) => u.activo === filtros.activo);
  if (filtros.tipo) resultado = resultado.filter((u) => u.tipo === filtros.tipo);
  if (filtros.horarioId) resultado = resultado.filter((u) => u.horarioId === filtros.horarioId);
  return resultado;
};

const getUsuarioById = (id) => usuarios.find((u) => u.id === id) || null;
const getUsuarioByEmail = (email) => usuarios.find((u) => u.email === email) || null;

const createUsuario = (data) => {
  const nuevo = {
    id: newId(),
    grupoId: null,
    horarioId: null,
    jefeInmediatoId: null,
    area: null,
    fechaNacimiento: null,
    fechaInicioActividades: null,
    usaHorarioPuesto: false,
    configDiasHorario: null,
    totpSecret: null,
    totpHabilitado: false,
    activo: true,
    creadoEn: new Date().toISOString(),
    ...data,
  };
  usuarios.push(nuevo);
  scheduleDatabaseSync();
  const { password, ...sin } = nuevo;
  return sin;
};

const updateUsuario = (id, data) => {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  usuarios[idx] = { ...usuarios[idx], ...data };
  scheduleDatabaseSync();
  const { password, ...sin } = usuarios[idx];
  return sin;
};

const deleteUsuario = (id) => {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  usuarios.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

/**
 * Devuelve todos los supervisores que tienen visibilidad sobre una sucursal:
 * - Supervisores cuyo campo sucursalId coincide directamente, O
 * - Supervisores cuyo grupo de sucursales incluye la sucursal indicada.
 */
const getSupervisoresDeSucursal = (sucursalId) => {
  const directos = usuarios.filter(
    (u) => u.activo && u.rol === "supervisor_sucursales" && u.sucursalId === sucursalId
  );
  // Supervisores asignados a grupos que contienen esta sucursal
  const gruposConSucursal = grupos.filter(
    (g) => g.activo && Array.isArray(g.sucursalIds) && g.sucursalIds.includes(sucursalId)
  );
  const idsEnGrupos = gruposConSucursal.map((g) => g.supervisorId);
  const deGrupos = usuarios.filter(
    (u) => u.activo && u.rol === "supervisor_sucursales" && idsEnGrupos.includes(u.id)
  );
  // Unir sin duplicados
  const todos = [...directos];
  deGrupos.forEach((s) => { if (!todos.find((t) => t.id === s.id)) todos.push(s); });
  return todos;
};

/** Devuelve los grupos activos que contienen la sucursal indicada */
const getGruposBySucursalId = (sucursalId) =>
  grupos.filter(
    (g) => g.activo && Array.isArray(g.sucursalIds) && g.sucursalIds.includes(sucursalId)
  );

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Grupos
// ─────────────────────────────────────────────────────────────────────────────

const getGrupos = (filtros = {}) => {
  let resultado = grupos.filter((g) => g.activo);
  if (filtros.supervisorId) resultado = resultado.filter((g) => g.supervisorId === filtros.supervisorId);
  // filtro por sucursal: busca grupos que contengan esa sucursal en su array
  if (filtros.sucursalId)
    resultado = resultado.filter(
      (g) => Array.isArray(g.sucursalIds) && g.sucursalIds.includes(filtros.sucursalId)
    );
  return resultado;
};

const getGrupoById = (id) => grupos.find((g) => g.id === id) || null;

const createGrupo = (data) => {
  const nuevo = {
    id: newId(),
    sucursalIds: [],   // grupo de sucursales
    activo: true,
    creadoEn: new Date().toISOString(),
    ...data,
  };
  grupos.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

const updateGrupo = (id, data) => {
  const idx = grupos.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  grupos[idx] = { ...grupos[idx], ...data };
  scheduleDatabaseSync();
  return grupos[idx];
};

const deleteGrupo = (id) => {
  const idx = grupos.findIndex((g) => g.id === id);
  if (idx === -1) return false;
  grupos.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Tipos de Incidencia
// ─────────────────────────────────────────────────────────────────────────────

const getTiposIncidencia = (soloActivos = true) =>
  soloActivos ? tiposIncidencia.filter((t) => t.activo) : tiposIncidencia;

const getTipoIncidenciaById = (id) => tiposIncidencia.find((t) => t.id === id) || null;

const createTipoIncidencia = (data) => {
  const nuevo = { id: newId(), activo: true, creadoEn: new Date().toISOString(), ...data };
  tiposIncidencia.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

const updateTipoIncidencia = (id, data) => {
  const idx = tiposIncidencia.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tiposIncidencia[idx] = { ...tiposIncidencia[idx], ...data };
  scheduleDatabaseSync();
  return tiposIncidencia[idx];
};

const deleteTipoIncidencia = (id) => {
  const idx = tiposIncidencia.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tiposIncidencia.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Incidencias
// ─────────────────────────────────────────────────────────────────────────────

const getIncidencias = (filtros = {}) => {
  let resultado = [...incidencias];
  if (filtros.usuarioId) resultado = resultado.filter((i) => i.usuarioId === filtros.usuarioId);
  if (filtros.sucursalId) resultado = resultado.filter((i) => i.sucursalId === filtros.sucursalId);
  // Filtro por array de sucursales (usado por supervisor con múltiples sucursales en su grupo)
  if (Array.isArray(filtros.sucursalIds) && filtros.sucursalIds.length > 0)
    resultado = resultado.filter((i) => filtros.sucursalIds.includes(i.sucursalId));
  if (filtros.estado) resultado = resultado.filter((i) => i.estado === filtros.estado);
  if (filtros.tipoIncidenciaId) resultado = resultado.filter((i) => i.tipoIncidenciaId === filtros.tipoIncidenciaId);
  if (filtros.supervisorId) resultado = resultado.filter((i) => i.supervisorId === filtros.supervisorId);
  return resultado.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
};

const getIncidenciaById = (id) => incidencias.find((i) => i.id === id) || null;

const createIncidencia = (data) => {
  const nueva = {
    id: newId(),
    estado: "pendiente",
    fechaIncidencia: new Date().toISOString().split("T")[0],
    fechaFin: null,
    preAprobaciones: [],
    jefeInmediatoId: null,
    supervisorId: null,
    comentarioSupervisor: null,
    revisadoEn: null,
    archivoUrl: null,
    archivoNombre: null,
    archivoMime: null,
    creadoEn: new Date().toISOString(),
    ...data,
  };
  incidencias.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};

/**
 * Pre-aprueba una incidencia (agente_control_asistencia).
 * Agrega un registro al historial de pre-aprobaciones y cambia estado a pre_aprobada.
 */
const preAprobarIncidencia = (id, preAprobadoPorId, comentario = "") => {
  const idx = incidencias.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const entrada = {
    preAprobadoPorId,
    preAprobadoEn: new Date().toISOString(),
    comentario,
  };
  const preAprobaciones = Array.isArray(incidencias[idx].preAprobaciones)
    ? [...incidencias[idx].preAprobaciones, entrada]
    : [entrada];
  incidencias[idx] = { ...incidencias[idx], estado: "pre_aprobada", preAprobaciones };
  scheduleDatabaseSync();
  return incidencias[idx];
};

/**
 * Devuelve las incidencias APROBADAS de un usuario que cubren una fecha dada.
 * Una incidencia cubre una fecha si:
 *   - fechaFin es null y fechaIncidencia === fecha, O
 *   - fechaFin != null y fechaIncidencia <= fecha <= fechaFin
 */
const getIncidenciasActivasParaUsuario = (usuarioId, fecha) => {
  return incidencias.filter((inc) => {
    if (inc.usuarioId !== usuarioId) return false;
    if (inc.estado !== "aprobada") return false;
    if (!inc.fechaIncidencia) return false;
    if (!inc.fechaFin) return inc.fechaIncidencia === fecha;
    return inc.fechaIncidencia <= fecha && fecha <= inc.fechaFin;
  });
};

/**
 * Devuelve todos los usuarios activos cuyo rol esté en el array proporcionado.
 * Útil para notificar a todos los administradores de un tipo en particular.
 */
const getSupervisoresPorRoles = (roles) =>
  usuarios.filter((u) => u.activo && roles.includes(u.rol));

const updateIncidencia = (id, data) => {
  const idx = incidencias.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  incidencias[idx] = { ...incidencias[idx], ...data };
  scheduleDatabaseSync();
  return incidencias[idx];
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Anuncios del panel lateral
// ─────────────────────────────────────────────────────────────────────────────

const getAnuncios = ({ all = false, usuarioId = null, grupoId = null, userArea = null } = {}) => {
  const hoy = new Date().toISOString().split("T")[0];
  const lista = [...anuncios].sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
  if (all) return lista; // para la vista de administración

  // Vista pública: activos, no vencidos y cuya fecha de inicio ya pasó
  const visibles = lista.filter((a) =>
    a.activo &&
    (!a.fechaExpiracion || a.fechaExpiracion >= hoy) &&
    (!a.fechaInicio     || a.fechaInicio     <= hoy)
  );

  // Sin contexto de usuario → devolver todos los visibles (sidebar sin sesión)
  if (!usuarioId && !grupoId && !userArea) return visibles;

  return visibles.filter((a) => {
    const dest = a.destinatarios;
    // Sin restricción de destinatarios → visible para todos
    if (!dest || dest.todos === true || Object.keys(dest).length === 0) return true;
    // Por usuario específico
    if (usuarioId && Array.isArray(dest.usuarios) && dest.usuarios.includes(usuarioId)) return true;
    // Por grupo
    if (grupoId && Array.isArray(dest.grupos) && dest.grupos.includes(grupoId)) return true;
    // Por área: los IDs de área se resuelven a nombres para comparar con el campo area del usuario
    if (userArea && Array.isArray(dest.areas) && dest.areas.length > 0) {
      const nombresArea = dest.areas
        .map((aId) => { const ar = areas.find((x) => x.id === aId); return ar ? ar.nombre : null; })
        .filter(Boolean);
      if (nombresArea.some((n) => n.toLowerCase() === userArea.toLowerCase())) return true;
    }
    return false;
  });
};

const getAnuncioById = (id) => anuncios.find((a) => a.id === id) || null;

const createAnuncio = (data) => {
  // Por defecto vence en 7 días si no se especifica
  const defaultExpiracion = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];
  const nuevo = {
    id: newId(),
    activo: true,
    fechaExpiracion: defaultExpiracion,
    creadoEn: new Date().toISOString(),
    ...data,
  };
  anuncios.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

const updateAnuncio = (id, data) => {
  const idx = anuncios.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  anuncios[idx] = { ...anuncios[idx], ...data };
  scheduleDatabaseSync();
  return anuncios[idx];
};

const deleteAnuncio = (id) => {
  const idx = anuncios.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  anuncios.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Aclaraciones de horario
// ─────────────────────────────────────────────────────────────────────────────

const getAclaraciones = (filtros = {}) => {
  let resultado = [...aclaraciones];
  if (filtros.usuarioId) resultado = resultado.filter((a) => a.usuarioId === filtros.usuarioId);
  if (filtros.estado) resultado = resultado.filter((a) => a.estado === filtros.estado);
  if (filtros.supervisorId) resultado = resultado.filter((a) => a.supervisorId === filtros.supervisorId);
  return resultado.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
};

const getAclaracionById = (id) => aclaraciones.find((a) => a.id === id) || null;

const createAclaracion = (data) => {
  const nueva = {
    id: newId(),
    estado: "pendiente",
    supervisorId: null,
    comentarioSupervisor: null,
    revisadoEn: null,
    creadoEn: new Date().toISOString(),
    ...data,
  };
  aclaraciones.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};

const updateAclaracion = (id, data) => {
  const idx = aclaraciones.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  aclaraciones[idx] = { ...aclaraciones[idx], ...data };
  scheduleDatabaseSync();
  return aclaraciones[idx];
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Notificaciones
// ─────────────────────────────────────────────────────────────────────────────

const getNotificaciones = (filtros = {}) => {
  let resultado = [...notificaciones];
  if (filtros.paraUsuarioId) resultado = resultado.filter((n) => n.paraUsuarioId === filtros.paraUsuarioId);
  if (filtros.leida !== undefined) resultado = resultado.filter((n) => n.leida === filtros.leida);
  return resultado.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
};

const getNotificacionById = (id) => notificaciones.find((n) => n.id === id) || null;

const createNotificacion = (data) => {
  const nueva = {
    id: newId(),
    leida: false,
    referenciaId: null,
    creadoEn: new Date().toISOString(),
    ...data,
  };
  notificaciones.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};

const updateNotificacion = (id, data) => {
  const idx = notificaciones.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  notificaciones[idx] = { ...notificaciones[idx], ...data };
  scheduleDatabaseSync();
  return notificaciones[idx];
};

const marcarTodasLeidas = (paraUsuarioId) => {
  notificaciones = notificaciones.map((n) =>
    n.paraUsuarioId === paraUsuarioId ? { ...n, leida: true } : n
  );
  scheduleDatabaseSync();
};

// ─────────────────────────────────────────────────────────────────────────────
// API del store — Registros de acceso
// ─────────────────────────────────────────────────────────────────────────────

const getRegistros = (filtros = {}) => {
  let resultado = [...registros];
  if (filtros.usuarioId) resultado = resultado.filter((r) => r.usuarioId === filtros.usuarioId);
  if (filtros.sucursalId) resultado = resultado.filter((r) => r.sucursalId === filtros.sucursalId);
  if (filtros.fecha) resultado = resultado.filter((r) => r.fecha === filtros.fecha);
  if (filtros.tipo) resultado = resultado.filter((r) => r.tipo === filtros.tipo);
  if (filtros.fechaInicio) resultado = resultado.filter((r) => r.fecha >= filtros.fechaInicio);
  if (filtros.fechaFin) resultado = resultado.filter((r) => r.fecha <= filtros.fechaFin);
  if (filtros.esManual !== undefined) resultado = resultado.filter((r) => r.esManual === filtros.esManual);
  if (filtros.estadoAprobacion) resultado = resultado.filter((r) => r.estadoAprobacion === filtros.estadoAprobacion);
  return resultado.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
};

const getRegistroById = (id) => registros.find((r) => r.id === id) || null;

const createRegistro = (data) => {
  const nuevo = {
    id: newId(),
    esManual: false,
    captadoPor: null,
    editadoManual: false,
    editadoPor: null,
    editadoEn: null,
    motivoEdicionManual: "",
    manualOriginal: null,
    estadoAprobacion: null,
    aprobadoPor: null,
    aprobadoEn: null,
    horaModificada: null,
    fotoUrl: null,
    creadoEn: new Date().toISOString(),
    ...data,
    // horaOriginal es inmutable: siempre refleja la hora real del primer registro
    horaOriginal: data.horaOriginal || data.hora || null,
  };
  registros.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

const updateRegistro = (id, data) => {
  const idx = registros.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  registros[idx] = { ...registros[idx], ...data };
  scheduleDatabaseSync();
  return registros[idx];
};

/** Obtiene los registros de un usuario para hoy */
const getRegistrosHoyDeUsuario = (usuarioId) => {
  const hoy = new Date().toISOString().split("T")[0];
  return registros
    .filter((r) => r.usuarioId === usuarioId && r.fecha === hoy)
    .sort((a, b) => a.hora.localeCompare(b.hora));
};

/** Determina el siguiente tipo de registro pendiente */
const getSiguienteRegistro = (usuarioId) => {
  const orden = [
    TIPOS_REGISTRO.ENTRADA,
    TIPOS_REGISTRO.SALIDA_ALIMENTOS,
    TIPOS_REGISTRO.REGRESO_ALIMENTOS,
    TIPOS_REGISTRO.SALIDA,
  ];
  const hechos = getRegistrosHoyDeUsuario(usuarioId).map((r) => r.tipo);
  return orden.find((t) => !hechos.includes(t)) || null;
};

/** Obtiene el último registro del usuario (cualquier día) para validar cooldown */
const getLastRegistroDeUsuario = (usuarioId) => {
  const regsUsuario = registros
    .filter((r) => r.usuarioId === usuarioId)
    .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
  return regsUsuario[0] || null;
};

/** Obtiene registros en rango de fechas para cálculo de minutos trabajados */
const getRegistrosByDateRange = (usuarioId, fechaInicio, fechaFin) => {
  return registros
    .filter(
      (r) =>
        r.usuarioId === usuarioId &&
        r.fecha >= fechaInicio &&
        r.fecha <= fechaFin
    )
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.hora.localeCompare(b.hora);
    });
};

const updateModulosDeRol = (rol, modulos) => {
  if (!configuracionRoles[rol]) return false;
  configuracionRoles[rol] = Array.isArray(modulos) ? modulos : [];
  scheduleDatabaseSync();
  return true;
};

const getDatabaseStatus = () => ({
  enabled: databaseState.enabled,
  connected: databaseState.connected,
  database: databaseState.database,
  tables: Array.from(databaseState.tables),
  lastSyncAt: databaseState.lastSyncAt,
  lastError: databaseState.lastError,
});

const initializeFromDatabase = async () => {
  if (!DB_ENABLED || !pool) {
    databaseState.enabled = false;
    return getDatabaseStatus();
  }

  try {
    await testConnection();
    databaseState.connected = true;
    databaseState.lastError = null;
    databaseState.tables = await getExistingTables();
    // Migraciones de columnas nuevas (idempotentes)
    if (hasTable("registros")) {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registros' AND COLUMN_NAME = 'foto_url'`
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE registros ADD COLUMN foto_url VARCHAR(500) NULL`);
      }
    }
    await loadDatabaseSnapshot();
    await persistDatabaseSnapshot();
    databaseState.lastSyncAt = new Date().toISOString();
    lastRefreshAt = Date.now();
  } catch (error) {
    trackDatabaseError(error);
  }

  return getDatabaseStatus();
};

const loadDatabaseSnapshot = async () => {
  if (!databaseState.connected) return;

  if (hasTable("empresa_config")) {
    const [rows] = await pool.query(
      `SELECT nombre, razon_social AS razonSocial, rfc, domicilio, telefono, email,
              logo_url AS logoUrl, updated_at AS actualizadoEn
       FROM empresa_config
       WHERE id = 1
       LIMIT 1`
    );
    if (rows[0]) empresaConfig = { ...empresaConfig, ...rows[0] };
  }

  if (hasTable("modulos")) {
    const [rows] = await pool.query(
      `SELECT clave AS \`key\`, nombre AS label
       FROM modulos
       WHERE activo = 1
       ORDER BY orden_menu, nombre`
    );
    if (rows.length > 0) {
      MODULOS_SISTEMA.splice(0, MODULOS_SISTEMA.length, ...rows);
    }
  }

  if (hasTable("rol_modulo")) {
    const rolesBase = Object.fromEntries(Object.keys(configuracionRoles).map((rol) => [rol, []]));
    const [rows] = await pool.query(
      `SELECT rol_clave AS rol, modulo_clave AS modulo
       FROM rol_modulo
       ORDER BY rol_clave, modulo_clave`
    );
    rows.forEach((row) => {
      if (!rolesBase[row.rol]) rolesBase[row.rol] = [];
      rolesBase[row.rol].push(row.modulo);
    });
    configuracionRoles = { ...configuracionRoles, ...rolesBase };

    // ── Auto-migración: asegurar que los módulos nuevos (logs, etc.) ──────────
    // existan en la BD cuando fue creada antes de que se añadieran esos módulos.
    const MODULOS_GARANTIZADOS = {
      super_admin:       ["logs", "auditoria"],
      agente_soporte_ti: ["logs"],
    };
    for (const [rol, extras] of Object.entries(MODULOS_GARANTIZADOS)) {
      for (const modulo of extras) {
        if (!configuracionRoles[rol]) configuracionRoles[rol] = [];
        if (!configuracionRoles[rol].includes(modulo)) {
          configuracionRoles[rol].push(modulo);
          // Persiste en la BD de forma silenciosa para que quede registrado
          pool.query(
            "INSERT IGNORE INTO rol_modulo (rol_clave, modulo_clave) VALUES (?, ?)",
            [rol, modulo]
          ).catch(() => {});
        }
      }
    }
    // ── Auto-migración: asegurar que 'logs' esté en la tabla modulos ──────────
    if (hasTable("modulos")) {
      pool.query(
        "INSERT IGNORE INTO modulos (clave, nombre, activo, orden_menu) VALUES ('logs', 'Logs / Salud de Plataforma', 1, 11)"
      ).catch(() => {});
    }
    // ──────────────────────────────────────────────────────────────────────────
  }

  if (hasTable("horarios")) {
    const [horarioRows] = await pool.query(
      `SELECT id, nombre, hora_entrada AS horaEntrada, hora_salida AS horaSalida,
              hora_salida_alimentos AS horaSalidaAlimentos,
              hora_regreso_alimentos AS horaRegresoAlimentos,
              tolerancia_minutos AS toleranciaMinutos, activo, created_at AS creadoEn
       FROM horarios`
    );
    const diasPorHorario = {};
    if (hasTable("horario_dias")) {
      const [diasRows] = await pool.query(
        `SELECT horario_id AS horarioId, dia_semana AS diaSemana
         FROM horario_dias
         ORDER BY horario_id, dia_semana`
      );
      diasRows.forEach((row) => {
        if (!diasPorHorario[row.horarioId]) diasPorHorario[row.horarioId] = [];
        diasPorHorario[row.horarioId].push(Number(row.diaSemana));
      });
    }
    if (horarioRows.length > 0) {
      horarios = horarioRows.map((row) => ({
        ...row,
        activo: toBool(row.activo, true),
        diasLaborales: diasPorHorario[row.id] || [],
      }));
    }
  }

  if (hasTable("puestos")) {
    // area_id column may not exist in older schemas (added in migration 007)
    let tieneColumnaAreaId = false;
    try {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'puestos' AND COLUMN_NAME = 'area_id'`
      );
      tieneColumnaAreaId = cols.length > 0;
    } catch { /* ignorar */ }

    const areaIdExpr = tieneColumnaAreaId ? "area_id AS areaId," : "NULL AS areaId,";
    const [puestosRows] = await pool.query(
      `SELECT id, nombre, descripcion, horario_id AS horarioId,
              ${areaIdExpr}
              activo, created_at AS creadoEn
       FROM puestos`
    );
    const camposPorPuesto = {};
    if (hasTable("puesto_campos_extra")) {
      const [camposRows] = await pool.query(
        `SELECT id, puesto_id AS puestoId, nombre, tipo,
                opciones_json AS opciones, obligatorio, orden_visual AS ordenVisual, activo
         FROM puesto_campos_extra
         ORDER BY puesto_id, orden_visual, nombre`
      );
      camposRows.forEach((row) => {
        if (!camposPorPuesto[row.puestoId]) camposPorPuesto[row.puestoId] = [];
        camposPorPuesto[row.puestoId].push({
          id: row.id,
          nombre: row.nombre,
          tipo: row.tipo,
          opciones: parseJson(row.opciones, []),
          obligatorio: toBool(row.obligatorio),
          ordenVisual: Number(row.ordenVisual || 0),
          activo: toBool(row.activo, true),
        });
      });
    }
    if (puestosRows.length > 0) {
      puestos = puestosRows.map((row) => ({
        ...row,
        activo: toBool(row.activo, true),
        camposExtra: camposPorPuesto[row.id] || [],
      }));
      refreshLegacyPuestos();
    }
  }

  if (hasTable("areas")) {
    const [areasRows] = await pool.query(
      `SELECT id, nombre, descripcion, activo, created_at AS creadoEn FROM areas`
    );
    if (areasRows.length > 0) {
      areas = areasRows.map((row) => ({
        ...row,
        activo: toBool(row.activo, true),
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
      }));
    }
  }

  if (hasTable("sucursales")) {
    // Determine if 'tipo' column exists (added in migration 006)
    let tieneColumnaTipo = false;
    try {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sucursales' AND COLUMN_NAME = 'tipo'`
      );
      tieneColumnaTipo = cols.length > 0;
    } catch { /* ignorar */ }

    const tipoExpr = tieneColumnaTipo ? "COALESCE(tipo, 'sucursal') AS tipo," : "'sucursal' AS tipo,";

    const [rows] = await pool.query(
      `SELECT id, nombre, direccion, ciudad, estado, latitud, longitud,
              radio_metros AS radio, activa, ${tipoExpr}
              created_at AS creadoEn
       FROM sucursales`
    );
    if (rows.length > 0) {
      sucursales = rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        direccion: row.direccion || "",
        ciudad: row.ciudad || "",
        estado: row.estado || "",
        tipo: row.tipo || "sucursal",
        activa: toBool(row.activa, true),
        geocerca: {
          latitud: Number(row.latitud),
          longitud: Number(row.longitud),
          radio: Number(row.radio || 0),
        },
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
      }));
    }
  }

  if (hasTable("usuarios")) {
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, email, password_hash AS password, sexo, edad, telefono,
              rol_clave AS rol, tipo_usuario AS tipo, departamento, datos_extra_json AS datosExtra,
              puesto_id AS puestoId, sucursal_id AS sucursalId, horario_id AS horarioId,
              grupo_id AS grupoId, jefe_inmediato_id AS jefeInmediatoId, area,
              fecha_nacimiento AS fechaNacimiento,
              fecha_inicio_actividades AS fechaInicioActividades,
              usa_horario_puesto AS usaHorarioPuesto,
              totp_secret AS totpSecret,
              totp_habilitado AS totpHabilitado,
              foto_url AS fotoUrl, activo, created_at AS creadoEn
       FROM usuarios`
    );
    if (rows.length > 0) {
      usuarios = rows.map((row) => ({
        ...row,
        edad: Number(row.edad || 0),
        activo: toBool(row.activo, true),
        datosExtra: parseJson(row.datosExtra, null),
        usaHorarioPuesto: toBool(row.usaHorarioPuesto, false),
        totpHabilitado: toBool(row.totpHabilitado, false),
        fechaNacimiento: row.fechaNacimiento
          ? (typeof row.fechaNacimiento === "string" ? row.fechaNacimiento : row.fechaNacimiento.toISOString().split("T")[0])
          : null,
        fechaInicioActividades: row.fechaInicioActividades
          ? (typeof row.fechaInicioActividades === "string" ? row.fechaInicioActividades : row.fechaInicioActividades.toISOString().split("T")[0])
          : null,
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
      }));
    }
  }

  if (hasTable("grupos")) {
    const [groupRows] = await pool.query(
      `SELECT id, nombre, supervisor_id AS supervisorId, activo, created_at AS creadoEn
       FROM grupos`
    );
    const sucursalesPorGrupo = {};
    if (hasTable("grupo_sucursales")) {
      const [groupBranchRows] = await pool.query(
        `SELECT grupo_id AS grupoId, sucursal_id AS sucursalId
         FROM grupo_sucursales
         ORDER BY grupo_id, sucursal_id`
      );
      groupBranchRows.forEach((row) => {
        if (!sucursalesPorGrupo[row.grupoId]) sucursalesPorGrupo[row.grupoId] = [];
        sucursalesPorGrupo[row.grupoId].push(row.sucursalId);
      });
    }
    if (groupRows.length > 0) {
      grupos = groupRows.map((row) => ({
        ...row,
        activo: toBool(row.activo, true),
        sucursalIds: sucursalesPorGrupo[row.id] || [],
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
      }));
    }
  }

  if (hasTable("tipos_incidencia")) {
    const [rows] = await pool.query(
      `SELECT id, nombre, descripcion, requiere_archivo AS requiereArchivo,
              categoria_bloqueo AS categoriaBloqueo,
              activo, created_at AS creadoEn
       FROM tipos_incidencia`
    );
    if (rows.length > 0) {
      tiposIncidencia = rows.map((row) => ({
        ...row,
        requiereArchivo: toBool(row.requiereArchivo),
        activo: toBool(row.activo, true),
        categoriaBloqueo: row.categoriaBloqueo || null,
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
      }));
    }
  }

  if (hasTable("incidencias")) {
    const [rows] = await pool.query(
      `SELECT id, usuario_id AS usuarioId, sucursal_id AS sucursalId, tipo_incidencia_id AS tipoIncidenciaId,
              descripcion, estado,
              fecha_incidencia AS fechaIncidencia, fecha_fin AS fechaFin,
              pre_aprobaciones_json AS preAprobacionesJson,
              jefe_inmediato_id AS jefeInmediatoId,
              supervisor_id AS supervisorId,
              comentario_supervisor AS comentarioSupervisor, revisado_en AS revisadoEn,
              archivo_url AS archivoUrl, archivo_nombre AS archivoNombre,
              archivo_mime AS archivoMime, created_at AS creadoEn
       FROM incidencias`
    );
    if (rows.length > 0) {
      incidencias = rows.map((row) => ({
        ...row,
        preAprobaciones: parseJson(row.preAprobacionesJson, []),
        preAprobacionesJson: undefined,
        fechaIncidencia: row.fechaIncidencia || null,
        fechaFin: row.fechaFin || null,
        jefeInmediatoId: row.jefeInmediatoId || null,
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
        revisadoEn: toIsoString(row.revisadoEn),
      }));
    }
  }

  if (hasTable("anuncios")) {
    // Verificar columnas opcionales (añadidas en migration 009)
    let tieneDestinatariosJson = false;
    let tieneFechaInicio       = false;
    let tieneFechaExpiracion   = false;
    try {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anuncios'
           AND COLUMN_NAME IN ('destinatarios_json','fecha_inicio','fecha_expiracion')`
      );
      const nombres = cols.map((c) => c.COLUMN_NAME);
      tieneDestinatariosJson = nombres.includes("destinatarios_json");
      tieneFechaInicio       = nombres.includes("fecha_inicio");
      tieneFechaExpiracion   = nombres.includes("fecha_expiracion");
    } catch { /* ignorar */ }

    const extras = [
      tieneDestinatariosJson ? "destinatarios_json AS destinatariosJson" : "NULL AS destinatariosJson",
      tieneFechaInicio       ? "fecha_inicio AS fechaInicio"             : "NULL AS fechaInicio",
      tieneFechaExpiracion   ? "fecha_expiracion AS fechaExpiracion"     : "NULL AS fechaExpiracion",
    ].join(", ");

    const [rows] = await pool.query(
      `SELECT id, titulo, texto, activo, creado_por AS creadoPor, created_at AS creadoEn,
              ${extras}
       FROM anuncios
       WHERE activo = 1
       ORDER BY created_at DESC`
    );
    if (rows.length > 0) {
      anuncios = rows.map((row) => ({
        ...row,
        activo:       toBool(row.activo, true),
        creadoEn:     toIsoString(row.creadoEn, new Date().toISOString()),
        destinatarios: row.destinatariosJson
          ? (typeof row.destinatariosJson === "string"
              ? JSON.parse(row.destinatariosJson)
              : row.destinatariosJson)
          : null,
        destinatariosJson: undefined,
      }));
    }
  }

  if (hasTable("aclaraciones")) {
    const [rows] = await pool.query(
      `SELECT id, usuario_id AS usuarioId, registro_id AS registroId,
              fecha_registro AS fechaRegistro, tipo_registro AS tipoRegistro,
              motivo, estado, supervisor_id AS supervisorId,
              comentario_supervisor AS comentarioSupervisor, revisado_en AS revisadoEn,
              created_at AS creadoEn
       FROM aclaraciones`
    );
    if (rows.length > 0) {
      aclaraciones = rows.map((row) => ({
        ...row,
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
        revisadoEn: toIsoString(row.revisadoEn),
      }));
    }
  }

  if (hasTable("notificaciones")) {
    const [rows] = await pool.query(
      `SELECT id, para_usuario_id AS paraUsuarioId, de_usuario_id AS deUsuarioId, tipo, titulo, mensaje,
              referencia_id AS referenciaId, leida, created_at AS creadoEn
       FROM notificaciones`
    );
    if (rows.length > 0) {
      notificaciones = rows.map((row) => ({
        ...row,
        leida: toBool(row.leida),
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
      }));
    }
  }

  if (hasTable("registros")) {
    const [rows] = await pool.query(
      `SELECT id, usuario_id AS usuarioId, sucursal_id AS sucursalId, tipo, fecha, hora,
              hora_original AS horaOriginal, hora_modificada AS horaModificada,
              latitud, longitud, dentro_geocerca AS dentroGeocerca, distancia_al_centro AS distanciaAlCentro,
              es_manual AS esManual, justificacion,
              fuera_de_horario AS fueraDeHorario, motivo_fuera_horario AS motivoFueraHorario,
              captado_por AS captadoPor,
              estado_aprobacion AS estadoAprobacion, aprobado_por AS aprobadoPor, aprobado_en AS aprobadoEn,
              comentario_supervisor AS comentarioSupervisor, editado_manual AS editadoManual,
              editado_por AS editadoPor, editado_en AS editadoEn,
              motivo_edicion_manual AS motivoEdicionManual, manual_original_json AS manualOriginal,
              foto_url AS fotoUrl,
              created_at AS creadoEn
       FROM registros`
    );
    if (rows.length > 0) {
      registros = rows.map((row) => ({
        ...row,
        latitud: row.latitud !== null ? Number(row.latitud) : null,
        longitud: row.longitud !== null ? Number(row.longitud) : null,
        dentroGeocerca: row.dentroGeocerca !== null ? toBool(row.dentroGeocerca) : null,
        distanciaAlCentro: row.distanciaAlCentro !== null ? Number(row.distanciaAlCentro) : null,
        esManual: toBool(row.esManual),
        fueraDeHorario: toBool(row.fueraDeHorario),
        motivoFueraHorario: row.motivoFueraHorario || null,
        editadoManual: toBool(row.editadoManual),
        manualOriginal: parseJson(row.manualOriginal, null),
        creadoEn: toIsoString(row.creadoEn, new Date().toISOString()),
        aprobadoEn: toIsoString(row.aprobadoEn),
        editadoEn: toIsoString(row.editadoEn),
      }));
    }
  }

  if (hasTable("auditoria_eventos")) {
    const [rows] = await pool.query(
      `SELECT id, usuario_id AS usuarioId, usuario_nombre AS usuarioNombre, usuario_rol AS usuarioRol,
              accion, metodo, ruta, status_code AS statusCode, exito, ip,
              detalles_json AS detalles, created_at AS timestamp
       FROM auditoria_eventos
       ORDER BY created_at DESC
       LIMIT ?`,
      [MAX_AUDIT_LOG]
    );
    if (rows.length > 0) {
      auditLog = rows.map((row) => {
        const detallesRaw = parseJson(row.detalles, null);
        // Extraer objetivo guardado en detalles_json sin afectar los detalles normales
        const objetivo = detallesRaw?._objetivo || {};
        const detallesSinObjetivo = detallesRaw
          ? Object.fromEntries(Object.entries(detallesRaw).filter(([k]) => k !== "_objetivo"))
          : null;
        return {
          ...row,
          exito: toBool(row.exito, true),
          detalles: detallesSinObjetivo && Object.keys(detallesSinObjetivo).length > 0 ? detallesSinObjetivo : null,
          objetivoId:     objetivo.id   || null,
          objetivoNombre: objetivo.nombre || null,
          objetivoTipo:   objetivo.tipo  || null,
          timestamp: toIsoString(row.timestamp, new Date().toISOString()),
        };
      });
    }
  }
};

const persistDatabaseSnapshot = async () => {
  if (!databaseState.connected || !pool) return;

  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.beginTransaction();

    if (hasTable("empresa_config")) {
      await connection.query(
        `REPLACE INTO empresa_config
          (id, nombre, razon_social, rfc, domicilio, telefono, email, logo_url, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          empresaConfig.nombre || "Control de Acceso",
          empresaConfig.razonSocial || null,
          empresaConfig.rfc || null,
          empresaConfig.domicilio || null,
          empresaConfig.telefono || null,
          empresaConfig.email || null,
          empresaConfig.logoUrl || null,
        ]
      );
    }

    if (hasTable("roles")) {
      await connection.query("DELETE FROM roles");
      for (const [clave, def] of Object.entries(ROLE_DEFINITIONS)) {
        const nombre      = typeof def === "object" ? def.nombre      : def;
        const puedeEditar = typeof def === "object" ? (def.puedeEditar ? 1 : 0) : 1;
        await connection.query(
          `INSERT INTO roles (clave, nombre, descripcion, activo, puede_editar, created_at, updated_at)
           VALUES (?, ?, NULL, 1, ?, NOW(), NOW())`,
          [clave, nombre, puedeEditar]
        );
      }
    }

    if (hasTable("modulos")) {
      await connection.query("DELETE FROM modulos");
      for (let index = 0; index < MODULOS_SISTEMA.length; index += 1) {
        const modulo = MODULOS_SISTEMA[index];
        await connection.query(
          `INSERT INTO modulos (clave, nombre, descripcion, orden_menu, activo, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 1, NOW(), NOW())`,
          [modulo.key, modulo.label, (index + 1) * 10]
        );
      }
    }

    if (hasTable("rol_modulo")) {
      await connection.query("DELETE FROM rol_modulo");
      for (const [rol, modulos] of Object.entries(configuracionRoles)) {
        for (const modulo of modulos) {
          await connection.query(
            `INSERT INTO rol_modulo (rol_clave, modulo_clave, created_at)
             VALUES (?, ?, NOW())`,
            [rol, modulo]
          );
        }
      }
    }

    if (hasTable("horario_dias")) await connection.query("DELETE FROM horario_dias");
    if (hasTable("horarios")) {
      await connection.query("DELETE FROM horarios");
      for (const horario of horarios) {
        await connection.query(
          `INSERT INTO horarios
            (id, nombre, hora_entrada, hora_salida_alimentos, hora_regreso_alimentos, hora_salida,
             tolerancia_minutos, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            horario.id,
            horario.nombre,
            horario.horaEntrada,
            horario.horaSalidaAlimentos || null,
            horario.horaRegresoAlimentos || null,
            horario.horaSalida,
            Number(horario.toleranciaMinutos || 0),
            horario.activo ? 1 : 0,
            toMySqlDateTime(horario.creadoEn, toMySqlDateTime(new Date())),
          ]
        );

        if (hasTable("horario_dias")) {
          for (const dia of horario.diasLaborales || []) {
            await connection.query(
              `INSERT INTO horario_dias (horario_id, dia_semana) VALUES (?, ?)`,
              [horario.id, Number(dia)]
            );
          }
        }
      }
    }

    if (hasTable("puesto_campos_extra")) await connection.query("DELETE FROM puesto_campos_extra");
    if (hasTable("puestos")) {
      // Detect if area_id column exists (migration 007)
      let puestosConAreaId = false;
      try {
        const [cols] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'puestos' AND COLUMN_NAME = 'area_id'`
        );
        puestosConAreaId = cols.length > 0;
      } catch { /* ignorar */ }

      await connection.query("DELETE FROM puestos");
      for (const puesto of puestos) {
        if (puestosConAreaId) {
          await connection.query(
            `INSERT INTO puestos
              (id, nombre, descripcion, horario_id, area_id, activo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              puesto.id, puesto.nombre, puesto.descripcion || "",
              puesto.horarioId || null, puesto.areaId || null,
              puesto.activo ? 1 : 0,
              toMySqlDateTime(puesto.creadoEn, toMySqlDateTime(new Date())),
            ]
          );
        } else {
          await connection.query(
            `INSERT INTO puestos
              (id, nombre, descripcion, horario_id, activo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              puesto.id, puesto.nombre, puesto.descripcion || "",
              puesto.horarioId || null, puesto.activo ? 1 : 0,
              toMySqlDateTime(puesto.creadoEn, toMySqlDateTime(new Date())),
            ]
          );
        }

        if (hasTable("puesto_campos_extra")) {
          for (let index = 0; index < (puesto.camposExtra || []).length; index += 1) {
            const campo = puesto.camposExtra[index];
            await connection.query(
              `INSERT INTO puesto_campos_extra
                (id, puesto_id, nombre, tipo, opciones_json, obligatorio, orden_visual, activo, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                campo.id || newId(),
                puesto.id,
                campo.nombre,
                campo.tipo,
                JSON.stringify(campo.opciones || []),
                campo.obligatorio ? 1 : 0,
                Number(campo.ordenVisual ?? index),
                campo.activo === false ? 0 : 1,
              ]
            );
          }
        }
      }
    }

    if (hasTable("areas")) {
      await connection.query("DELETE FROM areas");
      for (const area of areas) {
        await connection.query(
          `INSERT INTO areas (id, nombre, descripcion, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            area.id,
            area.nombre,
            area.descripcion || "",
            area.activo ? 1 : 0,
            toMySqlDateTime(area.creadoEn, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("sucursales")) {
      // Detect if tipo column exists (migration 006)
      let sucursalesConTipo = false;
      try {
        const [cols] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sucursales' AND COLUMN_NAME = 'tipo'`
        );
        sucursalesConTipo = cols.length > 0;
      } catch { /* ignorar */ }

      await connection.query("DELETE FROM sucursales");
      for (const sucursal of sucursales) {
        if (sucursalesConTipo) {
          await connection.query(
            `INSERT INTO sucursales
              (id, nombre, direccion, ciudad, estado, latitud, longitud, radio_metros, activa, tipo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              sucursal.id, sucursal.nombre, sucursal.direccion || "",
              sucursal.ciudad || "", sucursal.estado || "",
              Number(sucursal.geocerca?.latitud || 0),
              Number(sucursal.geocerca?.longitud || 0),
              Number(sucursal.geocerca?.radio || 0),
              sucursal.activa ? 1 : 0,
              sucursal.tipo || "sucursal",
              toMySqlDateTime(sucursal.creadoEn, toMySqlDateTime(new Date())),
            ]
          );
        } else {
          await connection.query(
            `INSERT INTO sucursales
              (id, nombre, direccion, ciudad, estado, latitud, longitud, radio_metros, activa, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              sucursal.id, sucursal.nombre, sucursal.direccion || "",
              sucursal.ciudad || "", sucursal.estado || "",
              Number(sucursal.geocerca?.latitud || 0),
              Number(sucursal.geocerca?.longitud || 0),
              Number(sucursal.geocerca?.radio || 0),
              sucursal.activa ? 1 : 0,
              toMySqlDateTime(sucursal.creadoEn, toMySqlDateTime(new Date())),
            ]
          );
        }
      }
    }

    if (hasTable("grupo_sucursales")) await connection.query("DELETE FROM grupo_sucursales");
    if (hasTable("grupos")) {
      await connection.query("DELETE FROM grupos");
      for (const grupo of grupos) {
        await connection.query(
          `INSERT INTO grupos (id, nombre, supervisor_id, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            grupo.id,
            grupo.nombre,
            grupo.supervisorId,
            grupo.activo ? 1 : 0,
            toMySqlDateTime(grupo.creadoEn, toMySqlDateTime(new Date())),
          ]
        );

        if (hasTable("grupo_sucursales")) {
          for (const sucursalId of grupo.sucursalIds || []) {
            await connection.query(
              `INSERT INTO grupo_sucursales (grupo_id, sucursal_id, created_at)
               VALUES (?, ?, NOW())`,
              [grupo.id, sucursalId]
            );
          }
        }
      }
    }

    if (hasTable("usuarios")) {
      await connection.query("DELETE FROM usuarios");
      for (const usuario of usuarios) {
        // Detectar si la tabla ya tiene los campos nuevos (migration 003)
        const hasNuevosCampos = databaseState.tables.has("usuarios");
        await connection.query(
          `INSERT INTO usuarios
            (id, nombre, apellido, email, password_hash, sexo, edad, telefono,
             rol_clave, tipo_usuario, departamento, datos_extra_json,
             puesto_id, sucursal_id, horario_id, grupo_id,
             jefe_inmediato_id, area,
             fecha_nacimiento, fecha_inicio_actividades, usa_horario_puesto,
             totp_secret, totp_habilitado,
             foto_url, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            usuario.id,
            usuario.nombre,
            usuario.apellido || "",
            usuario.email,
            usuario.password,
            usuario.sexo,
            Number(usuario.edad || 0),
            usuario.telefono || null,
            usuario.rol,
            usuario.tipo || "sucursal",
            usuario.departamento || null,
            usuario.datosExtra ? JSON.stringify(usuario.datosExtra) : null,
            usuario.puestoId || null,
            usuario.sucursalId || null,
            usuario.horarioId || null,
            usuario.grupoId || null,
            usuario.jefeInmediatoId || null,
            usuario.area || null,
            usuario.fechaNacimiento || null,
            usuario.fechaInicioActividades || null,
            usuario.usaHorarioPuesto ? 1 : 0,
            usuario.totpSecret || null,
            usuario.totpHabilitado ? 1 : 0,
            usuario.fotoUrl || null,
            usuario.activo ? 1 : 0,
            toMySqlDateTime(usuario.creadoEn, toMySqlDateTime(new Date())),
          ]
        ).catch(async () => {
          // Fallback si migration 003 no se ha aplicado: insertar sin campos nuevos
          await connection.query(
            `INSERT IGNORE INTO usuarios
              (id, nombre, apellido, email, password_hash, sexo, edad, telefono,
               rol_clave, tipo_usuario, departamento, datos_extra_json,
               puesto_id, sucursal_id, horario_id, grupo_id,
               jefe_inmediato_id, area,
               foto_url, activo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              usuario.id, usuario.nombre, usuario.apellido || "", usuario.email,
              usuario.password, usuario.sexo, Number(usuario.edad || 0), usuario.telefono || null,
              usuario.rol, usuario.tipo || "sucursal", usuario.departamento || null,
              usuario.datosExtra ? JSON.stringify(usuario.datosExtra) : null,
              usuario.puestoId || null, usuario.sucursalId || null,
              usuario.horarioId || null, usuario.grupoId || null,
              usuario.jefeInmediatoId || null, usuario.area || null,
              usuario.fotoUrl || null, usuario.activo ? 1 : 0,
              toMySqlDateTime(usuario.creadoEn, toMySqlDateTime(new Date())),
            ]
          );
        });
      }
    }

    if (hasTable("tipos_incidencia")) {
      await connection.query("DELETE FROM tipos_incidencia");
      for (const tipo of tiposIncidencia) {
        await connection.query(
          `INSERT INTO tipos_incidencia
            (id, nombre, descripcion, requiere_archivo, categoria_bloqueo, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            tipo.id,
            tipo.nombre,
            tipo.descripcion || "",
            tipo.requiereArchivo ? 1 : 0,
            tipo.categoriaBloqueo || null,
            tipo.activo ? 1 : 0,
            toMySqlDateTime(tipo.creadoEn, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("incidencias")) {
      await connection.query("DELETE FROM incidencias");
      for (const incidencia of incidencias) {
        await connection.query(
          `INSERT INTO incidencias
            (id, usuario_id, sucursal_id, tipo_incidencia_id, descripcion, estado,
             fecha_incidencia, fecha_fin, pre_aprobaciones_json, jefe_inmediato_id,
             supervisor_id, comentario_supervisor, revisado_en,
             archivo_url, archivo_nombre, archivo_mime, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            incidencia.id,
            incidencia.usuarioId,
            incidencia.sucursalId || null,
            incidencia.tipoIncidenciaId,
            incidencia.descripcion || null,
            incidencia.estado || "pendiente",
            incidencia.fechaIncidencia || null,
            incidencia.fechaFin || null,
            incidencia.preAprobaciones?.length ? JSON.stringify(incidencia.preAprobaciones) : null,
            incidencia.jefeInmediatoId || null,
            incidencia.supervisorId || null,
            incidencia.comentarioSupervisor || null,
            toMySqlDateTime(incidencia.revisadoEn),
            incidencia.archivoUrl || null,
            incidencia.archivoNombre || null,
            incidencia.archivoMime || null,
            toMySqlDateTime(incidencia.creadoEn, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("aclaraciones")) {
      await connection.query("DELETE FROM aclaraciones");
      for (const aclaracion of aclaraciones) {
        await connection.query(
          `INSERT INTO aclaraciones
            (id, usuario_id, registro_id, fecha_registro, tipo_registro, motivo, estado,
             supervisor_id, comentario_supervisor, revisado_en, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            aclaracion.id,
            aclaracion.usuarioId,
            aclaracion.registroId || null,
            aclaracion.fechaRegistro,
            aclaracion.tipoRegistro,
            aclaracion.motivo,
            aclaracion.estado || "pendiente",
            aclaracion.supervisorId || null,
            aclaracion.comentarioSupervisor || null,
            toMySqlDateTime(aclaracion.revisadoEn),
            toMySqlDateTime(aclaracion.creadoEn, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("notificaciones")) {
      await connection.query("DELETE FROM notificaciones");
      for (const notificacion of notificaciones) {
        await connection.query(
          `INSERT INTO notificaciones
            (id, para_usuario_id, de_usuario_id, tipo, titulo, mensaje, referencia_id, leida, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            notificacion.id,
            notificacion.paraUsuarioId,
            notificacion.deUsuarioId || null,
            notificacion.tipo,
            notificacion.titulo,
            notificacion.mensaje,
            notificacion.referenciaId || null,
            notificacion.leida ? 1 : 0,
            toMySqlDateTime(notificacion.creadoEn, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("registros")) {
      await connection.query("DELETE FROM registros");
      for (const registro of registros) {
        await connection.query(
          `INSERT INTO registros
            (id, usuario_id, sucursal_id, tipo, fecha, hora, hora_original, hora_modificada,
             latitud, longitud, dentro_geocerca,
             distancia_al_centro, es_manual, justificacion, fuera_de_horario, motivo_fuera_horario,
             captado_por, estado_aprobacion,
             aprobado_por, aprobado_en, comentario_supervisor, editado_manual, editado_por,
             editado_en, motivo_edicion_manual, manual_original_json, foto_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            registro.id,
            registro.usuarioId,
            registro.sucursalId,
            registro.tipo,
            registro.fecha,
            registro.hora,
            registro.horaOriginal || registro.hora || null,
            registro.horaModificada || null,
            registro.latitud,
            registro.longitud,
            registro.dentroGeocerca === null ? null : (registro.dentroGeocerca ? 1 : 0),
            registro.distanciaAlCentro ?? null,
            registro.esManual ? 1 : 0,
            registro.justificacion || registro.motivoFueraHorario || null,
            registro.fueraDeHorario ? 1 : 0,
            registro.motivoFueraHorario || null,
            registro.captadoPor || null,
            registro.estadoAprobacion || null,
            registro.aprobadoPor || null,
            toMySqlDateTime(registro.aprobadoEn),
            registro.comentarioSupervisor || null,
            registro.editadoManual ? 1 : 0,
            registro.editadoPor || null,
            toMySqlDateTime(registro.editadoEn),
            registro.motivoEdicionManual || null,
            registro.manualOriginal ? JSON.stringify(registro.manualOriginal) : null,
            registro.fotoUrl || null,
            toMySqlDateTime(registro.creadoEn, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("auditoria_eventos")) {
      await connection.query("DELETE FROM auditoria_eventos");
      for (const evento of auditLog) {
        await connection.query(
          `INSERT INTO auditoria_eventos
            (id, usuario_id, usuario_nombre, usuario_rol, accion, metodo, ruta,
             status_code, exito, ip, detalles_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            evento.id,
            evento.usuarioId || null,
            evento.usuarioNombre || null,
            evento.usuarioRol || null,
            evento.accion,
            evento.metodo,
            evento.ruta,
            Number(evento.statusCode || 200),
            evento.exito ? 1 : 0,
            evento.ip || null,
            (() => {
              // Persistir detalles + objetivo en el mismo campo JSON (sin cambio de schema)
              const payload = {
                ...(evento.detalles || {}),
                ...(evento.objetivoId ? {
                  _objetivo: { id: evento.objetivoId, nombre: evento.objetivoNombre || null, tipo: evento.objetivoTipo || null },
                } : {}),
              };
              return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
            })(),
            toMySqlDateTime(evento.timestamp, toMySqlDateTime(new Date())),
          ]
        );
      }
    }

    if (hasTable("anuncios")) {
      // Detectar columnas opcionales
      let tieneDestinatariosJson = false;
      let tieneFechaInicio       = false;
      let tieneFechaExpiracion   = false;
      try {
        const [cols] = await connection.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anuncios'
             AND COLUMN_NAME IN ('destinatarios_json','fecha_inicio','fecha_expiracion')`
        );
        const nombres = cols.map((c) => c.COLUMN_NAME);
        tieneDestinatariosJson = nombres.includes("destinatarios_json");
        tieneFechaInicio       = nombres.includes("fecha_inicio");
        tieneFechaExpiracion   = nombres.includes("fecha_expiracion");
      } catch { /* ignorar */ }

      await connection.query("DELETE FROM anuncios");
      for (const anuncio of anuncios) {
        const cols   = ["id", "titulo", "texto", "activo", "creado_por", "created_at", "updated_at"];
        const values = [
          anuncio.id,
          anuncio.titulo,
          anuncio.texto,
          anuncio.activo ? 1 : 0,
          anuncio.creadoPor || null,
          toMySqlDateTime(anuncio.creadoEn, toMySqlDateTime(new Date())),
          toMySqlDateTime(new Date()),
        ];
        if (tieneFechaInicio) {
          cols.push("fecha_inicio");
          values.push(anuncio.fechaInicio || null);
        }
        if (tieneFechaExpiracion) {
          cols.push("fecha_expiracion");
          values.push(anuncio.fechaExpiracion || null);
        }
        if (tieneDestinatariosJson) {
          cols.push("destinatarios_json");
          values.push(
            anuncio.destinatarios ? JSON.stringify(anuncio.destinatarios) : null
          );
        }
        const placeholders = cols.map(() => "?").join(", ");
        await connection.query(
          `INSERT INTO anuncios (${cols.join(", ")}) VALUES (${placeholders})`,
          values
        );
      }
    }

    await connection.commit();
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    databaseState.lastError = null;
    databaseState.connected = true;
  } catch (error) {
    await connection.rollback();
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    throw error;
  } finally {
    connection.release();
  }
};

// ─── Desarrollo Organizacional ─────────────────────────────────────────────────

// Catálogo de competencias
let doCompetencias = [];

// Evaluaciones por competencias
let doEvalCompetencias = [];

// Evaluaciones 360
let doEval360 = [];

// Evaluaciones 1 a 1
let doEval1a1 = [];

// Satisfacción de clientes
let doSatisfaccion = [];

// Indicadores estratégicos (definición, max 3 por puesto)
let doIndicadores = [];

// Valores de indicadores (resultados por periodo)
let doIndicadoresValores = [];

// Plantillas de sesiones 1 a 1
let doPlantillas1a1 = [];

// ── Competencias ──────────────────────────────────────────────────────────────
const getDoCompetencias = () => doCompetencias.filter((c) => c.activo);
const getDoCompetenciaById = (id) => doCompetencias.find((c) => c.id === id) || null;
const createDoCompetencia = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), activo: true, ...data };
  doCompetencias.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};
const updateDoCompetencia = (id, data) => {
  const idx = doCompetencias.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  doCompetencias[idx] = { ...doCompetencias[idx], ...data };
  scheduleDatabaseSync();
  return doCompetencias[idx];
};
const deleteDoCompetencia = (id) => {
  const idx = doCompetencias.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  doCompetencias.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ── Evaluaciones por Competencias ─────────────────────────────────────────────
const getDoEvalCompetencias = (filtros = {}) => {
  let list = [...doEvalCompetencias];
  if (filtros.evaluadoId) list = list.filter((e) => e.evaluadoId === filtros.evaluadoId);
  if (filtros.periodo) list = list.filter((e) => e.periodo === filtros.periodo);
  return list;
};
const getDoEvalCompetenciaById = (id) => doEvalCompetencias.find((e) => e.id === id) || null;
const createDoEvalCompetencia = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), estado: "completada", ...data };
  doEvalCompetencias.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};
const updateDoEvalCompetencia = (id, data) => {
  const idx = doEvalCompetencias.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  doEvalCompetencias[idx] = { ...doEvalCompetencias[idx], ...data };
  scheduleDatabaseSync();
  return doEvalCompetencias[idx];
};

// ── Evaluaciones 360 ──────────────────────────────────────────────────────────
const getDoEval360 = (filtros = {}) => {
  let list = [...doEval360];
  if (filtros.evaluadoId) list = list.filter((e) => e.evaluadoId === filtros.evaluadoId);
  if (filtros.periodo) list = list.filter((e) => e.periodo === filtros.periodo);
  return list;
};
const getDoEval360ById = (id) => doEval360.find((e) => e.id === id) || null;
const createDoEval360 = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), ...data };
  doEval360.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};
const updateDoEval360 = (id, data) => {
  const idx = doEval360.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  doEval360[idx] = { ...doEval360[idx], ...data };
  scheduleDatabaseSync();
  return doEval360[idx];
};

// ── Evaluaciones 1 a 1 ────────────────────────────────────────────────────────
const getDoEval1a1 = (filtros = {}) => {
  let list = [...doEval1a1];
  if (filtros.empleadoId) list = list.filter((e) => e.empleadoId === filtros.empleadoId);
  return list;
};
const createDoEval1a1 = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), realizada: false, ...data };
  doEval1a1.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};
const updateDoEval1a1 = (id, data) => {
  const idx = doEval1a1.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  doEval1a1[idx] = { ...doEval1a1[idx], ...data };
  scheduleDatabaseSync();
  return doEval1a1[idx];
};

// ── Plantillas 1 a 1 ──────────────────────────────────────────────────────────
const getDoPlantillas1a1 = () => doPlantillas1a1.filter((p) => p.activo !== false);
const createDoPlantilla1a1 = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), activo: true, preguntas: [], ...data };
  doPlantillas1a1.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};
const updateDoPlantilla1a1 = (id, data) => {
  const idx = doPlantillas1a1.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  doPlantillas1a1[idx] = { ...doPlantillas1a1[idx], ...data };
  scheduleDatabaseSync();
  return doPlantillas1a1[idx];
};
const deleteDoPlantilla1a1 = (id) => {
  const idx = doPlantillas1a1.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  doPlantillas1a1.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ── Satisfacción de Clientes ──────────────────────────────────────────────────
const getDoSatisfaccion = (filtros = {}) => {
  let list = [...doSatisfaccion];
  if (filtros.periodo) list = list.filter((s) => s.periodo === filtros.periodo);
  return list;
};
const createDoSatisfaccion = (data) => {
  const nueva = { id: newId(), creadoEn: new Date().toISOString(), ...data };
  doSatisfaccion.push(nueva);
  scheduleDatabaseSync();
  return nueva;
};

// ── Indicadores Estratégicos ──────────────────────────────────────────────────
const getDoIndicadores = (filtros = {}) => {
  let list = doIndicadores.filter((i) => i.activo);
  if (filtros.puestoId) list = list.filter((i) => i.puestoId === filtros.puestoId);
  return list;
};
const getDoIndicadorById = (id) => doIndicadores.find((i) => i.id === id) || null;
const createDoIndicador = (data) => {
  // Validar máximo 3 por puesto
  const existentes = doIndicadores.filter((i) => i.puestoId === data.puestoId && i.activo);
  if (existentes.length >= 3) return null;
  const nuevo = { id: newId(), creadoEn: new Date().toISOString(), activo: true, ...data };
  doIndicadores.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};
const updateDoIndicador = (id, data) => {
  const idx = doIndicadores.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  doIndicadores[idx] = { ...doIndicadores[idx], ...data };
  scheduleDatabaseSync();
  return doIndicadores[idx];
};
const deleteDoIndicador = (id) => {
  const idx = doIndicadores.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  doIndicadores.splice(idx, 1);
  scheduleDatabaseSync();
  return true;
};

// ── Valores de Indicadores ────────────────────────────────────────────────────
const getDoIndicadoresValores = (filtros = {}) => {
  let list = [...doIndicadoresValores];
  if (filtros.usuarioId) list = list.filter((v) => v.usuarioId === filtros.usuarioId);
  if (filtros.indicadorId) list = list.filter((v) => v.indicadorId === filtros.indicadorId);
  if (filtros.periodo) list = list.filter((v) => v.periodo === filtros.periodo);
  return list;
};
const createDoIndicadorValor = (data) => {
  // Upsert por indicadorId + usuarioId + periodo
  const idx = doIndicadoresValores.findIndex(
    (v) => v.indicadorId === data.indicadorId && v.usuarioId === data.usuarioId && v.periodo === data.periodo
  );
  if (idx !== -1) {
    doIndicadoresValores[idx] = { ...doIndicadoresValores[idx], ...data, actualizadoEn: new Date().toISOString() };
    scheduleDatabaseSync();
    return doIndicadoresValores[idx];
  }
  const nuevo = { id: newId(), creadoEn: new Date().toISOString(), ...data };
  doIndicadoresValores.push(nuevo);
  scheduleDatabaseSync();
  return nuevo;
};

// ─────────────────────────────────────────────────────────────────────────────
// Exportaciones
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  PUESTOS, // backwards-compat
  TIPOS_REGISTRO,
  initializeFromDatabase,
  refreshFromDatabaseIfNeeded,
  getDatabaseStatus,
  // Áreas
  getAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
  // Puestos
  getPuestos,
  getPuestoById,
  createPuesto,
  updatePuesto,
  deletePuesto,
  // Horarios
  getHorarios,
  getHorarioById,
  createHorario,
  updateHorario,
  deleteHorario,
  // Sucursales
  getSucursales,
  getSucursalById,
  createSucursal,
  updateSucursal,
  deleteSucursal,
  // Usuarios
  getUsuarios,
  getUsuarioById,
  getUsuarioByEmail,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getSupervisoresDeSucursal,
  getSupervisoresPorRoles,
  // Configuración de roles
  MODULOS_SISTEMA,
  getConfiguracionRoles: () => ({ ...configuracionRoles }),
  /**
   * Devuelve los módulos del rol.
   * Garantiza que super_admin y agente_soporte_ti siempre tengan
   * los módulos restringidos (logs, auditoria) aunque la BD no los
   * incluya (puede pasar cuando la BD se creó antes de añadir esos módulos).
   */
  getModulosDeRol: (rol) => {
    const MODULOS_GARANTIZADOS = {
      administrador_general: ["logs", "auditoria"],
      super_admin:           ["logs", "auditoria"],
      agente_soporte_ti:     ["logs"],
    };
    const mods   = [...(configuracionRoles[rol] || [])];
    const extras = MODULOS_GARANTIZADOS[rol] || [];
    extras.forEach((m) => { if (!mods.includes(m)) mods.push(m); });
    return mods;
  },
  updateModulosDeRol,
  // Grupos
  getGrupos,
  getGrupoById,
  getGruposBySucursalId,
  createGrupo,
  updateGrupo,
  deleteGrupo,
  // Tipos de incidencia
  getTiposIncidencia,
  getTipoIncidenciaById,
  createTipoIncidencia,
  updateTipoIncidencia,
  deleteTipoIncidencia,
  // Incidencias
  getIncidencias,
  getIncidenciaById,
  createIncidencia,
  updateIncidencia,
  preAprobarIncidencia,
  getIncidenciasActivasParaUsuario,
  // Anuncios
  getAnuncios,
  getAnuncioById,
  createAnuncio,
  updateAnuncio,
  deleteAnuncio,
  // Aclaraciones
  getAclaraciones,
  getAclaracionById,
  createAclaracion,
  updateAclaracion,
  // Notificaciones
  getNotificaciones,
  getNotificacionById,
  createNotificacion,
  updateNotificacion,
  marcarTodasLeidas,
  // Registros
  getRegistros,
  getRegistroById,
  createRegistro,
  updateRegistro,
  getRegistrosHoyDeUsuario,
  getSiguienteRegistro,
  getLastRegistroDeUsuario,
  getRegistrosByDateRange,
  // Auditoría
  createAuditEntry,
  getAuditLog,
  // Configuración de empresa
  getEmpresaConfig,
  updateEmpresaConfig,
  // IDs fijos de tipos de incidencia
  ID_TIPO_VACACIONES,
  ID_TIPO_INCAPACIDAD,
  ID_TIPO_INCAP_MAT,
  // Desarrollo Organizacional
  getDoCompetencias,
  getDoCompetenciaById,
  createDoCompetencia,
  updateDoCompetencia,
  deleteDoCompetencia,
  getDoEvalCompetencias,
  getDoEvalCompetenciaById,
  createDoEvalCompetencia,
  updateDoEvalCompetencia,
  getDoEval360,
  getDoEval360ById,
  createDoEval360,
  updateDoEval360,
  getDoEval1a1,
  createDoEval1a1,
  updateDoEval1a1,
  getDoSatisfaccion,
  createDoSatisfaccion,
  getDoIndicadores,
  getDoIndicadorById,
  createDoIndicador,
  updateDoIndicador,
  deleteDoIndicador,
  getDoIndicadoresValores,
  createDoIndicadorValor,
  getDoPlantillas1a1,
  createDoPlantilla1a1,
  updateDoPlantilla1a1,
  deleteDoPlantilla1a1,
};
