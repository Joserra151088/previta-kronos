/**
 * ResetPassword.jsx
 * Página pública para restablecer la contraseña usando el token del enlace enviado por email.
 * Ruta: /reset-password?token=<uuid>
 */

import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEmpresa } from "../context/EmpresaContext";
import { resetPassword } from "../utils/api";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const ResetPassword = () => {
  const [searchParams]      = useSearchParams();
  const navigate            = useNavigate();
  const { empresa }         = useEmpresa();
  const token               = searchParams.get("token") || "";

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [enviando,    setEnviando]    = useState(false);
  const [exito,       setExito]       = useState(false);
  const [error,       setError]       = useState("");
  const [showPass,    setShowPass]    = useState(false);

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">
              {empresa?.logoUrl
                ? <img src={`${BASE}${empresa.logoUrl}`} alt={empresa.nombre} className="login-logo-image" />
                : <span style={{ fontSize: "4rem" }}>🏢</span>
              }
            </div>
            <h1>{empresa?.nombre || "Kronos"}</h1>
          </div>
          <div className="alert alert-danger" style={{ marginTop: 16 }}>
            ⚠️ Enlace inválido o incompleto. Solicita un nuevo enlace desde la pantalla de inicio de sesión.
          </div>
          <button className="btn btn-secondary btn-full" style={{ marginTop: 16 }} onClick={() => navigate("/login")}>
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres.");
    }
    if (password !== confirm) {
      return setError("Las contraseñas no coinciden.");
    }

    setEnviando(true);
    try {
      await resetPassword(token, password);
      setExito(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.message || "No se pudo restablecer la contraseña. El enlace puede haber expirado.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            {empresa?.logoUrl
              ? <img src={`${BASE}${empresa.logoUrl}`} alt={empresa.nombre} className="login-logo-image" />
              : <span style={{ fontSize: "4rem" }}>🏢</span>
            }
          </div>
          <h1>{empresa?.nombre || "Kronos"}</h1>
          <p>Crea tu nueva contraseña</p>
        </div>

        {exito ? (
          <div style={{ padding: "8px 0" }}>
            <div className="alert alert-success">
              ✅ ¡Contraseña actualizada correctamente! Serás redirigido al inicio de sesión…
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => navigate("/login")}>
              Ir al inicio de sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="form-group">
              <label htmlFor="new-password">Nueva contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  id="new-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", fontSize: 16,
                    color: "var(--text2)", padding: 0,
                  }}
                  tabIndex={-1}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirmar contraseña</label>
              <input
                id="confirm-password"
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                autoComplete="new-password"
              />
            </div>

            {/* Indicador de fortaleza visual */}
            {password.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: strengthLevel(password) >= n
                          ? strengthColor(strengthLevel(password))
                          : "var(--border)",
                        transition: "background .2s",
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                  {strengthLabel(strengthLevel(password))}
                </span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={enviando}
            >
              {enviando ? <><span className="login-spinner" />Guardando…</> : "Guardar nueva contraseña"}
            </button>

            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: "0.85rem", color: "var(--text2)" }}
                onClick={() => navigate("/login")}
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Helpers para fortaleza de contraseña ─────────────────────────────────────

function strengthLevel(pwd) {
  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

function strengthColor(level) {
  return ["#d32f2f", "#f57c00", "#fbc02d", "#388e3c"][level - 1] || "#ccc";
}

function strengthLabel(level) {
  return ["Muy débil", "Débil", "Aceptable", "Fuerte"][level - 1] || "";
}

export default ResetPassword;
