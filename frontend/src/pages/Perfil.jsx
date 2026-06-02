/**
 * Perfil.jsx
 * Edición del perfil propio: datos, foto, contraseña, registros y aclaraciones.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { actualizarUsuario, subirFotoEmpleado, get2FAStatus, setup2FA, confirm2FA, disable2FA } from "../utils/api";
import { toastError } from "../utils/toast";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// ─── Validación de contraseña ─────────────────────────────────────────────────
const PWD_RULES = [
  { id: "len",     label: "Mínimo 8 caracteres",            test: (p) => p.length >= 8 },
  { id: "upper",   label: "Al menos una letra mayúscula",   test: (p) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Al menos una letra minúscula",   test: (p) => /[a-z]/.test(p) },
  { id: "num",     label: "Al menos un número",             test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "Al menos un carácter especial",  test: (p) => /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(p) },
];

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const cumplidos = PWD_RULES.filter((r) => r.test(password)).length;
  const porcentaje = (cumplidos / PWD_RULES.length) * 100;
  const color = porcentaje < 40 ? "#ef4444" : porcentaje < 80 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${porcentaje}%`, background: color, transition: "width 0.25s, background 0.25s", borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {PWD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <span key={r.id} style={{ fontSize: 11, color: ok ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 5 }}>
              {ok ? "✓" : "✗"} {r.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── API helpers (aclaraciones) ───────────────────────────────────────────────

const getToken = () => localStorage.getItem("token");

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers, ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || "Error en la petición"), data);
  return data;
}

const getRegistrosPropios = (params) =>
  apiRequest("/registros?" + new URLSearchParams(params));

const createAclaracion = (data) =>
  apiRequest("/aclaraciones", { method: "POST", body: data });

const getAclaraciones = () => apiRequest("/aclaraciones");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoy() { return new Date().toISOString().split("T")[0]; }

function inicioSemana() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - ((dow + 6) % 7));
  return d.toISOString().split("T")[0];
}

function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function inicioAnio() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().split("T")[0];
}

const TIPO_ICON = {
  entrada: "🟢",
  salida_alimentos: "🟡",
  regreso_alimentos: "🔵",
  salida: "🔴",
};

const TIPO_LABEL = {
  entrada: "Entrada",
  salida_alimentos: "Salida a comer",
  regreso_alimentos: "Regreso de comer",
  salida: "Salida final",
};

const PERIODOS = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta Semana" },
  { key: "mes", label: "Este Mes" },
  { key: "anio", label: "Este Año" },
];

function rangoParaPeriodo(periodo) {
  const fin = hoy();
  if (periodo === "hoy") return { desde: fin, hasta: fin };
  if (periodo === "semana") return { desde: inicioSemana(), hasta: fin };
  if (periodo === "mes") return { desde: inicioMes(), hasta: fin };
  return { desde: inicioAnio(), hasta: fin };
}

// ─── Sección Mis Registros ────────────────────────────────────────────────────

function MisRegistros({ usuarioId }) {
  const [periodo, setPeriodo] = useState("semana");
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { desde, hasta } = rangoParaPeriodo(periodo);
      const res = await getRegistrosPropios({ usuarioId, fechaInicio: desde, fechaFin: hasta });
      const lista = Array.isArray(res) ? res : (res.registros || []);
      // Sort by fecha desc, then hora desc
      lista.sort((a, b) => {
        const fd = (b.fecha || "").localeCompare(a.fecha || "");
        if (fd !== 0) return fd;
        return (b.hora || "").localeCompare(a.hora || "");
      });
      setRegistros(lista);
    } catch (e) {
      console.error("Error cargando registros:", e);
    } finally {
      setCargando(false);
    }
  }, [periodo, usuarioId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Estadísticas
  const diasConRegistro = new Set(registros.map((r) => r.fecha)).size;
  const jornadasCompletas = (() => {
    const porDia = {};
    for (const r of registros) {
      if (!porDia[r.fecha]) porDia[r.fecha] = new Set();
      porDia[r.fecha].add(r.tipo);
    }
    return Object.values(porDia).filter((tipos) => tipos.has("entrada") && tipos.has("salida")).length;
  })();

  const { desde, hasta } = rangoParaPeriodo(periodo);
  const diasRango = (() => {
    const dias = [];
    const cur = new Date(desde + "T00:00:00");
    const end = new Date(hasta + "T00:00:00");
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) dias.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dias;
  })();

  const diasConDatos = new Set(registros.map((r) => r.fecha));
  const ausencias = diasRango.filter((d) => d <= hoy() && !diasConDatos.has(d)).length;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>📅 Mis Registros de Asistencia</span>
      </div>
      <div className="card-body">
        {/* Period selector */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              className={`tab-btn ${periodo === p.key ? "tab-active" : ""}`}
              onClick={() => setPeriodo(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { label: "Días con registro", value: diasConRegistro, color: "var(--accent)" },
            { label: "Jornadas completas", value: jornadasCompletas, color: "var(--success)" },
            { label: "Ausencias (hábiles)", value: ausencias, color: "var(--danger)" },
            { label: "Total registros", value: registros.length, color: "var(--text)" },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: "10px 16px",
              background: "var(--bg3)",
              borderRadius: 8,
              border: "1px solid var(--border)",
              textAlign: "center",
              minWidth: 100,
              flex: 1,
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Registros list */}
        {cargando ? (
          <div className="loading" style={{ padding: "20px 0" }}>Cargando registros...</div>
        ) : registros.length === 0 ? (
          <div style={{ color: "var(--text2)", textAlign: "center", padding: "20px 0", fontSize: "0.9rem" }}>
            No hay registros en este período
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
            {registros.map((reg) => (
              <div key={reg.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "8px 12px",
                background: "var(--bg3)",
                borderRadius: 6,
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
              }}>
                <span style={{ fontSize: "1.1rem" }}>{TIPO_ICON[reg.tipo] || "⚪"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{TIPO_LABEL[reg.tipo] || reg.tipo}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                    {reg.fecha} — {reg.hora?.slice(0, 5) || "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {reg.fueraDeHorario ? (
                    <span style={{ fontSize: "0.72rem", color: "var(--danger)", background: "rgba(248,81,73,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                      ⚠ Fuera de horario
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.72rem", color: "var(--success)", background: "rgba(63,185,80,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                      ✓ En horario
                    </span>
                  )}
                  {reg.esManual && (
                    <div style={{ fontSize: "0.68rem", color: "var(--warning)", marginTop: 2 }}>📝 Manual</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sección Aclaración de Horario ───────────────────────────────────────────

function AclaracionHorario({ usuarioId }) {
  const [showModal, setShowModal] = useState(false);
  const [aclaraciones, setAclaraciones] = useState([]);
  const [cargandoAcl, setCargandoAcl] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [okEnvio, setOkEnvio] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  const [form, setForm] = useState({
    fechaRegistro: hoy(),
    tipoRegistro: "entrada",
    motivo: "",
  });

  const cargarAclaraciones = useCallback(async () => {
    setCargandoAcl(true);
    try {
      const res = await getAclaraciones();
      const lista = Array.isArray(res) ? res : (res.aclaraciones || []);
      setAclaraciones(lista);
    } catch (e) {
      // Endpoint may not exist yet - fail gracefully
      setAclaraciones([]);
    } finally {
      setCargandoAcl(false);
    }
  }, []);

  useEffect(() => { cargarAclaraciones(); }, [cargarAclaraciones]);

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!form.motivo.trim()) { setErrorEnvio("Por favor describe el problema"); return; }
    setEnviando(true); setErrorEnvio(""); setOkEnvio(false);
    try {
      await createAclaracion(form);
      setOkEnvio(true);
      setForm({ fechaRegistro: hoy(), tipoRegistro: "entrada", motivo: "" });
      setShowModal(false);
      await cargarAclaraciones();
    } catch (err) {
      setErrorEnvio(err.message || "No se pudo enviar la aclaración");
    } finally {
      setEnviando(false);
    }
  };

  const estadoConfig = {
    pendiente:  { color: "#d29922", bg: "rgba(210,153,34,0.12)", label: "Pendiente" },
    aprobada:   { color: "#3fb950", bg: "rgba(63,185,80,0.12)",  label: "Aprobada" },
    rechazada:  { color: "#f85149", bg: "rgba(248,81,73,0.12)",  label: "Rechazada" },
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>📋 Aclaración de Horario</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setOkEnvio(false); setErrorEnvio(""); }}>
          + Solicitar Aclaración
        </button>
      </div>
      <div className="card-body">
        {/* Mis aclaraciones enviadas */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: "0.9rem" }}>Mis Aclaraciones</div>
        {cargandoAcl ? (
          <div style={{ color: "var(--text2)", fontSize: "0.85rem" }}>Cargando...</div>
        ) : aclaraciones.length === 0 ? (
          <div style={{ color: "var(--text2)", fontSize: "0.85rem", fontStyle: "italic" }}>
            No has enviado aclaraciones todavía.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aclaraciones.map((acl) => {
              const cfg = estadoConfig[acl.estado] || estadoConfig.pendiente;
              return (
                <div key={acl.id} style={{
                  padding: "10px 14px",
                  background: "var(--bg3)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: "0.85rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {TIPO_LABEL[acl.tipoRegistro] || acl.tipoRegistro} — {acl.fechaRegistro}
                      </div>
                      <div style={{ color: "var(--text2)", fontSize: "0.8rem", marginTop: 2 }}>{acl.motivo}</div>
                      {acl.respuesta && (
                        <div style={{ color: "var(--text2)", fontSize: "0.78rem", marginTop: 4, fontStyle: "italic" }}>
                          Resp. supervisor: {acl.respuesta}
                        </div>
                      )}
                    </div>
                    <span style={{
                      padding: "3px 8px", borderRadius: 12,
                      fontSize: "0.75rem", fontWeight: 700,
                      color: cfg.color, background: cfg.bg, whiteSpace: "nowrap",
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de aclaración */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>📋 Solicitar Aclaración de Horario</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEnviar} className="modal-body">
              {errorEnvio && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{errorEnvio}</div>}
              {okEnvio && (
                <div className="alert alert-success" style={{ marginBottom: 12 }}>
                  ✅ Tu aclaración ha sido enviada a tu supervisor
                </div>
              )}

              <div className="form-group">
                <label>¿Qué fecha tiene el problema? *</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.fechaRegistro}
                  max={hoy()}
                  onChange={(e) => setForm((f) => ({ ...f, fechaRegistro: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>¿Qué tipo de registro está incorrecto? *</label>
                <select
                  className="form-control"
                  value={form.tipoRegistro}
                  onChange={(e) => setForm((f) => ({ ...f, tipoRegistro: e.target.value }))}
                  required
                >
                  <option value="entrada">Entrada</option>
                  <option value="salida_alimentos">Salida a comer</option>
                  <option value="regreso_alimentos">Regreso de comer</option>
                  <option value="salida">Salida final</option>
                </select>
              </div>

              <div className="form-group">
                <label>¿Qué está mal y por qué necesita corrección? *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                  placeholder="Describe el problema, por ejemplo: 'Mi registro de entrada del día X no aparece porque el sistema falló al momento de fichar...'"
                  required
                  minLength={10}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviando}>
                  {enviando ? "Enviando..." : "📤 Enviar Aclaración"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sección 2FA ──────────────────────────────────────────────────────────────

function Seguridad2FA() {
  const [estado, setEstado] = useState(null); // { habilitado }
  const [cargando, setCargando] = useState(true);

  // Setup flow
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUrl }
  const [code, setCode]           = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [ok, setOk]               = useState("");
  const [errMsg, setErrMsg]       = useState("");

  // Disable flow
  const [showDesactivar, setShowDesactivar] = useState(false);
  const [codeDesactivar, setCodeDesactivar] = useState("");

  const cargarEstado = useCallback(async () => {
    try {
      setCargando(true);
      const data = await get2FAStatus();
      setEstado(data);
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  const handleSetup = async () => {
    setErrMsg(""); setOk("");
    try {
      const data = await setup2FA();
      setSetupData(data); // { secret, otpauthUrl }
      setCode("");
    } catch (e) {
      setErrMsg(e.message);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setErrMsg("El código debe tener 6 dígitos"); return; }
    setEnviando(true); setErrMsg(""); setOk("");
    try {
      await confirm2FA(code);
      setSetupData(null);
      setCode("");
      setOk("✅ Autenticación de dos factores activada correctamente.");
      await cargarEstado();
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleDesactivar = async (e) => {
    e.preventDefault();
    setEnviando(true); setErrMsg(""); setOk("");
    try {
      await disable2FA(codeDesactivar);
      setShowDesactivar(false);
      setCodeDesactivar("");
      setOk("✅ Autenticación de dos factores desactivada.");
      await cargarEstado();
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <div style={{ color: "var(--text2)", padding: "20px 0" }}>Cargando estado de 2FA…</div>;

  return (
    <div className="card">
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ marginBottom: 8 }}>🔐 Autenticación en Dos Factores (2FA)</h3>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem", marginBottom: 20 }}>
          Añade una capa extra de seguridad a tu cuenta. Necesitarás una aplicación autenticadora
          como <strong>Google Authenticator</strong> o <strong>Authy</strong>.
        </p>

        {errMsg && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{errMsg}</div>}
        {ok     && <div className="alert alert-success" style={{ marginBottom: 16 }}>{ok}</div>}

        {/* Estado actual */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg3)", borderRadius: 8, marginBottom: 20, border: "1px solid var(--border)" }}>
          <span style={{ fontSize: "1.5rem" }}>{estado?.habilitado ? "🟢" : "⚪"}</span>
          <div>
            <div style={{ fontWeight: 700 }}>
              {estado?.habilitado ? "2FA Activado" : "2FA Desactivado"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>
              {estado?.habilitado
                ? "Tu cuenta está protegida con verificación en dos pasos."
                : "Tu cuenta solo usa contraseña para iniciar sesión."}
            </div>
          </div>
        </div>

        {/* Configurar 2FA */}
        {!estado?.habilitado && !setupData && (
          <button className="btn btn-primary" onClick={handleSetup}>
            🔑 Activar 2FA
          </button>
        )}

        {/* QR + confirmar */}
        {!estado?.habilitado && setupData && (
          <div>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              <strong>Paso 1:</strong> Escanea el código QR con tu aplicación autenticadora o ingresa el código manualmente.
            </div>
            {/* QR via Google Charts */}
            <div style={{ textAlign: "center", margin: "16px 0" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.otpauthUri || setupData.otpauthUrl || "")}`}
                alt="QR 2FA"
                style={{ width: 200, height: 200, borderRadius: 8, border: "1px solid var(--border)" }}
              />
            </div>
            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontFamily: "monospace", wordBreak: "break-all", fontSize: 14 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 4 }}>Clave secreta (entrada manual):</div>
              {setupData.secret}
            </div>
            <form onSubmit={handleConfirm}>
              <div className="alert alert-info" style={{ marginBottom: 12 }}>
                <strong>Paso 2:</strong> Ingresa el código de 6 dígitos que aparece en tu app para confirmar.
              </div>
              <div className="form-group">
                <label>Código de verificación</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="form-control"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  style={{ letterSpacing: "0.25em", fontSize: "1.2rem", textAlign: "center", maxWidth: 160 }}
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setSetupData(null); setCode(""); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviando || code.length !== 6}>
                  {enviando ? "Verificando…" : "✅ Confirmar y activar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Desactivar 2FA */}
        {estado?.habilitado && !showDesactivar && (
          <button
            className="btn btn-danger"
            onClick={() => { setShowDesactivar(true); setCodeDesactivar(""); setErrMsg(""); }}
          >
            🔓 Desactivar 2FA
          </button>
        )}

        {estado?.habilitado && showDesactivar && (
          <form onSubmit={handleDesactivar}>
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              Para desactivar el 2FA, confirma con un código actual de tu aplicación autenticadora.
            </div>
            <div className="form-group">
              <label>Código de verificación actual</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="form-control"
                value={codeDesactivar}
                onChange={(e) => setCodeDesactivar(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                style={{ letterSpacing: "0.25em", fontSize: "1.2rem", textAlign: "center", maxWidth: 160 }}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDesactivar(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger" disabled={enviando || codeDesactivar.length !== 6}>
                {enviando ? "Desactivando…" : "Confirmar desactivación"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal Perfil ──────────────────────────────────────────────

const Perfil = () => {
  const { usuario, setUsuario } = useAuth();
  const [tab, setTab] = useState("datos");

  // Datos personales
  const [formDatos, setFormDatos] = useState({
    nombre:   usuario?.nombre   || "",
    apellido: usuario?.apellido || "",
    email:    usuario?.email    || "",
    telefono: usuario?.telefono || "",
  });
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos]         = useState("");
  const [okDatos, setOkDatos]               = useState(false);

  // Contraseña
  const [formPass, setFormPass] = useState({ password: "", confirmar: "" });
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [errorPass, setErrorPass]         = useState("");
  const [okPass, setOkPass]               = useState(false);

  // Foto
  const fotoRef = useRef(null);
  const [fotoPreview, setFotoPreview] = useState(usuario?.fotoUrl ? `${BASE}${usuario.fotoUrl}` : null);
  const [fotoFile, setFotoFile]       = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const handleFotoChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFotoFile(f);
    setFotoPreview(URL.createObjectURL(f));
  };

  const handleSubirFoto = async () => {
    if (!fotoFile) return;
    setSubiendoFoto(true);
    try {
      const res = await subirFotoEmpleado(usuario.id, fotoFile);
      setUsuario({ ...usuario, fotoUrl: res.fotoUrl });
      setFotoFile(null);
    } catch (err) { toastError(err); }
    finally { setSubiendoFoto(false); }
  };

  const handleGuardarDatos = async (e) => {
    e.preventDefault();
    setGuardandoDatos(true); setErrorDatos(""); setOkDatos(false);
    try {
      const res = await actualizarUsuario(usuario.id, formDatos);
      setUsuario({ ...usuario, ...res });
      setOkDatos(true);
    } catch (err) { setErrorDatos(err.message); }
    finally { setGuardandoDatos(false); }
  };

  const handleGuardarPass = async (e) => {
    e.preventDefault();
    if (formPass.password !== formPass.confirmar)
      { setErrorPass("Las contraseñas no coinciden"); return; }
    // Validar reglas de contraseña
    const reglasFallidas = PWD_RULES.filter((r) => !r.test(formPass.password));
    if (reglasFallidas.length > 0)
      { setErrorPass(`La contraseña no cumple: ${reglasFallidas.map(r => r.label).join(", ")}`); return; }
    setGuardandoPass(true); setErrorPass(""); setOkPass(false);
    try {
      await actualizarUsuario(usuario.id, { password: formPass.password });
      setFormPass({ password: "", confirmar: "" });
      setOkPass(true);
    } catch (err) { setErrorPass(err.message); }
    finally { setGuardandoPass(false); }
  };

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p className="page-subtitle">Administra tu información personal</p>
        </div>
      </div>

      {/* Foto */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", marginBottom: 20, flexWrap: "wrap" }}>
        <div
          className="foto-upload-area"
          style={{ margin: 0, flexShrink: 0 }}
          onClick={() => fotoRef.current?.click()}
        >
          {fotoPreview
            ? <img src={fotoPreview} alt="foto" className="emp-foto-preview" />
            : <div className="foto-upload-placeholder"><span>👤</span><small>Subir foto</small></div>
          }
          <div className="foto-overlay">📷 Cambiar</div>
        </div>
        <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFotoChange} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{usuario?.nombre} {usuario?.apellido}</div>
          <div style={{ color: "var(--text2)", fontSize: 13, marginTop: 2 }}>{usuario?.email}</div>
          <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 4 }}>{usuario?.rol?.replace(/_/g," ")}</div>
          {fotoFile && (
            <button className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={handleSubirFoto} disabled={subiendoFoto}>
              {subiendoFoto ? "Subiendo…" : "💾 Guardar foto"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${tab === "datos" ? "tab-active" : ""}`} onClick={() => setTab("datos")}>Datos personales</button>
        <button className={`tab-btn ${tab === "password" ? "tab-active" : ""}`} onClick={() => setTab("password")}>Contraseña</button>
        <button className={`tab-btn ${tab === "seguridad" ? "tab-active" : ""}`} onClick={() => setTab("seguridad")}>🔐 Seguridad 2FA</button>
        <button className={`tab-btn ${tab === "registros" ? "tab-active" : ""}`} onClick={() => setTab("registros")}>Mis Registros</button>
        <button className={`tab-btn ${tab === "aclaraciones" ? "tab-active" : ""}`} onClick={() => setTab("aclaraciones")}>Aclaraciones</button>
      </div>

      {/* Datos personales */}
      {tab === "datos" && (
        <div className="card">
          <form onSubmit={handleGuardarDatos}>
            {errorDatos && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{errorDatos}</div>}
            {okDatos    && <div className="alert alert-success" style={{ marginBottom: 14 }}>✅ Datos guardados correctamente</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre *</label>
                <input className="form-control" value={formDatos.nombre} onChange={e => setFormDatos({...formDatos, nombre: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input className="form-control" value={formDatos.apellido} onChange={e => setFormDatos({...formDatos, apellido: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Correo electrónico</label>
              <input type="email" className="form-control" value={formDatos.email} onChange={e => setFormDatos({...formDatos, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="tel" className="form-control" value={formDatos.telefono} placeholder="10 dígitos" onChange={e => setFormDatos({...formDatos, telefono: e.target.value})} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={guardandoDatos}>
              {guardandoDatos ? "Guardando…" : "💾 Guardar cambios"}
            </button>
          </form>
        </div>
      )}

      {/* Contraseña */}
      {tab === "password" && (
        <div className="card">
          <form onSubmit={handleGuardarPass}>
            {errorPass && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{errorPass}</div>}
            {okPass    && <div className="alert alert-success" style={{ marginBottom: 14 }}>✅ Contraseña actualizada</div>}
            <div className="form-group">
              <label>Nueva contraseña *</label>
              <input
                type="password"
                className="form-control"
                value={formPass.password}
                onChange={e => setFormPass({...formPass, password: e.target.value})}
                required
                placeholder="Mín. 8 caracteres, mayúscula, número, especial"
              />
              <PasswordStrength password={formPass.password} />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Confirmar contraseña *</label>
              <input
                type="password"
                className="form-control"
                value={formPass.confirmar}
                onChange={e => setFormPass({...formPass, confirmar: e.target.value})}
                required
              />
              {formPass.confirmar && formPass.password !== formPass.confirmar && (
                <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>✗ Las contraseñas no coinciden</p>
              )}
              {formPass.confirmar && formPass.password === formPass.confirmar && formPass.password && (
                <p style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>✓ Las contraseñas coinciden</p>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={guardandoPass}>
              {guardandoPass ? "Actualizando…" : "🔒 Cambiar contraseña"}
            </button>
          </form>
        </div>
      )}

      {/* Seguridad 2FA */}
      {tab === "seguridad" && <Seguridad2FA />}

      {/* Mis Registros */}
      {tab === "registros" && (
        <MisRegistros usuarioId={usuario?.id} />
      )}

      {/* Aclaraciones */}
      {tab === "aclaraciones" && (
        <AclaracionHorario usuarioId={usuario?.id} />
      )}
    </div>
  );
};

export default Perfil;
