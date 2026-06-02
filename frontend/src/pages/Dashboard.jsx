/**
 * Dashboard.jsx – Previta × KronOS redesign
 * Mantiene toda la lógica de API, GPS, cámara y modales del original.
 * Nuevo diseño visual con k-* classes del sistema Previta.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRegistrosHoy, crearRegistroConFoto, getSucursales, getHorarios, getAnuncios } from "../utils/api";

const MEDICO_GUARDIA_ROL = "medico_de_guardia";
const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const ETIQUETAS = {
  entrada:           { label: "Entrada",         short: "Entrada",      icon: "🟢" },
  salida_alimentos:  { label: "Salida a comer",   short: "Salida comer", icon: "🍽️" },
  regreso_alimentos: { label: "Regreso de comer", short: "Regreso",      icon: "↩️" },
  salida:            { label: "Salida final",     short: "Salida",       icon: "🔴" },
};

const ORDEN = ["entrada", "salida_alimentos", "regreso_alimentos", "salida"];

const getSaludoPorHora = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
};

const horaAMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const verificarFueraDeHorario = (horario, tipoRegistro, horaActual) => {
  if (!horario) return false;
  const mapaHoras = {
    entrada:           horario.horaEntrada,
    salida_alimentos:  horario.horaSalidaAlimentos,
    regreso_alimentos: horario.horaRegresoAlimentos,
    salida:            horario.horaSalida,
  };
  const esperada = mapaHoras[tipoRegistro];
  if (!esperada) return false;
  const tolerancia = horario.toleranciaMinutos ?? 10;
  const diffMin = horaAMin(horaActual) - horaAMin(esperada);
  return diffMin > tolerancia || diffMin < -30;
};

// ─── Live clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  const fecha = now.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="k-clock-card">
      <div className="k-clock-time">{hh}:{mm}<span style={{ fontSize: "1.2rem", opacity: 0.5 }}>:{ss}</span></div>
      <div className="k-clock-date" style={{ textTransform: "capitalize" }}>{fecha}</div>
      <div className="k-clock-gps">
        <div className="k-clock-gps-dot" />
        GPS activo
      </div>
    </div>
  );
}

// ─── Progress ring SVG ────────────────────────────────────────────────────────
function ProgressRing({ value, total }) {
  const pct = total > 0 ? value / total : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <svg width="100" height="100" className="k-ring-svg">
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e6f7a" />
          <stop offset="100%" stopColor="#77B328" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

// ─── Radar GPS component ──────────────────────────────────────────────────────
function RadarGPS() {
  return (
    <div className="k-radar">
      <div className="k-radar-ring" />
      <div className="k-radar-ring" />
      <div className="k-radar-ring" />
      <div className="k-radar-center" />
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [registrosHoy, setRegistrosHoy]           = useState([]);
  const [siguienteRegistro, setSiguienteRegistro]  = useState(null);
  const [sucursal, setSucursal]                   = useState(null);
  const [todasSucursales, setTodasSucursales]     = useState([]);
  const [horario, setHorario]                     = useState(null);
  const [anunciosList, setAnunciosList]           = useState([]);
  const [estado, setEstado]                       = useState("idle");
  const [mensaje, setMensaje]                     = useState("");
  const [modalGPSDenegado, setModalGPSDenegado]   = useState(false);

  const esMedicoGuardia = usuario?.rol === MEDICO_GUARDIA_ROL;
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState("sesion");

  const [modalFueraHorario, setModalFueraHorario]     = useState(false);
  const [motivoFueraHorario, setMotivoFueraHorario]   = useState("");
  const [coordsCache, setCoordsCache]                 = useState(null);
  const [modalFueraGeocerca, setModalFueraGeocerca]   = useState(false);
  const [motivoFueraGeocerca, setMotivoFueraGeocerca] = useState("");
  const [infoGeocerca, setInfoGeocerca]               = useState({ distancia: 0, radio: 0 });
  const [modalBloqueo, setModalBloqueo]               = useState(null);
  const [modalCamara, setModalCamara]                 = useState(false);
  const [fotoBlob, setFotoBlob]                       = useState(null);
  const [fotoBlobUrl, setFotoBlobUrl]                 = useState(null);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (modalCamara && !fotoBlob) iniciarStreamCamara();
    return () => { if (!modalCamara) detenerCamara(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCamara]);

  // ── Botón cámara del bottom nav ───────────────────────────────────────────
  // 1. Escuchar evento cuando ya estamos en /dashboard
  useEffect(() => {
    const handler = () => abrirCamara();
    window.addEventListener("kronos:abrir-camara", handler);
    return () => window.removeEventListener("kronos:abrir-camara", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Si llegamos desde otro sitio con state.abrirCamara = true
  useEffect(() => {
    if (location.state?.abrirCamara) {
      // Limpiar state para evitar re-trigger en refrescos
      navigate("/dashboard", { replace: true, state: {} });
      abrirCamara();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      const { registros, siguienteRegistro: sig } = await getRegistrosHoy();
      setRegistrosHoy(registros);
      setSiguienteRegistro(sig);
    } catch (err) {
      console.error("Error cargando registros:", err);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    getSucursales().then((lista) => {
      setTodasSucursales(lista.filter((s) => s.activa));
      if (usuario?.sucursalId) {
        setSucursal(lista.find((x) => x.id === usuario.sucursalId) || { nombre: "Corporativo" });
      } else {
        setSucursal({ nombre: "Corporativo" });
      }
    });
    if (usuario?.horarioId) {
      getHorarios().then((lista) => {
        setHorario(lista.find((h) => h.id === usuario.horarioId) || null);
      }).catch(() => {});
    }
    getAnuncios().then((r) => setAnunciosList(Array.isArray(r) ? r.slice(0, 4) : [])).catch(() => {});
  }, [cargarDatos, usuario]);

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const abrirCamara = async () => {
    setFotoBlob(null);
    if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); setFotoBlobUrl(null); }
    setModalCamara(true);
  };

  const iniciarStreamCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setModalCamara(false);
      setMensaje("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
      setEstado("error");
      setTimeout(() => setEstado("idle"), 5000);
    }
  };

  const capturarFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setFotoBlob(blob);
      const url = URL.createObjectURL(blob);
      setFotoBlobUrl(url);
      detenerCamara();
    }, "image/jpeg", 0.85);
  };

  const repetirFoto = () => {
    if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); setFotoBlobUrl(null); }
    setFotoBlob(null);
    iniciarStreamCamara();
  };

  const confirmarFotoYRegistrar = () => { setModalCamara(false); iniciarGPS(); };

  const cerrarCamara = () => {
    detenerCamara();
    if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); setFotoBlobUrl(null); }
    setFotoBlob(null);
    setModalCamara(false);
  };

  const ejecutarRegistro = async (lat, lng, foto, motivo = null, sucursalIdOverride = null, motivoGeocerca = null) => {
    setEstado("registrando");
    setMensaje("Registrando asistencia…");
    try {
      const result = await crearRegistroConFoto(lat, lng, foto, {
        ...(motivo ? { motivoFueraHorario: motivo } : {}),
        ...(motivoGeocerca ? { motivoFueraGeocerca: motivoGeocerca } : {}),
        ...(sucursalIdOverride ? { sucursalId: sucursalIdOverride } : {}),
      });
      setMensaje(result.mensaje);
      setEstado("exito");
      setFotoBlob(null);
      await cargarDatos();
      setTimeout(() => setEstado("idle"), 3000);
    } catch (err) {
      if (err.bloqueado) {
        setModalBloqueo({ categoriaBloqueo: err.categoriaBloqueo, incidenciaId: err.incidenciaId, error: err.message });
        setEstado("idle"); setMensaje(""); return;
      }
      if (err.fueraDeGeocerca) {
        setCoordsCache({ lat, lng, foto });
        setInfoGeocerca({ distancia: err.distancia || 0, radio: err.radioPermitido || 0 });
        setMotivoFueraGeocerca(""); setModalFueraGeocerca(true); setEstado("idle"); setMensaje(""); return;
      }
      setMensaje(err.message); setEstado("error");
      setTimeout(() => setEstado("idle"), 5000);
    }
  };

  const getSucursalIdParaRegistro = () => {
    if (!esMedicoGuardia) return null;
    if (ubicacionSeleccionada === "sesion") return null;
    return ubicacionSeleccionada;
  };

  const handleRegistrar = () => { abrirCamara(); };

  const iniciarGPS = () => {
    if (!navigator.geolocation) {
      setMensaje("Tu navegador no soporta geolocalización.");
      setEstado("error"); return;
    }
    setEstado("obteniendo-gps");
    setMensaje("Obteniendo tu ubicación GPS…");
    const fotoActual = fotoBlob;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const horaActual = new Date().toTimeString().slice(0, 5);
        if (siguienteRegistro && verificarFueraDeHorario(horario, siguienteRegistro, horaActual)) {
          setCoordsCache({ lat: latitude, lng: longitude, foto: fotoActual });
          setMotivoFueraHorario(""); setModalFueraHorario(true); setEstado("idle"); setMensaje(""); return;
        }
        await ejecutarRegistro(latitude, longitude, fotoActual, null, getSucursalIdParaRegistro());
      },
      (err) => {
        if (err.code === 1) { setModalGPSDenegado(true); setEstado("idle"); }
        else {
          setMensaje(err.code === 2 ? "No se pudo determinar tu ubicación." : "Tiempo de espera agotado.");
          setEstado("error"); setTimeout(() => setEstado("idle"), 6000);
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmarConMotivo = async () => {
    if (!motivoFueraHorario.trim()) return;
    setModalFueraHorario(false);
    if (coordsCache) {
      await ejecutarRegistro(coordsCache.lat, coordsCache.lng, coordsCache.foto, motivoFueraHorario.trim(), getSucursalIdParaRegistro());
      setCoordsCache(null);
    }
  };

  const confirmarFueraGeocerca = async () => {
    if (!motivoFueraGeocerca.trim()) return;
    setModalFueraGeocerca(false);
    if (coordsCache) {
      await ejecutarRegistro(coordsCache.lat, coordsCache.lng, coordsCache.foto, null, getSucursalIdParaRegistro(), motivoFueraGeocerca.trim());
      setCoordsCache(null);
    }
  };

  const progreso = registrosHoy.length;
  const fechaHoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Horario slots
  const horarioSlots = horario ? [
    { label: "Entrada",      value: horario.horaEntrada },
    { label: "Salida comer", value: horario.horaSalidaAlimentos },
    { label: "Regreso",      value: horario.horaRegresoAlimentos },
    { label: "Salida final", value: horario.horaSalida },
  ] : [];

  // Asistencia % (placeholder for now — could come from API)
  const asistenciaPct = progreso > 0 ? Math.round((progreso / 4) * 100) : 0;

  // Anuncio icon colors
  const anuncioColors = ["rgba(30,111,122,0.12)", "rgba(119,179,40,0.12)", "rgba(184,134,11,0.12)", "rgba(192,85,107,0.12)"];

  return (
    <div className="page" style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="k-page-head">
        <div>
          <div className="k-eyebrow">
            <span>📅</span>
            <span style={{ textTransform: "capitalize" }}>{fechaHoy}</span>
          </div>
          <h1 className="k-h1">{getSaludoPorHora()}, {usuario?.nombre}</h1>
          <p className="k-sub">
            {usuario?.puestoNombre || usuario?.puesto || "Colaborador"}
            {sucursal?.nombre ? ` · ${sucursal.nombre}` : (esMedicoGuardia ? " · Médico de Guardia" : "")}
          </p>
        </div>
        <LiveClock />
      </div>

      {/* ── 2-column grid ─────────────────────────────────────────────────── */}
      <div className="k-dash-grid">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Progress card */}
          <div className="k-card">
            <div className="k-ring-wrap">
              <ProgressRing value={progreso} total={4} />
              <div className="k-ring-info">
                <div className="k-ring-pct">{progreso}<span style={{ fontSize: "1.2rem", color: "var(--ink-3)", fontWeight: 400 }}>/4</span></div>
                <div className="k-ring-sub">Registros completados hoy</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="k-timeline">
              {ORDEN.map((tipo, i) => {
                const reg = registrosHoy.find((r) => r.tipo === tipo);
                const { label, short } = ETIQUETAS[tipo];
                const isDone = !!reg;
                const isNext = !isDone && i === progreso;
                const isPending = !isDone && !isNext;

                const metaText = horario && !reg && isNext
                  ? `Esperado ${[horario.horaEntrada, horario.horaSalidaAlimentos, horario.horaRegresoAlimentos, horario.horaSalida][i] || "—"} ±${horario.toleranciaMinutos ?? 10}m`
                  : isDone ? label : "";

                return (
                  <div key={tipo} className="k-tl-item">
                    <div className={`k-tl-dot ${isDone ? "k-tl-dot-done" : isNext ? "k-tl-dot-next" : "k-tl-dot-pending"}`} />
                    <span className="k-tl-label" style={{ opacity: isPending ? 0.4 : 1 }}>
                      {short}
                    </span>
                    {metaText && <span className="k-tl-meta">{metaText}</span>}
                    {reg && <span className="k-tl-time">{reg.hora?.slice(0, 5)}</span>}
                    {isNext && !reg && (
                      <span className="k-tag k-tag-teal" style={{ fontSize: "0.68rem" }}>Pendiente</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats row */}
          <div className="k-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="k-card-head">
              <span className="k-card-title">Semana en cifras</span>
            </div>
            <div className="k-stats-row">
              <div className="k-stats-cell">
                <div className="k-stat">
                  <div className="k-stat-value" style={{ color: "var(--teal)" }}>{asistenciaPct}%</div>
                  <div className="k-stat-label">Asistencia</div>
                </div>
              </div>
              <div className="k-stats-cell">
                <div className="k-stat">
                  <div className="k-stat-value">
                    {horario
                      ? (() => {
                          const e = horaAMin(horario.horaEntrada);
                          const s = horaAMin(horario.horaSalida);
                          if (e !== null && s !== null) {
                            const hrs = Math.round((s - e) / 60 * 10) / 10;
                            return `${hrs}h`;
                          }
                          return "—";
                        })()
                      : "—"
                    }
                  </div>
                  <div className="k-stat-label">Jornada</div>
                </div>
              </div>
              <div className="k-stats-cell">
                <div className="k-stat">
                  <div className="k-stat-value" style={{ color: "var(--green-deep)" }}>
                    {progreso === 0 ? "—" : "100%"}
                  </div>
                  <div className="k-stat-label">Puntualidad</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="k-dash-right" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Action card */}
          {progreso < 4 ? (
            <div className="k-action-card">
              <div className="k-action-eyebrow">Siguiente registro</div>
              {siguienteRegistro ? (
                <>
                  <div className="k-action-title">
                    {ETIQUETAS[siguienteRegistro]?.label}
                  </div>

                  {/* Selector de ubicación para médico de guardia */}
                  {esMedicoGuardia && (
                    <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                      <p style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>
                        🏥 ¿Dónde te vas a reportar?
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 7, background: ubicacionSeleccionada === "sesion" ? "rgba(119,179,40,0.2)" : "transparent", border: ubicacionSeleccionada === "sesion" ? "1px solid rgba(119,179,40,0.5)" : "1px solid transparent", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
                          <input type="radio" name="ubicacion_guardia" value="sesion" checked={ubicacionSeleccionada === "sesion"} onChange={() => setUbicacionSeleccionada("sesion")} />
                          🏛️ Corporativo {sucursal ? `(${sucursal.nombre})` : ""}
                        </label>
                        {todasSucursales.filter((s) => s.id !== usuario?.sucursalId).map((s) => (
                          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 7, background: ubicacionSeleccionada === s.id ? "rgba(119,179,40,0.2)" : "transparent", border: ubicacionSeleccionada === s.id ? "1px solid rgba(119,179,40,0.5)" : "1px solid transparent", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
                            <input type="radio" name="ubicacion_guardia" value={s.id} checked={ubicacionSeleccionada === s.id} onChange={() => setUbicacionSeleccionada(s.id)} />
                            🏢 {s.nombre} — {s.ciudad}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {mensaje && (
                    <div className={`alert ${estado === "exito" ? "alert-success" : estado === "error" ? "alert-error" : "alert-info"}`} style={{ marginBottom: 14, fontSize: "0.85rem" }}>
                      {mensaje}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button
                      className="k-btn k-btn-primary k-btn-xl"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={handleRegistrar}
                      disabled={estado === "obteniendo-gps" || estado === "registrando"}
                    >
                      {estado === "obteniendo-gps" && "📡 Obteniendo GPS…"}
                      {estado === "registrando" && "⏳ Registrando…"}
                      {(estado === "idle" || estado === "exito" || estado === "error") && "📷 Tomar foto y registrar"}
                    </button>
                    <RadarGPS />
                  </div>

                  {(() => {
                    const sucursalActual = esMedicoGuardia && ubicacionSeleccionada !== "sesion"
                      ? todasSucursales.find((s) => s.id === ubicacionSeleccionada)
                      : sucursal;
                    return sucursalActual?.geocerca?.radio ? (
                      <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginTop: 10, textAlign: "center" }}>
                        📍 Debes estar dentro de {sucursalActual.geocerca.radio}m de la sucursal
                      </p>
                    ) : null;
                  })()}
                </>
              ) : (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>Cargando…</p>
              )}
            </div>
          ) : (
            <div className="k-complete-card">
              <div style={{ fontSize: "2.8rem" }}>🎉</div>
              <div className="k-complete-title">¡Jornada completa!</div>
              <p style={{ color: "var(--ink-3)", fontSize: "0.875rem" }}>Has completado los 4 registros del día. ¡Hasta mañana!</p>
            </div>
          )}

          {/* Schedule card */}
          {horario && (
            <div className="k-card" style={{ padding: 0 }}>
              <div className="k-card-head">
                <span className="k-card-title">Tu horario hoy</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-3)" }}>±{horario.toleranciaMinutos ?? 10} min tolerancia</span>
              </div>
              <div className="k-schedule-grid">
                {horarioSlots.filter((s) => s.value).map(({ label, value }) => (
                  <div key={label} className="k-schedule-slot">
                    <div className="k-schedule-slot-label">{label}</div>
                    <div className="k-schedule-slot-time">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Announcements card */}
          {anunciosList.length > 0 && (
            <div className="k-card" style={{ padding: 0 }}>
              <div className="k-card-head">
                <span className="k-card-title">Anuncios</span>
                <span className="k-tag k-tag-teal">{anunciosList.length}</span>
              </div>
              <div>
                {anunciosList.map((a, i) => (
                  <div key={a.id} className="k-anuncio">
                    <div className="k-anuncio-icon" style={{ background: anuncioColors[i % anuncioColors.length] }}>
                      📢
                    </div>
                    <div>
                      <div className="k-anuncio-title">{a.titulo}</div>
                      <div className="k-anuncio-text">{a.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info: solo-hoy */}
          <div style={{ background: "rgba(30,111,122,0.06)", border: "1px solid rgba(30,111,122,0.15)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "0.8rem", color: "var(--teal)" }}>
            ℹ️ Los registros solo aplican para el día de <strong>hoy</strong>.
          </div>
        </div>
      </div>


      {/* ── Modal: cámara ──────────────────────────────────────────────────── */}
      {modalCamara && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📷 Tomar foto para el registro</h2>
              <button className="modal-close" onClick={cerrarCamara}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {!fotoBlobUrl ? (
                <>
                  <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", marginBottom: 14, aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(119,179,40,0.6)", borderRadius: 10, pointerEvents: "none" }} />
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 16 }}>Asegúrate de que tu rostro sea visible antes de capturar.</p>
                  <button className="btn btn-primary btn-xl" onClick={capturarFoto} style={{ width: "100%" }}>📸 Capturar foto</button>
                </>
              ) : (
                <>
                  <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                    <img src={fotoBlobUrl} alt="Foto capturada" style={{ width: "100%", borderRadius: 10, display: "block" }} />
                    <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(119,179,40,0.9)", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: "0.78rem", fontWeight: 700 }}>✓ Foto lista</div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-secondary" onClick={repetirFoto} style={{ flex: 1 }}>🔄 Repetir</button>
                    <button className="btn btn-primary" onClick={confirmarFotoYRegistrar} style={{ flex: 2 }}>✅ Confirmar y registrar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: fuera de geocerca ─────────────────────────────────────────── */}
      {modalFueraGeocerca && (
        <div className="modal-overlay" onClick={() => { setModalFueraGeocerca(false); setCoordsCache(null); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📍 Fuera de la geocerca</h2>
              <button className="modal-close" onClick={() => { setModalFueraGeocerca(false); setCoordsCache(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                Tu ubicación está a <strong>{infoGeocerca.distancia}m</strong> del centro de la sucursal (radio permitido: <strong>{infoGeocerca.radio}m</strong>). Puedes continuar indicando el motivo.
              </div>
              <div className="form-group">
                <label>Motivo del registro fuera de geocerca *</label>
                <textarea className="form-control" rows={4} value={motivoFueraGeocerca} onChange={(e) => setMotivoFueraGeocerca(e.target.value)} placeholder="Ej: GPS impreciso en interior, trabajando en otra ubicación autorizada…" autoFocus />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setModalFueraGeocerca(false); setCoordsCache(null); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmarFueraGeocerca} disabled={!motivoFueraGeocerca.trim()}>Continuar y registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: fuera de horario ──────────────────────────────────────────── */}
      {modalFueraHorario && (
        <div className="modal-overlay" onClick={() => { setModalFueraHorario(false); setCoordsCache(null); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Registro fuera de horario</h2>
              <button className="modal-close" onClick={() => { setModalFueraHorario(false); setCoordsCache(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                Este registro se está realizando <strong>fuera del horario establecido</strong>
                {horario && (
                  <span>{" "}(esperado: <strong>{[horario.horaEntrada, horario.horaSalidaAlimentos, horario.horaRegresoAlimentos, horario.horaSalida][ORDEN.indexOf(siguienteRegistro)] || "—"}</strong> ±{horario.toleranciaMinutos ?? 10} min)</span>
                )}. Por favor indica el motivo.
              </div>
              <div className="form-group">
                <label>Motivo del registro fuera de horario *</label>
                <textarea className="form-control" rows={4} value={motivoFueraHorario} onChange={(e) => setMotivoFueraHorario(e.target.value)} placeholder="Ej: Tráfico en la ciudad, cita médica previa, autorización del supervisor…" autoFocus />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setModalFueraHorario(false); setCoordsCache(null); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmarConMotivo} disabled={!motivoFueraHorario.trim()}>Continuar y registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: bloqueo por incidencia ───────────────────────────────────── */}
      {modalBloqueo && (
        <div className="modal-overlay" onClick={() => setModalBloqueo(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: "3px solid var(--danger)" }}>
              <h2>🚫 Registro Bloqueado</h2>
              <button className="modal-close" onClick={() => setModalBloqueo(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {modalBloqueo.categoriaBloqueo === "vacaciones" ? "🏖️" : modalBloqueo.categoriaBloqueo === "incapacidad" ? "🩺" : "📋"}
              </div>
              <h3 style={{ marginBottom: 8 }}>
                {modalBloqueo.categoriaBloqueo === "vacaciones" && "Estás en período de vacaciones"}
                {modalBloqueo.categoriaBloqueo === "incapacidad" && "Tienes una incapacidad activa"}
                {modalBloqueo.categoriaBloqueo === "falta" && "Tienes una falta registrada"}
                {!modalBloqueo.categoriaBloqueo && "Tienes una incidencia activa"}
              </h3>
              <p style={{ color: "var(--text2)", fontSize: 14 }}>
                {modalBloqueo.error || "No puedes registrar asistencia mientras tienes una incidencia aprobada activa."}
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => setModalBloqueo(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: GPS denegado ─────────────────────────────────────────────── */}
      {modalGPSDenegado && (
        <div className="modal-overlay" onClick={() => setModalGPSDenegado(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>📍 Permiso de ubicación requerido</h3>
            </div>
            <div className="modal-body" style={{ padding: "20px 24px" }}>
              <p style={{ marginBottom: 16, color: "var(--text2)", fontSize: 14 }}>
                Para registrar tu asistencia necesitamos acceder a tu ubicación GPS. Parece que tu navegador tiene el permiso bloqueado. Sigue estos pasos:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { t: "🌐 Chrome / Edge", d: "Haz clic en el ícono 🔒 en la barra de direcciones → Permisos del sitio → Ubicación → Permitir" },
                  { t: "🦊 Firefox", d: "Haz clic en el ícono 🔒 → Permisos de conexión → Acceder a tu ubicación → Permitir siempre" },
                  { t: "🍎 Safari (Mac / iPhone)", d: "Configuración → Safari → Ubicación → Preguntar o Permitir" },
                ].map(({ t, d }) => (
                  <div key={t} style={{ padding: "12px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>{t}</strong>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 16, fontSize: 13, color: "var(--text2)" }}>
                Después de habilitar el permiso, <strong>recarga la página</strong> e intenta nuevamente.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalGPSDenegado(false)}>Entendido</button>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>🔄 Recargar página</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
