/**
 * Licencias.jsx
 * Gestión de licencias de usuario de la plataforma KronOS.
 * Solo accesible para el rol "administrador_general".
 * Permite ver, aumentar, reducir y registrar notas de las licencias activas.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getUsuarios } from "../utils/api";
import { toastAviso } from "../utils/toast";

const LS_KEY = "kronos_licencias";

// ─── Helpers de persistencia local ────────────────────────────────────────────
// En una implementación real esto vendría del backend. Por ahora usamos
// localStorage + un endpoint futuro en /api/licencias.

function cargarLicenciasLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { total: 300, notas: "", updatedAt: new Date().toISOString() };
  } catch {
    return { total: 300, notas: "", updatedAt: new Date().toISOString() };
  }
}

function guardarLicenciasLS(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ─── Componente ───────────────────────────────────────────────────────────────

const Licencias = () => {
  const { usuario } = useAuth();
  const esAdmin = ["administrador_general", "super_admin", "agente_soporte_ti"].includes(usuario?.rol);

  const [licencias, setLicencias] = useState(cargarLicenciasLS);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [usuariosActivos, setUsuariosActivos] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [formTotal, setFormTotal] = useState(String(licencias.total));
  const [formNotas, setFormNotas] = useState(licencias.notas || "");
  const [historial, setHistorial] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY + "_hist") || "[]"); }
    catch { return []; }
  });

  const cargar = useCallback(async () => {
    try {
      const usuarios = await getUsuarios();
      const lista = Array.isArray(usuarios) ? usuarios : [];
      setTotalUsuarios(lista.length);
      setUsuariosActivos(lista.filter((u) => u.activo !== false).length);
    } catch (e) {
      console.error("Error cargando usuarios:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const usadas = usuariosActivos;
  const disponibles = Math.max(0, licencias.total - usadas);
  const pct = licencias.total > 0 ? Math.min(100, Math.round((usadas / licencias.total) * 100)) : 0;
  const colorBarra = pct >= 90 ? "var(--danger)" : pct >= 70 ? "#f59e0b" : "var(--accent)";

  const handleGuardar = () => {
    const nuevoTotal = parseInt(formTotal, 10);
    if (isNaN(nuevoTotal) || nuevoTotal < 1) {
      toastAviso("El número de licencias debe ser mayor a 0");
      return;
    }
    if (nuevoTotal < usadas) {
      toastAviso(`No se puede reducir a ${nuevoTotal} licencias. Ya hay ${usadas} usuarios activos.`);
      return;
    }
    const entrada = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      anterior: licencias.total,
      nuevo: nuevoTotal,
      usuario: `${usuario.nombre} ${usuario.apellido}`,
      notas: formNotas,
    };
    const nuevaData = { total: nuevoTotal, notas: formNotas, updatedAt: new Date().toISOString() };
    setLicencias(nuevaData);
    guardarLicenciasLS(nuevaData);
    const nuevoHist = [entrada, ...historial].slice(0, 50);
    setHistorial(nuevoHist);
    localStorage.setItem(LS_KEY + "_hist", JSON.stringify(nuevoHist));
    setEditando(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔑 Gestión de Licencias</h1>
          <p className="page-subtitle">Control de accesos y usuarios habilitados en la plataforma</p>
        </div>
        {esAdmin && !editando && (
          <button className="btn btn-primary" onClick={() => {
            setFormTotal(String(licencias.total));
            setFormNotas(licencias.notas || "");
            setEditando(true);
          }}>
            ✏️ Modificar licencias
          </button>
        )}
      </div>

      {!esAdmin && (
        <div className="alert alert-warning">
          ⚠️ Solo el Administrador General puede modificar las licencias.
        </div>
      )}

      {cargando ? (
        <div className="loading">Cargando información de licencias…</div>
      ) : (
        <>
          {/* ── Tarjetas de estado ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Licencias contratadas", value: licencias.total, icon: "📋", color: "var(--accent2)" },
              { label: "En uso (activos)",       value: usadas,          icon: "👤", color: "var(--accent)" },
              { label: "Disponibles",            value: disponibles,     icon: "✅", color: disponibles === 0 ? "var(--danger)" : "var(--success)" },
              { label: "Total empleados",        value: totalUsuarios,   icon: "👥", color: "var(--text)" },
            ].map((stat) => (
              <div key={stat.label} className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: "2rem", marginBottom: 6 }}>{stat.icon}</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── Barra de uso ───────────────────────────────────────────────── */}
          <div className="card" style={{ padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Uso de licencias</span>
              <span style={{ fontWeight: 700, color: colorBarra, fontSize: "1.1rem" }}>{pct}%</span>
            </div>
            <div style={{ height: 14, background: "var(--bg3)", borderRadius: 7, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`, borderRadius: 7,
                background: colorBarra,
                transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.8rem", color: "var(--text2)" }}>
              <span>{usadas} usadas</span>
              <span>{licencias.total} total</span>
            </div>
            {disponibles === 0 && (
              <div className="alert alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>
                ⚠️ Se alcanzó el límite de licencias. No se pueden agregar nuevos usuarios.
              </div>
            )}
            {disponibles > 0 && disponibles <= 10 && (
              <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                ⚠️ Quedan solo {disponibles} licencias disponibles. Considera aumentar el plan.
              </div>
            )}
            {licencias.notas && (
              <div style={{ marginTop: 14, fontSize: "0.85rem", color: "var(--text2)", fontStyle: "italic" }}>
                📝 {licencias.notas}
              </div>
            )}
          </div>

          {/* ── Modal de edición ───────────────────────────────────────────── */}
          {editando && esAdmin && (
            <div className="modal-overlay" onClick={() => setEditando(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                  <h2>Modificar Licencias</h2>
                  <button className="modal-close" onClick={() => setEditando(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Total de licencias contratadas *</label>
                    <input
                      type="number"
                      className="form-control"
                      min={usadas}
                      value={formTotal}
                      onChange={(e) => setFormTotal(e.target.value)}
                    />
                    <small style={{ color: "var(--text2)" }}>
                      Mínimo {usadas} (usuarios activos actuales)
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {[10, 25, 50, 100].map((d) => (
                      <button
                        key={d}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                        onClick={() => setFormTotal(String(Math.max(usadas, (parseInt(formTotal) || licencias.total) + d)))}
                      >
                        +{d}
                      </button>
                    ))}
                  </div>
                  <div className="form-group">
                    <label>Notas / motivo del cambio</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={formNotas}
                      onChange={(e) => setFormNotas(e.target.value)}
                      placeholder="Ej: Ampliación de contrato Q2 2026, nueva sucursal abierta…"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setEditando(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleGuardar}>
                    💾 Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Historial de cambios ────────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">📜 Historial de cambios de licencias</div>
            <div className="card-body">
              {historial.length === 0 ? (
                <div style={{ color: "var(--text2)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
                  Sin cambios registrados
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Modificado por</th>
                        <th>Anterior</th>
                        <th>Nuevo</th>
                        <th>Diferencia</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.fecha).toLocaleString("es-MX")}</td>
                          <td>{h.usuario}</td>
                          <td>{h.anterior}</td>
                          <td style={{ fontWeight: 600 }}>{h.nuevo}</td>
                          <td>
                            <span style={{ color: h.nuevo > h.anterior ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                              {h.nuevo > h.anterior ? `+${h.nuevo - h.anterior}` : `${h.nuevo - h.anterior}`}
                            </span>
                          </td>
                          <td style={{ color: "var(--text2)", fontSize: "0.85rem" }}>{h.notas || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Licencias;
