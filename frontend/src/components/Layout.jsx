import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEmpresa } from "../context/EmpresaContext";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import useSidebar from "../hooks/useSidebar";
import { getModulesForUser } from "../utils/module-access";
import { getUsuarios, getAnuncios, crearAnuncio, eliminarAnuncio, getPersonalHoy } from "../utils/api";

import { SERVER_URL as BASE } from "../utils/config.js";

// ─── Estructura de navegación agrupada ────────────────────────────────────────
// Cada entrada puede ser un ítem directo ({ to, label, icon, moduleKey })
// o un grupo ({ label, icon, children: [...ítems] })

const NAV_ESTRUCTURA_ADMIN = [
  { section: "Hoy" },
  { to: "/dashboard",   label: "Inicio",      icon: "🏠", moduleKey: "dashboard" },
  {
    label: "Eventos", icon: "📡",
    children: [
      { to: "/eventos",       label: "Asistencia",    icon: "📡", moduleKey: "eventos" },
      { to: "/incidencias",   label: "Incidencias",   icon: "📋", moduleKey: "incidencias" },
      { to: "/vacaciones",    label: "Vacaciones",    icon: "🏖️", moduleKey: "vacaciones" },
      { to: "/incapacidades", label: "Incapacidades", icon: "🩺", moduleKey: "incapacidades" },
    ],
  },
  { to: "/calendario",  label: "Calendario",  icon: "📅", moduleKey: "calendario" },
  { section: "Gestión" },
  { to: "/reportes",    label: "Reportes",    icon: "📊", moduleKey: "reportes" },
  { to: "/grupos",      label: "Grupos",      icon: "🔗", moduleKey: "grupos" },
  { to: "/mapa",        label: "Mapa",        icon: "🗺️", moduleKey: "mapa" },
  {
    label: "Administración", icon: "⚙️",
    children: [
      { to: "/organigrama",    label: "Organigrama", icon: "🌲", moduleKey: "organigrama" },
      { to: "/horarios",       label: "Horarios",    icon: "⏰", moduleKey: "horarios" },
      { to: "/sucursales",     label: "Sucursales",  icon: "🏢", moduleKey: "sucursales" },
      { to: "/empleados",      label: "Empleados",   icon: "👥", moduleKey: "empleados" },
      { to: "/puestos",        label: "Puestos",     icon: "💼", moduleKey: "administracion" },
      { to: "/areas",          label: "Áreas",       icon: "🏗️", moduleKey: "administracion" },
      { to: "/empresa",        label: "Empresa",     icon: "🏛️", moduleKey: "administracion" },
      { to: "/anuncios-admin", label: "Anuncios",    icon: "📢", moduleKey: "administracion" },
    ],
  },
  { section: "Sistema" },
  {
    label: "Sistema", icon: "🖥️",
    children: [
      { to: "/auditoria",  label: "Auditoría",  icon: "🔍", moduleKey: "auditoria" },
      { to: "/logs",       label: "Logs",       icon: "🖥️", moduleKey: "logs" },
      { to: "/licencias",  label: "Licencias",  icon: "🔑", moduleKey: "licencias" },
    ],
  },
];

const NAV_ITEMS_EMPLEADO = [
  { to: "/dashboard",        label: "Inicio",           icon: "🏠" },
  { to: "/mis-incidencias",  label: "Mis Incidencias",  icon: "📋" },
  { to: "/mis-registros",    label: "Mis Registros",    icon: "🕐" },
  { to: "/perfil",           label: "Mi Perfil",        icon: "👤" },
];

const ROL_LABEL = {
  administrador_general: "Administrador General",
  super_admin: "Super Admin", agente_soporte_ti: "Soporte TI",
  supervisor_sucursales: "Supervisor", agente_control_asistencia: "Control Asist.",
  visor_reportes: "Visor", medico_titular: "Médico Titular", medico_de_guardia: "Médico Guardia",
  nominas: "Nóminas",
};

// ─── Componente NavGroup — grupo colapsable en el sidebar ─────────────────────

