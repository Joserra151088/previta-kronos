/**
 * Grupos.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión de grupos de SUCURSALES.
 * Cada grupo tiene un supervisor_sucursales asignado que puede ver y aprobar
 * incidencias de cualquier sucursal dentro de su grupo.
 *
 * Roles:
 *   super_admin         → ve todos los grupos, puede crear / editar / desactivar
 *   supervisor_sucursales → ve solo sus grupos, puede gestionar las sucursales
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getGrupos, getGrupo, crearGrupo, actualizarGrupo,
  actualizarSucursalesGrupo, eliminarGrupo,
  getUsuarios, getSucursales,
} from "../utils/api";
import { toastError, confirmar } from "../utils/toast";

const Grupos = () => {
  const { usuario } = useAuth();
  const esSuperAdmin = usuario?.rol === "super_admin";
  const puedeEditar  = usuario?.puedeEditar !== false;

  const [grupos,      setGrupos]      = useState([]);
  const [supervisores,setSupervisores]= useState([]);
  const [sucursales,  setSucursales]  = useState([]);
  const [cargando,    setCargando]    = useState(true);

  // Modal crear/editar grupo
  const [modal,    setModal]    = useState(false);
  const [editando, setEditando] = useState(null);
  const [form,     setForm]     = useState({ nombre: "", supervisorId: "" });
  const [guardando,setGuardando]= useState(false);
  const [error,    setError]    = useState("");

  // Modal gestión de sucursales del grupo
  const [detalleGrupo,         setDetalleGrupo]         = useState(null);
  const [sucursalesSeleccionadas, setSucursalesSeleccionadas] = useState([]);

  const cargar = async () => {
    try {
      const [g, u, s] = await Promise.all([getGrupos(), getUsuarios(), getSucursales()]);
      setGrupos(Array.isArray(g) ? g : []);
      setSucursales(Array.isArray(s) ? s : []);
      setSupervisores(
        (Array.isArray(u) ? u : []).filter((x) => x.rol === "supervisor_sucursales")
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // ── Modal crear / editar ────────────────────────────────────────────────────
  const abrirModal = (g = null) => {
    setEditando(g);
    setForm(g ? { nombre: g.nombre, supervisorId: g.supervisorId } : { nombre: "", supervisorId: "" });
    setError("");
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      if (editando) await actualizarGrupo(editando.id, form);
      else await crearGrupo({ ...form, sucursalIds: [] });
      setModal(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Modal gestión de sucursales ─────────────────────────────────────────────
  const abrirDetalle = async (g) => {
    const detalle = await getGrupo(g.id);
    setDetalleGrupo(detalle);
    setSucursalesSeleccionadas(
      Array.isArray(detalle.sucursalIds) ? detalle.sucursalIds : []
    );
  };

  const toggleSucursal = (sid) => {
    setSucursalesSeleccionadas((prev) =>
      prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]
    );
  };

  const handleGuardarSucursales = async () => {
    setGuardando(true);
    try {
      await actualizarSucursalesGrupo(detalleGrupo.id, sucursalesSeleccionadas);
      setDetalleGrupo(null);
      await cargar();
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (id) => {
    if (!(await confirmar("¿Desactivar este grupo?", "Confirmar", "warning"))) return;
    try { await eliminarGrupo(id); await cargar(); } catch (err) { toastError(err); }
  };

  if (cargando) return <div className="loading">Cargando grupos…</div>;

  return (
    <div className="page">
      {/* Cabecera */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Grupos de Sucursales</h1>
          <p className="page-subtitle">
            Agrupa sucursales bajo un supervisor para centralizar la aprobación de incidencias
          </p>
        </div>
        {esSuperAdmin && puedeEditar && (
          <button className="btn btn-primary" onClick={() => abrirModal()}>
            + Nuevo Grupo
          </button>
        )}
      </div>

      {/* Lista de grupos */}
      {grupos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <p>No hay grupos registrados</p>
          {esSuperAdmin && (
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginTop: 8 }}>
              Crea un grupo para asignar sucursales a un supervisor.
            </p>
          )}
        </div>
      ) : (
        <div className="cards-grid">
          {grupos.map((g) => (
            <div key={g.id} className="card">
              <div className="card-header">
                <h3>{g.nombre}</h3>
                <span className="badge badge-info">{g.totalSucursales ?? 0} sucursal{(g.totalSucursales ?? 0) !== 1 ? "es" : ""}</span>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 8px" }}>
                  👤 <strong>Supervisor:</strong> {g.supervisorNombre}
                </p>
                {Array.isArray(g.sucursalesNombres) && g.sucursalesNombres.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {g.sucursalesNombres.map((n, i) => (
                      <span key={i} className="badge badge-default" style={{ fontSize: 11 }}>🏢 {n}</span>
                    ))}
                  </div>
                )}
                {(!g.sucursalesNombres || g.sucursalesNombres.length === 0) && (
                  <p style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic" }}>
                    Sin sucursales asignadas aún
                  </p>
                )}
              </div>
              <div className="card-footer">
                <button className="btn btn-sm btn-secondary" onClick={() => abrirDetalle(g)}>
                  🏢 Gestionar sucursales
                </button>
                {esSuperAdmin && puedeEditar && (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirModal(g)}>✏️ Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDesactivar(g.id)}>Desactivar</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal crear / editar grupo ─────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? "Editar" : "Nuevo"} Grupo</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
                <div className="form-group">
                  <label>Nombre del grupo *</label>
                  <input
                    className="form-control"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej. Zona Norte, Región Centro…"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Supervisor asignado *</label>
                  <select
                    className="form-control"
                    value={form.supervisorId}
                    onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
                    required
                  >
                    <option value="">Selecciona un supervisor…</option>
                    {supervisores.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>
                    ))}
                  </select>
                  {supervisores.length === 0 && (
                    <p style={{ color: "var(--warning)", fontSize: 12, marginTop: 4 }}>
                      No hay supervisores registrados. Crea primero un usuario con rol "Supervisor de Sucursales".
                    </p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando || supervisores.length === 0}>
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal gestión de sucursales ────────────────────────────────────── */}
      {detalleGrupo && (
        <div className="modal-overlay" onClick={() => setDetalleGrupo(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sucursales: {detalleGrupo.nombre}</h2>
              <button className="modal-close" onClick={() => setDetalleGrupo(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text2)", marginBottom: 12, fontSize: 13 }}>
                Selecciona las sucursales que pertenecen a este grupo. El supervisor podrá aprobar
                incidencias de todos los empleados de estas sucursales.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {sucursales.map((s) => {
                  const seleccionada = sucursalesSeleccionadas.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                        padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                        background: seleccionada ? "color-mix(in srgb, var(--primary) 8%, var(--surface))" : "var(--surface)",
                        borderColor: seleccionada ? "var(--primary)" : "var(--border)",
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionada}
                        onChange={() => toggleSucursal(s.id)}
                        style={{ accentColor: "var(--primary)", width: 16, height: 16 }}
                      />
                      <span style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500 }}>🏢 {s.nombre}</span>
                        <span style={{ color: "var(--text2)", fontSize: 12, marginLeft: 8 }}>{s.ciudad}</span>
                      </span>
                      {!s.activa && <span className="badge badge-danger" style={{ fontSize: 10 }}>Inactiva</span>}
                    </label>
                  );
                })}
                {sucursales.length === 0 && (
                  <p style={{ color: "var(--text2)", fontSize: 13 }}>No hay sucursales registradas.</p>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 10 }}>
                {sucursalesSeleccionadas.length} sucursal{sucursalesSeleccionadas.length !== 1 ? "es" : ""} seleccionada{sucursalesSeleccionadas.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalleGrupo(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando} onClick={handleGuardarSucursales}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grupos;
