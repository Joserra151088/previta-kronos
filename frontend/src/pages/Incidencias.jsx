/**
 * Incidencias.jsx
 * - Empleados: ver sus incidencias + crear nueva con adjunto
 * - Supervisores/Admin: ver todas las de su sucursal + aprobar/rechazar
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getIncidencias, getTiposIncidencia, crearIncidencia,
  aprobarIncidencia, rechazarIncidencia, preAprobarIncidencia,
} from "../utils/api";
import FileUpload from "../components/FileUpload";
import { toastError, toastAviso, confirmar } from "../utils/toast";

/** Roles que ven el panel de gestión (todos los registros, tabs Por Aprobar / Todas) */
const ROLES_GESTION       = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia", "nominas"];
/** Roles que además pueden aprobar o rechazar incidencias */
const ROLES_APROBACION    = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "nominas"];
/** Roles que pueden pre-aprobar */
const ROLES_PRE_APROBACION = ["agente_control_asistencia", "super_admin", "agente_soporte_ti"];

const ESTADO_BADGE = {
  pendiente:    "badge-warning",
  pre_aprobada: "badge-info",
  aprobada:     "badge-success",
  rechazada:    "badge-danger",
};
const ESTADO_LABEL = {
  pendiente:    "Pendiente",
  pre_aprobada: "Pre-aprobada",
  aprobada:     "Aprobada",
  rechazada:    "Rechazada",
};

