/**
 * Dashboard.jsx
 * Panel principal del sistema.
 * - Muestra el estado de registros del día del usuario.
 * - Permite realizar el siguiente registro usando GPS.
 * - Sólo permite registros del día de hoy.
 * - Si el registro cae fuera del horario + tolerancia, solicita motivo.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getRegistrosHoy, crearRegistroConFoto, getSucursales, getHorarios } from "../utils/api";

const MEDICO_GUARDIA_ROL = "medico_de_guardia";

import { SERVER_URL as BASE } from "../utils/config.js";

const ETIQUETAS = {
  entrada:           { label: "Entrada",         icon: "🟢" },
  salida_alimentos:  { label: "Salida a comer",   icon: "🍽️" },
  regreso_alimentos: { label: "Regreso de comer", icon: "↩️" },
  salida:            { label: "Salida final",     icon: "🔴" },
};

const ORDEN = ["entrada", "salida_alimentos", "regreso_alimentos", "salida"];

const getSaludoPorHora = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
};

/** Convierte "HH:MM" a minutos desde medianoche */
const horaAMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Comprueba si horaActual "HH:MM" está fuera del horario esperado para tipoRegistro */
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
  // Fuera si llega tarde más allá de tolerancia, o muy temprano (> 30 min antes)
  return diffMin > tolerancia || diffMin < -30;
};

