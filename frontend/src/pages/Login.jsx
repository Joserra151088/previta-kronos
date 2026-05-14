/**
 * Login.jsx — Diseño Previta
 * Split layout: panel izquierdo con gradiente azul Previta + logo,
 * panel derecho blanco con formulario minimalista.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEmpresa } from "../context/EmpresaContext";
import { forgotPassword } from "../utils/api";

import { SERVER_URL as BASE } from "../utils/config.js";

// Colores de marca Previta
const C = {
  azulOscuro:  "#1a4a6e",
  azulMedio:   "#2a6a9a",
  azulClaro:   "#5badd4",
  teal:        "#1e6f7a",
  tealClaro:   "#2a8a97",
  blanco:      "#ffffff",
  grisClaro:   "#f5f7fa",
  grisTexto:   "#6b7280",
  verde:       "#77b328",
};

// ── Estilos inline reutilizables ──────────────────────────────────────────────

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  background: C.teal,
  border: "none",
  borderRadius: 8,
  color: C.blanco,
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
  transition: "background 0.2s",
};

const inputStyleFocus = {
  ...inputStyle,
  background: C.tealClaro,
};

// Componente de input con estado de foco
function PrevitaInput({ id, type, value, onChange, placeholder, autoComplete, autoFocus, required, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required={required}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={focused ? inputStyleFocus : inputStyle}
      {...rest}
    />
  );
}

const DEMO_USERS = [
  { label: "👑 Super Admin",     email: "ana.garcia@empresa.com",       password: "123456" },
  { label: "🔧 Soporte TI",      email: "luis.ramirez@empresa.com",     password: "123456" },
  { label: "🏢 Supervisor",      email: "carlos.mendoza@empresa.com",   password: "123456" },
  { label: "🩺 Médico Titular",  email: "sofia.torres@empresa.com",     password: "123456" },
  { label: "🩺 Médico Guardia",  email: "maria.lopez@empresa.com",      password: "123456" },
  { label: "📊 Control Asist.",  email: "roberto.fuentes@empresa.com",  password: "123456" },
  { label: "👁️ Visor",           email: "patricia.morales@empresa.com", password: "123456" },
];

const Login = () => {
  const { login, verifyLogin2FA } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("ana.garcia@empresa.com");
  const [password, setPassword] = useState("123456");
  const [error, setError]       = useState("");
  const [cargando, setCargando] = useState(false);
  const [bienvenido, setBienvenido] = useState(null);

  // Médico de guardia
  const [requiresBranch, setRequiresBranch]     = useState(false);
  const [sucursales, setSucursales]             = useState([]);
  const [sucursalIdLogin, setSucursalIdLogin]   = useState("");

  // 2FA
  const [requires2FA, setRequires2FA] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [totp, setTotp]               = useState("");
  const [enviando2FA, setEnviando2FA] = useState(false);

  // Olvidé contraseña
  const [mostrarOlvide, setMostrarOlvide]   = useState(false);
  const [emailReset, setEmailReset]         = useState("");
  const [enviandoReset, setEnviandoReset]   = useState(false);
  const [resetEnviado, setResetEnviado]     = useState(false);
  const [errorReset, setErrorReset]         = useState("");

  // Avatar dinámico: se busca la foto del usuario al escribir el email
  const [userAvatar, setUserAvatar] = useState(null);
  useEffect(() => {
    if (!email || !email.includes("@")) { setUserAvatar(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/avatar?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          setUserAvatar(data.fotoUrl || null);
        }
      } catch { setUserAvatar(null); }
    }, 450); // debounce 450 ms
    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const data = await login(email, password, requiresBranch ? sucursalIdLogin : null);
      if (data.requiresBranchSelection) {
        setRequiresBranch(true);
        setSucursales(data.sucursales || []);
        setCargando(false);
        return;
      }
      if (data.requires2FA) {
        setChallengeId(data.challengeId || "");
        setRequires2FA(true);
        setCargando(false);
        return;
      }
      const nombre = data.usuario?.nombre || "Usuario";
      setBienvenido({ nombre });
      setTimeout(() => navigate("/dashboard"), 1900);
    } catch (err) {
      setError(err.message || "Credenciales incorrectas");
      setCargando(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (!totp.trim()) { setError("Ingresa el código de verificación"); return; }
    setEnviando2FA(true);
    setError("");
    try {
      const data = await verifyLogin2FA(challengeId, totp);
      const nombre = data.usuario?.nombre || "Usuario";
      setBienvenido({ nombre });
      setTimeout(() => navigate("/dashboard"), 1900);
    } catch (err) {
      setError(err.message || "Código incorrecto o expirado");
    } finally {
      setEnviando2FA(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErrorReset("");
    setEnviandoReset(true);
    try {
      await forgotPassword(emailReset);
      setResetEnviado(true);
    } catch (err) {
      setErrorReset(err.message || "Error al enviar la solicitud");
    } finally {
      setEnviandoReset(false);
    }
  };

  // ── Overlay de bienvenida ─────────────────────────────────────────────────
  if (bienvenido) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: `linear-gradient(135deg, ${C.azulClaro} 0%, ${C.azulMedio} 50%, ${C.azulOscuro} 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: C.blanco, zIndex: 9999,
      }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>✔</div>
        <div style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 8 }}>
          ¡Bienvenido, {bienvenido.nombre}!
        </div>
        <div style={{ fontSize: "1rem", opacity: 0.85 }}>
          {empresa?.nombre || "Kronos"} — Cargando tu espacio…
        </div>
      </div>
    );
  }

  // ── Layout principal split ────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Panel izquierdo — Previta brand ─────────────────────────────── */}
      <div style={{
        flex: "0 0 45%",
        background: `linear-gradient(160deg, ${C.azulClaro} 0%, ${C.azulMedio} 45%, ${C.azulOscuro} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: "40px 32px",
      }}>
        {/* Logo / nombre de empresa */}
        <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {empresa?.logoUrl ? (
            <img
              src={`${BASE}${empresa.logoUrl}`}
              alt={empresa.nombre || "Empresa"}
              style={{ maxWidth: 220, maxHeight: 100, objectFit: "contain", marginBottom: 24 }}
            />
          ) : (
            <>
              {/* Logo Previta SVG simplificado */}
              <div style={{
                fontSize: "3.5rem",
                fontWeight: 900,
                color: C.blanco,
                letterSpacing: "-2px",
                marginBottom: 8,
                fontFamily: "'Segoe UI', system-ui, sans-serif",
              }}>
                PRE<span style={{ color: C.verde }}>V</span>ITA
              </div>
              <div style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.75)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: 0,
              }}>
                {empresa?.nombre || "Administración de Salud Poblacional"}
              </div>
            </>
          )}
        </div>

        {/* Marca KronOS en la parte inferior */}
        <div style={{
          fontSize: "0.85rem",
          color: "rgba(255,255,255,0.6)",
          fontStyle: "italic",
          textDecoration: "underline",
          textDecorationColor: "rgba(255,255,255,0.3)",
          letterSpacing: "0.05em",
        }}>
          KronOS
        </div>
      </div>

      {/* ── Panel derecho — Formulario ───────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: C.blanco,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 48px",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>

          {/* Avatar de usuario — muestra foto real si el email coincide */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 80, height: 80,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: userAvatar ? "transparent" : "#eef2f7",
              border: `3px solid ${userAvatar ? C.teal : "#dde3ed"}`,
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              transition: "border-color 0.3s",
            }}>
              {userAvatar ? (
                <img
                  src={`${BASE}${userAvatar}`}
                  alt="Foto de perfil"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" fill="#b0bec5" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#b0bec5" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </div>
          </div>

          {error && (
            <div style={{
              background: "#fee2e2", border: "1px solid #fca5a5",
              color: "#dc2626", borderRadius: 8, padding: "10px 14px",
              fontSize: "0.875rem", marginBottom: 16, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* ── Formulario 2FA ─────────────────────────────────────── */}
          {requires2FA ? (
            <form onSubmit={handle2FASubmit}>
              <div style={{
                background: "#eff6ff", border: "1px solid #bfdbfe",
                borderRadius: 8, padding: "12px 16px", marginBottom: 20,
                fontSize: "0.875rem", color: C.azulMedio, textAlign: "center",
              }}>
                🔐 Ingresa el código de 6 dígitos de tu aplicación autenticadora
              </div>
              <div style={{ marginBottom: 20 }}>
                <PrevitaInput
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  style={{ ...inputStyle, letterSpacing: "0.35em", fontSize: "1.5rem", textAlign: "center" }}
                  autoFocus
                />
                <div style={{ fontSize: "0.75rem", color: C.grisTexto, textAlign: "center", marginTop: 6 }}>
                  Código de verificación
                </div>
              </div>
              <button
                type="submit"
                disabled={enviando2FA || totp.length !== 6}
                style={{
                  width: "100%", padding: "13px",
                  background: totp.length === 6 ? C.teal : "#94a3b8",
                  color: C.blanco, border: "none", borderRadius: 8,
                  fontSize: "0.95rem", fontWeight: 600, cursor: totp.length === 6 ? "pointer" : "not-allowed",
                  transition: "background 0.2s",
                }}
              >
                {enviando2FA ? "Verificando…" : "Verificar código"}
              </button>
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => { setRequires2FA(false); setTotp(""); setError(""); }}
                  style={{ background: "none", border: "none", color: C.grisTexto, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  ← Volver al inicio de sesión
                </button>
              </div>
            </form>

          /* ── Formulario principal ────────────────────────────────── */
          ) : (
            <form onSubmit={handleSubmit}>
              {!requiresBranch ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <PrevitaInput
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Correo electrónico"
                      required
                      autoComplete="email"
                    />
                    <div style={{ fontSize: "0.75rem", color: C.grisTexto, marginTop: 5, paddingLeft: 2 }}>
                      Usuario
                    </div>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <PrevitaInput
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      required
                      autoComplete="current-password"
                    />
                    <div style={{ fontSize: "0.75rem", color: C.grisTexto, marginTop: 5, paddingLeft: 2 }}>
                      Contraseña
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    background: "#eff6ff", border: "1px solid #bfdbfe",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 14,
                    fontSize: "0.875rem", color: C.azulMedio,
                  }}>
                    🩺 Selecciona tu sucursal de hoy como Médico de Guardia:
                  </div>
                  <select
                    style={{ ...inputStyle, appearance: "none" }}
                    value={sucursalIdLogin}
                    onChange={(e) => setSucursalIdLogin(e.target.value)}
                    required
                  >
                    <option value="">Selecciona sucursal…</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre} — {s.ciudad}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setRequiresBranch(false)}
                    style={{ background: "none", border: "none", color: C.grisTexto, cursor: "pointer", fontSize: "0.85rem", marginTop: 8 }}
                  >
                    ← Cambiar usuario
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={cargando || (requiresBranch && !sucursalIdLogin)}
                style={{
                  width: "100%", padding: "13px",
                  background: C.teal,
                  color: C.blanco, border: "none", borderRadius: 8,
                  fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                  opacity: (cargando || (requiresBranch && !sucursalIdLogin)) ? 0.7 : 1,
                  transition: "opacity 0.2s, background 0.2s",
                }}
                onMouseOver={(e) => { if (!cargando) e.currentTarget.style.background = C.tealClaro; }}
                onMouseOut={(e) => e.currentTarget.style.background = C.teal}
              >
                {cargando ? "Iniciando sesión…" : requiresBranch ? "Confirmar sucursal" : "Iniciar sesión"}
              </button>

              {!requiresBranch && (
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => { setMostrarOlvide(!mostrarOlvide); setResetEnviado(false); setErrorReset(""); }}
                    style={{ background: "none", border: "none", color: C.grisTexto, cursor: "pointer", fontSize: "0.82rem" }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </form>
          )}

          {/* ── Olvidé contraseña ──────────────────────────────────── */}
          {!requires2FA && mostrarOlvide && !requiresBranch && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid #e5e7eb` }}>
              {resetEnviado ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", fontSize: "0.875rem", color: "#15803d", textAlign: "center" }}>
                  ✅ Si el correo está registrado, recibirás un enlace de restablecimiento.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <p style={{ fontSize: "0.82rem", color: C.grisTexto, marginBottom: 12, textAlign: "center" }}>
                    Ingresa tu correo para recibir el enlace de restablecimiento.
                  </p>
                  {errorReset && (
                    <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem", marginBottom: 10 }}>
                      {errorReset}
                    </div>
                  )}
                  <PrevitaInput
                    id="email-reset"
                    type="email"
                    value={emailReset}
                    onChange={(e) => setEmailReset(e.target.value)}
                    placeholder="correo@empresa.com"
                    required
                  />
                  <button
                    type="submit"
                    disabled={enviandoReset}
                    style={{
                      width: "100%", padding: "11px", marginTop: 10,
                      background: C.azulMedio, color: C.blanco,
                      border: "none", borderRadius: 8,
                      fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {enviandoReset ? "Enviando…" : "Enviar solicitud"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── Usuarios de prueba ─────────────────────────────────── */}
          {!requires2FA && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid #e5e7eb` }}>
              <p style={{ fontSize: "0.72rem", color: "#9ca3af", textAlign: "center", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Acceso rápido (demo)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => { setEmail(u.email); setPassword(u.password); setRequiresBranch(false); }}
                    style={{
                      padding: "6px 8px",
                      background: C.grisClaro,
                      border: `1px solid #e5e7eb`,
                      borderRadius: 6,
                      fontSize: "0.72rem",
                      color: "#374151",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#e5e7eb"}
                    onMouseOut={(e) => e.currentTarget.style.background = C.grisClaro}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
