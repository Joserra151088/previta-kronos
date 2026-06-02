import { useState, useEffect, useMemo } from "react";
import { getSucursales, crearSucursal, actualizarSucursal, eliminarSucursal } from "../utils/api";
import { toastError, confirmar } from "../utils/toast";
import { useAuth } from "../context/AuthContext";

const FORM_VACIO = {
  nombre: "", direccion: "", ciudad: "", estado: "",
  tipo: "sucursal",
  geocerca: { latitud: "", longitud: "", radio: 200 },
};

/* ─── SVG Icons ────────────────────────────────────────────────────────────── */
const IcoBuilding = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 22V12h6v10" />
    <path d="M3 9h18" />
  </svg>
);

const IcoCorporate = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IcoPin = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IcoGeo = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="8" />
    <line x1="12" y1="16" x2="12" y2="22" />
    <line x1="2" y1="12" x2="8" y2="12" />
    <line x1="16" y1="12" x2="22" y2="12" />
  </svg>
);

const IcoEdit = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IcoTrash = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IcoPause = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const IcoPlay = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IcoGrid = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IcoList = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IcoSearch = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IcoChevronL = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IcoChevronR = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const COLORS = ["#1e6f7a", "#77b328", "#2a8a97", "#5a9a1e", "#0d2a42", "#7c5cbf", "#c27c2e"];
const avatarColor = (nombre = "") => COLORS[nombre.charCodeAt(0) % COLORS.length];

