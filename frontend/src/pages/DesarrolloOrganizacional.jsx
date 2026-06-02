import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getUsuarios, getPuestos } from "../utils/api";
import { confirmar, toastExito, toastError } from "../utils/toast";
import {
  getDoCompetencias, crearDoCompetencia, actualizarDoCompetencia, eliminarDoCompetencia,
  getDoEvalCompetencias, crearDoEvalCompetencia,
  getDoEval360, crearDoEval360,
  getDoEval1a1, crearDoEval1a1, actualizarDoEval1a1,
  getDoSatisfaccion, crearDoSatisfaccion,
  getDoIndicadores, crearDoIndicador, eliminarDoIndicador,
  getDoIndicadoresValores, crearDoIndicadorValor,
  getDoPlantillas1a1, crearDoPlantilla1a1, actualizarDoPlantilla1a1, eliminarDoPlantilla1a1,
} from "../utils/api";

// ─── Preguntas por defecto para cada tipo de evaluación 360 ────────────────────
const PREGUNTAS_360_DEFAULT = {
  jefe: [
    "¿Comunica claramente las expectativas y objetivos del equipo?",
    "¿Provee retroalimentación oportuna y constructiva?",
    "¿Apoya el desarrollo profesional de los integrantes del equipo?",
  ],
  par: [
    "¿Colabora de manera efectiva con otros compañeros del mismo nivel?",
    "¿Cumple con sus compromisos y plazos acordados?",
    "¿Comparte conocimiento y apoya a sus pares cuando es necesario?",
  ],
  personal: [
    "¿Gestiona y delega tareas de forma adecuada?",
    "¿Crea un ambiente de trabajo positivo para el equipo a su cargo?",
    "¿Reconoce los logros y esfuerzos de las personas que supervisa?",
  ],
  compañero: [
    "¿Identificas áreas de mejora propias en tu desempeño actual?",
    "¿Cuáles son tus principales logros en este período?",
    "¿Qué recursos o apoyo necesitas para mejorar tu desempeño?",
  ],
};

const LS_KEY_360 = "kronos_do_preguntas360";

const cargarPreguntas360 = () => {
  try {
    const raw = localStorage.getItem(LS_KEY_360);
    return raw ? JSON.parse(raw) : PREGUNTAS_360_DEFAULT;
  } catch { return PREGUNTAS_360_DEFAULT; }
};

const guardarPreguntas360 = (preguntas) => {
  localStorage.setItem(LS_KEY_360, JSON.stringify(preguntas));
};

const PERIODOS = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2025-Q4", "2025-Q3"];
const TIPOS_EVAL360 = [
  { value: "jefe", label: "Jefe inmediato" },
  { value: "par", label: "Par" },
  { value: "personal", label: "Personal" },
  { value: "compañero", label: "Compañero en la empresa" },
];

