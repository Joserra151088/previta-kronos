import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEmpresa } from "../context/EmpresaContext";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { getModulesForUser } from "../utils/module-access";
import { getUsuarios, getAnuncios, crearAnuncio, eliminarAnuncio, getPersonalHoy } from "../utils/api";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

// Misma función determinística que Usuarios.jsx
const AVATAR_COLORS = ["#4f7ec7","#5baa6b","#c47a3e","#9561b0","#c45b5b","#2e9fb3","#7a8c5b","#c47a7a","#3e7db3","#7a6baa"];
function avatarColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Icon set (refined, elegant, consistent strokeWidth 1.5) ────────────────
const Ico = {
  dashboard:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  registros:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>,
  calendario:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/></svg>,
  anuncios:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/></svg>,
  empleados:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  sucursales:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  asistencia:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  incidencias:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>,
  reportes:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><rect x="4" y="14" width="4" height="6" rx="0.5"/><rect x="10" y="4" width="4" height="16" rx="0.5"/><rect x="16" y="10" width="4" height="10" rx="0.5"/></svg>,
  horarios:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/><line x1="12" y1="3" x2="12" y2="5"/><line x1="21" y1="12" x2="19" y2="12"/></svg>,
  grupos:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><line x1="8.5" y1="13.4" x2="15.5" y2="17.6"/><line x1="15.5" y1="6.4" x2="8.5" y2="10.6"/></svg>,
  vacaciones:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/><line x1="12" y1="2" x2="12" y2="18"/></svg>,
  incapacidades:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  ninebox:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5" rx="0.5"/><rect x="9.5" y="3" width="5" height="5" rx="0.5"/><rect x="16" y="3" width="5" height="5" rx="0.5"/><rect x="3" y="9.5" width="5" height="5" rx="0.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/><rect x="16" y="9.5" width="5" height="5" rx="0.5"/><rect x="3" y="16" width="5" height="5" rx="0.5"/><rect x="9.5" y="16" width="5" height="5" rx="0.5"/><rect x="16" y="16" width="5" height="5" rx="0.5"/></svg>,
  organigrama:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="18" width="6" height="4" rx="1"/><rect x="9" y="18" width="6" height="4" rx="1"/><rect x="16" y="18" width="6" height="4" rx="1"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="5" y1="14" x2="19" y2="14"/><line x1="5" y1="14" x2="5" y2="18"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="19" y1="14" x2="19" y2="18"/></svg>,
  evaluaciones: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  empresa:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="2" y1="11" x2="22" y2="11"/></svg>,
  puestos:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M9 4V2h6v2"/><line x1="2" y1="9" x2="22" y2="9"/><circle cx="12" cy="15" r="2"/></svg>,
  areas:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  auditoria:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  logs:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  licencias:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>,
  mapa:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  perfil:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  camera:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  bell:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  home:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  sync:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
};

