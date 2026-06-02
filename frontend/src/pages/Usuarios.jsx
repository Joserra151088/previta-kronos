/**
 * Usuarios.jsx – Gestión de empleados (CRUD)
 * Soporta tabs: Todos / Corporativo / Sucursales
 * Soporta campos extra por puesto y campo `tipo` de empleado.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUsuarios, getUsuariosPaginados, getPuestos, getSucursales, getHorarios,
  crearUsuario, actualizarUsuario, eliminarUsuario,
  subirFotoEmpleado, descargarPlantillaImportacion, importarUsuarios,
  reset2FA, getAreas, verificarEmailDisponible, getRoles,
} from "../utils/api";
import { getGrupos } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toastExito, toastError, toastAviso, confirmar } from "../utils/toast";

// ─── Validación de contraseña ─────────────────────────────────────────────────
const PWD_RULES = [
  { id: "len",     label: "Mínimo 8 caracteres",            test: (p) => p.length >= 8 },
  { id: "upper",   label: "Al menos una letra mayúscula",   test: (p) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Al menos una letra minúscula",   test: (p) => /[a-z]/.test(p) },
  { id: "num",     label: "Al menos un número",             test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "Al menos un carácter especial",  test: (p) => /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(p) },
];

/**
 * Muestra los requisitos de contraseña en tiempo real.
 * Solo se muestra cuando el campo tiene valor.
 */