// ─── Vista: Configuración ──────────────────────────────────────────────────────
function VistaConfiguracion({ puestos, puedeAdmin }) {
  const [competencias, setCompetencias] = useState([]);
  const [indicadores, setIndicadores] = useState([]);
  const [satisfaccionConf, setSatisfaccionConf] = useState([]);
  const [filtroPuesto, setFiltroPuesto] = useState("");
  const [tabConf, setTabConf] = useState("competencias");
  const [modal, setModal] = useState(null); // "competencia" | "competencia_edit" | "indicador"
  const [formComp, setFormComp] = useState({ nombre: "", tipo: "dura", descripcion: "" });
  const [editCompId, setEditCompId] = useState(null);
  const [formInd, setFormInd] = useState({ puestoId: "", nombre: "", descripcion: "", unidad: "", meta: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Satisfacción de clientes (compañía)
  const [periodoSat, setPeriodoSat] = useState(PERIODOS[0]);
  const [formSat, setFormSat] = useState({ calificacion: 8, comentarios: "" });
  const [guardandoSat, setGuardandoSat] = useState(false);
  const cargarSat = (p) => getDoSatisfaccion({ periodo: p || periodoSat }).then(setSatisfaccionConf).catch(() => {});

  // Preguntas 360
  const [preguntas360, setPreguntas360] = useState(cargarPreguntas360);
  const [tipo360Activo, setTipo360Activo] = useState("jefe");
  const [nuevaPregunta360, setNuevaPregunta360] = useState("");

  // Plantillas 1a1
  const [plantillas, setPlantillas] = useState([]);
  const [modalPlantilla, setModalPlantilla] = useState(null); // null | "crear" | {id, nombre, descripcion, preguntas}
  const [formPlantilla, setFormPlantilla] = useState({ nombre: "", descripcion: "", preguntas: [] });
  const [nuevaPregunta, setNuevaPregunta] = useState("");

  const cargarComp = () => getDoCompetencias().then(setCompetencias).catch(() => {});
  const cargarInd = () => getDoIndicadores(filtroPuesto ? { puestoId: filtroPuesto } : {}).then(setIndicadores).catch(() => {});

  useEffect(() => { cargarComp(); getDoPlantillas1a1().then(setPlantillas).catch(() => {}); cargarSat(PERIODOS[0]); }, []);
  useEffect(() => { cargarInd(); }, [filtroPuesto]);
  useEffect(() => { cargarSat(periodoSat); }, [periodoSat]);

  const countByPuesto = {};
  indicadores.forEach((i) => { countByPuesto[i.puestoId] = (countByPuesto[i.puestoId] || 0) + 1; });

  const getPuestoNombre = (id) => puestos.find((p) => p.id === id)?.nombre || id;

  const submitComp = async (e) => {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      if (editCompId) {
        await actualizarDoCompetencia(editCompId, formComp);
      } else {
        await crearDoCompetencia(formComp);
      }
      setModal(null); setEditCompId(null); setFormComp({ nombre: "", tipo: "dura", descripcion: "" }); cargarComp();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  const submitSatisfaccionConf = async (e) => {
    e.preventDefault(); setGuardandoSat(true);
    try {
      await crearDoSatisfaccion({ ...formSat, periodo: periodoSat });
      setFormSat({ calificacion: 8, comentarios: "" });
      cargarSat(periodoSat);
    } catch (err) { alert(err.message); } finally { setGuardandoSat(false); }
  };

  const submitInd = async (e) => {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      await crearDoIndicador({ ...formInd, meta: formInd.meta ? Number(formInd.meta) : null });
      setModal(null); setFormInd({ puestoId: "", nombre: "", descripcion: "", unidad: "", meta: "" }); cargarInd();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { key: "competencias", label: "🎯 Competencias" },
          { key: "indicadores",  label: "📈 Indicadores" },
          { key: "plantillas1a1", label: "📝 Plantillas 1a1" },
          { key: "satisfaccion",  label: "⭐ Satisfacción Clientes" },
          { key: "preguntas360",  label: "🔄 Preguntas 360°" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTabConf(key)}
            className={`btn ${tabConf === key ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: "0.85rem" }}>
            {label}
          </button>
        ))}
      </div>

      {tabConf === "competencias" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Catálogo de Competencias</h3>
            {puedeAdmin && <button className="btn btn-primary" onClick={() => { setError(""); setModal("competencia"); }}>+ Nueva competencia</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {competencias.map((c) => (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>{c.descripcion}</div>
                  </div>
                  <span className={`badge ${c.tipo === "dura" ? "badge-primary" : "badge-success"}`}>{c.tipo}</span>
                </div>
                {puedeAdmin && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                      onClick={() => { setError(""); setEditCompId(c.id); setFormComp({ nombre: c.nombre, tipo: c.tipo, descripcion: c.descripcion || "" }); setModal("competencia"); }}>
                      ✏️ Editar
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }}
                      onClick={async () => { if (await confirmar(`¿Eliminar la competencia "${c.nombre}"?`, "Eliminar")) { eliminarDoCompetencia(c.id).then(cargarComp); toastExito("Competencia eliminada"); } }}>
                      🗑️ Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {competencias.length === 0 && <div style={{ color: "var(--text2)", fontStyle: "italic" }}>Sin competencias. {puedeAdmin ? "Agrega la primera." : ""}</div>}
          </div>
        </div>
      )}

      {tabConf === "indicadores" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Indicadores Estratégicos</h3>
              <select className="form-control" value={filtroPuesto} onChange={(e) => setFiltroPuesto(e.target.value)} style={{ width: 200, fontSize: "0.85rem" }}>
                <option value="">Todos los puestos</option>
                {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            {puedeAdmin && <button className="btn btn-primary" onClick={() => { setError(""); setModal("indicador"); }}>+ Nuevo indicador</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {indicadores.map((ind) => (
              <div key={ind.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ind.nombre}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>{getPuestoNombre(ind.puestoId)}</div>
                    {ind.descripcion && <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{ind.descripcion}</div>}
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: "0.7rem" }}>{countByPuesto[ind.puestoId] || 1}/3</span>
                </div>
                {ind.meta && <div style={{ fontSize: "0.8rem", marginTop: 6 }}>Meta: <strong>{ind.meta} {ind.unidad}</strong></div>}
                {puedeAdmin && (
                  <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }}
                    onClick={async () => { if (await confirmar(`¿Eliminar el indicador "${ind.nombre}"?`, "Eliminar")) { eliminarDoIndicador(ind.id).then(cargarInd); toastExito("Indicador eliminado"); } }}>
                    Eliminar
                  </button>
                )}
              </div>
            ))}
            {indicadores.length === 0 && <div style={{ color: "var(--text2)", fontStyle: "italic" }}>Sin indicadores.</div>}
          </div>
        </div>
      )}

      {tabConf === "plantillas1a1" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setFormPlantilla({ nombre: "", descripcion: "", preguntas: [] }); setModalPlantilla("crear"); }}>+ Nueva plantilla</button>
          </div>
          {plantillas.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📝</div><p>No hay plantillas creadas.</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {plantillas.map((pl) => (
                <div key={pl.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{pl.nombre}</div>
                      {pl.descripcion && <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 6 }}>{pl.descripcion}</div>}
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{pl.preguntas?.length || 0} preguntas</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setFormPlantilla({ nombre: pl.nombre, descripcion: pl.descripcion || "", preguntas: pl.preguntas || [] }); setModalPlantilla(pl); }}>✏️ Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={async () => { if (await confirmar(`¿Eliminar la plantilla "${pl.nombre}"?`, "Eliminar")) { await eliminarDoPlantilla1a1(pl.id); toastExito("Plantilla eliminada"); getDoPlantillas1a1().then(setPlantillas); } }}>🗑️</button>
                    </div>
                  </div>
                  {pl.preguntas?.length > 0 && (
                    <ol style={{ margin: "10px 0 0 0", paddingLeft: 20, fontSize: "0.83rem", color: "var(--text2)" }}>
                      {pl.preguntas.map((q, i) => <li key={i} style={{ marginBottom: 3 }}>{q.texto}</li>)}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal plantilla */}
          {modalPlantilla && (
            <div className="modal-overlay" onClick={() => setModalPlantilla(null)}>
              <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{modalPlantilla === "crear" ? "Nueva Plantilla 1a1" : "Editar Plantilla"}</h2>
                  <button className="modal-close" onClick={() => setModalPlantilla(null)}>✕</button>
                </div>
                <div className="modal-form">
                  <div className="form-group">
                    <label>Nombre de la plantilla *</label>
                    <input value={formPlantilla.nombre} onChange={(e) => setFormPlantilla((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Sesión mensual de seguimiento" required />
                  </div>
                  <div className="form-group">
                    <label>Descripción (opcional)</label>
                    <textarea value={formPlantilla.descripcion} onChange={(e) => setFormPlantilla((f) => ({ ...f, descripcion: e.target.value }))} rows={2} placeholder="Para qué se usa esta plantilla..." />
                  </div>
                  <div className="form-group">
                    <label>Preguntas de la sesión</label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        value={nuevaPregunta}
                        onChange={(e) => setNuevaPregunta(e.target.value)}
                        placeholder="Escribe una pregunta..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (nuevaPregunta.trim()) {
                              setFormPlantilla((f) => ({ ...f, preguntas: [...f.preguntas, { id: Date.now().toString(), texto: nuevaPregunta.trim() }] }));
                              setNuevaPregunta("");
                            }
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={() => {
                        if (nuevaPregunta.trim()) {
                          setFormPlantilla((f) => ({ ...f, preguntas: [...f.preguntas, { id: Date.now().toString(), texto: nuevaPregunta.trim() }] }));
                          setNuevaPregunta("");
                        }
                      }}>+ Añadir</button>
                    </div>
                    {formPlantilla.preguntas.length > 0 && (
                      <ol style={{ paddingLeft: 20, margin: 0 }}>
                        {formPlantilla.preguntas.map((q, idx) => (
                          <li key={q.id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "0.88rem" }}>{q.texto}</span>
                            <button type="button" onClick={() => setFormPlantilla((f) => ({ ...f, preguntas: f.preguntas.filter((_, i) => i !== idx) }))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>✕</button>
                          </li>
                        ))}
                      </ol>
                    )}
                    {formPlantilla.preguntas.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin preguntas. Añade al menos una. Puedes presionar Enter para agregar rápido.</p>}
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setModalPlantilla(null)}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={async () => {
                      if (!formPlantilla.nombre.trim()) { alert("El nombre es requerido"); return; }
                      if (modalPlantilla === "crear") {
                        await crearDoPlantilla1a1(formPlantilla);
                      } else {
                        await actualizarDoPlantilla1a1(modalPlantilla.id, formPlantilla);
                      }
                      getDoPlantillas1a1().then(setPlantillas);
                      setModalPlantilla(null);
                    }}>
                      {modalPlantilla === "crear" ? "Crear plantilla" : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Satisfacción de Clientes */}
      {tabConf === "satisfaccion" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ margin: 0 }}>⭐ Satisfacción de Clientes — Compañía</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text2)" }}>Período:</label>
              <select className="form-control" value={periodoSat} onChange={(e) => setPeriodoSat(e.target.value)} style={{ width: 140 }}>
                {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Resumen del período */}
          {satisfaccionConf.length > 0 && (() => {
            const prom = (satisfaccionConf.reduce((s, r) => s + r.calificacion, 0) / satisfaccionConf.length).toFixed(1);
            const color = Number(prom) >= 8 ? "#10b981" : Number(prom) >= 6 ? "#f59e0b" : "#ef4444";
            return (
              <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ background: "var(--bg3)", borderRadius: 12, padding: "20px 28px", textAlign: "center", minWidth: 140 }}>
                  <div style={{ fontSize: "2.5rem", fontWeight: 700, color }}>{prom}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>Promedio / 10</div>
                </div>
                <div style={{ background: "var(--bg3)", borderRadius: 12, padding: "20px 28px", textAlign: "center", minWidth: 120 }}>
                  <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{satisfaccionConf.length}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>Registros</div>
                </div>
              </div>
            );
          })()}

          {/* Historial */}
          {satisfaccionConf.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {satisfaccionConf.map((r) => {
                const col = r.calificacion >= 8 ? "#10b981" : r.calificacion >= 6 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={r.id} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 16px", textAlign: "center", border: `2px solid ${col}22` }}>
                    <div style={{ fontWeight: 700, fontSize: "1.5rem", color: col }}>{r.calificacion}/10</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text2)", marginTop: 2 }}>{r.creadoEn?.split("T")[0]}</div>
                    {r.comentarios && <div style={{ fontSize: "0.72rem", marginTop: 4, color: "var(--text2)", maxWidth: 140 }}>{r.comentarios}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "var(--text2)", fontStyle: "italic", marginBottom: 24 }}>Sin registros para este período.</div>
          )}

          {/* Formulario nuevo registro */}
          {puedeAdmin && (
            <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 20, maxWidth: 480 }}>
              <h4 style={{ margin: "0 0 14px", fontSize: "0.95rem" }}>+ Registrar calificación</h4>
              <form onSubmit={submitSatisfaccionConf}>
                <div className="form-group">
                  <label>Calificación (1–10) *</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map((v) => {
                      const col = v >= 8 ? "#10b981" : v >= 6 ? "#f59e0b" : "#ef4444";
                      return (
                        <button key={v} type="button" onClick={() => setFormSat((f) => ({ ...f, calificacion: v }))}
                          style={{ width: 40, height: 40, borderRadius: 8, border: "2px solid", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                            borderColor: formSat.calificacion === v ? col : "var(--border)",
                            background: formSat.calificacion === v ? col : "var(--bg2)",
                            color: formSat.calificacion === v ? "#fff" : "var(--text)" }}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label>Comentarios (opcional)</label>
                  <textarea value={formSat.comentarios} onChange={(e) => setFormSat((f) => ({ ...f, comentarios: e.target.value }))} rows={2} placeholder="Contexto sobre la calificación…" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={guardandoSat}>
                  {guardandoSat ? "Guardando…" : "Registrar calificación"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab: Preguntas 360° */}
      {tabConf === "preguntas360" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 6px" }}>🔄 Banco de Preguntas para Evaluación 360°</h3>
            <p style={{ color: "var(--text2)", fontSize: "0.85rem", margin: 0 }}>
              Define las preguntas que se mostrarán al evaluar a cada empleado según el tipo de relación. Las preguntas se guardan localmente en este navegador.
            </p>
          </div>

          {/* Tabs por tipo */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {TIPOS_EVAL360.map((t) => (
              <button key={t.value} onClick={() => setTipo360Activo(t.value)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.85rem", fontWeight: tipo360Activo === t.value ? 700 : 400,
                  background: tipo360Activo === t.value ? "var(--accent)" : "var(--bg3)",
                  color: tipo360Activo === t.value ? "#fff" : "var(--text2)" }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 20, maxWidth: 580 }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 14 }}>
              Preguntas para el evaluador tipo: <strong>{TIPOS_EVAL360.find(t => t.value === tipo360Activo)?.label}</strong>
            </p>

            {/* Lista de preguntas */}
            <ol style={{ paddingLeft: 20, margin: "0 0 14px" }}>
              {(preguntas360[tipo360Activo] || []).map((q, idx) => (
                <li key={idx} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: "0.88rem", flex: 1 }}>{q}</span>
                  {puedeAdmin && (
                    <button onClick={() => {
                      const updated = { ...preguntas360, [tipo360Activo]: preguntas360[tipo360Activo].filter((_, i) => i !== idx) };
                      setPreguntas360(updated); guardarPreguntas360(updated);
                    }} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1rem", flexShrink: 0, padding: "0 4px" }}>✕</button>
                  )}
                </li>
              ))}
              {(preguntas360[tipo360Activo] || []).length === 0 && (
                <li style={{ listStyle: "none", color: "var(--text2)", fontStyle: "italic", fontSize: "0.85rem" }}>Sin preguntas definidas.</li>
              )}
            </ol>

            {/* Agregar nueva pregunta */}
            {puedeAdmin && (
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-control" value={nuevaPregunta360} onChange={(e) => setNuevaPregunta360(e.target.value)}
                  placeholder="Escribe una nueva pregunta…" style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (nuevaPregunta360.trim()) {
                        const updated = { ...preguntas360, [tipo360Activo]: [...(preguntas360[tipo360Activo] || []), nuevaPregunta360.trim()] };
                        setPreguntas360(updated); guardarPreguntas360(updated); setNuevaPregunta360("");
                      }
                    }
                  }} />
                <button type="button" className="btn btn-primary" onClick={() => {
                  if (nuevaPregunta360.trim()) {
                    const updated = { ...preguntas360, [tipo360Activo]: [...(preguntas360[tipo360Activo] || []), nuevaPregunta360.trim()] };
                    setPreguntas360(updated); guardarPreguntas360(updated); setNuevaPregunta360("");
                  }
                }}>+ Añadir</button>
              </div>
            )}

            {puedeAdmin && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}
                onClick={async () => {
                  if (await confirmar("¿Restaurar preguntas predeterminadas para este tipo? Se perderán los cambios actuales.", "Restaurar", "warning")) {
                    const updated = { ...preguntas360, [tipo360Activo]: PREGUNTAS_360_DEFAULT[tipo360Activo] };
                    setPreguntas360(updated); guardarPreguntas360(updated);
                  }
                }}>
                🔄 Restaurar predeterminadas
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal competencia (crear / editar) */}
      {modal === "competencia" && (
        <div className="modal-overlay" onClick={() => { setModal(null); setEditCompId(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editCompId ? "Editar Competencia" : "Nueva Competencia"}</h2>
              <button className="modal-close" onClick={() => { setModal(null); setEditCompId(null); }}>✕</button>
            </div>
            <form onSubmit={submitComp} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group"><label>Nombre *</label><input value={formComp.nombre} onChange={(e) => setFormComp((f) => ({ ...f, nombre: e.target.value }))} required /></div>
              <div className="form-group"><label>Tipo *</label>
                <select value={formComp.tipo} onChange={(e) => setFormComp((f) => ({ ...f, tipo: e.target.value }))}>
                  <option value="dura">Dura</option><option value="blanda">Blanda</option>
                </select>
              </div>
              <div className="form-group"><label>Descripción</label><textarea value={formComp.descripcion} onChange={(e) => setFormComp((f) => ({ ...f, descripcion: e.target.value }))} rows={2} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setModal(null); setEditCompId(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando…" : editCompId ? "Guardar cambios" : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal indicador */}
      {modal === "indicador" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Nuevo Indicador Estratégico</h2><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <form onSubmit={submitInd} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group"><label>Puesto *</label>
                <select value={formInd.puestoId} onChange={(e) => setFormInd((f) => ({ ...f, puestoId: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {puestos.map((p) => { const c = countByPuesto[p.id] || 0; return <option key={p.id} value={p.id} disabled={c >= 3}>{p.nombre} ({c}/3)</option>; })}
                </select>
              </div>
              <div className="form-group"><label>Nombre *</label><input value={formInd.nombre} onChange={(e) => setFormInd((f) => ({ ...f, nombre: e.target.value }))} required /></div>
              <div className="form-group"><label>Descripción</label><textarea value={formInd.descripcion} onChange={(e) => setFormInd((f) => ({ ...f, descripcion: e.target.value }))} rows={2} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group"><label>Unidad</label><input value={formInd.unidad} onChange={(e) => setFormInd((f) => ({ ...f, unidad: e.target.value }))} placeholder="ventas, %, pts" /></div>
                <div className="form-group"><label>Meta</label><input type="number" value={formInd.meta} onChange={(e) => setFormInd((f) => ({ ...f, meta: e.target.value }))} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Seccion1a1 — sesiones con formulario, preguntas y audio ─────────────────
function Seccion1a1({ empleado, eval1a1, plantillas = [], cargar }) {
  const [modal, setModal] = useState(null); // null | "nuevo" | sesion_existente
  const [form, setForm]   = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Audio
  const [grabarAudio, setGrabarAudio] = useState(false);
  const [grabando, setGrabando]       = useState(false);
  const [audioUrl, setAudioUrl]       = useState(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [tiempoGrab, setTiempoGrab]   = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url  = URL.createObjectURL(blob);
        setAudioUrl(url);
        const reader = new FileReader();
        reader.onload = () => setAudioBase64(reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setGrabando(true);
      setTiempoGrab(0);
      timerRef.current = setInterval(() => setTiempoGrab((t) => t + 1), 1000);
    } catch {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  };

  const detenerGrabacion = () => {
    mediaRecorderRef.current?.stop();
    setGrabando(false);
    clearInterval(timerRef.current);
  };

  const resetAudio = () => {
    setAudioUrl(null); setAudioBase64(null);
    setGrabando(false); setTiempoGrab(0);
    clearInterval(timerRef.current);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  const fmtTiempo = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const abrirNuevo = () => {
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      realizada: false,
      plantillaId: "",
      respuestas: [],
      comentarios: "",
    });
    resetAudio(); setGrabarAudio(false);
    setError(""); setModal("nuevo");
  };

  const plantillaSeleccionada = plantillas.find((p) => p.id === form.plantillaId) || null;

  const handleChangePlantilla = (plantillaId) => {
    const pl = plantillas.find((p) => p.id === plantillaId);
    setForm((f) => ({
      ...f,
      plantillaId,
      respuestas: pl ? pl.preguntas.map((q) => ({ preguntaId: q.id, pregunta: q.texto, respuesta: "" })) : [],
    }));
  };

  const handleRespuesta = (preguntaId, valor) => {
    setForm((f) => ({
      ...f,
      respuestas: f.respuestas.map((r) => r.preguntaId === preguntaId ? { ...r, respuesta: valor } : r),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      await crearDoEval1a1({
        ...form,
        empleadoId: empleado.id,
        audioBase64: grabarAudio ? audioBase64 : null,
      });
      setModal(null); resetAudio(); setGrabarAudio(false);
      cargar();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  const realizadas = eval1a1.filter((e) => e.realizada).length;

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>🤝 Sesiones 1 a 1 <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text2)", marginLeft: 8 }}>{realizadas}/{eval1a1.length} realizadas</span></h3>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>+ Nueva sesión</button>
      </div>

      {eval1a1.length === 0 ? (
        <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>Sin sesiones 1 a 1 registradas.</p>
      ) : (
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Plantilla</th>
              <th>Estado</th>
              <th>Audio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eval1a1.map((ev) => {
              const pl = plantillas.find((p) => p.id === ev.plantillaId);
              return (
                <tr key={ev.id}>
                  <td style={{ fontSize: "0.85rem" }}>{ev.fecha?.split("T")[0] || ev.fecha}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{pl ? pl.nombre : ev.comentarios ? "Libre" : "—"}</td>
                  <td><span className={`badge ${ev.realizada ? "badge-success" : "badge-warning"}`}>{ev.realizada ? "Realizada" : "Pendiente"}</span></td>
                  <td>{ev.audioBase64 ? <span title="Tiene grabación de audio" style={{ fontSize: "1.1rem" }}>🎙️</span> : <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal(ev)}>👁️ Ver</button>
                    <button className={`btn btn-sm ${ev.realizada ? "btn-secondary" : "btn-success"}`} onClick={() => actualizarDoEval1a1(ev.id, { realizada: !ev.realizada }).then(cargar)}>
                      {ev.realizada ? "↩" : "✔"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal nueva sesión */}
      {modal === "nuevo" && (
        <div className="modal-overlay" onClick={() => { setModal(null); resetAudio(); }}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h2>Nueva sesión 1 a 1 — {empleado.nombre}</h2>
              <button className="modal-close" onClick={() => { setModal(null); resetAudio(); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Fecha *</label>
                  <input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Plantilla</label>
                  <select value={form.plantillaId} onChange={(e) => handleChangePlantilla(e.target.value)}>
                    <option value="">— Sin plantilla (libre) —</option>
                    {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="realizada1a1" checked={form.realizada} onChange={(e) => setForm((f) => ({ ...f, realizada: e.target.checked }))} style={{ width: 18, height: 18 }} />
                <label htmlFor="realizada1a1" style={{ margin: 0 }}>¿Ya fue realizada?</label>
              </div>

              {/* Preguntas con respuestas */}
              {plantillaSeleccionada && plantillaSeleccionada.preguntas.length > 0 && (
                <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 16, marginBottom: 8 }}>
                  <p style={{ fontWeight: 600, marginBottom: 12, fontSize: "0.88rem" }}>📋 {plantillaSeleccionada.nombre}</p>
                  {plantillaSeleccionada.preguntas.map((q, idx) => {
                    const resp = form.respuestas.find((r) => r.preguntaId === q.id);
                    return (
                      <div key={q.id} className="form-group" style={{ marginBottom: 14 }}>
                        <label style={{ fontWeight: 600, fontSize: "0.85rem" }}>{idx + 1}. {q.texto}</label>
                        <textarea
                          value={resp?.respuesta || ""}
                          onChange={(e) => handleRespuesta(q.id, e.target.value)}
                          placeholder="Escribe la respuesta..."
                          rows={2}
                          style={{ fontSize: "0.88rem" }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="form-group">
                <label>Comentarios generales</label>
                <textarea value={form.comentarios} onChange={(e) => setForm((f) => ({ ...f, comentarios: e.target.value }))} rows={2} placeholder="Notas adicionales sobre la sesión..." />
              </div>

              {/* Audio recording */}
              <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: grabarAudio ? 12 : 0 }}>
                  <input type="checkbox" checked={grabarAudio} onChange={(e) => { setGrabarAudio(e.target.checked); if (!e.target.checked) resetAudio(); }} style={{ width: 18, height: 18 }} />
                  <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>🎙️ Grabar audio de esta sesión</span>
                </label>

                {grabarAudio && (
                  <div>
                    {!audioUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {!grabando ? (
                          <button type="button" className="btn btn-primary" onClick={iniciarGrabacion} style={{ background: "#ef4444", borderColor: "#ef4444" }}>
                            ⏺ Iniciar grabación
                          </button>
                        ) : (
                          <>
                            <button type="button" className="btn btn-secondary" onClick={detenerGrabacion}>
                              ⏹ Detener
                            </button>
                            <span style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.9rem", fontVariantNumeric: "tabular-nums" }}>
                              🔴 {fmtTiempo(tiempoGrab)}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {audioUrl && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: "0.85rem", color: "var(--text2)" }}>✅ Grabación lista ({fmtTiempo(tiempoGrab)})</span>
                          <button type="button" onClick={resetAudio} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem" }}>Repetir</button>
                        </div>
                        <audio controls src={audioUrl} style={{ width: "100%", height: 36 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setModal(null); resetAudio(); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando || grabando}>
                  {guardando ? "Guardando…" : "Registrar sesión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ver sesión existente */}
      {modal && modal !== "nuevo" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>Sesión 1 a 1 — {modal.fecha?.split("T")[0] || modal.fecha}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              {/* Info */}
              <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <span className={`badge ${modal.realizada ? "badge-success" : "badge-warning"}`}>{modal.realizada ? "✔ Realizada" : "⏳ Pendiente"}</span>
                {plantillas.find((p) => p.id === modal.plantillaId) && (
                  <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>📋 {plantillas.find((p) => p.id === modal.plantillaId)?.nombre}</span>
                )}
              </div>

              {/* Preguntas y respuestas */}
              {modal.respuestas?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontWeight: 600, marginBottom: 10, fontSize: "0.9rem" }}>Preguntas y respuestas:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {modal.respuestas.map((r, i) => (
                      <div key={i} style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 4 }}>{i + 1}. {r.pregunta}</div>
                        <div style={{ fontSize: "0.88rem", color: r.respuesta ? "var(--text)" : "var(--text-muted)", fontStyle: r.respuesta ? "normal" : "italic" }}>
                          {r.respuesta || "Sin respuesta registrada"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comentarios */}
              {modal.comentarios && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>Comentarios:</p>
                  <p style={{ fontSize: "0.88rem", color: "var(--text2)", margin: 0 }}>{modal.comentarios}</p>
                </div>
              )}

              {/* Audio */}
              {modal.audioBase64 && (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.9rem" }}>🎙️ Grabación de audio:</p>
                  <audio controls src={modal.audioBase64} style={{ width: "100%", height: 40 }} />
                </div>
              )}

              {!modal.respuestas?.length && !modal.comentarios && !modal.audioBase64 && (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.88rem" }}>Esta sesión no tiene contenido registrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vista: Perfil de evaluaciones por empleado ───────────────────────────────
function PerfilEmpleado({ empleado, periodo, setPeriodo, puestos, onVolver }) {
  const [eval360, setEval360] = useState([]);
  const [evalComp, setEvalComp] = useState([]);
  const [eval1a1, setEval1a1] = useState([]);
  const [plantillas1a1, setPlantillas1a1] = useState([]);
  const [indValores, setIndValores] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Carga fresca de competencias e indicadores dentro del perfil
  const [competencias, setCompetencias] = useState([]);
  const [indicadores, setIndicadores] = useState([]);
  const preguntas360 = cargarPreguntas360();

  const cargar = () => {
    getDoEval360({ evaluadoId: empleado.id, periodo }).then(setEval360).catch(() => {});
    getDoEvalCompetencias({ evaluadoId: empleado.id, periodo }).then(setEvalComp).catch(() => {});
    getDoEval1a1({ empleadoId: empleado.id }).then(setEval1a1).catch(() => {});
    getDoIndicadoresValores({ usuarioId: empleado.id, periodo }).then(setIndValores).catch(() => {});
    getDoPlantillas1a1().then(setPlantillas1a1).catch(() => {});
    getDoCompetencias().then(setCompetencias).catch(() => {});
    getDoIndicadores().then(setIndicadores).catch(() => {});
  };
  useEffect(() => { cargar(); }, [empleado.id, periodo]);

  const indEmpleado = indicadores.filter((i) => i.puestoId === empleado.puestoId);
  const getPuestoNombre = (id) => puestos.find((p) => p.id === id)?.nombre || "";

  // ── helpers de submit ──
  const submit360 = async (e) => {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      await crearDoEval360({ ...form, evaluadoId: empleado.id, periodo });
      setModal(null); cargar();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  const submitComp = async (e) => {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      await crearDoEvalCompetencia({ evaluadoId: empleado.id, periodo, detalles: form.detalles, comentarios: form.comentarios || "" });
      setModal(null); cargar();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  const submitValorInd = async (e) => {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      await crearDoIndicadorValor({ ...form, usuarioId: empleado.id, periodo, valor: Number(form.valor), meta: form.meta ? Number(form.meta) : null });
      setModal(null); cargar();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  const prom360 = eval360.length ? (eval360.reduce((s, e) => s + e.calificacion, 0) / eval360.length).toFixed(1) : null;
  const promComp = evalComp.length && evalComp[0]?.detalles?.length
    ? (evalComp.flatMap((e) => e.detalles).reduce((s, d) => s + d.calificacion, 0) / evalComp.flatMap((e) => e.detalles).length).toFixed(1)
    : null;
  const realizadas1a1 = eval1a1.filter((e) => e.realizada).length;

  const cardStyle = { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, marginBottom: 16 };
  const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 };

  return (
    <div>
      {/* Header del perfil */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px 20px", background: "var(--bg3)", borderRadius: 12 }}>
        <button className="btn btn-secondary" onClick={onVolver}>← Volver</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{empleado.nombre} {empleado.apellido}</h2>
          <div style={{ fontSize: "0.85rem", color: "var(--text2)" }}>{getPuestoNombre(empleado.puestoId)} · {empleado.email}</div>
        </div>
        <select className="form-control" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ width: 160 }}>
          {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Resumen rápido */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Eval. 360", value: prom360 ? `${prom360}/5` : "—", icon: "🔄", color: "#6366f1" },
          { label: "Competencias", value: promComp ? `${promComp}/5` : "—", icon: "🎯", color: "#10b981" },
          { label: "Sesiones 1a1", value: `${realizadas1a1}/${eval1a1.length}`, icon: "🤝", color: "#f59e0b" },
          { label: "Indicadores", value: `${indValores.length}/${indEmpleado.length}`, icon: "📈", color: "#8b5cf6" },
        ].map((m) => (
          <div key={m.label} style={{ background: "var(--bg3)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>{m.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "1.3rem", color: m.color }}>{m.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* 1. Evaluación 360 */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0 }}>🔄 Evaluación 360</h3>
          <button className="btn btn-primary btn-sm" onClick={() => {
            const tipo = "jefe";
            const pregs = cargarPreguntas360();
            setForm({ tipoEvaluador: tipo, calificacion: 3, comentarios: "", respuestas360: (pregs[tipo] || []).map((q) => ({ pregunta: q, respuesta: "" })) });
            setError(""); setModal("360");
          }}>+ Agregar</button>
        </div>
        {eval360.length === 0 ? <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>Sin evaluaciones 360 en este periodo.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {eval360.map((ev) => (
              <div key={ev.id} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>{TIPOS_EVAL360.find((t) => t.value === ev.tipoEvaluador)?.label}</div>
                <div style={{ fontWeight: 700, fontSize: "1.3rem", color: "#6366f1" }}>{ev.calificacion}/5</div>
                {ev.comentarios && <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 4 }}>{ev.comentarios}</div>}
              </div>
            ))}
          </div>
        )}
        {prom360 && <div style={{ marginTop: 10, fontSize: "0.85rem", fontWeight: 600 }}>Promedio: <span style={{ color: "#6366f1" }}>{prom360}/5</span></div>}
      </div>

      {/* 2. Evaluación por Competencias */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0 }}>🎯 Evaluación por Competencias</h3>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setForm({ comentarios: "", detalles: competencias.map((c) => ({ competenciaId: c.id, competenciaNombre: c.nombre, tipo: c.tipo, calificacion: 3 })) });
            setError(""); setModal("competencias");
          }} disabled={competencias.length === 0}>+ Agregar</button>
        </div>
        {evalComp.length === 0 ? <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>Sin evaluaciones de competencias en este periodo.</p> : (
          evalComp.map((ev) => (
            <div key={ev.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 6 }}>Registrada el {ev.creadoEn?.split("T")[0]}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                {(ev.detalles || []).map((d) => (
                  <div key={d.competenciaId} style={{ background: "var(--bg)", borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8rem" }}>{d.competenciaNombre}</span>
                    <span style={{ fontWeight: 700, color: "#10b981" }}>{d.calificacion}/5</span>
                  </div>
                ))}
              </div>
              {ev.comentarios && <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 4 }}>{ev.comentarios}</div>}
            </div>
          ))
        )}
        {promComp && <div style={{ marginTop: 6, fontSize: "0.85rem", fontWeight: 600 }}>Promedio: <span style={{ color: "#10b981" }}>{promComp}/5</span></div>}
      </div>

      {/* 3. Evaluaciones 1 a 1 */}
      <Seccion1a1 empleado={empleado} eval1a1={eval1a1} plantillas={plantillas1a1} cargar={cargar} />

      {/* 4. Indicadores Estratégicos */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0 }}>📈 Indicadores Estratégicos</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ indicadorId: "", valor: "", meta: "" }); setError(""); setModal("indicador"); }} disabled={indEmpleado.length === 0}>+ Registrar valor</button>
        </div>
        {indEmpleado.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: "0.85rem" }}>No hay indicadores configurados para el puesto de este empleado. Configúralos en la sección "Configuración".</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {indEmpleado.map((ind) => {
              const val = indValores.find((v) => v.indicadorId === ind.id);
              const meta = val?.meta || ind.meta;
              const pct = val && meta ? Math.min((val.valor / meta) * 100, 150).toFixed(0) : null;
              const color = pct ? (Number(pct) >= 100 ? "#10b981" : Number(pct) >= 70 ? "#f59e0b" : "#ef4444") : "var(--text2)";
              return (
                <div key={ind.id} style={{ background: "var(--bg)", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{ind.nombre}</div>
                  {ind.meta && <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>Meta: {ind.meta} {ind.unidad}</div>}
                  {val ? (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "1.2rem", color }}>{val.valor} {ind.unidad}</span>
                      {pct && <span style={{ marginLeft: 8, fontSize: "0.85rem", color, fontWeight: 600 }}>({pct}%)</span>}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.8rem", color: "var(--text2)", marginTop: 8, fontStyle: "italic" }}>Sin valor registrado</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Modales ─── */}
      {modal === "360" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-large" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔄 Evaluación 360 — {empleado.nombre}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={submit360} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Tipo de relación con el evaluado *</label>
                <select value={form.tipoEvaluador}
                  onChange={(e) => setForm((f) => ({ ...f, tipoEvaluador: e.target.value, respuestas360: (preguntas360[e.target.value] || []).map((q) => ({ pregunta: q, respuesta: "" })) }))}>
                  {TIPOS_EVAL360.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Preguntas configuradas para este tipo */}
              {(preguntas360[form.tipoEvaluador] || []).length > 0 && (
                <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 12, color: "var(--text2)" }}>
                    Preguntas para {TIPOS_EVAL360.find(t => t.value === form.tipoEvaluador)?.label}:
                  </p>
                  {(form.respuestas360 || []).map((r, idx) => (
                    <div key={idx} className="form-group" style={{ marginBottom: 12 }}>
                      <label style={{ fontWeight: 600, fontSize: "0.82rem" }}>{idx + 1}. {r.pregunta}</label>
                      <textarea
                        value={r.respuesta}
                        onChange={(e) => setForm((f) => {
                          const r360 = [...(f.respuestas360 || [])];
                          r360[idx] = { ...r360[idx], respuesta: e.target.value };
                          return { ...f, respuestas360: r360 };
                        })}
                        placeholder="Escribe tu respuesta…"
                        rows={2}
                        style={{ fontSize: "0.85rem" }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Calificación general (1–5) *</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {[1,2,3,4,5].map((v) => (
                    <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, calificacion: v }))}
                      style={{ width: 48, height: 48, borderRadius: 10, border: "2px solid",
                        borderColor: form.calificacion === v ? "#6366f1" : "var(--border)",
                        background: form.calificacion === v ? "#6366f1" : "var(--bg3)",
                        color: form.calificacion === v ? "#fff" : "var(--text)",
                        cursor: "pointer", fontWeight: 700, fontSize: "1.1rem" }}>
                      {v}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text2)", marginTop: 4, paddingLeft: 4 }}>
                  <span>Muy bajo</span><span>Excelente</span>
                </div>
              </div>
              <div className="form-group"><label>Comentarios adicionales</label><textarea value={form.comentarios} onChange={(e) => setForm((f) => ({ ...f, comentarios: e.target.value }))} rows={2} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Registrar evaluación"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "competencias" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>🎯 Eval. Competencias — {empleado.nombre}</h2><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <form onSubmit={submitComp} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}
              {competencias.length === 0 && (
                <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                  No hay competencias en el catálogo. Ve a <strong>Configuración → Competencias</strong> para agregar.
                </div>
              )}
              <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 12 }}>
                {(form.detalles || []).map((d, i) => (
                  <div key={d.competenciaId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{d.competenciaNombre}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>{d.tipo}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1,2,3,4,5].map((v) => (
                        <button key={v} type="button"
                          onClick={() => setForm((f) => { const det = [...f.detalles]; det[i] = { ...det[i], calificacion: v }; return { ...f, detalles: det }; })}
                          style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border)", background: d.calificacion >= v ? "#10b981" : "var(--bg3)", color: d.calificacion >= v ? "#fff" : "var(--text)", cursor: "pointer", fontWeight: 600 }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-group"><label>Comentarios</label><textarea value={form.comentarios} onChange={(e) => setForm((f) => ({ ...f, comentarios: e.target.value }))} rows={2} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando || competencias.length === 0}>{guardando ? "Guardando…" : "Registrar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "indicador" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Valor de Indicador — {empleado.nombre}</h2><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <form onSubmit={submitValorInd} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group"><label>Indicador *</label>
                <select value={form.indicadorId} onChange={(e) => setForm((f) => ({ ...f, indicadorId: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {indEmpleado.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group"><label>Valor alcanzado *</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required /></div>
                <div className="form-group"><label>Meta (opcional)</label><input type="number" step="0.01" value={form.meta} onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Registrar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vista: Lista de empleados ────────────────────────────────────────────────
function ListaEmpleados({ usuarios, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState("");
  const lista = usuarios.filter((u) => {
    const q = busqueda.toLowerCase();
    return !q || `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input className="form-control" placeholder="Buscar empleado…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ maxWidth: 340 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {lista.map((u) => (
          <div key={u.id} className="card" style={{ padding: 16, cursor: "pointer", transition: "box-shadow 0.15s" }}
            onClick={() => onSeleccionar(u)}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1.1rem", flexShrink: 0 }}>
                {u.nombre?.[0]}{u.apellido?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>{u.email}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{u.puestoNombre || "Sin puesto"}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>Ver evaluaciones →</div>
          </div>
        ))}
        {lista.length === 0 && <div style={{ color: "var(--text2)", fontStyle: "italic" }}>Sin resultados.</div>}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const VISTAS = [
  { key: "empleados", label: "Empleados", icon: "👥" },
  { key: "configuracion", label: "Configuración", icon: "⚙️" },
];

const DesarrolloOrganizacional = () => {
  const { usuario } = useAuth();
  const [vista, setVista] = useState("empleados");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [periodo, setPeriodo] = useState(PERIODOS[0]);

  const puedeAdmin = ["super_admin", "administrador_general", "desarrollo_organizacional"].includes(usuario?.rol);

  useEffect(() => {
    getUsuarios().then((u) => setUsuarios(Array.isArray(u) ? u.filter((e) => e.evaluacionesHabilitadas !== false) : [])).catch(() => {});
    getPuestos().then((p) => setPuestos(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);

  const handleSeleccionarEmpleado = (emp) => {
    setEmpleadoSeleccionado(emp);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Desarrollo Organizacional</h1>
          <p className="subtitle">Evaluaciones de talento y desempeño</p>
        </div>
      </div>

      {/* Si hay empleado seleccionado, mostramos su perfil */}
      {empleadoSeleccionado ? (
        <PerfilEmpleado
          empleado={empleadoSeleccionado}
          periodo={periodo}
          setPeriodo={setPeriodo}
          puestos={puestos}
          onVolver={() => setEmpleadoSeleccionado(null)}
        />
      ) : (
        <>
          {/* Tabs de vista */}
          <div style={{ display: "flex", gap: 4, borderBottom: "2px solid var(--border)", marginBottom: 24 }}>
            {VISTAS.map((v) => (
              <button key={v.key} onClick={() => setVista(v.key)}
                style={{
                  padding: "8px 20px", border: "none",
                  borderBottom: vista === v.key ? "2px solid var(--accent)" : "2px solid transparent",
                  background: "none", cursor: "pointer",
                  fontWeight: vista === v.key ? 700 : 400,
                  color: vista === v.key ? "var(--accent)" : "var(--text2)",
                  fontSize: "0.9rem", marginBottom: -2,
                }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {vista === "empleados" && (
            <ListaEmpleados usuarios={usuarios} onSeleccionar={handleSeleccionarEmpleado} />
          )}
          {vista === "configuracion" && (
            <VistaConfiguracion puestos={puestos} puedeAdmin={puedeAdmin} />
          )}
        </>
      )}
    </div>
  );
};

export default DesarrolloOrganizacional;
