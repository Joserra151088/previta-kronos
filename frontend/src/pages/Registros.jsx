/**
 * Registros.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de registros de acceso / asistencia.
 *
 * Roles de gestión (pueden ver todos los registros, crear manuales, aprobar):
 *   super_admin, agente_soporte_ti, supervisor_sucursales, agente_control_asistencia
 *
 * Empleados (medico_titular, medico_de_guardia, visor_reportes…):
 *   - Ven solo sus propios registros del día
 *   - Visualizan el tiempo trabajado en el día actual
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getRegistros, getReporte, getSucursales, getRegistrosHoy,
  crearRegistroManual, aprobarRegistro, rechazarRegistro, getUsuarios,
} from "../utils/api";
import { formatearMinutos } from "../utils/minutos";
import { toastError, toastAviso, confirmar } from "../utils/toast";

/** Roles que pueden ver el panel de gestión y crear registros manuales */
const ROLES_GESTION = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia"];
/** Roles que pueden aprobar / rechazar registros manuales */
const ROLES_APROBACION = ["super_admin", "supervisor_sucursales", "agente_soporte_ti"];

const TIPOS_REGISTRO = [
  { val: "entrada",           label: "Entrada" },
  { val: "salida_alimentos",  label: "Salida a comer" },
  { val: "regreso_alimentos", label: "Regreso de comer" },
  { val: "salida",            label: "Salida final" },
];

