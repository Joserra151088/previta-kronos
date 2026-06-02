/**
 * Incapacidades.jsx
 * Vista filtrada de incidencias de tipo "incapacidad" (categoriaBloqueo === "incapacidad").
 * Requiere adjuntar documento médico.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getIncidencias, getTiposIncidencia, crearIncidencia,
  aprobarIncidencia, rechazarIncidencia, preAprobarIncidencia,
} from "../utils/api";
import FileUpload from "../components/FileUpload";
import { toastError, toastAviso, confirmar } from "../utils/toast";

const ROLES_GESTION        = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia", "nominas"];
const ROLES_APROBACION     = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "nominas"];
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

const fmt = (d) => d ? new Date(d).toLocaleDateString("es-MX") : "—";

const Incapacidades = () => {
  const { usuario, vistaActual } = useAuth();
  const esVistaEmpleado = vistaActual === "empleado";
  const esGestion      = ROLES_GESTION.includes(usuario?.rol) && !esVistaEmpleado;
  const esPreAprobador = ROLES_PRE_APROBACION.includes(usuario?.rol) && !esVistaEmpleado;

  const [incidencias, setIncidencias] = useState([]);
  const [tiposInc, setTiposInc] = useState([]);
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
        getIncidencias(),
        getTiposIncidencia(),
      ]);
      const tipos  = listaTipos.filter((t) => t.categoriaBloqueo === "incapacidad");
      const ids    = new Set(tipos.map((t) => t.id));
      setTiposInc(tipos);
      setIncidencias(listaInc.filter((i) => ids.has(i.tipoIncidenciaId)));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!form.tipoIncidenciaId) { setError("Selecciona el tipo de incapacidad"); return; }
    if (!form.fechaIncidencia)  { setError("Indica la fecha de inicio"); return; }
    if (!archivo) { setError("Debes adjuntar el documento médico"); return; }
    try {
      setEnviando(true);
      setError("");
      const fd = new FormData();
      fd.append("tipoIncidenciaId", form.tipoIncidenciaId);
      fd.append("descripcion", form.descripcion);
      fd.append("fechaIncidencia", form.fechaIncidencia);
      if (form.fechaFin) fd.append("fechaFin", form.fechaFin);
      fd.append("archivo", archivo);
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
    if (!(await confirmar("¿Pre-aprobar esta incapacidad?", "Confirmar", "warning"))) return;
    try {
      await preAprobarIncidencia(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) { toastError(e); }
  };

  const handleAprobar = async (id) => {
    if (!(await confirmar("¿Aprobar esta incapacidad?", "Confirmar", "warning"))) return;
    try {
      await aprobarIncidencia(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) { toastError(e); }
  };

  const handleRechazar = async (id) => {
    if (!comentario.trim()) { toastAviso("Escribe un motivo de rechazo"); return; }
    try {
      await rechazarIncidencia(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) { toastError(e); }
  };

  const puedeAprobar = (inc) =>
    ROLES_APROBACION.includes(usuario?.rol) || inc.jefeInmediatoId === usuario?.id;

  const listaFiltrada = incidencias.filter((inc) => {
    if (!esGestion) return true;
    if (tab === "pendientes") return inc.estado === "pendiente" || inc.estado === "pre_aprobada";
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🩺 Incapacidades</h1>
          <p className="page-subtitle">
            {esGestion ? "Gestión de incapacidades médicas" : "Mis incapacidades registradas"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(""); setModalNueva(true); }}>
          + Registrar Incapacidad
        </button>
      </div>

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
          <div className="empty-icon">🩺</div>
          <p>{esGestion ? "No hay incapacidades pendientes" : "No tienes incapacidades registradas"}</p>
          <button className="btn btn-primary" onClick={() => setModalNueva(true)}>Registrar incapacidad</button>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                {esGestion && <th>Empleado</th>}
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Días</th>
                <th>Estado</th>
                <th>Documento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((inc) => {
                const dias = inc.fechaFin && inc.fechaIncidencia
                  ? Math.ceil((new Date(inc.fechaFin) - new Date(inc.fechaIncidencia)) / 86400000) + 1
                  : 1;
                return (
                  <tr key={inc.id}>
                    <td>{inc.tipoNombre}</td>
                    {esGestion && <td>{inc.usuarioNombre}</td>}
                    <td>{fmt(inc.fechaIncidencia)}</td>
                    <td>{fmt(inc.fechaFin)}</td>
                    <td>{dias}</td>
                    <td>
                      <span className={`badge ${ESTADO_BADGE[inc.estado] || "badge-secondary"}`}>
                        {ESTADO_LABEL[inc.estado] || inc.estado}
                      </span>
                    </td>
                    <td>
                      {inc.archivoUrl ? (
                        <a href={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${inc.archivoUrl}`} target="_blank" rel="noopener noreferrer" className="btn-link">
                          📄 Ver
                        </a>
                      ) : "—"}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setModalDetalle(inc); setComentario(""); }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nueva Incapacidad */}
      {modalNueva && (
        <div className="modal-overlay" onClick={() => setModalNueva(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Incapacidad</h2>
              <button className="modal-close" onClick={() => setModalNueva(false)}>✕</button>
            </div>
            <form onSubmit={handleEnviar} className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {tiposInc.length === 0 ? (
                <div className="alert alert-warning">
                  No hay tipos de incidencia configurados para incapacidades. Contacta al administrador.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Tipo de incapacidad *</label>
                    <select
                      className="form-control"
                      value={form.tipoIncidenciaId}
                      onChange={(e) => setForm({ ...form, tipoIncidenciaId: e.target.value })}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {tiposInc.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Fecha inicio *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.fechaIncidencia}
                        onChange={(e) => setForm({ ...form, fechaIncidencia: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha fin</label>
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
                    <label>Descripción / Diagnóstico</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.descripcion}
                      onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                      placeholder="Describe la incapacidad..."
                    />
                  </div>
                  <FileUpload onChange={setArchivo} label="Documento médico * (requerido)" />
                  {!archivo && <small style={{ color: "var(--danger)" }}>* Es obligatorio adjuntar el documento médico</small>}
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalNueva(false)}>Cancelar</button>
                {tiposInc.length > 0 && (
                  <button type="submit" className="btn btn-primary" disabled={enviando}>
                    {enviando ? "Enviando..." : "Registrar Incapacidad"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {modalDetalle && (
        <div className="modal-overlay" onClick={() => setModalDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle de Incapacidad</h2>
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
                <div className="detail-item"><label>Fecha inicio</label><span>{fmt(modalDetalle.fechaIncidencia)}</span></div>
                <div className="detail-item"><label>Fecha fin</label><span>{fmt(modalDetalle.fechaFin)}</span></div>
                {modalDetalle.descripcion && (
                  <div className="detail-item detail-full"><label>Descripción</label><span>{modalDetalle.descripcion}</span></div>
                )}
                {modalDetalle.archivoUrl && (
                  <div className="detail-item detail-full">
                    <label>Documento médico</label>
                    {modalDetalle.archivoMime?.startsWith("image/") ? (
                      <img src={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${modalDetalle.archivoUrl}`} alt="Documento" style={{ maxWidth: "100%", borderRadius: 8 }} />
                    ) : (
                      <a href={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${modalDetalle.archivoUrl}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                        📄 Ver documento
                      </a>
                    )}
                  </div>
                )}
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
                  <label>Comentario</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Comentario opcional..."
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
                  <button className="btn btn-danger" onClick={() => handleRechazar(modalDetalle.id)}>
                    Rechazar
                  </button>
                  <button className="btn btn-success" onClick={() => handleAprobar(modalDetalle.id)}>
                    Aprobar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incapacidades;