const BadgeStatus = ({ activa }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600,
    background: activa ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
    color: activa ? "#16a34a" : "#ef4444",
    border: `1px solid ${activa ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
  }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: activa ? "#22c55e" : "#ef4444", display: "inline-block" }} />
    {activa ? "Activa" : "Inactiva"}
  </span>
);

const BadgeTipo = ({ tipo }) => (
  <span style={{
    display: "inline-block", padding: "1px 7px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 600,
    background: tipo === "corporativo" ? "rgba(30,111,122,0.1)" : "rgba(119,179,40,0.1)",
    color: tipo === "corporativo" ? "var(--teal,#1e6f7a)" : "var(--primary,#77b328)",
    border: `1px solid ${tipo === "corporativo" ? "rgba(30,111,122,0.25)" : "rgba(119,179,40,0.25)"}`,
  }}>
    {tipo === "corporativo" ? "Corporativo" : "Sucursal"}
  </span>
);

/* ─── Paginador ────────────────────────────────────────────────────────────── */
const Pager = ({ total, perPage, page, onChange }) => {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  const desde = (page - 1) * perPage + 1;
  const hasta = Math.min(page * perPage, total);
  return (
    <div className="suc-pager">
      <span className="suc-pager-info">{desde}–{hasta} de {total}</span>
      <div className="suc-pager-btns">
        <button disabled={page === 1} onClick={() => onChange(page - 1)}><IcoChevronL /></button>
        {pages.map(p => (
          <button key={p} className={p === page ? "active" : ""} onClick={() => onChange(p)}>{p}</button>
        ))}
        <button disabled={page === totalPages} onClick={() => onChange(page + 1)}><IcoChevronR /></button>
      </div>
    </div>
  );
};

/* ═══ Componente principal ═══════════════════════════════════════════════════ */
const Sucursales = () => {
  const { usuario } = useAuth();
  const puedeEditar = usuario?.puedeEditar !== false;

  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // UI state
  const [vista, setVista] = useState("grid");
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("activa");
  const [verInactivas, setVerInactivas] = useState(false);
  const [sortCol, setSortCol] = useState("nombre");
  const [sortDir, setSortDir] = useState("asc");
  const [pagina, setPagina] = useState(1);

  const PER_PAGE_GRID = 12;
  const PER_PAGE_LIST = 20;

  const cargarSucursales = async () => {
    try {
      const data = await getSucursales();
      setSucursales(data);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarSucursales(); }, []);

  const abrirCrear = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setError("");
    setModal(true);
  };

  const abrirEditar = (s) => {
    setEditando(s.id);
    setForm({
      nombre: s.nombre,
      direccion: s.direccion,
      ciudad: s.ciudad,
      estado: s.estado,
      tipo: s.tipo || "sucursal",
      geocerca: { ...s.geocerca },
    });
    setError("");
    setModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("geo_")) {
      const campo = name.replace("geo_", "");
      setForm((prev) => ({ ...prev, geocerca: { ...prev.geocerca, [campo]: value } }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      if (editando) {
        await actualizarSucursal(editando, form);
      } else {
        await crearSucursal(form);
      }
      setModal(false);
      await cargarSucursales();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (id, nombre) => {
    if (!(await confirmar(`¿Desactivar la sucursal "${nombre}"? Los empleados asignados quedarán sin sucursal activa.`, "Confirmar", "warning"))) return;
    try {
      await actualizarSucursal(id, { activa: false });
      await cargarSucursales();
    } catch (err) {
      toastError(err);
    }
  };

  const handleReactivar = async (id) => {
    try {
      await actualizarSucursal(id, { activa: true });
      await cargarSucursales();
    } catch (err) {
      toastError(err);
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (!(await confirmar(`ELIMINAR PERMANENTEMENTE la sucursal "${nombre}". Esta acción no se puede deshacer. ¿Continuar?`, "Eliminar", "danger"))) return;
    try {
      await eliminarSucursal(id);
      await cargarSucursales();
    } catch (err) {
      toastError(err);
    }
  };

  /* ─── Filtrado + Ordenamiento ──────────────────────────────────────────── */
  const filtradas = useMemo(() => {
    let arr = [...sucursales];

    // Filtro estado
    if (!verInactivas) {
      arr = arr.filter(s => s.activa);
    } else if (filtroEstado === "activa") {
      arr = arr.filter(s => s.activa);
    } else if (filtroEstado === "inactiva") {
      arr = arr.filter(s => !s.activa);
    }

    // Filtro tipo
    if (filtroTipo !== "todos") {
      arr = arr.filter(s => s.tipo === filtroTipo);
    }

    // Búsqueda texto
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      arr = arr.filter(s =>
        s.nombre?.toLowerCase().includes(q) ||
        s.ciudad?.toLowerCase().includes(q) ||
        s.estado?.toLowerCase().includes(q) ||
        s.direccion?.toLowerCase().includes(q)
      );
    }

    // Ordenamiento
    arr.sort((a, b) => {
      let va = (a[sortCol] || "").toString().toLowerCase();
      let vb = (b[sortCol] || "").toString().toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [sucursales, busqueda, filtroTipo, filtroEstado, verInactivas, sortCol, sortDir]);

  // Reset page when filters change
  useEffect(() => { setPagina(1); }, [busqueda, filtroTipo, filtroEstado, verInactivas, vista]);

  const perPage = vista === "grid" ? PER_PAGE_GRID : PER_PAGE_LIST;
  const paginadas = filtradas.slice((pagina - 1) * perPage, pagina * perPage);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortArrow = ({ col }) => {
    const active = sortCol === col;
    return (
      <span className={`sort-arrow ${active ? "" : ""}`}>
        {active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
      </span>
    );
  };

  if (cargando) return <div className="loading">Cargando sucursales…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sucursales</h1>
          <p className="subtitle">Gestión de ubicaciones y geocercas</p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={abrirCrear}>
            + Nueva sucursal
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="suc-toolbar">
        <div className="suc-search-wrap">
          <IcoSearch size={15} />
          <input
            type="text"
            placeholder="Buscar por nombre, ciudad, estado…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <select className="suc-filter-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          <option value="sucursal">Sucursal</option>
          <option value="corporativo">Corporativo</option>
        </select>

        {verInactivas && (
          <select className="suc-filter-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "var(--text2)", whiteSpace: "nowrap", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={verInactivas}
            onChange={e => setVerInactivas(e.target.checked)}
            style={{ accentColor: "var(--primary)" }}
          />
          Ver inactivas
        </label>

        <div className="suc-view-btns">
          <button className={vista === "grid" ? "active" : ""} onClick={() => setVista("grid")} title="Vista tarjetas">
            <IcoGrid />
          </button>
          <button className={vista === "list" ? "active" : ""} onClick={() => setVista("list")} title="Vista lista">
            <IcoList />
          </button>
        </div>
      </div>

      {/* Vista Grid */}
      {vista === "grid" && (
        <>
          {paginadas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" style={{ fontSize: 40, marginBottom: 12 }}>
                <IcoBuilding size={48} />
              </div>
              <p>{filtradas.length === 0 && sucursales.length === 0 ? "No hay sucursales registradas." : "Sin resultados para los filtros actuales."}</p>
              {sucursales.length === 0 && puedeEditar && (
                <button className="btn btn-primary" onClick={abrirCrear}>Crear primera sucursal</button>
              )}
            </div>
          ) : (
            <div className="suc-grid">
              {paginadas.map(s => (
                <div key={s.id} className={`suc-card ${!s.activa ? "inactiva" : ""}`}>
                  <div className={`suc-card-bar ${s.tipo === "corporativo" ? "corporativo" : "sucursal"}`} />

                  <div className="suc-card-top">
                    <div className={`suc-card-ico ${s.tipo === "corporativo" ? "corporativo" : "sucursal"}`}>
                      {s.tipo === "corporativo" ? <IcoCorporate size={20} /> : <IcoBuilding size={20} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="suc-card-title">{s.nombre}</div>
                      <div className="suc-card-location">{s.ciudad}{s.estado ? `, ${s.estado}` : ""}</div>
                      <div style={{ marginTop: 5 }}>
                        <BadgeTipo tipo={s.tipo} />
                      </div>
                    </div>
                    <div className="suc-card-status">
                      <BadgeStatus activa={s.activa} />
                    </div>
                  </div>

                  <div className="suc-card-body">
                    <div className="suc-info-row">
                      <IcoPin size={13} />
                      <span>{s.direccion || "Sin dirección registrada"}</span>
                    </div>
                    <div className="suc-info-row">
                      <IcoGeo size={13} />
                      <span>
                        {s.geocerca.latitud}, {s.geocerca.longitud} · <strong>{s.geocerca.radio}m</strong>
                      </span>
                    </div>
                  </div>

                  {puedeEditar && (
                    <div className="suc-card-foot">
                      <button className="suc-act-btn" onClick={() => abrirEditar(s)} title="Editar">
                        <IcoEdit size={14} />
                      </button>
                      {s.activa ? (
                        <button className="suc-act-btn warning" onClick={() => handleDesactivar(s.id, s.nombre)} title="Desactivar">
                          <IcoPause size={14} />
                        </button>
                      ) : (
                        <button className="suc-act-btn success" onClick={() => handleReactivar(s.id)} title="Activar">
                          <IcoPlay size={14} />
                        </button>
                      )}
                      <button className="suc-act-btn danger" onClick={() => handleEliminar(s.id, s.nombre)} title="Eliminar">
                        <IcoTrash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Pager total={filtradas.length} perPage={PER_PAGE_GRID} page={pagina} onChange={setPagina} />
        </>
      )}

      {/* Vista Lista */}
      {vista === "list" && (
        <>
          {paginadas.length === 0 ? (
            <div className="empty-state">
              <p>{filtradas.length === 0 && sucursales.length === 0 ? "No hay sucursales registradas." : "Sin resultados para los filtros actuales."}</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className={`sort-th ${sortCol === "nombre" ? "active-sort" : ""}`} onClick={() => handleSort("nombre")}>
                      Nombre <SortArrow col="nombre" />
                    </th>
                    <th className={`sort-th ${sortCol === "ciudad" ? "active-sort" : ""}`} onClick={() => handleSort("ciudad")}>
                      Ciudad · Estado <SortArrow col="ciudad" />
                    </th>
                    <th className={`sort-th ${sortCol === "tipo" ? "active-sort" : ""}`} onClick={() => handleSort("tipo")}>
                      Tipo <SortArrow col="tipo" />
                    </th>
                    <th>Radio</th>
                    <th>Estado</th>
                    {puedeEditar && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginadas.map(s => (
                    <tr key={s.id} style={{ opacity: s.activa ? 1 : 0.55 }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: avatarColor(s.nombre),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontWeight: 700, fontSize: "0.8rem",
                          }}>
                            {(s.nombre || "?")[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{s.nombre}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
                        {s.ciudad}{s.estado ? ` · ${s.estado}` : ""}
                      </td>
                      <td><BadgeTipo tipo={s.tipo} /></td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text2)" }}>{s.geocerca.radio}m</td>
                      <td><BadgeStatus activa={s.activa} /></td>
                      {puedeEditar && (
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="suc-act-btn" style={{ flex: "none", padding: "5px 8px" }} onClick={() => abrirEditar(s)} title="Editar">
                              <IcoEdit size={14} />
                            </button>
                            {s.activa ? (
                              <button className="suc-act-btn warning" style={{ flex: "none", padding: "5px 8px" }} onClick={() => handleDesactivar(s.id, s.nombre)} title="Desactivar">
                                <IcoPause size={14} />
                              </button>
                            ) : (
                              <button className="suc-act-btn success" style={{ flex: "none", padding: "5px 8px" }} onClick={() => handleReactivar(s.id)} title="Activar">
                                <IcoPlay size={14} />
                              </button>
                            )}
                            <button className="suc-act-btn danger" style={{ flex: "none", padding: "5px 8px" }} onClick={() => handleEliminar(s.id, s.nombre)} title="Eliminar">
                              <IcoTrash size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager total={filtradas.length} perPage={PER_PAGE_LIST} page={pagina} onChange={setPagina} />
        </>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? "Editar Sucursal" : "Nueva Sucursal"}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label>Nombre de la sucursal *</label>
                  <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Sucursal Centro" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de ubicación *</label>
                  <select name="tipo" value={form.tipo} onChange={handleChange} required>
                    <option value="sucursal">Sucursal</option>
                    <option value="corporativo">Corporativo</option>
                  </select>
                  <p className="form-hint">Indica si esta ubicación es una sucursal o la sede corporativa.</p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Dirección</label>
                  <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Av. Principal 100" />
                </div>
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Ciudad</label>
                  <input name="ciudad" value={form.ciudad} onChange={handleChange} placeholder="Ciudad de México" />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <input name="estado" value={form.estado} onChange={handleChange} placeholder="CDMX" />
                </div>
              </div>

              <div className="form-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcoGeo size={16} /> Configuración de Geocerca
              </div>

              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Latitud *</label>
                  <input name="geo_latitud" type="number" step="any" value={form.geocerca.latitud} onChange={handleChange} required placeholder="19.4326" />
                </div>
                <div className="form-group">
                  <label>Longitud *</label>
                  <input name="geo_longitud" type="number" step="any" value={form.geocerca.longitud} onChange={handleChange} required placeholder="-99.1332" />
                </div>
              </div>

              <div className="form-group">
                <label>Radio permitido (metros) *</label>
                <input name="geo_radio" type="number" min="10" max="5000" value={form.geocerca.radio} onChange={handleChange} required />
                <p className="form-hint">Los empleados solo podrán registrar dentro de este radio desde el punto central.</p>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? "Guardando…" : editando ? "Actualizar" : "Crear sucursal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sucursales;