function NavGroup({ icon, label, children, collapsed, onClose }) {
  const location = useLocation();
  // Expandir automáticamente si algún hijo está activo
  const tieneHijoActivo = children.some((c) => location.pathname.startsWith(c.to));
  const [open, setOpen] = useState(tieneHijoActivo);

  // Si el sidebar se colapsa, mostrar el tooltip con ícono
  if (collapsed) {
    return (
      <div className="nav-group-collapsed" title={label}>
        <span className="nav-icon">{icon}</span>
      </div>
    );
  }

  return (
    <div className="nav-group">
      {/* Cabecera del grupo */}
      <button
        className={`nav-group-header ${tieneHijoActivo ? "nav-group-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={label}
      >
        <span className="nav-icon">{icon}</span>
        <span className="nav-label">{label}</span>
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          opacity: 0.7,
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 0.2s",
          display: "inline-block",
        }}>▾</span>
      </button>
      {/* Hijos */}
      {open && (
        <div className="nav-group-children">
          {children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              onClick={onClose}
              className={({ isActive }) => `nav-item nav-item-child ${isActive ? "nav-item-active" : ""}`}
              title={c.label}
            >
              <span className="nav-icon" style={{ fontSize: "0.9em" }}>{c.icon}</span>
              <span className="nav-label">{c.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Links Frecuentes (localStorage) ─────────────────────────────────────────

const LS_KEY = "superadmin_links_frecuentes";

function loadLinks() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLinks(links) {
  localStorage.setItem(LS_KEY, JSON.stringify(links));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esMismoDiaDelAnio(fecha1, fecha2) {
  return fecha1.getMonth() === fecha2.getMonth() && fecha1.getDate() === fecha2.getDate();
}

// ─── Componente Right Sidebar ─────────────────────────────────────────────────

// Sub-componente de sección colapsable
function SidebarSection({ icon, title, badge, defaultOpen = true, actions, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Cabecera clicable */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          userSelect: "none",
          background: open ? "transparent" : "var(--bg-secondary)",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.88rem", flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
          {icon} {title}
          {badge > 0 && (
            <span style={{
              background: "var(--accent)", color: "#fff", borderRadius: 10,
              fontSize: "0.7rem", padding: "1px 6px", fontWeight: 700,
            }}>
              {badge}
            </span>
          )}
        </span>
        {/* Botones de acción (no colapsar cuando se hace clic en ellos) */}
        {actions && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 4 }}>
            {actions}
          </div>
        )}
        {/* Chevron */}
        <span style={{
          fontSize: 12, color: "var(--text-muted)",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 0.2s",
          display: "inline-block",
          marginLeft: 2,
        }}>▾</span>
      </div>
      {/* Contenido colapsable */}
      {open && (
        <div style={{ padding: "0 16px 12px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function RightSidebar({ usuarios, puedeEditar, personal, anuncios, onCrearAnuncio, onEliminarAnuncio }) {
  const [abierto, setAbierto] = useState(true);
  const [links, setLinks] = useState(loadLinks);
  const [showFormLink, setShowFormLink] = useState(false);
  const [formLink, setFormLink] = useState({ titulo: "", url: "", imagenBase64: "" });
  const [imgPreview, setImgPreview] = useState("");
  const [showFormAnuncio, setShowFormAnuncio] = useState(false);
  const [formAnuncio, setFormAnuncio] = useState({ titulo: "", texto: "" });

  const hoy = new Date();

  // Cumpleaños: SOLO empleados con fechaNacimiento registrada que coincide con hoy (mes/día)
  const cumpleaneros = usuarios.filter((u) => {
    if (!u.fechaNacimiento) return false;
    return esMismoDiaDelAnio(new Date(u.fechaNacimiento + "T12:00:00"), hoy);
  });

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormLink((f) => ({ ...f, imagenBase64: ev.target.result }));
      setImgPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddLink = (e) => {
    e.preventDefault();
    if (!formLink.titulo || !formLink.url) return;
    const newLink = {
      id: Date.now().toString(),
      titulo: formLink.titulo,
      url: formLink.url.startsWith("http") ? formLink.url : "https://" + formLink.url,
      imagenBase64: formLink.imagenBase64,
      creadoEn: new Date().toISOString(),
    };
    const updated = [...links, newLink];
    setLinks(updated);
    saveLinks(updated);
    setFormLink({ titulo: "", url: "", imagenBase64: "" });
    setImgPreview("");
    setShowFormLink(false);
  };

  const handleDeleteLink = (id) => {
    const updated = links.filter((l) => l.id !== id);
    setLinks(updated);
    saveLinks(updated);
  };

  return (
    <>
      {/* Pestaña lateral para abrir/cerrar el panel */}
      <button
        className="right-sidebar-toggle"
        onClick={() => setAbierto((a) => !a)}
        title={abierto ? "Ocultar panel" : "Mostrar panel"}
        style={{
          position: "fixed",
          top: "50%",
          right: abierto ? 260 : 0,
          transform: "translateY(-50%)",
          zIndex: 200,
          background: "var(--accent)",
          color: "white",
          border: "none",
          borderRadius: "6px 0 0 6px",
          width: 20,
          height: 60,
          cursor: "pointer",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "right 0.25s ease",
          writingMode: "vertical-rl",
          padding: 0,
        }}
      >
        {abierto ? "›" : "‹"}
      </button>

      {/* Panel lateral */}
      <aside
        className="right-sidebar"
        style={{
          width: 260,
          height: "100vh",          // altura fija = permite scroll interno
          background: "var(--bg2)",
          borderLeft: "1px solid var(--border)",
          position: "fixed",
          top: 0,
          right: abierto ? 0 : -260,
          transition: "right 0.25s ease",
          zIndex: 100,
          overflowY: "auto",        // scroll cuando el contenido desborda
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header fijo */}
        <div style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--border)",
          fontWeight: 700,
          fontSize: "0.8rem",
          color: "var(--text2)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          background: "var(--bg2)",
          zIndex: 1,
        }}>
          Panel de Empresa
        </div>

        {/* ── Cumpleaños ──────────────────────────── */}
        <SidebarSection
          icon="🎂"
          title="Cumpleaños del día"
          badge={cumpleaneros.length}
          defaultOpen={true}
        >
          {cumpleaneros.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>
              Sin cumpleaños hoy
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cumpleaneros.map((u) => {
                const nac = new Date(u.fechaNacimiento + "T12:00:00");
                const anios = hoy.getFullYear() - nac.getFullYear();
                return (
                  <div key={u.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px",
                    background: "rgba(119,179,40,0.1)",
                    borderRadius: 6,
                    border: "1px solid rgba(119,179,40,0.25)",
                  }}>
                    <span style={{ fontSize: "1.2rem" }}>🎉</span>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                        {anios === 0 ? "¡Nació hoy!" : `🎂 ${anios} año${anios !== 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SidebarSection>

        {/* ── Personal de hoy ──────────────────────── */}
        <SidebarSection
          icon="👥"
          title="Personal de hoy"
          badge={personal?.length || 0}
          defaultOpen={true}
        >
          {!personal || personal.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>Sin registros hoy</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {personal.map((p, i) => (
                <div key={p.usuarioId || i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px", background: "var(--bg3)", borderRadius: 6,
                  borderLeft: "3px solid var(--primary)",
                }}>
                  {p.fotoUrl ? (
                    <img src={`${BASE}${p.fotoUrl}`} alt={p.nombre} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <span style={{ fontSize: 20, flexShrink: 0 }}>👤</span>
                  )}
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nombre}
                    </div>
                    {p.puestoNombre && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        💼 {p.puestoNombre}
                      </div>
                    )}
                    {p.sucursalNombre && (
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        🏢 {p.sucursalNombre}
                      </div>
                    )}
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                      🕐 {p.hora || ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>

        {/* ── Anuncios ─────────────────────────────── */}
        <SidebarSection
          icon="📢"
          title="Anuncios"
          badge={anuncios?.length || 0}
          defaultOpen={true}
          actions={puedeEditar && (
            <button
              onClick={() => setShowFormAnuncio((v) => !v)}
              style={{
                background: "var(--accent)", color: "white", border: "none",
                borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontSize: "0.72rem",
              }}
            >
              {showFormAnuncio ? "✕" : "+ Nuevo"}
            </button>
          )}
        >
          {showFormAnuncio && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formAnuncio.titulo || !formAnuncio.texto) return;
                onCrearAnuncio?.(formAnuncio);
                setFormAnuncio({ titulo: "", texto: "" });
                setShowFormAnuncio(false);
              }}
              style={{ marginBottom: 10 }}
            >
              <input
                type="text"
                className="form-control"
                placeholder="Título"
                value={formAnuncio.titulo}
                onChange={(e) => setFormAnuncio((f) => ({ ...f, titulo: e.target.value }))}
                required
                style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }}
              />
              <textarea
                className="form-control"
                placeholder="Texto del anuncio..."
                value={formAnuncio.texto}
                onChange={(e) => setFormAnuncio((f) => ({ ...f, texto: e.target.value }))}
                required
                rows={3}
                style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: "100%", fontSize: "0.8rem", padding: "5px" }}>
                Publicar
              </button>
            </form>
          )}
          {!anuncios || anuncios.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>Sin anuncios</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {anuncios.map((a) => (
                <div key={a.id} style={{
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  borderRadius: 6, padding: "8px 10px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{a.titulo}</div>
                    {puedeEditar && (
                      <button
                        onClick={() => onEliminarAnuncio?.(a.id)}
                        style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}
                      >✕</button>
                    )}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 3 }}>{a.texto}</div>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>

        {/* ── Links Frecuentes ─────────────────────── */}
        <SidebarSection
          icon="🔗"
          title="Links Frecuentes"
          defaultOpen={true}
          actions={puedeEditar && (
            <button
              onClick={() => setShowFormLink((v) => !v)}
              style={{
                background: "var(--accent)", color: "white", border: "none",
                borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontSize: "0.72rem",
              }}
            >
              {showFormLink ? "✕" : "+ Añadir"}
            </button>
          )}
        >
          {showFormLink && (
            <form onSubmit={handleAddLink} style={{ marginBottom: 12 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Título del link"
                value={formLink.titulo}
                onChange={(e) => setFormLink((f) => ({ ...f, titulo: e.target.value }))}
                required
                style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="URL (ej: google.com)"
                value={formLink.url}
                onChange={(e) => setFormLink((f) => ({ ...f, url: e.target.value }))}
                required
                style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }}
              />
              <div style={{ marginBottom: 7 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>
                  Imagen (opcional)
                </label>
                <input type="file" accept="image/*" onChange={handleImagenChange} style={{ fontSize: "0.75rem" }} />
                {imgPreview && (
                  <img src={imgPreview} alt="preview" style={{ width: "100%", height: 56, objectFit: "cover", borderRadius: 4, marginTop: 4 }} />
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%", fontSize: "0.8rem", padding: "5px" }}>
                Guardar link
              </button>
            </form>
          )}
          {links.length === 0 && !showFormLink ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>
              No hay links guardados
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {links.map((link) => (
                <div key={link.id} style={{
                  border: "1px solid var(--border)", borderRadius: 6,
                  overflow: "hidden", background: "var(--bg3)",
                }}>
                  {link.imagenBase64 && (
                    <img src={link.imagenBase64} alt={link.titulo}
                      style={{ width: "100%", height: 56, objectFit: "cover" }} />
                  )}
                  <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--accent2)", textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      🔗 {link.titulo}
                    </a>
                    {puedeEditar && (
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        title="Eliminar"
                        style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>

        {/* Espaciado inferior para que el último ítem no quede pegado al borde */}
        <div style={{ height: 24, flexShrink: 0 }} />
      </aside>
    </>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────

const Layout = () => {
  const { usuario, logout, vistaActual, toggleVista } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [personalHoy, setPersonalHoy] = useState([]);
  const [anuncios, setAnuncios] = useState([]);
  const showLabels = !collapsed || mobileOpen;
  const modulosPermitidos = new Set(getModulesForUser(usuario));
  const esSuperAdmin = ["super_admin", "administrador_general"].includes(usuario?.rol);
  const puedeEditarSidebar = esSuperAdmin || usuario?.rol === "agente_soporte_ti";
  // Roles que pueden consultar la lista de usuarios (para mostrar aniversarios)
  const ROLES_PUEDEN_VER_USUARIOS = ["super_admin", "agente_soporte_ti", "supervisor_sucursales"];
  const ROLES_GESTION = ["administrador_general", "super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia", "nominas"];

  const handleLogout = () => { logout(); navigate("/login"); };

  // Filtrar la estructura de nav según módulos permitidos del usuario
  const estructuraFiltrada = NAV_ESTRUCTURA_ADMIN
    .map((entry) => {
      if (entry.section) return entry; // section label always shown
      if (entry.children) {
        const hijosVisibles = entry.children.filter((c) => !c.moduleKey || modulosPermitidos.has(c.moduleKey));
        if (hijosVisibles.length === 0) return null;
        return { ...entry, children: hijosVisibles };
      }
      if (entry.moduleKey && !modulosPermitidos.has(entry.moduleKey)) return null;
      return entry;
    })
    .filter(Boolean);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Cargar usuarios para el panel lateral
  useEffect(() => {
    if (usuario && ROLES_PUEDEN_VER_USUARIOS.includes(usuario.rol)) {
      getUsuarios().then((u) => setTodosUsuarios(Array.isArray(u) ? u : [])).catch(() => {});
    }
  }, [usuario?.rol]);

  // Cargar personal de hoy y anuncios
  useEffect(() => {
    if (!usuario) return;
    if (ROLES_GESTION.includes(usuario.rol)) {
      getPersonalHoy().then((r) => setPersonalHoy(Array.isArray(r) ? r : [])).catch(() => {});
    }
    getAnuncios().then((r) => setAnuncios(Array.isArray(r) ? r : [])).catch(() => {});
  }, [usuario?.rol]);

  const handleCrearAnuncio = async (data) => {
    try {
      const nuevo = await crearAnuncio(data);
      setAnuncios((prev) => [nuevo, ...prev]);
    } catch (e) { alert(e.message); }
  };

  const handleEliminarAnuncio = async (id) => {
    if (!window.confirm("¿Eliminar este anuncio?")) return;
    try {
      await eliminarAnuncio(id);
      setAnuncios((prev) => prev.filter((a) => a.id !== id));
    } catch (e) { alert(e.message); }
  };

  const fotoUrl = usuario?.fotoUrl ? `${BASE}${usuario.fotoUrl}` : null;
  const logoEmpresa = empresa?.logoUrl ? `${BASE}${empresa.logoUrl}` : null;
  const nombreEmpresa = empresa?.nombre || "Control de Acceso";

  return (
    <div
      className={`layout ${collapsed ? "sidebar-is-collapsed" : ""}`}
      style={{ paddingRight: 260, background: "var(--bone)" }}
    >
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? "✕" : "☰"}
        </button>
        <span className="mobile-brand">
          {logoEmpresa ? <img src={logoEmpresa} alt={nombreEmpresa} className="mobile-brand-logo" /> : "🏢"}
          {nombreEmpresa}
        </span>
        <div className="mobile-actions"><NotificationBell /></div>
      </header>

      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-open" : ""}`}>
        {/* Brand / toggle */}
        <div className="sidebar-brand">
          {logoEmpresa
            ? <img src={logoEmpresa} alt={nombreEmpresa} className="brand-logo" />
            : <div className="sidebar-k-mark">K</div>
          }
          {showLabels && (
            <div className="sidebar-brand-text">
              <span className="sidebar-product-name">KronOS</span>
              <span className="sidebar-by-line">By <b>Previta</b></span>
            </div>
          )}
          <button className="sidebar-toggle-btn" onClick={toggle} title={collapsed ? "Expandir menú" : "Colapsar menú"}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "4px 6px", borderRadius: 6, transition: "color 0.18s" }}
            onMouseEnter={e => e.currentTarget.style.color = "white"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.45)"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {vistaActual === "empleado" ? (
            // Vista empleado: lista plana
            NAV_ITEMS_EMPLEADO.map((item) => (
              <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
                <span className="nav-icon">{item.icon}</span>
                {showLabels && <span className="nav-label">{item.label}</span>}
              </NavLink>
            ))
          ) : (
            // Vista admin: estructura agrupada con labels de sección
            estructuraFiltrada.map((entry, i) =>
              entry.section ? (
                showLabels
                  ? <div key={`section-${entry.section}`} className="nav-section-label">{entry.section}</div>
                  : null
              ) : entry.children ? (
                <NavGroup
                  key={entry.label}
                  icon={entry.icon}
                  label={entry.label}
                  children={entry.children}
                  collapsed={collapsed && !mobileOpen}
                  onClose={() => setMobileOpen(false)}
                />
              ) : (
                <NavLink key={entry.to} to={entry.to}
                  title={collapsed ? entry.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
                  <span className="nav-icon">{entry.icon}</span>
                  {showLabels && <span className="nav-label">{entry.label}</span>}
                </NavLink>
              )
            )
          )}
        </nav>

        <div className="sidebar-footer">
          {fotoUrl
            ? <img src={fotoUrl} alt="avatar" className="sidebar-avatar" />
            : (
              <div className="sidebar-user-avatar">
                {usuario?.nombre?.[0]?.toUpperCase()}{usuario?.apellido?.[0]?.toUpperCase()}
              </div>
            )
          }
          {showLabels && (
            <div className="user-details" style={{ flex: 1, overflow: "hidden" }}>
              <div className="user-name-sm">{usuario?.nombre} {usuario?.apellido}</div>
              <div className="user-rol">{ROL_LABEL[usuario?.rol] || usuario?.rol}</div>
            </div>
          )}
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión"
            style={{ marginLeft: showLabels ? 0 : "auto" }}
          >🚪</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="app-topbar">
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>
            Previta <span style={{ margin: "0 8px", color: "var(--line)" }}>/</span>
            KronOS
          </div>
          <div className="app-topbar-actions">
            <ThemeToggle />
            <NotificationBell />
            {/* Toggle vista admin/empleado — solo para roles de gestión */}
            {["administrador_general", "super_admin", "agente_soporte_ti"].includes(usuario?.rol) && (
              <button
                onClick={toggleVista}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  background: vistaActual === "empleado" ? "var(--accent)" : "var(--bg3)",
                  color: vistaActual === "empleado" ? "#fff" : "var(--text)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
                title={vistaActual === "admin" ? "Cambiar a vista empleado" : "Cambiar a vista admin"}
              >
                {vistaActual === "admin" ? "👤 Vista Empleado" : "⚙️ Vista Admin"}
              </button>
            )}
            <button
              className="profile-chip"
              onClick={() => { navigate("/perfil"); setMobileOpen(false); }}
              title="Editar perfil"
            >
              {fotoUrl
                ? <img src={fotoUrl} alt="avatar" className="profile-chip-avatar" />
                : <div className="profile-chip-fallback">{usuario?.sexo === "femenino" ? "👩" : "👨"}</div>
              }
              <span className="profile-chip-text">
                <strong>{usuario?.nombre} {usuario?.apellido}</strong>
                <small>{usuario?.email || ROL_LABEL[usuario?.rol] || usuario?.rol}</small>
              </span>
            </button>
          </div>
        </div>
        <Outlet />
      </main>

      {/* Right sidebar - visible para todos, editable solo por super_admin y agente_soporte_ti */}
      <RightSidebar
        usuarios={todosUsuarios}
        puedeEditar={puedeEditarSidebar}
        personal={personalHoy}
        anuncios={anuncios}
        onCrearAnuncio={handleCrearAnuncio}
        onEliminarAnuncio={handleEliminarAnuncio}
      />
    </div>
  );
};

export default Layout;