const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const cumplidos = PWD_RULES.filter((r) => r.test(password)).length;
  const porcentaje = (cumplidos / PWD_RULES.length) * 100;
  const color = porcentaje < 40 ? "#ef4444" : porcentaje < 80 ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ marginTop: 8 }}>
      {/* Barra de fuerza */}
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${porcentaje}%`, background: color, transition: "width 0.25s, background 0.25s", borderRadius: 2 }} />
      </div>
      {/* Checklist de reglas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {PWD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <span key={r.id} style={{ fontSize: 11, color: ok ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 5 }}>
              {ok ? "✓" : "✗"} {r.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── Constante días de la semana para el diseñador de horario ─────────────────
const DIAS_SEMANA = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const DEFAULT_CONFIG_DIAS = DIAS_SEMANA.map((d) => ({
  dia: d.value,
  activo: d.value >= 1 && d.value <= 5,
  entrada: "09:00",
  salida: "19:00",
  tieneComida: false,
  comidaInicio: "13:00",
  comidaFin: "14:00",
}));

/** Componente visual de horario por día — inspirado en el selector de Booking.com */
function DiseñadorHorario({ value, onChange }) {
  const dias = Array.isArray(value) && value.length === 7 ? value : DEFAULT_CONFIG_DIAS;

  const update = (diaValue, campo, val) => {
    const next = dias.map((d) =>
      d.dia === diaValue ? { ...d, [campo]: val } : d
    );
    onChange(next);
  };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      {dias.map((d, i) => {
        const info = DIAS_SEMANA.find((x) => x.value === d.dia);
        return (
          <div
            key={d.dia}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr",
              alignItems: "center",
              padding: "8px 12px",
              background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
              borderBottom: i < 6 ? "1px solid var(--border)" : "none",
              gap: 8,
            }}
          >
            {/* Nombre del día + toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={d.activo}
                onChange={(e) => update(d.dia, "activo", e.target.checked)}
                style={{ width: 14, height: 14 }}
              />
              <span style={{ fontWeight: 600, fontSize: 13, color: d.activo ? "var(--text)" : "var(--text-muted)" }}>
                {info?.label}
              </span>
            </label>

            {/* Horarios del día */}
            {d.activo ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {/* Entrada */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="time"
                    value={d.entrada}
                    onChange={(e) => update(d.dia, "entrada", e.target.value)}
                    style={{
                      padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                      background: "var(--bg3)", color: "var(--text)", fontSize: 13, width: 100,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>–</span>
                  <input
                    type="time"
                    value={d.salida}
                    onChange={(e) => update(d.dia, "salida", e.target.value)}
                    style={{
                      padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                      background: "var(--bg3)", color: "var(--text)", fontSize: 13, width: 100,
                    }}
                  />
                </div>

                {/* Hora de comida */}
                {d.tieneComida ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>🍽</span>
                    <input
                      type="time"
                      value={d.comidaInicio}
                      onChange={(e) => update(d.dia, "comidaInicio", e.target.value)}
                      style={{
                        padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                        background: "var(--bg3)", color: "var(--text)", fontSize: 13, width: 100,
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>–</span>
                    <input
                      type="time"
                      value={d.comidaFin}
                      onChange={(e) => update(d.dia, "comidaFin", e.target.value)}
                      style={{
                        padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                        background: "var(--bg3)", color: "var(--text)", fontSize: 13, width: 100,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => update(d.dia, "tieneComida", false)}
                      title="Quitar hora de comida"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--danger)", fontSize: 16, lineHeight: 1, padding: "0 2px",
                      }}
                    >×</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => update(d.dia, "tieneComida", true)}
                    style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11,
                      border: "1px dashed var(--border)", cursor: "pointer",
                      background: "none", color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Hora de comida
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                fontSize: 13, color: "var(--text-muted)", fontStyle: "italic",
                background: "var(--bg-secondary)", borderRadius: 6,
                padding: "6px 12px", border: "1px dashed var(--border)",
                textAlign: "center",
              }}>
                Día libre
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Calcula años de antigüedad desde una fecha ISO */
function calcularAntigüedad(fechaInicioActividades) {
  if (!fechaInicioActividades) return null;
  const inicio = new Date(fechaInicioActividades);
  const hoy = new Date();
  let anios = hoy.getFullYear() - inicio.getFullYear();
  const m = hoy.getMonth() - inicio.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < inicio.getDate())) anios--;
  const mesesTotal = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  const meses = ((mesesTotal % 12) + 12) % 12;
  if (anios > 0) return `${anios} año${anios !== 1 ? "s" : ""}${meses > 0 ? ` ${meses} mes${meses !== 1 ? "es" : ""}` : ""}`;
  if (meses > 0) return `${meses} mes${meses !== 1 ? "es" : ""}`;
  return "< 1 mes";
}

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const ROLES_DISPONIBLES_DEFAULT = [
  { value: "medico_titular",            label: "Médico Titular" },
  { value: "medico_de_guardia",         label: "Médico de Guardia" },
  { value: "supervisor_sucursales",     label: "Supervisor de Sucursales" },
  { value: "agente_control_asistencia", label: "Agente Control Asistencia" },
  { value: "agente_soporte_ti",         label: "Agente Soporte TI" },
  { value: "visor_reportes",            label: "Visor de Reportes" },
  { value: "nominas",                   label: "Nóminas" },
  { value: "desarrollo_organizacional", label: "Desarrollo Organizacional" },
  { value: "administrador_general",     label: "Administrador General" },
  { value: "super_admin",               label: "Super Administrador" },
];

const FORM_VACIO = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  sexo: "masculino",
  edad: "",
  fechaNacimiento: "",
  fechaInicioActividades: "",
  puestoId: "",
  horarioId: "",
  usaHorarioPuesto: false,
  configDiasHorario: null,
  sucursalId: "",
  rol: "medico_titular",
  tipo: "sucursal",
  departamento: "",
  datosExtra: {},
  jefeInmediatoId: "",
  area: "",
  evaluacionesHabilitadas: true,
};

// ─── Iconos SVG para acciones ─────────────────────────────────────────────
const IcoEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IcoTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IcoShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
  </svg>
);
const IcoCam = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IcoBuilding = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle", marginRight: 3, opacity: 0.6 }}>
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/><path d="M3 9h18"/>
  </svg>
);
const IcoCake = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle", marginRight: 3, opacity: 0.6 }}>
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4l.5 1"/><path d="M12 4l.5 1"/><path d="M17 4l.5 1"/>
  </svg>
);

// ─── Avatar con iniciales coloreadas ──────────────────────────────────────
const AVATAR_COLORS = [
  "#4f7ec7","#5baa6b","#c47a3e","#9561b0",
  "#c45b5b","#2e9fb3","#7a8c5b","#c47a7a","#3e7db3","#7a6baa",
];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function UserAvatar({ nombre = "", apellido = "", fotoUrl, size = 36 }) {
  const initials = `${(nombre[0] || "").toUpperCase()}${(apellido[0] || "").toUpperCase()}` || "?";
  const bg = avatarColor(`${nombre}${apellido}`);
  if (fotoUrl) return null; // la <img> ya se renderiza por separado
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.36),
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, letterSpacing: "-0.5px", userSelect: "none",
      border: "2px solid rgba(255,255,255,0.18)",
    }}>
      {initials}
    </div>
  );
}

const ROL_LABEL = {
  super_admin: "Super Admin",
  administrador_general: "Admin General",
  agente_soporte_ti: "Soporte TI",
  supervisor_sucursales: "Supervisor",
  agente_control_asistencia: "Control Asist.",
  visor_reportes: "Visor",
  medico_titular: "Médico Titular",
  medico_de_guardia: "Médico Guardia",
  nominas: "Nóminas",
  desarrollo_organizacional: "Desarrollo Org.",
};

// Roles que pueden ver todos los tabs
const ROLES_VER_TODOS = ["super_admin", "agente_soporte_ti", "administrador_general"];
// Roles que pueden ver el tab corporativo
const ROLES_VER_CORPORATIVO = ["super_admin", "agente_soporte_ti", "administrador_general"];
// Roles que pueden gestionar (crear/editar/eliminar)
const ROLES_GESTIONAR = ["super_admin", "agente_soporte_ti", "administrador_general", "nominas"];
// Roles que pueden ELIMINAR empleados
const ROLES_ELIMINAR  = ["super_admin", "agente_soporte_ti", "administrador_general", "nominas"];

const Usuarios = () => {
  const { usuario: usuarioActual, setUsuario: setUsuarioActual } = useAuth();

  const queryClient = useQueryClient();
  const LIMIT = 25; // empleados por página
  const [pagina, setPagina] = useState(1);

  const [puestos, setPuestos]       = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [grupos, setGrupos]         = useState([]);
  const [horarios, setHorarios]     = useState([]);
  const [areas, setAreas]           = useState([]);
  const [rolesDisponibles, setRolesDisponibles] = useState(ROLES_DISPONIBLES_DEFAULT);
  const [modal, setModal]           = useState(false);
  const [editando, setEditando]     = useState(null);
  const [form, setForm]             = useState(FORM_VACIO);
  const [error, setError]           = useState("");
  const [guardando, setGuardando]   = useState(false);
  const [busqueda, setBusqueda]     = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroGrupo, setFiltroGrupo]       = useState("");
  const [tabActivo, setTabActivo]           = useState("todos");

  // Foto
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile]       = useState(null);
  const fotoInputRef = useRef(null);

  // Modal importar CSV
  const [modalImportar, setModalImportar]   = useState(false);
  const [csvFile, setCsvFile]               = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [importando, setImportando]         = useState(false);
  const csvInputRef = useRef(null);

  // Validación email en tiempo real
  const [emailEstado, setEmailEstado] = useState(null); // null | "verificando" | "disponible" | "ocupado"
  const emailTimerRef = useRef(null);

  const rolActual = usuarioActual?.rol || "";
  const puedeVerTodos       = ROLES_VER_TODOS.includes(rolActual);
  const puedeVerCorporativo = ROLES_VER_CORPORATIVO.includes(rolActual);
  const puedeGestionar      = ROLES_GESTIONAR.includes(rolActual) && (usuarioActual?.puedeEditar !== false);

  // El tab inicial depende del rol
  const tabInicial = puedeVerTodos ? "todos" : "sucursales";
  useEffect(() => { setTabActivo(tabInicial); }, [rolActual]); // eslint-disable-line

  // ─── React Query: carga de empleados paginada con caché ───────────────
  const queryKey = ["usuarios", tabActivo, filtroSucursal, filtroGrupo, busqueda, pagina];

  const {
    data: usuariosData,
    isLoading: cargando,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const filtros = { page: pagina, limit: LIMIT };
      if (tabActivo === "corporativo") filtros.tipo = "corporativo";
      if (tabActivo === "sucursales")  filtros.tipo = "sucursal";
      if (filtroSucursal) filtros.sucursalId = filtroSucursal;
      if (filtroGrupo)    filtros.grupoId    = filtroGrupo;
      if (busqueda)       filtros.q          = busqueda;
      const res = await getUsuariosPaginados(filtros);
      // Compatibilidad: respuesta puede ser array (sin paginación) o { data, total, pages }
      if (Array.isArray(res)) return { data: res, total: res.length, page: 1, pages: 1 };
      return res;
    },
    placeholderData: (prev) => prev, // mantiene datos anteriores mientras carga nueva página
  });

  const usuarios        = usuariosData?.data    ?? [];
  const totalUsuarios   = usuariosData?.total   ?? 0;
  const totalPaginas    = usuariosData?.pages   ?? 1;

  // Prefetch de la siguiente página
  useEffect(() => {
    if (pagina < totalPaginas) {
      const nextFiltros = { page: pagina + 1, limit: LIMIT };
      if (tabActivo === "corporativo") nextFiltros.tipo = "corporativo";
      if (tabActivo === "sucursales")  nextFiltros.tipo = "sucursal";
      if (filtroSucursal) nextFiltros.sucursalId = filtroSucursal;
      if (filtroGrupo)    nextFiltros.grupoId    = filtroGrupo;
      if (busqueda)       nextFiltros.q          = busqueda;
      queryClient.prefetchQuery({
        queryKey: ["usuarios", tabActivo, filtroSucursal, filtroGrupo, busqueda, pagina + 1],
        queryFn: () => getUsuariosPaginados(nextFiltros),
      });
    }
  }, [pagina, totalPaginas, tabActivo, filtroSucursal, filtroGrupo, busqueda, queryClient]);

  // Resetear a página 1 cuando cambien los filtros
  useEffect(() => { setPagina(1); }, [tabActivo, filtroSucursal, filtroGrupo, busqueda]);

  // ─── Catálogos auxiliares — staleTime corto para reflejar cambios inmediatamente ──
  const CATALOGO_STALE = 30 * 1000; // 30 s: siempre frescos sin saturar el servidor
  const { data: puestosData    } = useQuery({ queryKey: ["puestos"],    queryFn: getPuestos,    staleTime: CATALOGO_STALE, refetchOnMount: "always" });
  const { data: sucursalesData } = useQuery({ queryKey: ["sucursales"], queryFn: getSucursales, staleTime: CATALOGO_STALE, refetchOnMount: "always" });
  const { data: gruposData     } = useQuery({ queryKey: ["grupos"],     queryFn: getGrupos,     staleTime: CATALOGO_STALE, refetchOnMount: "always" });
  const { data: horariosData   } = useQuery({ queryKey: ["horarios"],   queryFn: getHorarios,   staleTime: CATALOGO_STALE, refetchOnMount: "always" });
  const { data: areasData      } = useQuery({ queryKey: ["areas"],      queryFn: getAreas,      staleTime: CATALOGO_STALE, refetchOnMount: "always" });
  const { data: rolesData      } = useQuery({ queryKey: ["roles"],      queryFn: getRoles,      staleTime: CATALOGO_STALE, refetchOnMount: "always" });

  useEffect(() => {
    if (puestosData)    setPuestos(Array.isArray(puestosData)    ? puestosData    : []);
    if (sucursalesData) setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
    if (gruposData)     setGrupos(Array.isArray(gruposData)     ? gruposData     : []);
    if (horariosData)   setHorarios(Array.isArray(horariosData)   ? horariosData   : []);
    if (areasData)      setAreas(Array.isArray(areasData)      ? areasData      : []);
    if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
      setRolesDisponibles(rolesData.map((r) => ({ value: r.clave, label: r.nombre })));
    }
  }, [puestosData, sucursalesData, gruposData, horariosData, areasData, rolesData]);

  const cargarDatos = () => {
    queryClient.invalidateQueries({ queryKey: ["usuarios"] });
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const nombreSucursal = (id) => sucursales.find((s) => s.id === id)?.nombre || "—";
  const nombrePuesto   = (id) => puestos.find((p) => p.id === id)?.nombre   || "—";
  const nombreGrupo    = (id) => grupos.find((g) => g.id === id)?.nombre    || "—";

  const puestoSeleccionado = puestos.find((p) => p.id === form.puestoId) || null;
  const camposExtra = puestoSeleccionado?.camposExtra || [];

  // ─── Filtrado por tab ──────────────────────────────────────────────────────
  const usuariosPorTab = (tab) => {
    let lista = [...usuarios];

    if (tab === "corporativo") {
      lista = lista.filter((u) => u.tipo === "corporativo");
    } else if (tab === "sucursales") {
      lista = lista.filter((u) => u.tipo === "sucursal" || !u.tipo);
      // Para roles sin acceso global: filtrar por su sucursal
      if (!puedeVerTodos && usuarioActual?.sucursalId) {
        lista = lista.filter((u) => u.sucursalId === usuarioActual.sucursalId);
      }
    }
    return lista;
  };

  // Con paginación server-side, usuarios ya viene filtrado del backend
  const usuariosFiltrados = usuarios;

  // ─── Modal ─────────────────────────────────────────────────────────────────
  const abrirCrear = () => {
    setEditando(null);
    setForm({
      ...FORM_VACIO,
      tipo: tabActivo === "corporativo" ? "corporativo" : "sucursal",
    });
    setFotoPreview(null);
    setFotoFile(null);
    setError("");
    setEmailEstado(null);
    setModal(true);
  };

  const abrirEditar = (u) => {
    setEditando(u.id);
    setEmailEstado(null);
    setForm({
      nombre:      u.nombre,
      apellido:    u.apellido ?? "",
      email:       u.email,
      password:    "",
      sexo:        u.sexo,
      edad:        u.edad,
      fechaNacimiento:        u.fechaNacimiento ? u.fechaNacimiento.slice(0, 10) : "",
      fechaInicioActividades: u.fechaInicioActividades ? u.fechaInicioActividades.slice(0, 10) : "",
      puestoId:    u.puestoId ?? "",
      horarioId:   u.horarioId ?? "",
      usaHorarioPuesto: !!u.usaHorarioPuesto,
      configDiasHorario: Array.isArray(u.configDiasHorario) && u.configDiasHorario.length === 7
        ? u.configDiasHorario
        : DEFAULT_CONFIG_DIAS,
      sucursalId:  u.sucursalId ?? "",
      rol:         u.rol,
      tipo:        u.tipo || "sucursal",
      departamento: u.departamento ?? "",
      datosExtra:  u.datosExtra || {},
      jefeInmediatoId: u.jefeInmediatoId ?? "",
      area:           u.area ?? "",
      evaluacionesHabilitadas: u.evaluacionesHabilitadas !== false,
    });
    setFotoPreview(u.fotoUrl ? `${BASE}${u.fotoUrl}` : null);
    setFotoFile(null);
    setError("");
    setModal(true);
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  // Verificación de email único con debounce de 600ms
  const verificarEmail = useCallback((emailVal, excluirId) => {
    clearTimeout(emailTimerRef.current);
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setEmailEstado(null);
      return;
    }
    setEmailEstado("verificando");
    emailTimerRef.current = setTimeout(async () => {
      try {
        const { disponible } = await verificarEmailDisponible(emailVal, excluirId || "");
        setEmailEstado(disponible ? "disponible" : "ocupado");
      } catch {
        setEmailEstado(null); // no bloquear si el servidor falla
      }
    }, 600);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "email") verificarEmail(value, editando?.id);
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Al cambiar tipo, limpiar campos que no aplican
      if (name === "tipo") {
        if (value === "corporativo") {
          next.sucursalId = "";
        } else {
          next.departamento = "";
        }
      }
      // Al seleccionar sucursal: sincronizar tipo del empleado con el tipo de la sucursal
      if (name === "sucursalId" && value) {
        const sucursalSeleccionada = sucursales.find((s) => s.id === value);
        if (sucursalSeleccionada?.tipo === "corporativo") {
          next.tipo = "corporativo";
        } else if (sucursalSeleccionada) {
          next.tipo = "sucursal";
        }
      }
      // Al cambiar puesto, resetear datosExtra
      if (name === "puestoId") {
        next.datosExtra = {};
      }
      return next;
    });
  };

  const handleDatoExtra = (campoId, valor) => {
    setForm((prev) => ({
      ...prev,
      datosExtra: { ...prev.datosExtra, [campoId]: valor },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (emailEstado === "ocupado") {
      toastError("El correo electrónico ya está en uso por otro usuario.");
      return;
    }
    if (emailEstado === "verificando") {
      toastAviso("Espera un momento, verificando disponibilidad del correo…");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      const datos = { ...form };
      if (!datos.password) delete datos.password;
      // Solo limpiar sucursalId si es corporativo y la sucursal elegida NO es corporativa
      if (datos.tipo === "corporativo") {
        const sucursalElegida = sucursales.find((s) => s.id === datos.sucursalId);
        if (!sucursalElegida || sucursalElegida.tipo !== "corporativo") {
          datos.sucursalId = null;
        }
      }
      if (datos.tipo === "sucursal") {
        delete datos.departamento;
      }
      // Limpiar datosExtra vacíos
      if (datos.datosExtra && Object.keys(datos.datosExtra).length === 0) {
        delete datos.datosExtra;
      }
      // Si usa horario del puesto o tiene un horario base asignado, limpiar configDiasHorario
      if (datos.usaHorarioPuesto || datos.horarioId) {
        datos.configDiasHorario = null;
      }

      let uid = editando;
      if (editando) {
        await actualizarUsuario(editando, datos);
      } else {
        const nuevo = await crearUsuario(datos);
        uid = nuevo.id;
      }
      // Subir foto si se seleccionó una
      if (fotoFile && uid) {
        const fotoRes = await subirFotoEmpleado(uid, fotoFile);
        // Si el empleado editado es el usuario logueado, sincronizar AuthContext
        if (uid === usuarioActual?.id && fotoRes?.fotoUrl) {
          setUsuarioActual((prev) => ({ ...prev, fotoUrl: fotoRes.fotoUrl }));
        }
      }
      setModal(false);
      toastExito(editando ? "Empleado actualizado correctamente" : "Empleado creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (!(await confirmar(`¿Eliminar permanentemente a "${nombre}"?\n\nEsta acción no se puede deshacer.`, "Eliminar", "danger"))) return;
    try {
      await eliminarUsuario(id);
      toastExito("Empleado eliminado correctamente");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err) {
      toastError(err);
    }
  };

  const handleDescargarPlantilla = async () => {
    try {
      const blob = await descargarPlantillaImportacion();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "plantilla_empleados.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err);
    }
  };

  const handleImportar = async () => {
    if (!csvFile) { toastAviso("Selecciona un archivo CSV"); return; }
    try {
      setImportando(true);
      const res = await importarUsuarios(csvFile);
      setResultadoImport(res);
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
      await cargarDatos();
    } catch (err) {
      toastError(err);
    } finally {
      setImportando(false);
    }
  };

  // ─── Render campo extra ────────────────────────────────────────────────────
  const renderCampoExtra = (campo) => {
    const val = form.datosExtra[campo.id] ?? "";
    const base = {
      id:       `extra-${campo.id}`,
      value:    val,
      required: campo.obligatorio,
      onChange: (e) => handleDatoExtra(campo.id, e.target.value),
    };

    if (campo.tipo === "select") {
      return (
        <select {...base}>
          <option value="">Seleccionar…</option>
          {(campo.opciones || []).map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        {...base}
        type={campo.tipo === "number" ? "number" : campo.tipo === "date" ? "date" : "text"}
      />
    );
  };

  // ─── Render tabla ──────────────────────────────────────────────────────────
  const esCorporativoTab = tabActivo === "corporativo";

  const renderTabla = (lista) => (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Sexo / Edad</th>
            <th>Puesto</th>
            {esCorporativoTab ? <th>Área / Departamento</th> : <th>Sucursal</th>}
            <th>Rol</th>
            <th>Estado</th>
            {puedeGestionar && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {lista.map((u) => (
            <tr key={u.id} className={!u.activo ? "row-inactiva" : ""}>
              <td>
                <div className="user-cell">
                  {u.fotoUrl ? (
                    <img
                      src={`${BASE}${u.fotoUrl}`}
                      alt={u.nombre}
                      className="emp-foto-sm"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <UserAvatar nombre={u.nombre} apellido={u.apellido} />
                  )}
                  <div>
                    <div className="user-name">{u.nombre} {u.apellido}</div>
                    <div className="user-email">{u.email}</div>
                    {u.fechaInicioActividades && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        <IcoBuilding />{calcularAntigüedad(u.fechaInicioActividades)}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className="capitalize">{u.sexo}</span> · {u.edad} años
                {u.fechaNacimiento && (
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <IcoCake />{new Date(u.fechaNacimiento + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </div>
                )}
              </td>
              <td>{nombrePuesto(u.puestoId)}</td>
              {esCorporativoTab
                ? <td>{u.departamento || "—"}</td>
                : <td>{nombreSucursal(u.sucursalId)}</td>
              }
              <td>
                <span className="badge badge-info">
                  {ROL_LABEL[u.rol] || u.rol}
                </span>
              </td>
              <td>
                <span className={`badge ${u.activo ? "badge-success" : "badge-danger"}`}>
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              {puedeGestionar && (
                <td>
                  <div className="action-btns">
                    <button
                      className="btn btn-secondary btn-xs icon-btn"
                      onClick={() => abrirEditar(u)}
                      title="Editar"
                    ><IcoEdit /></button>
                    {/* Reset 2FA — solo super_admin y agente_soporte_ti, solo para empleados (no para uno mismo) */}
                    {u.totpHabilitado && ["super_admin", "agente_soporte_ti", "administrador_general"].includes(rolActual) && u.id !== usuarioActual?.id && (
                      <button
                        className="btn btn-warning btn-xs icon-btn"
                        title="Restablecer 2FA"
                        onClick={async () => {
                          if (!(await confirmar(`¿Restablecer el 2FA de ${u.nombre} ${u.apellido}? Deberá configurarlo de nuevo.`, "Confirmar", "warning"))) return;
                          try {
                            await reset2FA(u.id);
                            await cargarDatos();
                            toastExito(`2FA restablecido para ${u.nombre}`);
                          } catch (err) { toastError(err); }
                        }}
                      ><IcoShield /><span style={{ marginLeft: 4, fontSize: "0.75rem" }}>2FA</span></button>
                    )}
                    {u.activo && ROLES_ELIMINAR.includes(rolActual) && u.id !== usuarioActual?.id && usuarioActual?.puedeEditar !== false && (
                      <button
                        className="btn btn-danger btn-xs icon-btn"
                        onClick={() => handleEliminar(u.id, `${u.nombre} ${u.apellido}`)}
                        title="Eliminar"
                      ><IcoTrash /></button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {lista.length === 0 && !cargando && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>No se encontraron empleados.</p>
        </div>
      )}

      {/* ── Paginación ───────────────────────────────────────────────── */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)", marginTop: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text2)" }}>
            {isFetching ? "Actualizando…" : `${totalUsuarios} empleado${totalUsuarios !== 1 ? "s" : ""} · Página ${pagina} de ${totalPaginas}`}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 13 }}
              disabled={pagina <= 1}
              onClick={() => setPagina(1)}
            >«</button>
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 13 }}
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >‹ Anterior</button>
            {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
              const start = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
              const p = start + i;
              return p <= totalPaginas ? (
                <button
                  key={p}
                  className={p === pagina ? "btn btn-primary" : "btn btn-secondary"}
                  style={{ padding: "4px 10px", fontSize: 13, minWidth: 36 }}
                  onClick={() => setPagina(p)}
                >{p}</button>
              ) : null;
            })}
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 13 }}
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >Siguiente ›</button>
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 13 }}
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(totalPaginas)}
            >»</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Tabs disponibles ──────────────────────────────────────────────────────
  const tabs = [];
  if (puedeVerTodos) {
    tabs.push({ id: "todos", label: `Todos (${totalUsuarios})` });
  }
  if (puedeVerCorporativo) {
    tabs.push({ id: "corporativo", label: "Corporativo" });
  }
  tabs.push({ id: "sucursales", label: "Sucursales" });

  if (cargando) return <div className="loading">Cargando empleados…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="page-subtitle">Gestión de personal por tipo y sucursal</p>
        </div>
        {puedeGestionar && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setResultadoImport(null); setCsvFile(null); setModalImportar(true); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Importar CSV
            </button>
            <button className="btn btn-primary" onClick={abrirCrear}>
              + Nuevo empleado
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-bar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "2px solid var(--border)", paddingBottom: "0" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTabActivo(t.id)}
            style={{
              padding: "0.5rem 1.25rem",
              border: "none",
              borderBottom: tabActivo === t.id ? "3px solid var(--primary)" : "3px solid transparent",
              background: "none",
              cursor: "pointer",
              fontWeight: tabActivo === t.id ? "700" : "400",
              color: tabActivo === t.id ? "var(--primary)" : "var(--text2)",
              fontSize: "0.9rem",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="filtros-bar">
        <input
          className="search-input"
          type="search"
          placeholder="🔍 Buscar por nombre o correo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {tabActivo === "sucursales" && puedeVerTodos && (
          <>
            <select
              className="filter-select"
              value={filtroSucursal}
              onChange={(e) => setFiltroSucursal(e.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
            >
              <option value="">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Tabla */}
      {renderTabla(usuariosFiltrados)}

      {/* Modal crear / editar */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div
            className="modal modal-large"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h2>{editando ? "Editar Empleado" : "Nuevo Empleado"}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}

              {/* Foto de perfil */}
              <div
                className="foto-upload-area"
                onClick={() => fotoInputRef.current?.click()}
              >
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Vista previa" className="emp-foto-preview" />
                ) : (
                  <div className="foto-upload-placeholder">
                    <span style={{ color: "var(--text2)", opacity: 0.7 }}><IcoCam /></span>
                    <span>Clic para subir foto</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                      JPG, PNG o WebP · máx 5 MB
                    </span>
                  </div>
                )}
                {fotoPreview && (
                  <div className="foto-overlay">
                    <span><IcoCam /> Cambiar</span>
                  </div>
                )}
              </div>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleFotoChange}
              />

              {/* Tipo de empleado */}
              <div className="form-group">
                <label>Tipo de empleado *</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} required>
                  <option value="sucursal">Sucursal</option>
                  <option value="corporativo">Corporativo</option>
                </select>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Nombre *</label>
                  <input name="nombre" value={form.nombre} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Apellido</label>
                  <input name="apellido" value={form.apellido} onChange={handleChange} />
                </div>
              </div>

              <div className="form-group">
                <label>Correo electrónico *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  style={emailEstado === "ocupado" ? { borderColor: "#ef4444", background: "#fef2f2" } : emailEstado === "disponible" ? { borderColor: "#22c55e" } : {}}
                />
                {emailEstado === "verificando" && (
                  <span style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, display: "block" }}>
                    🔄 Verificando disponibilidad…
                  </span>
                )}
                {emailEstado === "ocupado" && (
                  <span style={{ fontSize: 12, color: "#ef4444", marginTop: 4, display: "block", fontWeight: 500 }}>
                    ❌ Este correo ya está registrado en el sistema
                  </span>
                )}
                {emailEstado === "disponible" && (
                  <span style={{ fontSize: 12, color: "#22c55e", marginTop: 4, display: "block" }}>
                    ✅ Correo disponible
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>
                  {editando
                    ? "Nueva contraseña (vacío = sin cambios)"
                    : "Contraseña *"}
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required={!editando}
                  placeholder="Mín. 8 caracteres, mayúscula, número, especial"
                />
                <PasswordStrength password={form.password} />
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Sexo *</label>
                  <select name="sexo" value={form.sexo} onChange={handleChange} required>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Edad *</label>
                  <input
                    name="edad"
                    type="number"
                    min="16"
                    max="80"
                    value={form.edad}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Fecha de nacimiento</label>
                  <input
                    name="fechaNacimiento"
                    type="date"
                    className="form-control"
                    value={form.fechaNacimiento}
                    onChange={handleChange}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha inicio de actividades</label>
                  <input
                    name="fechaInicioActividades"
                    type="date"
                    className="form-control"
                    value={form.fechaInicioActividades}
                    onChange={handleChange}
                    max={new Date().toISOString().split("T")[0]}
                  />
                  {form.fechaInicioActividades && (
                    <small style={{ color: "var(--text-muted)" }}>
                      Antigüedad: {calcularAntigüedad(form.fechaInicioActividades)}
                    </small>
                  )}
                </div>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Puesto *</label>
                  <select name="puestoId" value={form.puestoId} onChange={handleChange} required>
                    <option value="">Seleccionar…</option>
                    {puestos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Rol en el sistema *</label>
                  <select name="rol" value={form.rol} onChange={handleChange} required>
                    {rolesDisponibles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Horario */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                <p style={{ fontWeight: "600", marginBottom: "0.75rem", color: "var(--text2)", fontSize: "0.85rem" }}>
                  ⏰ Horario de trabajo
                </p>
                <div className="form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!form.usaHorarioPuesto}
                      onChange={(e) => setForm((prev) => ({ ...prev, usaHorarioPuesto: e.target.checked }))}
                    />
                    Usar el horario asignado al puesto
                  </label>
                  <small style={{ color: "var(--text-muted)" }}>
                    Si está activo, el empleado heredará el horario del puesto asignado. Si no, puedes asignar uno personalizado.
                  </small>
                </div>
                {!form.usaHorarioPuesto && (
                  <div className="form-group">
                    <label>Horario base</label>
                    <select
                      name="horarioId"
                      className="form-control"
                      value={form.horarioId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          horarioId: id,
                          // Al seleccionar horario base, limpiar diseñador
                          configDiasHorario: id ? null : prev.configDiasHorario ?? DEFAULT_CONFIG_DIAS,
                        }));
                      }}
                    >
                      <option value="">— Diseñar horario personalizado —</option>
                      {horarios.filter((h) => h.activo !== false).map((h) => (
                        <option key={h.id} value={h.id}>{h.nombre}</option>
                      ))}
                    </select>
                    <small style={{ color: "var(--text-muted)" }}>
                      Selecciona un horario existente, o déjalo vacío para configurar días y horas manualmente.
                    </small>
                  </div>
                )}
                {!form.usaHorarioPuesto && !form.horarioId && (
                  <div className="form-group">
                    <label style={{ marginBottom: 8, display: "block" }}>
                      📅 Configurar horario personalizado por día
                    </label>
                    <DiseñadorHorario
                      value={form.configDiasHorario ?? DEFAULT_CONFIG_DIAS}
                      onChange={(config) => setForm((prev) => ({ ...prev, configDiasHorario: config }))}
                    />
                  </div>
                )}
              </div>

              {/* Sucursal: solo requerida cuando tipo = sucursal */}
              <div className="form-group">
                <label>
                  Sucursal asignada{" "}
                  {form.tipo === "sucursal" ? "*" : "(opcional)"}
                </label>
                <select
                  name="sucursalId"
                  value={form.sucursalId}
                  onChange={handleChange}
                  required={form.tipo === "sucursal"}
                >
                  <option value="">Seleccionar sucursal…</option>
                  {sucursales.filter((s) => s.activa).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.tipo === "corporativo" ? "🏛️" : "🏢"} {s.nombre} – {s.ciudad}
                    </option>
                  ))}
                </select>
              </div>

              {/* Departamento: solo visible cuando tipo = corporativo */}
              {form.tipo === "corporativo" && (
                <div className="form-group">
                  <label>Área / Departamento</label>
                  <input
                    name="departamento"
                    value={form.departamento}
                    onChange={handleChange}
                    placeholder="Ej. Recursos Humanos, Finanzas…"
                  />
                </div>
              )}

              {/* Jefe inmediato y área organizacional */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                <p style={{ fontWeight: "600", marginBottom: "0.75rem", color: "var(--text2)", fontSize: "0.85rem" }}>
                  Organigrama
                </p>
                <div className="form-group">
                  <label>Jefe inmediato</label>
                  <select
                    className="form-control"
                    value={form.jefeInmediatoId}
                    onChange={(e) => setForm({ ...form, jefeInmediatoId: e.target.value })}
                  >
                    <option value="">— Sin jefe inmediato —</option>
                    {usuarios
                      .filter((u) => u.activo && u.id !== editando)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} {u.apellido || ""} ({ROL_LABEL[u.rol] || u.rol})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Área organizacional</label>
                  <select
                    className="form-control"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  >
                    <option value="">Sin área asignada</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.nombre}>{a.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campos extra del puesto */}
              {camposExtra.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <p style={{ fontWeight: "600", marginBottom: "0.75rem", color: "var(--text2)", fontSize: "0.85rem" }}>
                    Campos adicionales del puesto
                  </p>
                  {camposExtra.map((campo) => (
                    <div className="form-group" key={campo.id}>
                      <label>
                        {campo.nombre}
                        {campo.obligatorio ? " *" : ""}
                      </label>
                      {renderCampoExtra(campo)}
                    </div>
                  ))}
                </div>
              )}

              {/* Desarrollo Organizacional */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                <p style={{ fontWeight: "600", marginBottom: "0.75rem", color: "var(--text2)", fontSize: "0.85rem" }}>
                  🧠 Desarrollo Organizacional
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!form.evaluacionesHabilitadas}
                    onChange={(e) => setForm((prev) => ({ ...prev, evaluacionesHabilitadas: e.target.checked }))}
                  />
                  Habilitar evaluaciones para este empleado
                </label>
                <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
                  Si está activo, el empleado aparecerá en la sección de Desarrollo Organizacional para recibir evaluaciones.
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando…"
                    : editando
                    ? "Actualizar"
                    : "Crear empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Importar CSV ──────────────────────────────────────────────── */}
      {modalImportar && (
        <div className="modal-overlay" onClick={() => setModalImportar(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 Importar Empleados (CSV)</h2>
              <button className="modal-close" onClick={() => setModalImportar(false)}>✕</button>
            </div>
            <div className="modal-body">
              {resultadoImport ? (
                <div>
                  <div className="alert alert-success" style={{ marginBottom: 12 }}>
                    ✅ Importación completada: <strong>{resultadoImport.importados}</strong> empleado(s) importado(s).
                  </div>
                  {resultadoImport.errores?.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--danger)", marginBottom: 8 }}>
                        Errores ({resultadoImport.errores.length}):
                      </p>
                      <ul style={{ fontSize: 13, paddingLeft: 20, maxHeight: 160, overflowY: "auto" }}>
                        {resultadoImport.errores.map((e, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>
                            <strong>Fila {e.fila}:</strong> {e.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 14 }}>
                    Descarga la plantilla, llénala con los datos de los empleados y sube el archivo CSV.
                  </p>
                  <button className="btn btn-secondary" style={{ marginBottom: 16 }} onClick={handleDescargarPlantilla}>
                    📄 Descargar plantilla CSV
                  </button>
                  <div className="form-group">
                    <label>Archivo CSV *</label>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="form-control"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                    />
                    {csvFile && (
                      <small style={{ color: "var(--text-muted)" }}>{csvFile.name} — {(csvFile.size / 1024).toFixed(1)} KB</small>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setModalImportar(false); setResultadoImport(null); }}>
                {resultadoImport ? "Cerrar" : "Cancelar"}
              </button>
              {!resultadoImport && (
                <button className="btn btn-primary" disabled={!csvFile || importando} onClick={handleImportar}>
                  {importando ? "Importando..." : "Importar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
