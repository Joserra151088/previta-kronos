import { useState, useEffect } from "react";
import { getDoNineBox, getUsuarios } from "../utils/api";

const PERIODOS = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2025-Q4", "2025-Q3"];

const CUADRANTES = [
  { id: "Diamante en bruto",      pot: "alto",  des: "bajo",  color: "#3b82f6", bg: "#eff6ff", desc: "Alto potencial, bajo desempeño" },
  { id: "Futuro líder",           pot: "alto",  des: "medio", color: "#8b5cf6", bg: "#f5f3ff", desc: "Alto potencial, desempeño medio" },
  { id: "Estrella",               pot: "alto",  des: "alto",  color: "#10b981", bg: "#ecfdf5", desc: "Alto potencial y desempeño" },
  { id: "Enigma",                 pot: "medio", des: "bajo",  color: "#f59e0b", bg: "#fffbeb", desc: "Potencial medio, bajo desempeño" },
  { id: "Empleado clave",         pot: "medio", des: "medio", color: "#6366f1", bg: "#eef2ff", desc: "Confiable y consistente" },
  { id: "Alto rendimiento",       pot: "medio", des: "alto",  color: "#0ea5e9", bg: "#f0f9ff", desc: "Potencial medio, alto desempeño" },
  { id: "Bajo rendimiento",       pot: "bajo",  des: "bajo",  color: "#ef4444", bg: "#fef2f2", desc: "Requiere atención urgente" },
  { id: "Empleado inconsistente", pot: "bajo",  des: "medio", color: "#f97316", bg: "#fff7ed", desc: "Desempeño variable" },
  { id: "Mal ajuste",             pot: "bajo",  des: "alto",  color: "#84cc16", bg: "#f7fee7", desc: "Buen desempeño, bajo potencial" },
];