const Incidencias = () => {
  const { usuario, vistaActual } = useAuth();
  const esVistaEmpleado = vistaActual === "empleado";
  const esGestion      = ROLES_GESTION.includes(usuario?.rol) && !esVistaEmpleado;
  const esAprobador    = ROLES_APROBACION.includes(usuario?.rol) && !esVistaEmpleado;
  const esPreAprobador = ROLES_PRE_APROBACION.includes(usuario?.rol) && !esVistaEmpleado;

  const puedeAprobar = (inc) =>
    ROLES_APROBACION.includes(usuario?.rol) || inc.jefeInmediatoId === usuario?.id;

  const [incidencias, setIncidencias] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState(esGestion ? "pendientes" : "mias");
  const [modalNueva, setModalNueva] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [comentario, setComentario] = useState("");
  const [form, setForm] = useState({ tipoIncidenciaId: "", descripcion: "", fechaIncidencia: "", fechaFin: "" });
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [listaInc, listaTipos] = await Promise.all([
        getIncidencias(esGestion && tab === "pendientes" ? { estado: "pendiente" } : esGestion ? {} : {}),
        getTiposIncidencia(),
      ]);
      setIncidencias(listaInc);
      setTipos(listaTipos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [tab]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!form.tipoIncidenciaId) { setError("Selecciona el tipo de incidencia"); return; }
    // Validar archivo requerido según tipo de incidencia
    const tipoSeleccionado = tipos.find((t) => t.id === form.tipoIncidenciaId);
    if (tipoSeleccionado?.requiereArchivo && !archivo) {
      setError("Este tipo de incidencia requiere adjuntar un documento de soporte.");
      return;
    }
    try {
      setEnviando(true);
      setError("");
      const fd = new FormData();
      fd.append("tipoIncidenciaId", form.tipoIncidenciaId);
      fd.append("descripcion", form.descripcion);
      if (form.fechaIncidencia) fd.append("fechaIncidencia", form.fechaIncidencia);
      if (form.fechaFin) fd.append("fechaFin", form.fechaFin);
      if (archivo) fd.append("archivo", archivo);
      await crearIncidencia(fd);
      setModalNueva(false);
      setForm({ tipoIncidenciaId: "", descripcion: "", fechaIncidencia: "", fechaFin: "" });
      setArchivo(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handlePreAprobar = async (id) => {
    if (!(await confirmar("¿Pre-aprobar esta incidencia?", "Confirmar", "warning"))) return;
    try {
      await preAprobarIncidencia(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) {
      toastError(e);
    }
  };

  const handleAprobar = async (id) => {
    if (!(await confirmar("¿Aprobar esta incidencia?", "Confirmar", "warning"))) return;
    try {
      await aprobarIncidencia(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) {
      toastError(e);
    }
  };

  const handleRechazar = async (id) => {
    if (!comentario.trim()) { toastAviso("Escribe un motivo de rechazo"); return; }
    try {
      await rechazarIncidencia(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) {
      toastError(e);
    }
  };

  const listaFiltrada = incidencias.filter((inc) => {
    if (!esGestion) return true;
    if (tab === "pendientes") return inc.estado === "pendiente" || inc.estado === "pre_aprobada";
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Incidencias</h1>
          <p className="page-subtitle">
            {esGestion ? "Gestión y aprobación de incidencias" : "Mis solicitudes de incidencia"}
          </p>
        </div>
        {(!esGestion || esVistaEmpleado) && (
          <button className="btn btn-primary" onClick={() => setModalNueva(true)}>
            + Nueva Incidencia
          </button>
        )}
      </div>

      {/* Tabs */}
      {esGestion && (
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === "pendientes" ? "tab-active" : ""}`} onClick={() => setTab("pendientes")}>
            Por Aprobar
            {incidencias.filter(i => i.estado === "pendiente" || i.estado === "pre_aprobada").length > 0 && (
              <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                {incidencias.filter(i => i.estado === "pendiente" || i.estado === "pre_aprobada").length}
              </span>
            )}
          </button>
          <button className={`tab-btn ${tab === "todas" ? "tab-active" : ""}`} onClick={() => setTab("todas")}>
            Todas
          </button>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {cargando ? (
        <div className="loading">Cargando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>{esGestion ? "No hay incidencias pendientes" : "Aún no has registrado incidencias"}</p>
          {(!esGestion || esVistaEmpleado) && <button className="btn btn-primary" onClick={() => setModalNueva(true)}>Registrar incidencia</button>}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                {esGestion && <th>Empleado</th>}
                <th>Descripción</th>
                <th>Fecha incidencia</th>
                <th>Estado</th>
                <th>Evidencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((inc) => (
                <tr key={inc.id}>
                  <td>{inc.tipoNombre}</td>
                  {esGestion && <td>{inc.usuarioNombre}</td>}
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inc.descripcion || "—"}
                  </td>
                  <td>
                    {inc.fechaIncidencia
                      ? `${new Date(inc.fechaIncidencia + "T12:00:00").toLocaleDateString("es-MX")}${inc.fechaFin ? " – " + new Date(inc.fechaFin + "T12:00:00").toLocaleDateString("es-MX") : ""}`
                      : new Date(inc.creadoEn).toLocaleDateString("es-MX")}
                  </td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[inc.estado] || "badge-secondary"}`}>
                      {ESTADO_LABEL[inc.estado] || inc.estado}
                    </span>
                  </td>
                  <td>
                    {inc.archivoUrl ? (
                      <a href={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${inc.archivoUrl}`} target="_blank" rel="noopener noreferrer" className="btn-link">
                        {inc.archivoMime?.includes("pdf") ? "📄 PDF" : "🖼️ Imagen"}
                      </a>
                    ) : "—"}
                  </td>
                  <td>
                    {(puedeAprobar(inc) || esPreAprobador) && (inc.estado === "pendiente" || inc.estado === "pre_aprobada") ? (
                      <button className="btn btn-sm btn-primary" onClick={() => { setModalDetalle(inc); setComentario(""); }}>
                        Revisar
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-secondary" onClick={() => { setModalDetalle(inc); setComentario(""); }}>
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nueva Incidencia */}
      {modalNueva && (
        <div className="modal-overlay" onClick={() => setModalNueva(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Incidencia</h2>
              <button className="modal-close" onClick={() => setModalNueva(false)}>✕</button>
            </div>
            <form onSubmit={handleEnviar} className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-group">
                <label>Tipo de incidencia *</label>
                <select
                  className="form-control"
                  value={form.tipoIncidenciaId}
                  onChange={(e) => setForm({ ...form, tipoIncidenciaId: e.target.value })}
                  required
                >
                  <option value="">Selecciona un tipo...</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}{t.requiereArchivo ? " *" : ""}</option>
                  ))}
                </select>
                <small style={{ color: "var(--text-muted)" }}>* Los marcados requieren adjuntar evidencia</small>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de la incidencia</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.fechaIncidencia}
                    onChange={(e) => setForm({ ...form, fechaIncidencia: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha fin (multi-día)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.fechaFin}
                    min={form.fechaIncidencia}
                    onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Describe la incidencia..."
                />
              </div>
              <FileUpload onChange={setArchivo} label="Adjuntar evidencia (imagen o PDF)" />
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalNueva(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={enviando}>
                  {enviando ? "Enviando..." : "Registrar Incidencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle / Aprobación */}
      {modalDetalle && (
        <div className="modal-overlay" onClick={() => setModalDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle de Incidencia</h2>
              <button className="modal-close" onClick={() => setModalDetalle(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><label>Tipo</label><span>{modalDetalle.tipoNombre}</span></div>
                {esGestion && <div className="detail-item"><label>Empleado</label><span>{modalDetalle.usuarioNombre}</span></div>}
                <div className="detail-item">
                  <label>Estado</label>
                  <span className={`badge ${ESTADO_BADGE[modalDetalle.estado] || "badge-secondary"}`}>
                    {ESTADO_LABEL[modalDetalle.estado] || modalDetalle.estado}
                  </span>
                </div>
                <div className="detail-item"><label>Registrada</label><span>{new Date(modalDetalle.creadoEn).toLocaleString("es-MX")}</span></div>
                {modalDetalle.fechaIncidencia && (
                  <div className="detail-item">
                    <label>Fecha incidencia</label>
                    <span>
                      {new Date(modalDetalle.fechaIncidencia + "T12:00:00").toLocaleDateString("es-MX")}
                      {modalDetalle.fechaFin ? " — " + new Date(modalDetalle.fechaFin + "T12:00:00").toLocaleDateString("es-MX") : ""}
                    </span>
                  </div>
                )}
                {esGestion && modalDetalle.jefeInmediatoNombre && (
                  <div className="detail-item"><label>Jefe inmediato</label><span>{modalDetalle.jefeInmediatoNombre}</span></div>
                )}
                {modalDetalle.descripcion && (
                  <div className="detail-item detail-full"><label>Descripción</label><span>{modalDetalle.descripcion}</span></div>
                )}
                {modalDetalle.archivoUrl && (
                  <div className="detail-item detail-full">
                    <label>Evidencia adjunta</label>
                    {modalDetalle.archivoMime?.startsWith("image/") ? (
                      <img src={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${modalDetalle.archivoUrl}`} alt="Evidencia" style={{ maxWidth: "100%", borderRadius: 8 }} />
                    ) : (
                      <a href={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${modalDetalle.archivoUrl}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                        📄 Ver PDF
                      </a>
                    )}
                  </div>
                )}
                {/* Historial de pre-aprobaciones */}
                {Array.isArray(modalDetalle.preAprobaciones) && modalDetalle.preAprobaciones.length > 0 && (
                  <div className="detail-item detail-full">
                    <label>Historial de pre-aprobaciones</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                      {modalDetalle.preAprobaciones.map((pa, i) => (
                        <div key={i} style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
                          <strong>{pa.preAprobadoPorNombre || pa.preAprobadoPorId}</strong>
                          {" — "}{new Date(pa.preAprobadoEn).toLocaleString("es-MX")}
                          {pa.comentario && <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{pa.comentario}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {modalDetalle.comentarioSupervisor && (
                  <div className="detail-item detail-full"><label>Comentario del supervisor</label><span>{modalDetalle.comentarioSupervisor}</span></div>
                )}
              </div>

              {(esPreAprobador || puedeAprobar(modalDetalle)) &&
               (modalDetalle.estado === "pendiente" || modalDetalle.estado === "pre_aprobada") && (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Comentario (requerido para rechazar)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Escribe un comentario..."
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalDetalle(null)}>Cerrar</button>
              {esPreAprobador && modalDetalle.estado === "pendiente" && (
                <button className="btn btn-warning" onClick={() => handlePreAprobar(modalDetalle.id)}>
                  ✅ Pre-aprobar
                </button>
              )}
              {puedeAprobar(modalDetalle) && (modalDetalle.estado === "pendiente" || modalDetalle.estado === "pre_aprobada") && (
                <>
                  <button className="btn btn-danger"  onClick={() => handleRechazar(modalDetalle.id)}>Rechazar</button>
                  <button className="btn btn-success" onClick={() => handleAprobar(modalDetalle.id)}>Aprobar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incidencias;
