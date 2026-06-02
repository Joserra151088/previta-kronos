/**
 * Eventos.jsx — Matriz de asistencia por días × empleados
 * Columnas = días del rango seleccionado
 * Filas    = empleados (paginados de 10 en 10)
 * Colores  : verde = registrado, rojo = fuera de horario / ausente en día pasado
 * Filtros  : grupo, estado (entidad federativa), texto de empleado
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
  actualizarRegistroManual,
  crearRegistroManual,
  getGrupos,
  getIncidencias,
  getRegistros,
  getSucursales,
  getUsuarios,
} from "../utils/api";

const ROLES_CAPTURA = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia"];
const ROLES_EDICION = ["super_admin", "agente_soporte_ti", "supervisor_sucursales"];

const TIPOS = [
  { val: "entrada",           label: "E",   full: "Entrada",         color: "#77B328" },
  { val: "salida_alimentos",  label: "SA",  full: "Salida alimentos", color: "#d29922" },
  { val: "regreso_alimentos", label: "RA",  full: "Regreso alimentos",color: "#388bfd" },
  { val: "salida",            label: "S",   full: "Salida",           color: "#f85149" },
];

const TIPOS_REGISTRO = [
  { val: "entrada",           label: "Entrada" },
  { val: "salida_alimentos",  label: "Salida a comer" },
  { val: "regreso_alimentos", label: "Regreso de comer" },
  { val: "salida",            label: "Salida final" },
];

const PAGE_SIZE = 10;

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const fmt = (d) => d.toISOString().split("T")[0];           // "YYYY-MM-DD"
const hoy = () => fmt(new Date());

/** Lunes de la semana que contiene `fecha` */
const lunesDeSemana = (fecha) => {
  const d = new Date(fecha + "T12:00:00");
  const dow = d.getDay();                                    // 0=Dom
  d.setDate(d.getDate() - ((dow + 6) % 7));                 // retrocede a lunes
  return fmt(d);
};

/** Genera un array de N fechas a partir de startDate */
const generarRango = (startDate, dias = 7) =>
  Array.from({ length: dias }, (_, i) => {
    const d = new Date(startDate + "T12:00:00");
    d.setDate(d.getDate() + i);
    return fmt(d);
  });

const diaSemana = (fechaStr) =>
  new Date(fechaStr + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "numeric" });

const ahora = () => new Date().toTimeString().slice(0, 5);