// ─── Navigation structure ──────────────────────────────────────────────────────
const NAV_ESTRUCTURA_ADMIN = [
  {
    section: "Hoy",
    items: [
      { to: "/dashboard",      label: "Inicio",         icon: Ico.dashboard,    moduleKey: "dashboard" },
      { to: "/mis-registros",  label: "Registros",      icon: Ico.registros,    moduleKey: "eventos" },
      { to: "/calendario",     label: "Calendario",     icon: Ico.calendario,   moduleKey: "calendario" },
      { to: "/anuncios-admin", label: "Anuncios",       icon: Ico.anuncios,     moduleKey: "administracion" },
    ],
  },
  {
    section: "Gestión",
    items: [
      { to: "/empleados",      label: "Empleados",      icon: Ico.empleados,    moduleKey: "empleados" },
      { to: "/sucursales",     label: "Sucursales",     icon: Ico.sucursales,   moduleKey: "administracion" },
      { to: "/eventos",        label: "Asistencia",     icon: Ico.asistencia,   moduleKey: "eventos" },
      { to: "/incidencias",    label: "Incidencias",    icon: Ico.incidencias,  moduleKey: "incidencias" },
      { to: "/reportes",       label: "Reportes",       icon: Ico.reportes,     moduleKey: "reportes" },
      { to: "/horarios",       label: "Horarios",       icon: Ico.horarios,     moduleKey: "horarios" },
      { to: "/grupos",         label: "Grupos",         icon: Ico.grupos,       moduleKey: "grupos" },
      { to: "/vacaciones",     label: "Vacaciones",     icon: Ico.vacaciones,   moduleKey: "vacaciones" },
      { to: "/incapacidades",  label: "Incapacidades",  icon: Ico.incapacidades,moduleKey: "incapacidades" },
    ],
  },
  {
    section: "Desarrollo",
    items: [
      { to: "/nine-box",                  label: "Nine-Box",    icon: Ico.ninebox,      moduleKey: "desarrollo_organizacional" },
      { to: "/organigrama",               label: "Organigrama", icon: Ico.organigrama,  moduleKey: "organigrama" },
      { to: "/desarrollo-organizacional", label: "Evaluaciones",icon: Ico.evaluaciones, moduleKey: "desarrollo_organizacional" },
    ],
  },
  {
    section: "Sistema",
    items: [
      { to: "/empresa",   label: "Empresa",   icon: Ico.empresa,   moduleKey: "administracion" },
      { to: "/puestos",   label: "Puestos",   icon: Ico.puestos,   moduleKey: "administracion" },
      { to: "/areas",     label: "Áreas",     icon: Ico.areas,     moduleKey: "administracion" },
      { to: "/auditoria", label: "Auditoría", icon: Ico.auditoria, moduleKey: "auditoria" },
      { to: "/logs",      label: "Logs",      icon: Ico.logs,      moduleKey: "logs" },
      { to: "/licencias", label: "Licencias", icon: Ico.licencias, moduleKey: "licencias" },
      { to: "/mapa",      label: "Mapa",      icon: Ico.mapa,      moduleKey: "mapa" },
      { to: "/sync",      label: "Sincronizar", icon: Ico.sync,    moduleKey: "administracion" },
    ],
  },
];

const NAV_ITEMS_EMPLEADO = [
  { section: "Mi Espacio", items: [
    { to: "/dashboard",       label: "Inicio",          icon: Ico.home       },
    { to: "/mis-registros",   label: "Mis Registros",   icon: Ico.registros  },
    { to: "/mis-incidencias", label: "Mis Incidencias", icon: Ico.incidencias},
    { to: "/perfil",          label: "Mi Perfil",       icon: Ico.perfil     },
  ]},
];

// Bottom nav tabs — shown on mobile only
const BOTTOM_TABS = [
  { to: "/dashboard",      label: "Inicio",    icon: Ico.home      },
  { to: "/mis-registros",  label: "Registros", icon: Ico.registros },
  { type: "cam",           label: "Registrar", icon: Ico.camera    },
  { to: "/anuncios-admin", label: "Avisos",    icon: Ico.bell      },
  { to: "/perfil",         label: "Perfil",    icon: Ico.perfil    },
];

const ROL_LABEL = {
  administrador_general:    "Administrador General",
  super_admin:              "Super Admin",
  agente_soporte_ti:        "Soporte TI",
  supervisor_sucursales:    "Supervisor",
  agente_control_asistencia:"Control Asist.",
  visor_reportes:           "Visor",
  medico_titular:           "Médico Titular",
  medico_de_guardia:        "Médico Guardia",
  nominas:                  "Nóminas",
  desarrollo_organizacional:"Desarrollo Org.",
};

// ─── Section label in topbar breadcrumb ───────────────────────────────────────
function useSectionLabel(navGroups) {
  const location = useLocation();
  for (const grp of navGroups) {
    for (const item of grp.items || []) {
      if (item.to && location.pathname === item.to) return item.label;
    }
  }
  for (const grp of navGroups) {
    for (const item of grp.items || []) {
      if (item.to && location.pathname.startsWith(item.to) && item.to !== "/") return item.label;
    }
  }
  return "Inicio";
}

