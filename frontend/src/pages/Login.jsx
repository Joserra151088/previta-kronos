/**
 * Login.jsx — Diseño Previta responsive
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEmpresa } from "../context/EmpresaContext";
import { forgotPassword } from "../utils/api";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const C = {
  azulOscuro:  "#0d2a42",
  azulMedio:   "#1a4f7a",
  azulClaro:   "#2d7ab8",
  teal:        "#1e6f7a",
  tealClaro:   "#2a8a97",
  blanco:      "#ffffff",
  grisClaro:   "#f5f7fa",
  grisTexto:   "#6b7280",
  verde:       "#77b328",
  verdeOscuro: "#5a9a1e",
};

function PrevitaInput({ id, type, value, onChange, placeholder, autoComplete, autoFocus, required, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id} type={type} value={value} onChange={onChange}
      placeholder={placeholder} autoComplete={autoComplete}
      autoFocus={autoFocus} required={required}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "13px 16px",
        background: focused ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.12)",
        border: focused ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.2)",
        borderRadius: 10, color: C.blanco, fontSize: "0.95rem",
        outline: "none", boxSizing: "border-box", transition: "all 0.2s",
        boxShadow: focused ? "0 0 0 3px rgba(255,255,255,0.1)" : "none",
      }}
      {...rest}
    />
  );
}

const Login = () => {
  const { login, verifyLogin2FA } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [cargando, setCargando] = useState(false);
  const [bienvenido, setBienvenido] = useState(null);

  const [requiresBranch, setRequiresBranch] = useState(false);
  const [sucursales, setSucursales]         = useState([]);
  const [sucursalIdLogin, setSucursalIdLogin] = useState("");

  const [requires2FA, setRequires2FA] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [totp, setTotp]               = useState("");
  const [enviando2FA, setEnviando2FA] = useState(false);

  const [mostrarOlvide, setMostrarOlvide] = useState(false);
  const [emailReset, setEmailReset]       = useState("");
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviado, setResetEnviado]   = useState(false);
  const [errorReset, setErrorReset]       = useState("");

  const [userAvatar, setUserAvatar] = useState(null);
  useEffect(() => {
    if (!email || !email.includes("@")) { setUserAvatar(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/avatar?email=${encodeURIComponent(email)}`);
        if (res.ok) { const data = await res.json(); setUserAvatar(data.fotoUrl || null); }
      } catch { setUserAvatar(null); }
    }, 450);
    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setCargando(true);
    try {
      const data = await login(email, password, requiresBranch ? sucursalIdLogin : null);
      if (data.requiresBranchSelection) { setRequiresBranch(true); setSucursales(data.sucursales || []); setCargando(false); return; }
      if (data.requires2FA) { setChallengeId(data.challengeId || ""); setRequires2FA(true); setCargando(false); return; }
      setBienvenido({ nombre: data.usuario?.nombre || "Usuario" });
      setTimeout(() => navigate("/dashboard"), 1900);
    } catch (err) { setError(err.message || "Credenciales incorrectas"); setCargando(false); }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (!totp.trim()) { setError("Ingresa el código de verificación"); return; }
    setEnviando2FA(true); setError("");
    try {
      const data = await verifyLogin2FA(challengeId, totp);
      setBienvenido({ nombre: data.usuario?.nombre || "Usuario" });
      setTimeout(() => navigate("/dashboard"), 1900);
    } catch (err) { setError(err.message || "Código incorrecto o expirado"); }
    finally { setEnviando2FA(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setErrorReset(""); setEnviandoReset(true);
    try { await forgotPassword(emailReset); setResetEnviado(true); }
    catch (err) { setErrorReset(err.message || "Error al enviar la solicitud"); }
    finally { setEnviandoReset(false); }
  };

  // Overlay bienvenida
  if (bienvenido) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: `linear-gradient(135deg, ${C.azulClaro} 0%, ${C.azulMedio} 50%, ${C.azulOscuro} 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: C.blanco, zIndex: 9999,
      }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>✔</div>
        <div style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 8 }}>¡Bienvenido, {bienvenido.nombre}!</div>
        <div style={{ fontSize: "1rem", opacity: 0.85 }}>{empresa?.nombre || "Kronos"} — Cargando tu espacio…</div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Fondo gradiente (siempre visible, ocupa toda la pantalla en móvil) */}
      <div className="login-bg" />

      {/* Panel izquierdo (solo desktop) */}
      <div className="login-brand-panel">
        <div className="login-brand-content">
          {empresa?.logoUrl ? (
            <img src={`${BASE}${empresa.logoUrl}`} alt={empresa.nombre || "Empresa"} style={{ maxWidth: 200, maxHeight: 90, objectFit: "contain", marginBottom: 20 }} />
          ) : (
            <>
              <div className="login-brand-title">
                PRE<span style={{ color: C.verde }}>V</span>ITA
              </div>
              <div className="login-brand-sub">
                {empresa?.nombre || "Administración de Salud Poblacional"}
              </div>
            </>
          )}
          <div className="login-brand-features">
            <div className="login-feature-item">✓ Control de asistencia en tiempo real</div>
            <div className="login-feature-item">✓ Gestión de incidencias y vacaciones</div>
            <div className="login-feature-item">✓ Reportes y analytics organizacionales</div>
          </div>
        </div>
        <div className="login-brand-footer">KronOS</div>
      </div>

      {/* Panel derecho / Card centrada en móvil */}
      <div className="login-form-panel">
        <div className="login-card">

          {/* Logo móvil (solo aparece en móvil) */}
          <div className="login-mobile-brand">
            {empresa?.logoUrl ? (
              <img src={`${BASE}${empresa.logoUrl}`} alt={empresa.nombre} style={{ height: 48, objectFit: "contain" }} />
            ) : (
              <div style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: -1, color: C.blanco }}>
                PRE<span style={{ color: C.verde }}>V</span>ITA
              </div>
            )}
          </div>

          {/* Avatar */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              background: userAvatar ? "transparent" : "rgba(255,255,255,0.15)",
              border: `2px solid ${userAvatar ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)"}`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              transition: "border-color 0.3s",
            }}>
              {userAvatar ? (
                <img src={`${BASE}${userAvatar}`} alt="Foto de perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.7)" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </div>
            <div style={{ marginTop: 10, fontWeight: 600, fontSize: "1rem", color: C.blanco }}>Bienvenido</div>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.65)" }}>Inicia sesión para continuar</div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.4)",
              color: "#fca5a5", borderRadius: 8, padding: "10px 14px",
              fontSize: "0.875rem", marginBottom: 14, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* 2FA */}
          {requires2FA ? (
            <form onSubmit={handle2FASubmit}>
              <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 18, fontSize: "0.875rem", color: "rgba(255,255,255,0.9)", textAlign: "center" }}>
                🔐 Ingresa el código de 6 dígitos de tu aplicación autenticadora
              </div>
              <div style={{ marginBottom: 18 }}>
                <PrevitaInput id="totp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000" required autoComplete="one-time-code" autoFocus
                  style={{ letterSpacing: "0.35em", fontSize: "1.5rem", textAlign: "center" }}
                />
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 6 }}>Código de verificación</div>
              </div>
              <button type="submit" disabled={enviando2FA || totp.length !== 6} className="login-btn">
                {enviando2FA ? "Verificando…" : "Verificar código"}
              </button>
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button type="button" onClick={() => { setRequires2FA(false); setTotp(""); setError(""); }} className="login-link-btn">
                  ← Volver al inicio de sesión
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              {!requiresBranch ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <PrevitaInput id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" required autoComplete="email" />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <PrevitaInput id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required autoComplete="current-password" />
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: "0.875rem", color: "rgba(255,255,255,0.9)" }}>
                    🩺 Selecciona tu sucursal de hoy como Médico de Guardia:
                  </div>
                  <select
                    style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, color: C.blanco, fontSize: "0.95rem", outline: "none" }}
                    value={sucursalIdLogin} onChange={(e) => setSucursalIdLogin(e.target.value)} required
                  >
                    <option value="" style={{ color: "#333" }}>Selecciona sucursal…</option>
                    {sucursales.map((s) => <option key={s.id} value={s.id} style={{ color: "#333" }}>{s.nombre} — {s.ciudad}</option>)}
                  </select>
                  <button type="button" onClick={() => setRequiresBranch(false)} className="login-link-btn" style={{ marginTop: 8 }}>← Cambiar usuario</button>
                </div>
              )}

              <button type="submit" disabled={cargando || (requiresBranch && !sucursalIdLogin)} className="login-btn">
                {cargando ? "Iniciando sesión…" : requiresBranch ? "Confirmar sucursal" : "Iniciar sesión"}
              </button>

              {!requiresBranch && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <button type="button" onClick={() => { setMostrarOlvide(!mostrarOlvide); setResetEnviado(false); setErrorReset(""); }} className="login-link-btn">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Olvidé contraseña */}
          {!requires2FA && mostrarOlvide && !requiresBranch && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
              {resetEnviado ? (
                <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: "0.875rem", color: "#6ee7b7", textAlign: "center" }}>
                  ✅ Si el correo está registrado, recibirás un enlace de restablecimiento.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.65)", marginBottom: 10, textAlign: "center" }}>
                    Ingresa tu correo para recibir el enlace de restablecimiento.
                  </p>
                  {errorReset && <div style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem", marginBottom: 10 }}>{errorReset}</div>}
                  <PrevitaInput id="email-reset" type="email" value={emailReset} onChange={(e) => setEmailReset(e.target.value)} placeholder="correo@empresa.com" required />
                  <button type="submit" disabled={enviandoReset} className="login-btn" style={{ marginTop: 10, background: "rgba(255,255,255,0.2)" }}>
                    {enviandoReset ? "Enviando…" : "Enviar solicitud"}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