// ─── Chip de registro ─────────────────────────────────────────────────────────
const Chip = ({ reg, tipo, diaStr, onClick }) => {
  const esPasado    = diaStr < hoy();
  const esHoy       = diaStr === hoy();
  const tipoInfo    = TIPOS.find((t) => t.val === tipo);

  if (reg) {
    const tardeColor = reg.fueraDeHorario ? "#f85149" : tipoInfo.color;
    return (
      <span
        title={`${tipoInfo.full}: ${reg.hora?.slice(0,5)}${reg.fueraDeHorario ? " ⚠ Fuera de horario" : ""}${reg.esManual ? " (manual)" : ""}${reg.fotoUrl ? " — clic para ver foto" : ""}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 2,
          background: tardeColor + "22", border: `1px solid ${tardeColor}`,
          color: tardeColor, borderRadius: 4, padding: "1px 5px",
          fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
          fontFamily: "monospace",
        }}
        onClick={onClick}
      >
        {tipoInfo.label} <span style={{ opacity: 0.75 }}>{reg.hora?.slice(0,5)}</span>
        {reg.fotoUrl && <span style={{ fontSize: "0.6rem", opacity: 0.8, marginLeft: 1 }}>📷</span>}
      </span>
    );
  }

  // Sin registro
  if (esPasado) {
    return (
      <span title={`${tipoInfo.full}: ausente`} style={{
        display: "inline-block", width: 22, height: 16,
        background: "rgba(248,81,73,0.12)", border: "1px solid rgba(248,81,73,0.35)",
        borderRadius: 4, fontSize: "0.62rem", color: "#f85149",
        textAlign: "center", lineHeight: "16px", fontWeight: 700,
      }}>—</span>
    );
  }
  if (esHoy) {
    return (
      <span title={`${tipoInfo.full}: pendiente`} style={{
        display: "inline-block", width: 22, height: 16,
        background: "var(--bg3)", border: "1px dashed var(--border)",
        borderRadius: 4, fontSize: "0.62rem", color: "var(--text2)",
        textAlign: "center", lineHeight: "16px",
      }}>·</span>
    );
  }
  return null; // futuro
};

// ─── Vista Por Sucursal ───────────────────────────────────────────────────────

function VistaPorSucursal({ sucursales, usuarios, registros, hoyStr }) {
  // Agrupar usuarios por sucursal
  const usuariosPorSucursal = {};
  for (const u of usuarios) {
    const sid = u.sucursalId || "sin_sucursal";
    if (!usuariosPorSucursal[sid]) usuariosPorSucursal[sid] = [];
    usuariosPorSucursal[sid].push(u);
  }

  // Índice de registros de hoy: { usuarioId: { tipo: registro } }
  const regHoyIndex = {};
  for (const r of registros) {
    if (r.fecha !== hoyStr) continue;
    if (!regHoyIndex[r.usuarioId]) regHoyIndex[r.usuarioId] = {};
    regHoyIndex[r.usuarioId][r.tipo] = r;
  }

  const sucursalesConEmpleados = sucursales.filter(
    (s) => usuariosPorSucursal[s.id]?.length > 0
  );

  if (sucursalesConEmpleados.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏢</div>
        <p>No hay sucursales con empleados registrados</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {sucursalesConEmpleados.map((sucursal) => {
        const emps = usuariosPorSucursal[sucursal.id] || [];
        let presentes = 0;
        const estadosEmpleados = emps.map((emp) => {
          const regs = regHoyIndex[emp.id] || {};
          const tiposRegistrados = Object.keys(regs);
          const tieneEntrada = Boolean(regs.entrada);
          const tieneSalida = Boolean(regs.salida);
          const status =
            tieneEntrada && tieneSalida ? "completo" :
            tieneEntrada ? "en_progreso" :
            "ausente";
          if (tieneEntrada) presentes++;
          return { emp, regs, status, tiposRegistrados };
        });
        const pct = emps.length > 0 ? Math.round((presentes / emps.length) * 100) : 0;

        const statusColor = {
          completo:    "#22c55e",
          en_progreso: "#3b82f6",
          ausente:     "#ef4444",
        };
        const statusLabel = {
          completo:    "Completo",
          en_progreso: "En progreso",
          ausente:     "Sin registros",
        };

        return (
          <div key={sucursal.id} className="card">
            {/* Sucursal header */}
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>🏢 {sucursal.nombre}</span>
                {sucursal.municipio && (
                  <span style={{ color: "var(--text2)", fontSize: "0.8rem", marginLeft: 10 }}>
                    📍 {sucursal.municipio}{sucursal.estado ? `, ${sucursal.estado}` : ""}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
                  <strong style={{ color: presentes >= emps.length ? "#22c55e" : presentes > 0 ? "#3b82f6" : "#ef4444" }}>
                    {presentes}
                  </strong> / {emps.length} empleados presentes
                </div>
                {/* Progress bar */}
                <div style={{ width: 80, height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444",
                    borderRadius: 4, transition: "width 0.3s",
                  }} />
                </div>
                <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{pct}%</span>
              </div>
            </div>

            {/* Tabla de empleados */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg3)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", minWidth: 140 }}>Empleado</th>
                    {TIPOS.map((t) => (
                      <th key={t.val} style={{ padding: "8px 8px", textAlign: "center", minWidth: 80, color: t.color }}>
                        {t.label}
                      </th>
                    ))}
                    <th style={{ padding: "8px 12px", textAlign: "center", minWidth: 100 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {estadosEmpleados.map(({ emp, regs, status }, idx) => (
                    <tr key={emp.id} style={{
                      background: idx % 2 === 0 ? "transparent" : "var(--bg2)",
                      borderBottom: "1px solid var(--border)",
                    }}>
                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                        {emp.nombre} {emp.apellido}
                      </td>
                      {TIPOS.map((t) => {
                        const reg = regs[t.val];
                        return (
                          <td key={t.val} style={{ padding: "6px 8px", textAlign: "center" }}>
                            {reg ? (
                              <span style={{
                                color: reg.fueraDeHorario ? "#f85149" : t.color,
                                fontFamily: "monospace", fontSize: "0.8rem",
                                background: (reg.fueraDeHorario ? "#f85149" : t.color) + "22",
                                padding: "2px 6px", borderRadius: 4,
                                border: `1px solid ${reg.fueraDeHorario ? "#f85149" : t.color}55`,
                              }}>
                                {reg.hora?.slice(0, 5) || "?"}
                                {reg.fueraDeHorario ? " ⚠" : ""}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text2)", opacity: 0.4 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        <span style={{
                          padding: "2px 10px", borderRadius: 12,
                          fontSize: "0.75rem", fontWeight: 700,
                          color: statusColor[status],
                          background: statusColor[status] + "18",
                        }}>
                          {statusLabel[status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const Eventos = () => {
  const { usuario } = useAuth();
  const { socket, conectado } = useSocket();
  const puedeCapturar = ROLES_CAPTURA.includes(usuario?.rol);
  const puedeEditar   = ROLES_EDICION.includes(usuario?.rol);

  // Vista toggle
  const [vista, setVista] = useState("empleado");

  // Datos base
  const [sucursales, setSucursales] = useState([]);
  const [grupos,     setGrupos]     = useState([]);
  const [usuarios,   setUsuarios]   = useState([]);
  const [registros,  setRegistros]  = useState([]);
  const [incidenciasMap, setIncidenciasMap] = useState({}); // { [usuarioId+fecha]: incidencia }
  const [cargando,   setCargando]   = useState(false);
  const [ultimoEvento, setUltimoEvento] = useState(null);

  // Rango de fechas (semana navegable)
  const [semanaInicio, setSemanaInicio] = useState(lunesDeSemana(hoy()));
  const rango = useMemo(() => generarRango(semanaInicio, 7), [semanaInicio]);
  const irSemana = (delta) => {
    const d = new Date(semanaInicio + "T12:00:00");
    d.setDate(d.getDate() + delta * 7);
    setSemanaInicio(fmt(d));
  };

  // Filtros
  const [filtroGrupo,    setFiltroGrupo]    = useState("");
  const [filtroEstado,   setFiltroEstado]   = useState("");
  const [filtroEmpleado, setFiltroEmpleado] = useState("");

  // Paginación
  const [pagina, setPagina] = useState(1);

  // Modal
  const [modalCrear,   setModalCrear]   = useState(false);
  const [modalEditar,  setModalEditar]  = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null); // registro para ver detalle/foto
  const [errorForm,    setErrorForm]    = useState("");
  const [guardando,    setGuardando]    = useState(false);
  const [form, setForm] = useState({
    usuarioId: "", sucursalId: "", tipo: "entrada",
    fecha: hoy(), hora: ahora(), justificacion: "", motivoEdicionManual: "",
  });

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    getSucursales().then(setSucursales).catch(() => {});
    getGrupos().then(setGrupos).catch(() => {});
    getUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  // ── Carga de registros del rango ───────────────────────────────────────────
  const cargarRegistros = useCallback(async () => {
    setCargando(true);
    try {
      const fin = rango[rango.length - 1];
      const [lista, listaInc] = await Promise.all([
        getRegistros({ fechaInicio: semanaInicio, fechaFin: fin }),
        getIncidencias({ estado: "aprobada" }).catch(() => []),
      ]);
      setRegistros(lista);
      // Construir mapa { "usuarioId|YYYY-MM-DD": incidencia } para incidencias aprobadas que cubren el día
      const mapa = {};
      listaInc.forEach((inc) => {
        if (!inc.fechaIncidencia) return;
        const inicio = new Date(inc.fechaIncidencia + "T12:00:00");
        const fin_   = inc.fechaFin ? new Date(inc.fechaFin + "T12:00:00") : inicio;
        // Iterar por cada día del rango de la incidencia
        const cursor = new Date(inicio);
        while (cursor <= fin_) {
          const key = `${inc.usuarioId}|${cursor.toISOString().slice(0, 10)}`;
          mapa[key] = inc;
          cursor.setDate(cursor.getDate() + 1);
        }
      });
      setIncidenciasMap(mapa);
    } finally {
      setCargando(false);
    }
  }, [semanaInicio, rango]);

  useEffect(() => { cargarRegistros(); }, [cargarRegistros]);

  // ── WebSocket en tiempo real ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return undefined;
    const handler = (payload) => {
      setUltimoEvento(payload);
      cargarRegistros();
    };
    socket.on("registro_evento", handler);
    return () => socket.off("registro_evento", handler);
  }, [socket, cargarRegistros]);

  // ── Estados únicos de entidades federativas en las sucursales ─────────────
  const estadosFederativos = useMemo(
    () => [...new Set(sucursales.map((s) => s.estado).filter(Boolean))].sort(),
    [sucursales]
  );

  // ── Sucursales filtradas por grupo+estado ──────────────────────────────────
  const sucursalesFiltradas = useMemo(() => {
    let lista = sucursales;
    if (filtroEstado) lista = lista.filter((s) => s.estado === filtroEstado);
    if (filtroGrupo) {
      const grupo = grupos.find((g) => g.id === filtroGrupo);
      const ids   = new Set(grupo?.sucursales?.map((s) => s.id || s) || []);
      lista = lista.filter((s) => ids.has(s.id));
    }
    return lista;
  }, [sucursales, grupos, filtroEstado, filtroGrupo]);

  const sucursalIds = useMemo(() => new Set(sucursalesFiltradas.map((s) => s.id)), [sucursalesFiltradas]);

  // ── Empleados filtrados ────────────────────────────────────────────────────
  const empleadosFiltrados = useMemo(() => {
    let lista = usuarios.filter((u) => !u.sucursalId || sucursalIds.has(u.sucursalId));
    if (filtroEmpleado) {
      const q = filtroEmpleado.toLowerCase();
      lista = lista.filter((u) =>
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [usuarios, sucursalIds, filtroEmpleado]);

  // ── Paginación ─────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(empleadosFiltrados.length / PAGE_SIZE));
  const empleadosPagina = useMemo(
    () => empleadosFiltrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [empleadosFiltrados, pagina]
  );

  // Reset página cuando cambian filtros
  useEffect(() => { setPagina(1); }, [filtroGrupo, filtroEstado, filtroEmpleado, semanaInicio]);

  // ── Índice de registros por [usuarioId][fecha][tipo] ──────────────────────
  const regIndex = useMemo(() => {
    const idx = {};
    for (const r of registros) {
      if (!idx[r.usuarioId]) idx[r.usuarioId] = {};
      if (!idx[r.usuarioId][r.fecha]) idx[r.usuarioId][r.fecha] = {};
      idx[r.usuarioId][r.fecha][r.tipo] = r;
    }
    return idx;
  }, [registros]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const abrirCrear = () => {
    setErrorForm("");
    setForm({ usuarioId: "", sucursalId: "", tipo: "entrada", fecha: hoy(), hora: ahora(), justificacion: "", motivoEdicionManual: "" });
    setModalCrear(true);
  };

  const abrirEditar = (reg) => {
    setErrorForm("");
    setForm({
      usuarioId: reg.usuarioId, sucursalId: reg.sucursalId,
      tipo: reg.tipo, fecha: reg.fecha,
      hora: reg.hora?.slice(0, 5) || ahora(),
      justificacion: reg.justificacion || "",
      motivoEdicionManual: reg.motivoEdicionManual || "",
    });
    setModalEditar(reg);
  };

  const guardarRegistro = async (e) => {
    e.preventDefault();
    setErrorForm("");
    setGuardando(true);
    try {
      if (modalEditar) {
        await actualizarRegistroManual(modalEditar.id, form);
        setModalEditar(null);
      } else {
        await crearRegistroManual(form);
        setModalCrear(false);
      }
      await cargarRegistros();
    } catch (err) {
      setErrorForm(err.message || "No se pudo guardar el registro");
    } finally {
      setGuardando(false);
    }
  };

  const cerrarModal = () => { setModalCrear(false); setModalEditar(null); };

  // ── Semana label ───────────────────────────────────────────────────────────
  const semanaLabel = `${new Date(rango[0] + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${new Date(rango[6] + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="page" style={{ maxWidth: "100%", overflowX: "hidden" }}>
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Eventos de asistencia</h1>
          <p className="subtitle">Matriz de registros por empleado y día</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg3)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
            <button
              className={`btn btn-sm ${vista === "empleado" ? "btn-primary" : "btn-secondary"}`}
              style={{ borderRadius: 6 }}
              onClick={() => setVista("empleado")}
            >
              👤 Por Empleado
            </button>
            <button
              className={`btn btn-sm ${vista === "sucursal" ? "btn-primary" : "btn-secondary"}`}
              style={{ borderRadius: 6 }}
              onClick={() => setVista("sucursal")}
            >
              🏢 Por Sucursal
            </button>
          </div>
          <div className={`live-pill ${conectado ? "live-pill-on" : ""}`}>
            <span className="live-dot" />
            {conectado ? "En vivo" : "Sin conexión"}
          </div>
          {puedeCapturar && (
            <button className="btn btn-primary" onClick={abrirCrear}>+ Registro manual</button>
          )}
        </div>
      </div>

      {/* ── Último evento ──────────────────────────────────────────────────── */}
      {ultimoEvento && (
        <div className="alert alert-info" style={{ marginBottom: 12, fontSize: "0.84rem" }}>
          🔔 Nuevo evento: <strong>{ultimoEvento.registro?.usuarioNombre}</strong> — {ultimoEvento.registro?.tipo?.replace(/_/g, " ")} a las {ultimoEvento.registro?.hora?.slice(0,5)}
        </div>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select className="filter-select" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">Todos los grupos</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>

          <select className="filter-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">Todas las entidades</option>
            {estadosFederativos.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          <input
            className="filter-select"
            type="text"
            placeholder="Buscar empleado…"
            value={filtroEmpleado}
            onChange={(e) => setFiltroEmpleado(e.target.value)}
            style={{ minWidth: 180 }}
          />

          {(filtroGrupo || filtroEstado || filtroEmpleado) && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setFiltroGrupo(""); setFiltroEstado(""); setFiltroEmpleado(""); }}>
              Limpiar filtros
            </button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => irSemana(-1)}>‹ Anterior</button>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", minWidth: 180, textAlign: "center" }}>{semanaLabel}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => irSemana(1)}>Siguiente ›</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSemanaInicio(lunesDeSemana(hoy()))}>Hoy</button>
          </div>
        </div>
      </div>

      {/* ── Leyenda ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: "0.78rem", flexWrap: "wrap", color: "var(--text2)" }}>
        {TIPOS.map((t) => (
          <span key={t.val} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color, display: "inline-block" }} />
            <strong style={{ color: t.color }}>{t.label}</strong> = {t.full}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f85149", display: "inline-block", opacity: 0.4 }} />
          <strong style={{ color: "#f85149" }}>—</strong> = Ausente (día pasado)
        </span>
        <span>⚠️ = Fuera de horario</span>
      </div>

      {/* ── Vista principal (condicional) ──────────────────────────────────── */}
      {vista === "sucursal" ? (
        cargando ? (
          <div className="loading">Cargando registros…</div>
        ) : (
          <VistaPorSucursal
            sucursales={sucursalesFiltradas}
            usuarios={empleadosFiltrados}
            registros={registros}
            hoyStr={hoy()}
          />
        )
      ) : (
        <>
          {/* ── Tabla matriz ─────────────────────────────────────────────── */}
          {cargando ? (
            <div className="loading">Cargando registros…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg2)", borderBottom: "2px solid var(--border)" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", minWidth: 160, position: "sticky", left: 0, background: "var(--bg2)", zIndex: 1 }}>
                      Empleado
                    </th>
                    {rango.map((dia) => (
                      <th key={dia} style={{
                        padding: "10px 8px", textAlign: "center", minWidth: 120,
                        color: dia === hoy() ? "var(--accent)" : "var(--text3)",
                        fontWeight: dia === hoy() ? 700 : 500,
                        borderLeft: dia === hoy() ? "2px solid var(--accent)" : "1px solid var(--border)",
                      }}>
                        {diaSemana(dia)}
                        {dia === hoy() && <div style={{ fontSize: "0.65rem", color: "var(--accent)" }}>HOY</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empleadosPagina.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text2)" }}>
                        No hay empleados para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : empleadosPagina.map((emp, idx) => (
                    <tr key={emp.id} style={{
                      borderBottom: "1px solid var(--border)",
                      background: idx % 2 === 0 ? "transparent" : "var(--bg2)",
                    }}>
                      {/* Columna empleado */}
                      <td style={{ padding: "10px 14px", position: "sticky", left: 0, background: idx % 2 === 0 ? "var(--bg)" : "var(--bg2)", zIndex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{emp.nombre} {emp.apellido}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                          {sucursales.find((s) => s.id === emp.sucursalId)?.nombre || "—"}
                        </div>
                      </td>

                      {/* Columnas de días */}
                      {rango.map((dia) => {
                        const regsDelDia  = regIndex[emp.id]?.[dia] || {};
                        const incActiva   = incidenciasMap[`${emp.id}|${dia}`];
                        return (
                          <td key={dia} style={{
                            padding: "8px 6px", textAlign: "center", verticalAlign: "middle",
                            borderLeft: dia === hoy() ? "2px solid var(--accent)" : "1px solid var(--border)",
                            background: incActiva ? "rgba(239,68,68,0.05)" : undefined,
                          }}>
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                              {TIPOS.map((t) => (
                                <Chip
                                  key={t.val}
                                  reg={regsDelDia[t.val]}
                                  tipo={t.val}
                                  diaStr={dia}
                                  onClick={regsDelDia[t.val] ? () => setModalDetalle(regsDelDia[t.val]) : undefined}
                                />
                              ))}
                              {incActiva && (
                                <span
                                  title={`Incidencia: ${incActiva.tipoNombre || ""}`}
                                  style={{
                                    fontSize: 11,
                                    background: "#a855f7",
                                    color: "#fff",
                                    borderRadius: 4,
                                    padding: "1px 4px",
                                    cursor: "default",
                                  }}
                                >
                                  ⚠
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Paginación ─────────────────────────────────────────────── */}
          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16, alignItems: "center" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPagina(1)} disabled={pagina === 1}>«</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>‹</button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - pagina) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === pagina ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setPagina(p)}
                  >{p}</button>
                ))
              }
              <button className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>›</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas}>»</button>
              <span style={{ color: "var(--text2)", fontSize: "0.82rem" }}>
                {empleadosFiltrados.length} empleados · pág {pagina}/{totalPaginas}
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Modal Detalle / Foto ────────────────────────────────────────────── */}
      {modalDetalle && (() => {
        const reg = modalDetalle;
        const tipoInfo = TIPOS.find((t) => t.val === reg.tipo);
        const emp = usuarios.find((u) => u.id === reg.usuarioId);
        return (
          <div className="modal-overlay" onClick={() => setModalDetalle(null)}>
            <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📋 Detalle del registro</h2>
                <button className="modal-close" onClick={() => setModalDetalle(null)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Foto */}
                {reg.fotoUrl ? (
                  <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", background: "#000" }}>
                    <img
                      src={`${BASE_URL}${reg.fotoUrl}`}
                      alt="Foto de registro"
                      style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div style={{
                    marginBottom: 16, borderRadius: 10, padding: "28px 0",
                    background: "var(--bg3)", border: "1px dashed var(--border)",
                    textAlign: "center", color: "var(--text2)", fontSize: "0.85rem",
                  }}>
                    📷 Sin foto en este registro
                  </div>
                )}

                {/* Info del registro */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Empleado</div>
                    <div style={{ fontWeight: 600 }}>{emp ? `${emp.nombre} ${emp.apellido}` : reg.usuarioNombre || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Tipo</div>
                    <div style={{ fontWeight: 600, color: tipoInfo?.color }}>{tipoInfo?.full || reg.tipo}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Fecha</div>
                    <div style={{ fontWeight: 600 }}>{reg.fecha}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Hora</div>
                    <div style={{ fontWeight: 600 }}>{reg.hora?.slice(0, 5)}</div>
                  </div>
                </div>

                {/* Badges de estado */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {reg.fueraDeHorario && (
                    <span style={{ background: "#f8514922", border: "1px solid #f85149", color: "#f85149", borderRadius: 4, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600 }}>
                      ⚠️ Fuera de horario
                    </span>
                  )}
                  {reg.fueraDeGeocerca && (
                    <span style={{ background: "#d2992222", border: "1px solid #d29922", color: "#d29922", borderRadius: 4, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600 }}>
                      📍 Fuera de geocerca
                    </span>
                  )}
                  {reg.esManual && (
                    <span style={{ background: "#388bfd22", border: "1px solid #388bfd", color: "#388bfd", borderRadius: 4, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600 }}>
                      ✏️ Manual
                    </span>
                  )}
                </div>

                {/* Motivos */}
                {reg.motivoFueraHorario && (
                  <div style={{ marginBottom: 8, fontSize: "0.82rem", background: "var(--bg3)", borderRadius: 6, padding: "8px 10px" }}>
                    <strong>Motivo fuera de horario:</strong> {reg.motivoFueraHorario}
                  </div>
                )}
                {reg.motivoFueraGeocerca && (
                  <div style={{ marginBottom: 8, fontSize: "0.82rem", background: "var(--bg3)", borderRadius: 6, padding: "8px 10px" }}>
                    <strong>Motivo fuera de geocerca:</strong> {reg.motivoFueraGeocerca}
                  </div>
                )}
                {reg.justificacion && (
                  <div style={{ marginBottom: 8, fontSize: "0.82rem", background: "var(--bg3)", borderRadius: 6, padding: "8px 10px" }}>
                    <strong>Justificación:</strong> {reg.justificacion}
                  </div>
                )}

                {/* Footer */}
                <div className="modal-footer" style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setModalDetalle(null)}>Cerrar</button>
                  {puedeEditar && (
                    <button
                      className="btn btn-primary"
                      onClick={() => { setModalDetalle(null); abrirEditar(reg); }}
                    >
                      ✏️ Editar registro
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Crear / Editar ────────────────────────────────────────────── */}
      {(modalCrear || modalEditar) && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalEditar ? "Editar registro" : "Nuevo registro manual"}</h2>
              <button className="modal-close" onClick={cerrarModal}>✕</button>
            </div>
            <form onSubmit={guardarRegistro} className="modal-body">
              {errorForm && <div className="alert alert-danger">{errorForm}</div>}

              {!modalEditar && (
                <div className="form-group">
                  <label>Empleado *</label>
                  <select className="form-control" value={form.usuarioId}
                    onChange={(e) => setForm({ ...form, usuarioId: e.target.value })} required>
                    <option value="">Selecciona empleado…</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Sucursal *</label>
                <select className="form-control" value={form.sucursalId}
                  onChange={(e) => setForm({ ...form, sucursalId: e.target.value })} required>
                  <option value="">Selecciona sucursal…</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Tipo *</label>
                <select className="form-control" value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })} required>
                  {TIPOS_REGISTRO.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label>Fecha *</label>
                  <input type="date" className="form-control" value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Hora *</label>
                  <input type="time" className="form-control" value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label>{modalEditar ? "Motivo del cambio" : "Justificación"}</label>
                <textarea className="form-control" rows={3}
                  value={modalEditar ? form.motivoEdicionManual : form.justificacion}
                  onChange={(e) => setForm({
                    ...form,
                    ...(modalEditar ? { motivoEdicionManual: e.target.value } : { justificacion: e.target.value }),
                  })}
                  placeholder={modalEditar ? "Describe por qué se corrige…" : "Motivo del registro manual…"}
                />
              </div>

              {modalEditar && (
                <div className="form-group">
                  <label>Justificación visible</label>
                  <textarea className="form-control" rows={2} value={form.justificacion}
                    onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
                    placeholder="Texto visible para el registro…" />
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? "Guardando…" : modalEditar ? "Guardar cambio" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Eventos;