const COLS = [
  { tipo: "entrada",           label: "Entrada",         color: "verde"   },
  { tipo: "salida_alimentos",  label: "Salida a comer",  color: "naranja" },
  { tipo: "regreso_alimentos", label: "Regreso de comer", color: "azul"  },
  { tipo: "salida",            label: "Salida final",    color: "rojo"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte "HH:MM" o "HH:MM:SS" a minutos desde medianoche */
const horaToMin = (h) => {
  if (!h) return null;
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
};

/**
 * Calcula los minutos trabajados en el día actual de forma progresiva.
 * Devuelve 0 si el empleado ya marcó su salida final.
 */
const calcularTiempoActual = (regs) => {
  if (!regs || regs.length === 0) return 0;
  const entrada      = regs.find((r) => r.tipo === "entrada");
  const salidaAlm    = regs.find((r) => r.tipo === "salida_alimentos");
  const regresoAlm   = regs.find((r) => r.tipo === "regreso_alimentos");
  const salida       = regs.find((r) => r.tipo === "salida");

  if (!entrada) return 0;
  if (salida) return 0; // jornada cerrada

  const ahora = new Date();
  const ahoraMin   = ahora.getHours() * 60 + ahora.getMinutes();
  const entradaMin = horaToMin(entrada.hora);

  if (salidaAlm && !regresoAlm) {
    return Math.max(0, horaToMin(salidaAlm.hora) - entradaMin);
  }
  if (regresoAlm) {
    const periodo1 = horaToMin(salidaAlm?.hora || regresoAlm.hora) - entradaMin;
    const periodo2 = ahoraMin - horaToMin(regresoAlm.hora);
    return Math.max(0, periodo1) + Math.max(0, periodo2);
  }
  return Math.max(0, ahoraMin - entradaMin);
};

// ─── Componente ───────────────────────────────────────────────────────────────

const Registros = () => {
  const { usuario, vistaActual } = useAuth();
  const { pathname } = useLocation();

  // Vista empleado si:
  //   - El rol no tiene permisos de gestión, O
  //   - El admin accede desde /mis-registros (su propia vista), O
  //   - El admin activó la vista "empleado" desde el menú de perfil
  const esMisRegistros = pathname.includes("mis-registros");
  const esGestion   = ROLES_GESTION.includes(usuario?.rol) && !esMisRegistros && vistaActual !== "empleado";
  const esAprobador = ROLES_APROBACION.includes(usuario?.rol) && !esMisRegistros && vistaActual !== "empleado";

  const [sucursales,     setSucursales]     = useState([]);
  const [empleados,      setEmpleados]      = useState([]);
  const [sucursalId,     setSucursalId]     = useState("");
  const [fecha,          setFecha]          = useState(new Date().toISOString().split("T")[0]);
  const [reporte,        setReporte]        = useState(null);
  const [registros,      setRegistros]      = useState([]);
  const [resumenHoy,     setResumenHoy]     = useState(null);
  const [tiempoHoy,      setTiempoHoy]      = useState(0);
  const [cargando,       setCargando]       = useState(false);
  const [tab,            setTab]            = useState("reporte");

  const [modalManual,    setModalManual]    = useState(false);
  const [formManual,     setFormManual]     = useState({
    usuarioId: "", tipo: "entrada", sucursalId: "",
    fecha: new Date().toISOString().split("T")[0],
    hora: new Date().toTimeString().slice(0, 5),
    justificacion: "",
  });
  const [enviandoManual, setEnviandoManual] = useState(false);
  const [errorManual,    setErrorManual]    = useState("");

  const [modalRechazo,   setModalRechazo]   = useState(null);
  const [motivoRechazo,  setMotivoRechazo]  = useState("");

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (esGestion) {
      getSucursales().then((s) => {
        setSucursales(s);
        if (s.length > 0) setSucursalId(s[0].id);
      }).catch(() => {});
      getUsuarios().then(setEmpleados).catch(() => {});
    } else {
      cargarRegistrosEmpleado();
      getRegistrosHoy()
        .then((r) => { setResumenHoy(r); setTiempoHoy(calcularTiempoActual(r.registros)); })
        .catch(() => {});
    }
  }, []);

  // Actualizar contador de tiempo cada minuto
  useEffect(() => {
    if (esGestion) return;
    const interval = setInterval(() => {
      if (resumenHoy?.registros) setTiempoHoy(calcularTiempoActual(resumenHoy.registros));
    }, 60_000);
    return () => clearInterval(interval);
  }, [resumenHoy]);

  // ── Funciones de carga ────────────────────────────────────────────────────

  const cargarReporte = async () => {
    if (!sucursalId || !fecha) return;
    setCargando(true);
    try {
      const data = await getReporte(sucursalId, fecha);
      setReporte(data);
    } catch (err) { console.error(err); }
    finally { setCargando(false); }
  };

  const cargarManuales = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = sucursalId ? { sucursalId } : {};
      const all = await getRegistros(filtros);
      setRegistros(all.filter((r) => r.esManual));
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  }, [sucursalId]);

  const cargarRegistrosEmpleado = useCallback(async () => {
    setCargando(true);
    try {
      const data = await getRegistros(fecha ? { fecha } : {});
      setRegistros(data);
    } finally { setCargando(false); }
  }, [fecha]);

  useEffect(() => {
    if (!esGestion) cargarRegistrosEmpleado();
  }, [fecha]);

  useEffect(() => {
    if (esGestion && tab === "manuales") cargarManuales();
  }, [tab, sucursalId]);

  // ── Registro manual ───────────────────────────────────────────────────────

  const handleSubmitManual = async (e) => {
    e.preventDefault();
    setErrorManual("");
    if (!formManual.usuarioId || !formManual.sucursalId) {
      setErrorManual("Selecciona empleado y sucursal");
      return;
    }
    setEnviandoManual(true);
    try {
      await crearRegistroManual(formManual);
      setModalManual(false);
      setFormManual({
        usuarioId: "", tipo: "entrada", sucursalId: "",
        fecha: new Date().toISOString().split("T")[0],
        hora: new Date().toTimeString().slice(0, 5),
        justificacion: "",
      });
      if (tab === "manuales") cargarManuales();
      else if (reporte) cargarReporte();
    } catch (err) { setErrorManual(err.message); }
    finally { setEnviandoManual(false); }
  };

  const handleAprobar = async (id) => {
    if (!(await confirmar("¿Aprobar este registro manual?", "Confirmar", "warning"))) return;
    try { await aprobarRegistro(id); cargarManuales(); }
    catch (err) { toastError(err); }
  };

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) { toastAviso("Escribe un motivo de rechazo"); return; }
    try {
      await rechazarRegistro(modalRechazo, motivoRechazo);
      setModalRechazo(null);
      setMotivoRechazo("");
      cargarManuales();
    } catch (err) { toastError(err); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{esGestion ? "Registros de Asistencia" : "Mis Registros"}</h1>
          <p className="page-subtitle">
            {esGestion ? "Historial de entradas y salidas por sucursal" : "Historial personal de acceso"}
          </p>
        </div>
        {esGestion && (
          <button className="btn btn-primary" onClick={() => setModalManual(true)}>
            + Registro manual
          </button>
        )}
      </div>

      {/* Banner tiempo trabajado (empleados) */}
      {!esGestion && tiempoHoy > 0 && (
        <div className="alert alert-info" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: "1.4rem" }}>⏱</span>
          <div>
            <strong>Tiempo trabajado hoy:</strong> {formatearMinutos(tiempoHoy)}
            {resumenHoy?.siguienteRegistro && (
              <span style={{ marginLeft: 16, color: "var(--text2)", fontSize: 13 }}>
                · Siguiente: <strong>{TIPOS_REGISTRO.find((t) => t.val === resumenHoy.siguienteRegistro)?.label}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs (solo gestión) */}
      {esGestion && (
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === "reporte" ? "tab-active" : ""}`} onClick={() => setTab("reporte")}>
            📊 Reporte del día
          </button>
          <button className={`tab-btn ${tab === "manuales" ? "tab-active" : ""}`} onClick={() => setTab("manuales")}>
            📝 Registros manuales
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        {esGestion && (
          <select className="filter-select" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          className="filter-select"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        {esGestion && tab === "reporte" && (
          <button className="btn btn-primary" onClick={cargarReporte} disabled={cargando || !sucursalId}>
            {cargando ? "Cargando…" : "Ver reporte"}
          </button>
        )}
      </div>

      {/* ══ Tab: Reporte del día ══ */}
      {esGestion && tab === "reporte" && (
        <>
          {cargando && <div className="loading">Cargando…</div>}
          {!cargando && !reporte && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>Selecciona una sucursal y presiona "Ver reporte".</p>
            </div>
          )}
          {!cargando && reporte && (
            <>
              <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap", fontSize: 14, color: "var(--text2)" }}>
                <span>📅 {reporte.fecha}</span>
                <span>🏢 {sucursales.find((s) => s.id === reporte.sucursalId)?.nombre}</span>
                <span>👥 {reporte.resumen.length} empleados</span>
                <span>✅ {reporte.resumen.filter((r) => r.completo).length} jornadas completas</span>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Puesto</th>
                      {COLS.map((c) => <th key={c.tipo}>{c.label}</th>)}
                      <th>Min. trabajados</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.resumen.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.usuario}</strong></td>
                        <td>{r.puesto}</td>
                        {COLS.map((c) => (
                          <td key={c.tipo}>
                            {r[c.tipo]
                              ? <span style={{ color: "var(--primary)", fontWeight: 500 }}>🕐 {r[c.tipo]}</span>
                              : <span style={{ color: "var(--text2)" }}>—</span>
                            }
                          </td>
                        ))}
                        <td>
                          {r.minutosTrabajados > 0
                            ? <strong>{formatearMinutos(r.minutosTrabajados)}</strong>
                            : "—"
                          }
                        </td>
                        <td>
                          <span className={`badge ${r.completo ? "badge-success" : "badge-warning"}`}>
                            {r.completo ? "✅ Completo" : "⏳ Incompleto"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ Tab: Registros manuales ══ */}
      {esGestion && tab === "manuales" && (
        <>
          {cargando ? (
            <div className="loading">Cargando…</div>
          ) : registros.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <p>No hay registros manuales.</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Sucursal</th>
                    <th>Justificación</th>
                    <th>Estado</th>
                    {esAprobador && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id}>
                      <td>{r.usuarioNombre}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {TIPOS_REGISTRO.find((t) => t.val === r.tipo)?.label || r.tipo}
                        </span>
                      </td>
                      <td>{r.fecha}</td>
                      <td>{r.hora}</td>
                      <td>{r.sucursalNombre}</td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.justificacion || "—"}
                      </td>
                      <td>
                        {!r.estadoAprobacion || r.estadoAprobacion === "pendiente"
                          ? <span className="badge badge-warning">⏳ Pendiente</span>
                          : r.estadoAprobacion === "aprobada"
                          ? <span className="badge badge-success">✅ Aprobado</span>
                          : <span className="badge badge-danger">❌ Rechazado</span>
                        }
                      </td>
                      {esAprobador && (
                        <td>
                          {(!r.estadoAprobacion || r.estadoAprobacion === "pendiente") && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-sm btn-success" onClick={() => handleAprobar(r.id)}>✓</button>
                              <button className="btn btn-sm btn-danger" onClick={() => { setModalRechazo(r.id); setMotivoRechazo(""); }}>✕</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ Vista empleado: mis registros ══ */}
      {!esGestion && (
        <>
          {cargando ? (
            <div className="loading">Cargando registros…</div>
          ) : registros.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No hay registros para esta fecha.</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Hora</th>
                    <th>Fecha</th>
                    <th>Geocerca</th>
                    <th>Captura</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {TIPOS_REGISTRO.find((t) => t.val === r.tipo)?.label || r.tipo}
                        </span>
                      </td>
                      <td>🕐 {r.hora}</td>
                      <td>{r.fecha}</td>
                      <td>
                        {r.dentroGeocerca === null ? "—"
                          : r.dentroGeocerca
                          ? <span className="badge badge-success">✅ Dentro</span>
                          : <span className="badge badge-danger">⚠️ Fuera</span>
                        }
                      </td>
                      <td>
                        {r.esManual
                          ? <span className="badge badge-warning">📝 Manual</span>
                          : <span style={{ color: "var(--text2)", fontSize: 12 }}>📱 GPS</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ Modal: Nuevo registro manual ══ */}
      {modalManual && (
        <div className="modal-overlay" onClick={() => setModalManual(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📝 Registro Manual</h2>
              <button className="modal-close" onClick={() => setModalManual(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitManual} className="modal-body">
              {errorManual && <div className="alert alert-danger">{errorManual}</div>}

              <div className="form-group">
                <label>Empleado *</label>
                <select
                  className="form-control"
                  value={formManual.usuarioId}
                  onChange={(e) => setFormManual({ ...formManual, usuarioId: e.target.value })}
                  required
                >
                  <option value="">Selecciona empleado…</option>
                  {empleados.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tipo de registro *</label>
                <select
                  className="form-control"
                  value={formManual.tipo}
                  onChange={(e) => setFormManual({ ...formManual, tipo: e.target.value })}
                  required
                >
                  {TIPOS_REGISTRO.map((t) => (
                    <option key={t.val} value={t.val}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Sucursal *</label>
                <select
                  className="form-control"
                  value={formManual.sucursalId}
                  onChange={(e) => setFormManual({ ...formManual, sucursalId: e.target.value })}
                  required
                >
                  <option value="">Selecciona sucursal…</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Fecha *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formManual.fecha}
                    onChange={(e) => setFormManual({ ...formManual, fecha: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Hora *</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formManual.hora}
                    onChange={(e) => setFormManual({ ...formManual, hora: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Justificación</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={formManual.justificacion}
                  onChange={(e) => setFormManual({ ...formManual, justificacion: e.target.value })}
                  placeholder="Motivo del registro manual…"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalManual(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviandoManual}>
                  {enviandoManual ? "Registrando…" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Modal: Motivo de rechazo ══ */}
      {modalRechazo && (
        <div className="modal-overlay" onClick={() => setModalRechazo(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Rechazar registro</h2>
              <button className="modal-close" onClick={() => setModalRechazo(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Motivo de rechazo *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Escribe el motivo…"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalRechazo(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleRechazar}>Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registros;