const Dashboard = () => {
  const { usuario } = useAuth();

  const [registrosHoy, setRegistrosHoy]         = useState([]);
  const [siguienteRegistro, setSiguienteRegistro] = useState(null);
  const [sucursal, setSucursal]                 = useState(null);
  const [todasSucursales, setTodasSucursales]   = useState([]);
  const [horario, setHorario]                   = useState(null);
  const [estado, setEstado]                     = useState("idle");
  const [mensaje, setMensaje]                   = useState("");
  const [modalGPSDenegado, setModalGPSDenegado] = useState(false);

  // Médico de guardia: ubicación seleccionada para registrar
  const esMedicoGuardia = usuario?.rol === MEDICO_GUARDIA_ROL;
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState("sesion"); // "sesion" | sucursalId

  // Modal fuera de horario
  const [modalFueraHorario, setModalFueraHorario] = useState(false);
  const [motivoFueraHorario, setMotivoFueraHorario] = useState("");
  const [coordsCache, setCoordsCache]           = useState(null); // guarda lat/lng mientras espera motivo

  // Modal fuera de geocerca
  const [modalFueraGeocerca, setModalFueraGeocerca] = useState(false);
  const [motivoFueraGeocerca, setMotivoFueraGeocerca] = useState("");
  const [infoGeocerca, setInfoGeocerca]           = useState({ distancia: 0, radio: 0 });

  // Modal bloqueo por incidencia activa (vacaciones/incapacidad/falta)
  const [modalBloqueo, setModalBloqueo] = useState(null); // { categoriaBloqueo, incidenciaId, error }

  // Modal cámara
  const [modalCamara, setModalCamara]       = useState(false);
  const [fotoBlob, setFotoBlob]             = useState(null);   // Blob listo para enviar
  const [fotoBlobUrl, setFotoBlobUrl]       = useState(null);   // URL temporal para preview
  const videoRef                            = useRef(null);
  const canvasRef                           = useRef(null);
  const streamRef                           = useRef(null);     // guarda el MediaStream activo

  // Iniciar/detener stream cuando se abre/cierra el modal de cámara
  useEffect(() => {
    if (modalCamara && !fotoBlob) {
      iniciarStreamCamara();
    }
    return () => {
      if (!modalCamara) detenerCamara();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCamara]);

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
        // Usuario sin sucursal asignada (corporativo/admin)
        setSucursal({ nombre: "Corporativo" });
      }
    });
    // Cargar horario del usuario
    if (usuario?.horarioId) {
      getHorarios().then((lista) => {
        setHorario(lista.find((h) => h.id === usuario.horarioId) || null);
      }).catch(() => {});
    }
  }, [cargarDatos, usuario]);

  /** Detiene el stream de la cámara y limpia recursos */
  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  /** Abre el modal de cámara e inicia el stream */
  const abrirCamara = async () => {
    setFotoBlob(null);
    if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); setFotoBlobUrl(null); }
    setModalCamara(true);
  };

  /** Llamado por useEffect cuando el modal de cámara se abre */
  const iniciarStreamCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setModalCamara(false);
      setMensaje("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
      setEstado("error");
      setTimeout(() => setEstado("idle"), 5000);
    }
  };

  /** Captura el frame actual del video en el canvas */
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

  /** Repite la captura: limpia la foto y reinicia el stream */
  const repetirFoto = () => {
    if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); setFotoBlobUrl(null); }
    setFotoBlob(null);
    iniciarStreamCamara();
  };

  /** Confirma la foto y cierra el modal de cámara para continuar con GPS */
  const confirmarFotoYRegistrar = () => {
    setModalCamara(false);
    iniciarGPS();
  };

  /** Cierra el modal de cámara sin registrar */
  const cerrarCamara = () => {
    detenerCamara();
    if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); setFotoBlobUrl(null); }
    setFotoBlob(null);
    setModalCamara(false);
  };

  /** Ejecuta el registro con las coordenadas ya obtenidas */
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
      // Si el registro está bloqueado por incidencia activa
      if (err.bloqueado) {
        setModalBloqueo({
          categoriaBloqueo: err.categoriaBloqueo,
          incidenciaId: err.incidenciaId,
          error: err.message,
        });
        setEstado("idle");
        setMensaje("");
        return;
      }
      // Si el error es por geocerca, mostrar modal para pedir motivo
      if (err.fueraDeGeocerca) {
        setCoordsCache({ lat, lng, foto });
        setInfoGeocerca({ distancia: err.distancia || 0, radio: err.radioPermitido || 0 });
        setMotivoFueraGeocerca("");
        setModalFueraGeocerca(true);
        setEstado("idle");
        setMensaje("");
        return;
      }
      setMensaje(err.message);
      setEstado("error");
      setTimeout(() => setEstado("idle"), 5000);
    }
  };

  /** Devuelve el sucursalId a usar para el registro actual (médico de guardia) */
  const getSucursalIdParaRegistro = () => {
    if (!esMedicoGuardia) return null;
    if (ubicacionSeleccionada === "sesion") return null; // usa la de sesión en el backend
    return ubicacionSeleccionada;
  };

  /** Paso 1: click en "Registrar" → abre el modal de cámara */
  const handleRegistrar = () => {
    abrirCamara();
  };

  /** Paso 2: después de confirmar foto → obtener GPS y registrar */
  const iniciarGPS = () => {
    if (!navigator.geolocation) {
      setMensaje("Tu navegador no soporta geolocalización.");
      setEstado("error");
      return;
    }
    setEstado("obteniendo-gps");
    setMensaje("Obteniendo tu ubicación GPS…");

    const fotoActual = fotoBlob; // capturar referencia antes del callback asíncrono

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const horaActual = new Date().toTimeString().slice(0, 5);

        // ── Verificar si está fuera de horario ──────────────────────────────
        if (siguienteRegistro && verificarFueraDeHorario(horario, siguienteRegistro, horaActual)) {
          setCoordsCache({ lat: latitude, lng: longitude, foto: fotoActual });
          setMotivoFueraHorario("");
          setModalFueraHorario(true);
          setEstado("idle");
          setMensaje("");
          return;
        }

        await ejecutarRegistro(latitude, longitude, fotoActual, null, getSucursalIdParaRegistro());
      },
      (err) => {
        if (err.code === 1) {
          // Permiso denegado — mostrar modal con instrucciones
          setModalGPSDenegado(true);
          setEstado("idle");
        } else {
          setMensaje(
            err.code === 2
              ? "No se pudo determinar tu ubicación. Asegúrate de tener señal GPS o Wi-Fi activo."
              : "Tiempo de espera agotado al obtener tu ubicación. Inténtalo de nuevo."
          );
          setEstado("error");
          setTimeout(() => setEstado("idle"), 6000);
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{getSaludoPorHora()}, {usuario?.nombre} 👋</h1>
          <p className="subtitle">
            {usuario?.puestoNombre || usuario?.puesto || "Colaborador"} · {sucursal?.nombre || (esMedicoGuardia ? "Médico de Guardia" : "Cargando sucursal…")}
          </p>
          {/* Mejora 1: aviso "solo hoy" */}
          <p className="fecha-hoy" style={{ marginTop: 4, color: "var(--accent)" }}>
            📅 {fechaHoy}
          </p>
        </div>
      </div>

      {/* Aviso de solo-hoy */}
      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: "0.85rem" }}>
        ℹ️ Los registros de asistencia sólo aplican para el día de <strong>hoy</strong>. No es posible registrar días anteriores o futuros.
      </div>

      {/* Progreso del día */}
      <div className="card">
        <h2 className="card-title">Progreso del día</h2>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${(progreso / 4) * 100}%` }} />
        </div>
        <p className="progress-text">{progreso} / 4 registros completados</p>

        <div className="timeline">
          {ORDEN.map((tipo, i) => {
            const reg = registrosHoy.find((r) => r.tipo === tipo);
            const { label, icon } = ETIQUETAS[tipo];
            return (
              <div key={tipo} className={`timeline-item ${reg ? "done" : i === progreso ? "next" : "pending"}`}>
                <div className="timeline-icon">{reg ? "✅" : icon}</div>
                <div className="timeline-info">
                  <span className="timeline-label">{label}</span>
                  {reg && <span className="timeline-hora">{reg.hora?.slice(0,5)}</span>}
                  {horario && !reg && i === progreso && (
                    <span style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                      esperado: {[horario.horaEntrada, horario.horaSalidaAlimentos, horario.horaRegresoAlimentos, horario.horaSalida][i] || "—"}
                      {" "}±{horario.toleranciaMinutos ?? 10} min
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botón de registro */}
      {siguienteRegistro && (
        <div className="card card-register">
          <h2 className="card-title">Siguiente registro</h2>
          <div className="next-register">
            <span className="next-icon">{ETIQUETAS[siguienteRegistro]?.icon}</span>
            <span className="next-label">{ETIQUETAS[siguienteRegistro]?.label}</span>
          </div>

          {/* Selector de ubicación para médico de guardia */}
          {esMedicoGuardia && (
            <div className="medico-guardia-location" style={{ margin: "12px 0", padding: "12px 14px", background: "var(--bg3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <p style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.9rem" }}>
                🏥 ¿Dónde te vas a reportar?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: ubicacionSeleccionada === "sesion" ? "var(--accent)" + "22" : "transparent", border: ubicacionSeleccionada === "sesion" ? "1px solid var(--accent)" : "1px solid transparent" }}>
                  <input
                    type="radio"
                    name="ubicacion_guardia"
                    value="sesion"
                    checked={ubicacionSeleccionada === "sesion"}
                    onChange={() => setUbicacionSeleccionada("sesion")}
                  />
                  🏛️ Corporativo {sucursal ? `(${sucursal.nombre})` : ""}
                </label>
                {todasSucursales.filter((s) => s.id !== usuario?.sucursalId).map((s) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: ubicacionSeleccionada === s.id ? "var(--accent)" + "22" : "transparent", border: ubicacionSeleccionada === s.id ? "1px solid var(--accent)" : "1px solid transparent" }}>
                    <input
                      type="radio"
                      name="ubicacion_guardia"
                      value={s.id}
                      checked={ubicacionSeleccionada === s.id}
                      onChange={() => setUbicacionSeleccionada(s.id)}
                    />
                    🏢 {s.nombre} — {s.ciudad}
                  </label>
                ))}
              </div>
            </div>
          )}

          {mensaje && (
            <div className={`alert ${estado === "exito" ? "alert-success" : estado === "error" ? "alert-error" : "alert-info"}`}>
              {mensaje}
            </div>
          )}

          <button
            className="btn btn-primary btn-xl"
            onClick={handleRegistrar}
            disabled={estado === "obteniendo-gps" || estado === "registrando"}
          >
            {estado === "obteniendo-gps" && "📡 Obteniendo GPS…"}
            {estado === "registrando" && "⏳ Registrando…"}
            {(estado === "idle" || estado === "exito" || estado === "error") &&
              `Registrar ${ETIQUETAS[siguienteRegistro]?.label}`}
          </button>

          {(() => {
            const sucursalActual = esMedicoGuardia && ubicacionSeleccionada !== "sesion"
              ? todasSucursales.find((s) => s.id === ubicacionSeleccionada)
              : sucursal;
            return (
              <p className="geocerca-info">
                📍 Debes estar dentro de <strong>{sucursalActual?.geocerca?.radio || "…"}m</strong> de la sucursal para registrar.
              </p>
            );
          })()}
        </div>
      )}

      {progreso === 4 && (
        <div className="card card-completo">
          <div className="completo-icon">🎉</div>
          <h2>¡Jornada completa!</h2>
          <p>Has completado los 4 registros del día. ¡Hasta mañana!</p>
        </div>
      )}

      {/* ── Modal: cámara ─────────────────────────────────────────────────── */}
      {modalCamara && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📷 Tomar foto para el registro</h2>
              <button className="modal-close" onClick={cerrarCamara}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              {/* Canvas oculto para captura */}
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {!fotoBlobUrl ? (
                /* ── Vista previa de la cámara ── */
                <>
                  <div style={{
                    position: "relative", borderRadius: 10, overflow: "hidden",
                    background: "#000", marginBottom: 14,
                    aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {/* Marco guía */}
                    <div style={{
                      position: "absolute", inset: 0, border: "2px solid rgba(119,179,40,0.6)",
                      borderRadius: 10, pointerEvents: "none",
                    }} />
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 16 }}>
                    Asegúrate de que tu rostro sea visible antes de capturar.
                  </p>
                  <button className="btn btn-primary btn-xl" onClick={capturarFoto} style={{ width: "100%" }}>
                    📸 Capturar foto
                  </button>
                </>
              ) : (
                /* ── Preview de la foto capturada ── */
                <>
                  <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                    <img
                      src={fotoBlobUrl}
                      alt="Foto capturada"
                      style={{ width: "100%", borderRadius: 10, display: "block" }}
                    />
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      background: "rgba(119,179,40,0.9)", color: "#fff",
                      borderRadius: 20, padding: "2px 10px", fontSize: "0.78rem", fontWeight: 700,
                    }}>
                      ✓ Foto lista
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-secondary" onClick={repetirFoto} style={{ flex: 1 }}>
                      🔄 Repetir
                    </button>
                    <button className="btn btn-primary" onClick={confirmarFotoYRegistrar} style={{ flex: 2 }}>
                      ✅ Confirmar y registrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: fuera de geocerca ───────────────────────────────────────── */}
      {modalFueraGeocerca && (
        <div className="modal-overlay" onClick={() => { setModalFueraGeocerca(false); setCoordsCache(null); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📍 Fuera de la geocerca</h2>
              <button className="modal-close" onClick={() => { setModalFueraGeocerca(false); setCoordsCache(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                Tu ubicación está a <strong>{infoGeocerca.distancia}m</strong> del centro de la sucursal
                (radio permitido: <strong>{infoGeocerca.radio}m</strong>).
                Puedes continuar indicando el motivo por el que registras fuera de la geocerca.
              </div>
              <div className="form-group">
                <label>Motivo del registro fuera de geocerca *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={motivoFueraGeocerca}
                  onChange={(e) => setMotivoFueraGeocerca(e.target.value)}
                  placeholder="Ej: GPS impreciso en interior, trabajando en otra ubicación autorizada, señal débil…"
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setModalFueraGeocerca(false); setCoordsCache(null); }}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmarFueraGeocerca}
                  disabled={!motivoFueraGeocerca.trim()}
                >
                  Continuar y registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: fuera de horario ────────────────────────────────────────── */}
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
                  <span>
                    {" "}(esperado: <strong>
                      {[horario.horaEntrada, horario.horaSalidaAlimentos, horario.horaRegresoAlimentos, horario.horaSalida][
                        ORDEN.indexOf(siguienteRegistro)
                      ] || "—"}
                    </strong> ±{horario.toleranciaMinutos ?? 10} min)
                  </span>
                )}
                . Por favor indica el motivo.
              </div>

              <div className="form-group">
                <label>Motivo del registro fuera de horario *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={motivoFueraHorario}
                  onChange={(e) => setMotivoFueraHorario(e.target.value)}
                  placeholder="Ej: Tráfico en la ciudad, cita médica previa, autorización del supervisor…"
                  autoFocus
                />
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setModalFueraHorario(false); setCoordsCache(null); }}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmarConMotivo}
                  disabled={!motivoFueraHorario.trim()}
                >
                  Continuar y registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: bloqueo por incidencia activa ───────────────────────────── */}
      {modalBloqueo && (
        <div className="modal-overlay" onClick={() => setModalBloqueo(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: "3px solid var(--danger)" }}>
              <h2>🚫 Registro Bloqueado</h2>
              <button className="modal-close" onClick={() => setModalBloqueo(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {modalBloqueo.categoriaBloqueo === "vacaciones" ? "🏖️" :
                 modalBloqueo.categoriaBloqueo === "incapacidad" ? "🩺" : "📋"}
              </div>
              <h3 style={{ marginBottom: 8 }}>
                {modalBloqueo.categoriaBloqueo === "vacaciones" && "Estás en período de vacaciones"}
                {modalBloqueo.categoriaBloqueo === "incapacidad" && "Tienes una incapacidad activa"}
                {modalBloqueo.categoriaBloqueo === "falta" && "Tienes una falta registrada"}
                {!modalBloqueo.categoriaBloqueo && "Tienes una incidencia activa"}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {modalBloqueo.error || "No puedes registrar asistencia mientras tienes una incidencia aprobada activa."}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                Tu supervisor ha sido notificado de este intento de registro.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => setModalBloqueo(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: GPS denegado ────────────────────────────────────────── */}
      {modalGPSDenegado && (
        <div className="modal-overlay" onClick={() => setModalGPSDenegado(false)}>
          <div className="modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                📍 Permiso de ubicación requerido
              </h3>
            </div>
            <div className="modal-body" style={{ padding: "20px 24px" }}>
              <p style={{ marginBottom: 16, color: "var(--text2)", fontSize: 14 }}>
                Para registrar tu asistencia necesitamos acceder a tu ubicación GPS.
                Parece que tu navegador tiene el permiso bloqueado. Sigue estos pasos:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "12px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>🌐 Chrome / Edge</strong>
                  <span>Haz clic en el ícono 🔒 en la barra de direcciones → Permisos del sitio → Ubicación → <strong>Permitir</strong></span>
                </div>
                <div style={{ padding: "12px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>🦊 Firefox</strong>
                  <span>Haz clic en el ícono 🔒 → Permisos de conexión → Acceder a tu ubicación → <strong>Permitir siempre</strong></span>
                </div>
                <div style={{ padding: "12px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>🍎 Safari (Mac / iPhone)</strong>
                  <span>Configuración → Safari → Ubicación → <strong>Preguntar</strong> o <strong>Permitir</strong></span>
                </div>
                <div style={{ padding: "12px 14px", background: "#fffbeb", borderRadius: 8, fontSize: 13, border: "1px solid #fde68a" }}>
                  <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>📱 Dispositivo móvil</strong>
                  <span style={{ color: "#92400e" }}>Verifica en Ajustes → Privacidad → Ubicación que el navegador tenga permiso activo.</span>
                </div>
              </div>

              <p style={{ marginTop: 16, fontSize: 13, color: "var(--text2)" }}>
                Después de habilitar el permiso, <strong>recarga la página</strong> e intenta nuevamente.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalGPSDenegado(false)}>
                Entendido
              </button>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                🔄 Recargar página
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
