import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const IcoMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IcoSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IcoMonitor = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);
const IcoPalette = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
);

const THEME_ICO = { dark: <IcoMoon />, light: <IcoSun />, system: <IcoMonitor />, custom: <IcoPalette /> };
const THEMES = [
  { key: "dark",   label: "Oscuro",        icon: <IcoMoon /> },
  { key: "light",  label: "Claro",         icon: <IcoSun /> },
  { key: "system", label: "Sistema",       icon: <IcoMonitor /> },
  { key: "custom", label: "Personalizado", icon: <IcoPalette /> },
];

const ThemeToggle = () => {
  const { theme, setTheme, wallpaper, setWallpaper } = useTheme();
  const [open, setOpen] = useState(false);
  const [wpInput, setWpInput] = useState(wallpaper || "");

  return (
    <div style={{ position: "relative" }}>
      <button
        className="k-topbar-icon-btn"
        onClick={() => setOpen((p) => !p)}
        title="Cambiar tema"
      >
        {THEME_ICO[theme] || <IcoMoon />}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "110%", right: 0, zIndex: 1000,
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 14, minWidth: 200, boxShadow: "var(--shadow)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Apariencia
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTheme(t.key); if (t.key !== "custom") setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: theme === t.key ? "var(--primary)" : "transparent",
                  color: theme === t.key ? "#fff" : "var(--text)",
                  fontWeight: theme === t.key ? 600 : 400,
                  fontSize: "0.875rem", transition: "all 0.15s", width: "100%", textAlign: "left",
                }}
              >
                <span style={{ opacity: theme === t.key ? 1 : 0.6 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {theme === "custom" && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>URL del fondo</p>
              <input
                className="form-control"
                placeholder="https://..."
                value={wpInput}
                onChange={(e) => setWpInput(e.target.value)}
                style={{ fontSize: 12 }}
              />
              <button
                className="btn btn-sm btn-primary"
                style={{ marginTop: 6, width: "100%" }}
                onClick={() => { setWallpaper(wpInput); setOpen(false); }}
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