// ─── ProfileDropdown ────────────────────────────────────────────────────────────
function ProfileDropdown({ usuario, fotoUrl, onNavigate, onLogout, onToggleVista, vistaActual }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const location = useLocation();

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest(".profile-dropdown-portal") && e.target !== btnRef.current && !btnRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const puedeToggleVista = ["administrador_general", "super_admin", "agente_soporte_ti"].includes(usuario?.rol);

  return (
    <>
      <button
        ref={btnRef}
        className={`profile-chip${open ? " active" : ""}`}
        onClick={handleToggle}
        title="Mi perfil"
      >
        {fotoUrl
          ? <img src={fotoUrl} alt="avatar" className="profile-chip-avatar" />
          : <div className="profile-chip-fallback" style={{ background: avatarColor(`${usuario?.nombre}${usuario?.apellido}`), color: "#fff", fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", width: 30, height: 30, flexShrink: 0, userSelect: "none" }}>
              {(usuario?.nombre?.[0] || "").toUpperCase()}{(usuario?.apellido?.[0] || "").toUpperCase()}
            </div>
        }
        <span className="profile-chip-text">
          <strong>{usuario?.nombre} {usuario?.apellido}</strong>
          <small>{ROL_LABEL[usuario?.rol] || usuario?.rol}</small>
        </span>
        <span className={`tnav-chevron${open ? " open" : ""}`} style={{ marginLeft: 2 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          className="tnav-dropdown profile-dropdown-portal"
          style={{ position: "fixed", top: dropPos.top, right: dropPos.right, left: "auto", minWidth: 220, zIndex: 9999 }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{usuario?.nombre} {usuario?.apellido}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 2 }}>{ROL_LABEL[usuario?.rol] || usuario?.rol}</div>
          </div>
          <button
            onClick={() => { setOpen(false); onNavigate("/perfil"); }}
            className="tnav-dropdown-item"
            style={{ border: "none", background: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
          >
            👤 Mi Perfil
          </button>
          {puedeToggleVista && (
            <button
              onClick={() => { setOpen(false); onToggleVista(); }}
              className="tnav-dropdown-item"
              style={{ border: "none", background: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              {vistaActual === "admin" ? "👤 Vista Empleado" : "⚙️ Vista Admin"}
            </button>
          )}
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="tnav-dropdown-item"
            style={{ border: "none", background: "none", width: "100%", textAlign: "left", cursor: "pointer", color: "var(--danger)" }}
          >
            🚪 Cerrar sesión
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esMismoDiaDelAnio(fecha1, fecha2) {
  return fecha1.getMonth() === fecha2.getMonth() && fecha1.getDate() === fecha2.getDate();
}

// ─── SidebarSection (right panel) ─────────────────────────────────────────────
function SidebarSection({ icon, title, badge, defaultOpen = true, actions, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "10px 16px", display: "flex", alignItems: "center",
          gap: 6, cursor: "pointer", userSelect: "none",
          background: open ? "transparent" : "var(--bg3)",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.88rem", flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
          {icon} {title}
          {badge > 0 && (
            <span style={{
              background: "var(--accent)", color: "#fff", borderRadius: 10,
              fontSize: "0.7rem", padding: "1px 6px", fontWeight: 700,
            }}>{badge}</span>
          )}
        </span>
        {actions && <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 4 }}>{actions}</div>}
        <span style={{
          fontSize: 12, color: "var(--text2)",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 0.2s", display: "inline-block", marginLeft: 2,
        }}>▾</span>
      </div>
      {open && <div style={{ padding: "0 16px 12px" }}>{children}</div>}
    </div>
  );
}

// ─── RightSidebar ─────────────────────────────────────────────────────────────
function RightSidebar({ usuarios, puedeEditar, personal, anuncios, onCrearAnuncio, onEliminarAnuncio,
                        mobilePanelOpen, onMobilePanelClose, abierto, setAbierto }) {
  const [links, setLinks] = useState(() => {
    try { const r = localStorage.getItem("superadmin_links_frecuentes"); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [showFormLink, setShowFormLink] = useState(false);
  const [formLink, setFormLink] = useState({ titulo: "", url: "", imagenBase64: "" });
  const [imgPreview, setImgPreview] = useState("");
  const [showFormAnuncio, setShowFormAnuncio] = useState(false);
  const [formAnuncio, setFormAnuncio] = useState({ titulo: "", texto: "" });

  const hoy = new Date();
  const cumpleaneros = usuarios.filter((u) => {
    if (!u.fechaNacimiento) return false;
    return esMismoDiaDelAnio(new Date(u.fechaNacimiento + "T12:00:00"), hoy);
  });

  const saveLinks = (l) => { localStorage.setItem("superadmin_links_frecuentes", JSON.stringify(l)); };

  const handleImagenChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setFormLink((f) => ({ ...f, imagenBase64: ev.target.result })); setImgPreview(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleAddLink = (e) => {
    e.preventDefault();
    if (!formLink.titulo || !formLink.url) return;
    const newLink = { id: Date.now().toString(), titulo: formLink.titulo, url: formLink.url.startsWith("http") ? formLink.url : "https://" + formLink.url, imagenBase64: formLink.imagenBase64, creadoEn: new Date().toISOString() };
    const updated = [...links, newLink]; setLinks(updated); saveLinks(updated);
    setFormLink({ titulo: "", url: "", imagenBase64: "" }); setImgPreview(""); setShowFormLink(false);
  };

  const handleDeleteLink = (id) => { const updated = links.filter((l) => l.id !== id); setLinks(updated); saveLinks(updated); };

  return (
    <>
      {/* Toggle button — desktop only */}
      <button
        className="right-sidebar-toggle"
        onClick={() => setAbierto((a) => !a)}
        title={abierto ? "Ocultar panel" : "Mostrar panel"}
        style={{
          position: "fixed", top: "50%", right: abierto ? 260 : 0,
          transform: "translateY(-50%)", zIndex: 200,
          background: "var(--accent)", color: "white", border: "none",
          borderRadius: "6px 0 0 6px", width: 20, height: 60,
          cursor: "pointer", fontSize: 12, display: "flex",
          alignItems: "center", justifyContent: "center",
          transition: "right 0.25s ease", writingMode: "vertical-rl", padding: 0,
        }}
      >{abierto ? "›" : "‹"}</button>

      {/* Panel */}
      <aside
        className={`right-sidebar${mobilePanelOpen ? " mobile-panel-visible" : ""}`}
        style={{
          width: 260, height: "100vh", background: "var(--bg2)",
          borderLeft: "1px solid var(--border)", position: "fixed",
          top: 0, right: abierto ? 0 : -260,
          transition: "right 0.25s cubic-bezier(0.4,0,0.2,1)",
          zIndex: 100, overflowY: "auto", overflowX: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "14px 16px 10px", borderBottom: "1px solid var(--border)",
          fontWeight: 700, fontSize: "0.8rem", color: "var(--text2)",
          textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
          position: "sticky", top: 0, background: "var(--bg2)", zIndex: 1,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>📋 Panel de Empresa</span>
          {mobilePanelOpen && (
            <button onClick={onMobilePanelClose} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}>✕</button>
          )}
        </div>

        <SidebarSection icon="🎂" title="Cumpleaños del día" badge={cumpleaneros.length}>
          {cumpleaneros.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>Sin cumpleaños hoy</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cumpleaneros.map((u) => {
                const nac = new Date(u.fechaNacimiento + "T12:00:00");
                const anios = hoy.getFullYear() - nac.getFullYear();
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "rgba(119,179,40,0.1)", borderRadius: 6, border: "1px solid rgba(119,179,40,0.25)" }}>
                    <span style={{ fontSize: "1.2rem" }}>🎉</span>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>{anios === 0 ? "¡Nació hoy!" : `🎂 ${anios} año${anios !== 1 ? "s" : ""}`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SidebarSection>

        <SidebarSection icon="👥" title="Personal de hoy" badge={personal?.length || 0}>
          {!personal || personal.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>Sin registros hoy</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {personal.map((p, i) => (
                <div key={p.usuarioId || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--bg3)", borderRadius: 6, borderLeft: "3px solid var(--primary)" }}>
                  {p.fotoUrl
                    ? <img src={`${BASE}${p.fotoUrl}`} alt={p.nombre} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor(p.nombre || ""), color: "#fff", fontWeight: 700, fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none" }}>
                        {(p.nombre || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                      </div>
                  }
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                    {p.puestoNombre && <div style={{ fontSize: "0.7rem", color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💼 {p.puestoNombre}</div>}
                    <div style={{ fontSize: "0.68rem", color: "var(--text2)" }}>🕐 {p.hora || ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>

        <SidebarSection icon="📢" title="Anuncios" badge={anuncios?.length || 0} actions={puedeEditar && (
          <button onClick={() => setShowFormAnuncio((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontSize: "0.72rem" }}>
            {showFormAnuncio ? "✕" : "+ Nuevo"}
          </button>
        )}>
          {showFormAnuncio && (
            <form onSubmit={(e) => { e.preventDefault(); if (!formAnuncio.titulo || !formAnuncio.texto) return; onCrearAnuncio?.(formAnuncio); setFormAnuncio({ titulo: "", texto: "" }); setShowFormAnuncio(false); }} style={{ marginBottom: 10 }}>
              <input type="text" className="form-control" placeholder="Título" value={formAnuncio.titulo} onChange={(e) => setFormAnuncio((f) => ({ ...f, titulo: e.target.value }))} required style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }} />
              <textarea className="form-control" placeholder="Texto del anuncio..." value={formAnuncio.texto} onChange={(e) => setFormAnuncio((f) => ({ ...f, texto: e.target.value }))} required rows={3} style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }} />
              <button type="submit" className="btn btn-primary" style={{ width: "100%", fontSize: "0.8rem", padding: "5px" }}>Publicar</button>
            </form>
          )}
          {!anuncios || anuncios.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>Sin anuncios</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {anuncios.map((a) => (
                <div key={a.id} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{a.titulo}</div>
                    {puedeEditar && <button onClick={() => onEliminarAnuncio?.(a.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}>✕</button>}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 3 }}>{a.texto}</div>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>

        <SidebarSection icon="🔗" title="Links Frecuentes" actions={puedeEditar && (
          <button onClick={() => setShowFormLink((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontSize: "0.72rem" }}>
            {showFormLink ? "✕" : "+ Añadir"}
          </button>
        )}>
          {showFormLink && (
            <form onSubmit={handleAddLink} style={{ marginBottom: 12 }}>
              <input type="text" className="form-control" placeholder="Título del link" value={formLink.titulo} onChange={(e) => setFormLink((f) => ({ ...f, titulo: e.target.value }))} required style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }} />
              <input type="text" className="form-control" placeholder="URL (ej: google.com)" value={formLink.url} onChange={(e) => setFormLink((f) => ({ ...f, url: e.target.value }))} required style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 5 }} />
              <div style={{ marginBottom: 7 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Imagen (opcional)</label>
                <input type="file" accept="image/*" onChange={handleImagenChange} style={{ fontSize: "0.75rem" }} />
                {imgPreview && <img src={imgPreview} alt="preview" style={{ width: "100%", height: 56, objectFit: "cover", borderRadius: 4, marginTop: 4 }} />}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%", fontSize: "0.8rem", padding: "5px" }}>Guardar link</button>
            </form>
          )}
          {links.length === 0 && !showFormLink ? (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontStyle: "italic", paddingTop: 4 }}>No hay links guardados</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {links.map((link) => (
                <div key={link.id} style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "var(--bg3)" }}>
                  {link.imagenBase64 && <img src={link.imagenBase64} alt={link.titulo} style={{ width: "100%", height: 56, objectFit: "cover" }} />}
                  <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--accent2)", textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔗 {link.titulo}</a>
                    {puedeEditar && <button onClick={() => handleDeleteLink(link.id)} title="Eliminar" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}>✕</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SidebarSection>
        <div style={{ height: 24, flexShrink: 0 }} />
      </aside>
    </>
  );
}

// ─── Bottom nav (mobile only) ─────────────────────────────────────────────────
function BottomNav({ onCameraClick }) {
  return (
    <nav className="k-bottom-nav">
      {BOTTOM_TABS.map((tab, i) =>
        tab.type === "cam" ? (
          <button key="cam" className="k-bottom-cam" onClick={onCameraClick} aria-label="Registrar">
            <span className="k-bottom-cam-ico">{tab.icon}</span>
          </button>
        ) : (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `k-bottom-tab${isActive ? " active" : ""}`}
          >
            <span className="k-bottom-ico">{tab.icon}</span>
            <span className="k-bottom-label">{tab.label}</span>
          </NavLink>
        )
      )}
    </nav>
  );
}

// ─── Layout principal ──────────────────────────────────────────────────────────
const Layout = () => {
  const { usuario, logout, vistaActual, toggleVista } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen]       = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [panelAbierto, setPanelAbierto]   = useState(false); // lifted from RightSidebar
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [personalHoy, setPersonalHoy]     = useState([]);
  const [anuncios, setAnuncios]           = useState([]);

  const modulosPermitidos    = new Set(getModulesForUser(usuario));
  const esSuperAdmin         = ["super_admin", "administrador_general"].includes(usuario?.rol);
  const puedeEditarSidebar   = esSuperAdmin || usuario?.rol === "agente_soporte_ti";
  const ROLES_PUEDEN_VER_USUARIOS = ["super_admin", "agente_soporte_ti", "supervisor_sucursales"];
  const ROLES_GESTION = ["administrador_general", "super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia", "nominas", "desarrollo_organizacional"];

  const handleLogout = () => { logout(); navigate("/login"); };

  const navGroups = vistaActual === "empleado"
    ? NAV_ITEMS_EMPLEADO
    : NAV_ESTRUCTURA_ADMIN.map((grp) => ({
        ...grp,
        items: grp.items.filter((item) => !item.moduleKey || modulosPermitidos.has(item.moduleKey)),
      })).filter((grp) => grp.items.length > 0);

  const currentSection = useSectionLabel(navGroups);

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 900) { setMobileOpen(false); setMobilePanelOpen(false); }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (usuario && ROLES_PUEDEN_VER_USUARIOS.includes(usuario.rol)) {
      getUsuarios().then((u) => setTodosUsuarios(Array.isArray(u) ? u : [])).catch(() => {});
    }
  }, [usuario?.rol]);

  useEffect(() => {
    if (!usuario) return;
    if (ROLES_GESTION.includes(usuario.rol)) {
      getPersonalHoy().then((r) => setPersonalHoy(Array.isArray(r) ? r : [])).catch(() => {});
    }
    getAnuncios().then((r) => setAnuncios(Array.isArray(r) ? r : [])).catch(() => {});
  }, [usuario?.rol]);

  const handleCrearAnuncio = async (data) => {
    try { const nuevo = await crearAnuncio(data); setAnuncios((prev) => [nuevo, ...prev]); } catch (e) { alert(e.message); }
  };
  const handleEliminarAnuncio = async (id) => {
    if (!window.confirm("¿Eliminar este anuncio?")) return;
    try { await eliminarAnuncio(id); setAnuncios((prev) => prev.filter((a) => a.id !== id)); } catch (e) { alert(e.message); }
  };

  const fotoUrl    = usuario?.fotoUrl    ? `${BASE}${usuario.fotoUrl}`    : null;
  const logoEmpresa= empresa?.logoUrl    ? `${BASE}${empresa.logoUrl}`    : null;

  // Right-panel width to add as padding to main content (smooth transition)
  const rightPad = panelAbierto ? 260 : 0;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`k-sidebar${mobileOpen ? " k-sidebar-open" : ""}`}>

        {/* Brand */}
        <div className="k-brand">
          {logoEmpresa
            ? <img src={logoEmpresa} style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 10, background: "#fff", padding: 4, flexShrink: 0 }} alt="logo" />
            : <div className="k-mark">K</div>
          }
          <div className="k-brand-text">
            <div className="k-product">KronOS</div>
            <div className="k-by">By <b>Previta</b></div>
          </div>
        </div>

        {/* Nav sections */}
        <div style={{ flex: 1, padding: "8px 0 0" }}>
          {navGroups.map((grp) => (
            <div key={grp.section} className="k-nav-section">
              <span className="k-nav-label">{grp.section}</span>
              <nav className="k-nav">
                {grp.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => isActive ? "active" : ""}
                  >
                    <span className="ico">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="k-sidebar-foot">
          {fotoUrl
            ? <img src={fotoUrl} className="k-avatar" style={{ objectFit: "cover" }} alt="avatar" />
            : <div className="k-avatar">{usuario?.nombre?.[0]}{usuario?.apellido?.[0]}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="k-me-name">{usuario?.nombre} {usuario?.apellido}</div>
            <div className="k-me-role">{ROL_LABEL[usuario?.rol] || usuario?.rol}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, padding: "4px", borderRadius: 6, transition: "color 0.15s", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.85)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" style={{ display: "block" }} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div
        className="k-main"
        style={{
          paddingRight: rightPad,
          transition: "padding-right 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >

        {/* Topbar */}
        <header className="k-topbar">
          {/* Hamburger — visible only on mobile */}
          <button
            className="tnav-hamburger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menú"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>

          {/* Breadcrumb */}
          <div className="k-bread">
            <span>Previta</span>
            <span className="sep">/</span>
            <span>KronOS</span>
            <span className="sep">/</span>
            <span className="now">{currentSection}</span>
          </div>

          {/* Actions */}
          <div className="k-topbar-actions">
            <span className="k-topbar-theme"><ThemeToggle /></span>
            <NotificationBell />
            <ProfileDropdown
              usuario={usuario}
              fotoUrl={fotoUrl}
              onNavigate={navigate}
              onLogout={handleLogout}
              onToggleVista={toggleVista}
              vistaActual={vistaActual}
            />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "var(--bone)" }}>
          <Outlet />
        </main>

        {/* Bottom nav — mobile only */}
        <BottomNav onCameraClick={() => {
          if (location.pathname === "/dashboard") {
            // Ya estamos en dashboard: disparar la cámara directamente
            window.dispatchEvent(new CustomEvent("kronos:abrir-camara"));
          } else {
            // Navegar a dashboard e indicar que abra la cámara al montar
            navigate("/dashboard", { state: { abrirCamara: true } });
          }
        }} />
      </div>

      {/* ── Right sidebar ──────────────────────────────────────────────────── */}
      {mobilePanelOpen && (
        <div className="mobile-panel-overlay" onClick={() => setMobilePanelOpen(false)} />
      )}
      <RightSidebar
        usuarios={todosUsuarios}
        puedeEditar={puedeEditarSidebar}
        personal={personalHoy}
        anuncios={anuncios}
        onCrearAnuncio={handleCrearAnuncio}
        onEliminarAnuncio={handleEliminarAnuncio}
        mobilePanelOpen={mobilePanelOpen}
        onMobilePanelClose={() => setMobilePanelOpen(false)}
        abierto={panelAbierto}
        setAbierto={setPanelAbierto}
      />
    </div>
  );
};

export default Layout;
