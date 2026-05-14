import { SERVER_URL as BASE } from "../utils/config.js";
/**
 * Vacaciones.jsx
 * Vista filtrada de incidencias de tipo "vacaciones" (categoriaBloqueo === "vacaciones").
 * Empleados pueden ver sus solicitudes y crear nuevas.
 * Gestores pueden ver todas, pre-aprobar y aprobar/rechazar.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getTiposIncidencia,
  aprobarVacacion, rechazarVacacion, preAprobarVacacion,
  getVacaciones, solicitarVacaciones, getElegibilidadVacaciones,
} from "../utils/api";
import FileUpload from "../components/FileUpload";
import { toastError, toastAviso, confirmar } from "../utils/toast";

const ROLES_GESTION     = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia", "nominas"];
const ROLES_APROBACION  = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "nominas"];
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

const Vacaciones = () => {
  const { usuario, vistaActual } = useAuth();
  const esVistaEmpleado = vistaActual === "empleado";
  const esGestion      = ROLES_GESTION.includes(usuario?.rol) && !esVistaEmpleado;
  const esPreAprobador = ROLES_PRE_APROBACION.includes(usuario?.rol) && !esVistaEmpleado;

  const [incidencias, setIncidencias] = useState([]);
  const [tiposVac, setTiposVac] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState(esGestion ? "pendientes" : "mias");
  const [modalNueva, setModalNueva] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [comentario, setComentario] = useState("");
  const [form, setForm] = useState({ tipoIncidenciaId: "", descripcion: "", fechaIncidencia: "", fechaFin: "" });
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // Elegibilidad
  const [elegibilidad, setElegibilidad] = useState(null); // { elegible, aniosAntiguedad, mensaje }

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [listaVac, listaTipos] = await Promise.all([
        getVacaciones(),
        getTiposIncidencia(),
      ]);
      const tiposV = listaTipos.filter((t) => t.categoriaBloqueo === "vacaciones");
      setTiposVac(tiposV);
      setIncidencias(Array.isArray(listaVac) ? listaVac : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // Cargar elegibilidad del usuario actual
  useEffect(() => {
    if (!esGestion) {
      getElegibilidadVacaciones().then(setElegibilidad).catch(() => {});
    }
  }, [esGestion]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!form.tipoIncidenciaId) { setError("Selecciona el tipo de vacación"); return; }
    if (!form.fechaIncidencia)  { setError("Indica la fecha de inicio"); return; }
    try {
      setEnviando(true);
      setError("");
      const fd = new FormData();
      fd.append("tipoIncidenciaId", form.tipoIncidenciaId);
      fd.append("descripcion", form.descripcion);
      fd.append("fechaIncidencia", form.fechaIncidencia);
      if (form.fechaFin) fd.append("fechaFin", form.fechaFin);
      if (archivo) fd.append("archivo", archivo);
      await solicitarVacaciones(fd);
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
    if (!(await confirmar("¿Pre-aprobar esta solicitud?", "Confirmar", "warning"))) return;
    try {
      await preAprobarVacacion(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) {
      toastError(e);
    }
  };

  const handleAprobar = async (id) => {
    if (!(await confirmar("¿Aprobar estas vacaciones?", "Confirmar", "warning"))) return;
    try {
      await aprobarVacacion(id, comentario);
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
      await rechazarVacacion(id, comentario);
      setModalDetalle(null);
      setComentario("");
      cargar();
    } catch (e) {
      toastError(e);
    }
  };

  const abrirSolicitar = () => {
    setError("");
    if (elegibilidad && !elegibilidad.elegible) {
      setError(elegibilidad.mensaje || "No cumples con el requisito de antigüedad mínima (1 año).");
      return;
    }
    setModalNueva(true);
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
          <h1 className="page-title">🏖️ Vacaciones</h1>
          <p className="page-subtitle">
            {esGestion ? "Gestión de solicitudes de vacaciones" : "Mis solicitudes de vacaciones"}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={abrirSolicitar}
          disabled={!esGestion && elegibilidad && !elegibilidad.elegible}
          title={!esGestion && elegibilidad && !elegibilidad.elegible ? elegibilidad.mensaje : undefined}
        >
          + Solicitar Vacaciones
        </button>
      </div>

      {/* Elegibilidad */}
      {!esGestion && elegibilidad && (
        <div className={`alert ${elegibilidad.elegible ? "alert-success" : "alert-warning"}`} style={{ marginBottom: 16 }}>
          {elegibilidad.elegible
            ? `✅ ${elegibilidad.mensaje}`
            : `⚠️ ${elegibilidad.mensaje}`}
        </div>
      )}

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
          <div className="empty-icon">🏖️</div>
          <p>{esGestion ? "No hay solicitudes de vacaciones pendientes" : "Aún no has solicitado vacaciones"}</p>
          <button className="btn btn-primary" onClick={abrirSolicitar}>Solicitar vacaciones</button>
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
                <th>Jefe Inmediato</th>
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
                    <td>{inc.jefeInmediatoNombre || "—"}</td>
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

      {/* Modal Nueva Solicitud */}
      {modalNueva && (
        <div className="modal-overlay" onClick={() => setModalNueva(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Solicitar Vacaciones</h2>
              <button className="modal-close" onClick={() => setModalNueva(false)}>✕</button>
            </div>
            <form onSubmit={handleEnviar} className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {tiposVac.length === 0 ? (
                <div className="alert alert-warning">
                  No hay tipos de incidencia configurados para vacaciones. Contacta al administrador.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select
                      className="form-control"
                      value={form.tipoIncidenciaId}
                      onChange={(e) => setForm({ ...form, tipoIncidenciaId: e.target.value })}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {tiposVac.map((t) => (
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
                    <label>Descripción / Comentarios</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.descripcion}
                      onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                      placeholder="Motivo o comentarios adicionales..."
                    />
                  </div>
                  <FileUpload onChange={setArchivo} label="Adjuntar documento (opcional)" />
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalNueva(false)}>Cancelar</button>
                {tiposVac.length > 0 && (
                  <button type="submit" className="btn btn-primary" disabled={enviando}>
                    {enviando ? "Enviando..." : "Solicitar Vacaciones"}
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
              <h2>Detalle de Solicitud</h2>
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
                <div className="detail-item"><label>Jefe inmediato</label><span>{modalDetalle.jefeInmediatoNombre || "—"}</span></div>
                {modalDetalle.descripcion && (
                  <div className="detail-item detail-full"><label>Descripción</label><span>{modalDetalle.descripcion}</span></div>
                )}
                {modalDetalle.archivoUrl && (
                  <div className="detail-item detail-full">
                    <label>Documento adjunto</label>
                    <a href={`${BASE}${modalDetalle.archivoUrl}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                      📄 Ver documento
                    </a>
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

              {/* Acciones de aprobación */}
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

export default Vacaciones;
