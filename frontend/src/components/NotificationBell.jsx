import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificaciones } from "../context/NotificacionesContext";

// SVG bell elegante
const IcoBell = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

// Dot de color para cada tipo
const TIPO_CONFIG = {
  info:                { color: "#3b82f6" },
  alerta:              { color: "#f97316" },
  success:             { color: "#22c55e" },
  error:               { color: "#ef4444" },
  incidencia_nueva:    { color: "#f97316" },
  incidencia_resuelta: { color: "#22c55e" },
  asistencia_manual:   { color: "#3b82f6" },
  asistencia_aprobada: { color: "#22c55e" },
  asistencia_rechazada:{ color: "#ef4444" },
  mensaje_general:     { color: "#3b82f6" },
};

const tiempoRelativo = (isoString) => {
  const diff = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

const NotificationBell = () => {
  const { notificaciones, noLeidas, marcarLeida, marcarTodas } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (notif) => {
    if (!notif.leida) marcarLeida(notif.id);
    setAbierto(false);
    navigate("/notificaciones");
  };

  const recientes = notificaciones.slice(0, 6);

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button className="k-topbar-icon-btn" onClick={() => setAbierto(!abierto)} title="Notificaciones" style={{ position: "relative" }}>
        <IcoBell />
        {noLeidas > 0 && (
          <span className="notif-badge">{noLeidas > 99 ? "99+" : noLeidas}</span>
        )}
      </button>

      {abierto && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              Notificaciones
              {noLeidas > 0 && <span style={{ color: "#ef4444", fontWeight: 400, fontSize: "0.78rem", marginLeft: 6 }}>{noLeidas} sin leer</span>}
            </span>
            {noLeidas > 0 && (
              <button onClick={() => marcarTodas()} style={{ fontSize: "0.75rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Marcar leídas
              </button>
            )}
          </div>

          {recientes.length === 0 ? (
            <div className="notif-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: 8 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              Sin notificaciones
            </div>
          ) : (
            <div className="notif-list" style={{ maxHeight: 360, overflowY: "auto" }}>
              {recientes.map((n) => {
                const config = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info;
                return (
                  <button
                    key={n.id}
                    className={`notif-item ${!n.leida ? "notif-item-unread" : ""}`}
                    onClick={() => handleClick(n)}
                    style={{ borderLeft: `3px solid ${config.color}` }}
                  >
                    <span
                      className="notif-item-icon"
                      style={{ background: `${config.color}18`, color: config.color, borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </span>
                    <div className="notif-item-body">
                      <div className="notif-item-title">{n.titulo}</div>
                      <div className="notif-item-msg">{n.mensaje}</div>
                      <div className="notif-item-time">{tiempoRelativo(n.creadoEn)}</div>
                    </div>
                    {!n.leida && <span className="notif-item-dot" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="notif-dropdown-footer">
            <button onClick={() => { setAbierto(false); navigate("/notificaciones"); }}>
              Ver todas las notificaciones →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