const NineBox = () => {
  const [periodo, setPeriodo] = useState(PERIODOS[0]);
  const [data, setData]       = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError]     = useState("");
  const [seleccionado, setSeleccionado] = useState(null);

  // Filtros
  const [vistaFiltro, setVistaFiltro] = useState("organizacion"); // "organizacion" | "area" | "empleado"
  const [areaFiltro, setAreaFiltro]     = useState("");
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");

  useEffect(() => {
    getUsuarios().then((u) => setUsuarios(Array.isArray(u) ? u : [])).catch(() => {});
  }, []);

  const cargar = async () => {
    setCargando(true); setError(""); setData(null); setSeleccionado(null);
    try {
      const res = await getDoNineBox(periodo);
      setData(res);
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  };

  // Enriquecer empleados con area/departamento desde usuarios
  const empleadosEnriquecidos = (data?.empleados || []).map((e) => {
    const u = usuarios.find((u) => u.id === e.usuarioId);
    return { ...e, area: u?.area || u?.departamento || "", sucursal: u?.sucursalId || "" };
  });

  // Áreas únicas disponibles
  const areasDisponibles = [...new Set(empleadosEnriquecidos.map((e) => e.area).filter(Boolean))].sort();

  // Aplicar filtro
  const empleadosFiltrados = empleadosEnriquecidos.filter((e) => {
    if (vistaFiltro === "area") return areaFiltro ? e.area === areaFiltro : true;
    if (vistaFiltro === "empleado") return empleadoFiltro ? e.usuarioId === empleadoFiltro : true;
    return true;
  });

  const empleadosPorCuadrante = (cuadrante) =>
    empleadosFiltrados.filter((e) => e.cuadrante === cuadrante);

  const FILTER_TABS = [
    { key: "organizacion", label: "🏢 Organización" },
    { key: "area",         label: "🏗️ Por Área" },
    { key: "empleado",     label: "👤 Por Empleado" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nine-Box</h1>
          <p className="subtitle">Matriz de talento: Potencial vs Desempeño</p>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <select className="form-control" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ width: 160 }}>
          {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn btn-primary" onClick={cargar} disabled={cargando}>
          {cargando ? "Cargando…" : "Generar Nine-Box"}
        </button>
      </div>

      {/* Tabs de vista */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--bg3)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setVistaFiltro(t.key); setAreaFiltro(""); setEmpleadoFiltro(""); }}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: "0.85rem", transition: "all 0.15s",
              background: vistaFiltro === t.key ? "var(--accent)" : "transparent",
              color: vistaFiltro === t.key ? "#fff" : "var(--text2)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Selector secundario según la vista */}
      {vistaFiltro === "area" && data && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Área:</label>
          <select className="form-control" value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)} style={{ width: 240 }}>
            <option value="">— Todas las áreas —</option>
            {areasDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {areaFiltro && (
            <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
              {empleadosFiltrados.length} empleados en esta área
            </span>
          )}
        </div>
      )}

      {vistaFiltro === "empleado" && data && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Empleado:</label>
          <select className="form-control" value={empleadoFiltro} onChange={(e) => setEmpleadoFiltro(e.target.value)} style={{ width: 280 }}>
            <option value="">— Seleccionar empleado —</option>
            {empleadosEnriquecidos.map((e) => (
              <option key={e.usuarioId} value={e.usuarioId}>{e.nombre} — {e.puesto}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, fontSize: "0.85rem", color: "var(--text2)", flexWrap: "wrap" }}>
            <span>Evaluados: <strong>{empleadosFiltrados.length}</strong>{vistaFiltro !== "organizacion" ? ` de ${empleadosEnriquecidos.length}` : ""}</span>
            <span>·</span>
            <span>Periodo: <strong>{data.periodo}</strong></span>
            {vistaFiltro === "area" && areaFiltro && <><span>·</span><span>Área: <strong>{areaFiltro}</strong></span></>}
            {vistaFiltro === "empleado" && empleadoFiltro && (
              <><span>·</span><span>Empleado: <strong>{empleadosEnriquecidos.find((e) => e.usuarioId === empleadoFiltro)?.nombre}</strong></span></>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            {/* Eje Y */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "0.75rem", fontWeight: 700, color: "var(--text2)", height: 330, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Potencial (360 + Competencias) ↑
            </div>

            <div style={{ flex: 1 }}>
              {/* Grid 3×3 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
                {CUADRANTES.map((c) => {
                  const emps = empleadosPorCuadrante(c.id);
                  const isSelected = seleccionado === c.id;
                  return (
                    <div key={c.id}
                      onClick={() => setSeleccionado(isSelected ? null : c.id)}
                      style={{
                        background: c.bg,
                        border: `2px solid ${isSelected ? c.color : "transparent"}`,
                        borderRadius: 10, padding: 14, cursor: "pointer", minHeight: 100,
                        transition: "all 0.15s",
                        boxShadow: isSelected ? `0 0 0 3px ${c.color}33` : "none",
                        opacity: vistaFiltro === "empleado" && empleadoFiltro && emps.length === 0 ? 0.35 : 1,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: c.color, marginBottom: 2 }}>{c.id}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginBottom: 8 }}>{c.desc}</div>
                      {emps.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {emps.map((e) => (
                            <div key={e.usuarioId} style={{
                              background: c.color, color: "#fff", borderRadius: 20,
                              padding: "2px 8px", fontSize: "0.72rem", fontWeight: 600,
                            }} title={`Potencial: ${e.potencial} | Desempeño: ${e.desempeno}`}>
                              {e.nombre.split(" ")[0]}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin empleados</div>
                      )}
                      {emps.length > 0 && (
                        <div style={{ fontSize: "0.72rem", color: c.color, fontWeight: 700, marginTop: 6 }}>
                          {emps.length} {emps.length === 1 ? "empleado" : "empleados"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Eje X */}
              <div style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Desempeño (Indicadores Estratégicos) →
              </div>
            </div>
          </div>

          {/* Detalle cuadrante */}
          {seleccionado && (() => {
            const c = CUADRANTES.find((q) => q.id === seleccionado);
            const emps = empleadosPorCuadrante(seleccionado);
            return (
              <div style={{ marginTop: 24, background: c.bg, borderRadius: 12, padding: 20, border: `1px solid ${c.color}44` }}>
                <h3 style={{ color: c.color, margin: "0 0 8px" }}>{c.id}</h3>
                <p style={{ color: "var(--text2)", fontSize: "0.88rem", margin: "0 0 16px" }}>{c.desc}</p>
                {emps.length === 0 ? (
                  <p style={{ color: "var(--text2)", fontStyle: "italic" }}>Sin empleados en este cuadrante</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                    {emps.map((e) => (
                      <div key={e.usuarioId} style={{ background: "white", borderRadius: 8, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{e.nombre}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 2 }}>{e.puesto}</div>
                        {e.area && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>🏗️ {e.area}</div>}
                        <div style={{ display: "flex", gap: 12, fontSize: "0.82rem" }}>
                          <div>
                            <div style={{ color: "var(--text2)", fontSize: "0.72rem" }}>Potencial</div>
                            <div style={{ fontWeight: 700, color: c.color }}>{e.potencial ?? "—"}/5</div>
                          </div>
                          <div>
                            <div style={{ color: "var(--text2)", fontSize: "0.72rem" }}>Desempeño</div>
                            <div style={{ fontWeight: 700, color: c.color }}>{e.desempeno ?? "—"}/5</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {empleadosFiltrados.length === 0 && (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <div className="empty-icon">📊</div>
              <p>No hay empleados con datos de evaluación para este filtro.</p>
            </div>
          )}
        </>
      )}

      {!data && !cargando && (
        <div className="empty-state">
          <div className="empty-icon">🔲</div>
          <p>Selecciona un periodo y genera el Nine-Box.</p>
        </div>
      )}
    </div>
  );
};

export default NineBox;
