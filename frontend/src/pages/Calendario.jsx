/**
 * Calendario.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista mensual de incidencias autorizadas.
 * Dos vistas: "sucursales" (por sucursal) y "corporativo" (sede corporativa).
 * Muestra: vacaciones, incapacidades, incidencias y faltas aprobadas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getCalendario, getSucursales } from "../utils/api";

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// Colores para cada tipo de incidencia
const TIPO_COLORES = {
  vacaciones:  { bg: "#3b82f618", border: "#3b82f6", text: "#1d4ed8", badge: "#3b82f6", label: "Vacaciones",  icon: "🏖️" },
  incapacidad: { bg: "#f59e0b18", border: "#f59e0b", text: "#92400e", badge: "#d97706", label: "Incapacidad", icon: "🩺" },
  falta:       { bg: "#ef444418", border: "#ef4444", text: "#991b1b", badge: "#ef4444", label: "Falta",       icon: "❌" },
  incidencia:  { bg: "#8b5cf618", border: "#8b5cf6", text: "#5b21b6", badge: "#7c3aed", label: "Incidencia",  icon: "⚠️" },
};

const TIPOS_ORDEN = ["vacaciones", "incapacidad", "falta", "incidencia"];

const hoyDate = new Date();
const hoyStr = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth()+1).padStart(2,"0")}-${String(hoyDate.getDate()).padStart(2,"0")}`;

/**
 * Clasifica el estado de un empleado en el calendario.
 * Prioridad: vacaciones > incapacidad > falta > incidencia
 */
const categorizarEmpleado = (emp) => {
  if (emp.estaVacaciones)   return "vacaciones";
  if (emp.estaIncapacitado) return "incapacidad";
  if (emp.estaAusente)      return "falta";
  if (emp.tieneIncidencia)  return "incidencia";
  return null;
};

const Calendario = () => {
  const { usuario } = useAuth();
  const [anio, setAnio]             = useState(hoyDate.getFullYear());
  const [mes, setMes]               = useState(hoyDate.getMonth());     // 0-indexed
  const [vista, setVista]           = useState("sucursales");            // "sucursales" | "corporativo"
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState("");
  const [calData, setCalData]       = useState({});   // { "YYYY-MM-DD": empleados[] }
  const [cargando, setCargando]     = useState(false);
  const [diaDetalle, setDiaDetalle] = useState(null); // { fecha, empleados[] }
  const [error, setError]           = useState("");

  // Cargar sucursales activas (excluir corporativo para el select)
  useEffect(() => {
    getSucursales()
      .then((lista) => {
        const activas = lista.filter((s) => s.activa);
        const regulares = activas.filter((s) => s.tipo !== "corporativo");
        const paraSelector = regulares.length > 0 ? regulares : activas;
        setSucursales(paraSelector);
        if (!sucursalId && paraSelector.length > 0) setSucursalId(paraSelector[0].id);
      })
      .catch(() => {});
  }, []);

  // Calcular días del mes
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const primerDia  = new Date(anio, mes, 1).getDay();  // 0=Dom
  const celdas     = Array.from({ length: primerDia + diasDelMes }, (_, i) =>
    i < primerDia ? null : i - primerDia + 1
  );

  const fechaStr = (dia) => {
    const m = String(mes + 1).padStart(2, "0");
    const d = String(dia).padStart(2, "0");
    return `${anio}-${m}-${d}`;
  };

  // Cargar datos del mes
  const cargar = useCallback(async () => {
    if (vista === "sucursales" && !sucursalId) return;
    try {
      setCargando(true);
      setError("");
      const mesInicio = fechaStr(1);
      const mesFin    = fechaStr(diasDelMes);
      const params    = { mesInicio, mesFin, vista };
      if (vista === "sucursales" && sucursalId) params.sucursalId = sucursalId;

      const res   = await getCalendario(params);
      const mapa  = {};
      const lista = res?.dias ? res.dias : (Array.isArray(res) ? res : [res]);
      lista.forEach((item) => {
        if (item?.fecha) mapa[item.fecha] = item.empleados || [];
      });
      setCalData(mapa);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [sucursalId, anio, mes, vista]);

  useEffect(() => { cargar(); }, [cargar]);

  const navMes = (delta) => {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  };

  /** Calcula los contadores por tipo para una fecha */
  const getDiaResumen = (fecha) => {
    const todos = calData[fecha] || [];
    const contadores = { vacaciones: 0, incapacidad: 0, falta: 0, incidencia: 0 };
    todos.forEach((emp) => {
      const cat = categorizarEmpleado(emp);
      if (cat && contadores[cat] !== undefined) contadores[cat]++;
    });
    const total = Object.values(contadores).reduce((a, b) => a + b, 0);
    return { todos, contadores, total };
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Calendario de Incidencias</h1>
          <p className="page-subtitle">
            {vista === "corporativo"
              ? "Incidencias autorizadas — Vista Corporativo"
              : `Incidencias autorizadas — ${sucursales.find(s => s.id === sucursalId)?.nombre || "Sucursal"}`}
          </p>
        </div>
      </div>

      {/* ── Controles ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>

        {/* Toggle vista */}
        <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: 8, padding: 3, gap: 3 }}>
          <button
            className={`btn btn-sm ${vista === "sucursales" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: 6, padding: "6px 14px" }}
            onClick={() => setVista("sucursales")}
          >
            🏢 Sucursales
          </button>
          <button
            className={`btn btn-sm ${vista === "corporativo" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: 6, padding: "6px 14px" }}
            onClick={() => setVista("corporativo")}
          >
            🏛️ Corporativo
          </button>
        </div>

        {/* Navegación de mes */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navMes(-1)}>◀</button>
          <span style={{ fontSize: 17, fontWeight: 600, minWidth: 155, textAlign: "center" }}>
            {MESES[mes]} {anio}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => navMes(1)}>▶</button>
        </div>

        {/* Selector de sucursal (solo en vista sucursales) */}
        {vista === "sucursales" && sucursales.length > 1 && (
          <select
            className="form-control"
            style={{ width: "auto", minWidth: 200 }}
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
          >
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => { setAnio(hoyDate.getFullYear()); setMes(hoyDate.getMonth()); }}
        >
          Hoy
        </button>
      </div>

      {/* ── Leyenda ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {TIPOS_ORDEN.map((tipo) => {
          const col = TIPO_COLORES[tipo];
          return (
            <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: col.badge, flexShrink: 0 }} />
              <span>{col.icon} {col.label}</span>
            </div>
          );
        })}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── Grid del mes ── */}
      {cargando ? (
        <div className="loading">Cargando calendario...</div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 3,
          background: "#fff",
          borderRadius: 12,
          padding: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          border: "1px solid var(--border)",
        }}>
          {/* Cabecera días semana */}
          {DIAS_SEMANA.map((d) => (
            <div key={d} style={{
              textAlign: "center", fontWeight: 700, fontSize: 12,
              padding: "8px 0", color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {d}
            </div>
          ))}

          {/* Celdas */}
          {celdas.map((dia, idx) => {
            if (!dia) return <div key={`empty-${idx}`} />;
            const fecha  = fechaStr(dia);
            const { todos, contadores, total } = getDiaResumen(fecha);
            const esHoy  = fecha === hoyStr;
            const hayEventos = total > 0;

            return (
              <div
                key={fecha}
                onClick={() => hayEventos && setDiaDetalle({ fecha, empleados: todos })}
                style={{
                  background: esHoy ? "rgba(59,130,246,0.06)" : "#fff",
                  border: esHoy ? "2px solid var(--primary)" : "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "6px 8px",
                  minHeight: 84,
                  cursor: hayEventos ? "pointer" : "default",
                  transition: "background 0.15s, box-shadow 0.15s",
                  boxShadow: hayEventos ? "none" : undefined,
                }}
                onMouseEnter={(e) => { if (hayEventos) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                {/* Número del día */}
                <div style={{
                  fontWeight: 700, fontSize: 14, marginBottom: 5,
                  color: esHoy ? "var(--primary)" : "var(--text)",
                }}>
                  {dia}
                </div>

                {/* Badges por tipo */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {TIPOS_ORDEN.map((tipo) => {
                    const n = contadores[tipo];
                    if (!n) return null;
                    const col = TIPO_COLORES[tipo];
                    return (
                      <span
                        key={tipo}
                        title={`${n} ${col.label}`}
                        style={{
                          background: col.badge, color: "#fff",
                          borderRadius: 4, padding: "1px 5px",
                          fontSize: 11, fontWeight: 600,
                          display: "inline-flex", alignItems: "center", gap: 2,
                          width: "fit-content",
                        }}
                      >
                        {col.icon} {n}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal detalle del día ── */}
      {diaDetalle && (
        <div className="modal-overlay" onClick={() => setDiaDetalle(null)}>
          <div
            className="modal"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                📅 {new Date(diaDetalle.fecha + "T12:00:00").toLocaleDateString("es-MX", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </h2>
              <button className="modal-close" onClick={() => setDiaDetalle(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: 480, overflowY: "auto" }}>
              {/* Un bloque por cada tipo, en orden de prioridad */}
              {TIPOS_ORDEN.map((tipo) => {
                const grupo = diaDetalle.empleados.filter(
                  (emp) => categorizarEmpleado(emp) === tipo
                );
                if (grupo.length === 0) return null;
                const col = TIPO_COLORES[tipo];

                return (
                  <div key={tipo} style={{ marginBottom: 18 }}>
                    {/* Encabezado del grupo */}
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: col.text,
                      marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: col.badge, display: "inline-block", flexShrink: 0,
                      }} />
                      {col.icon} {col.label} — {grupo.length} empleado(s)
                    </div>

                    {/* Tarjetas de empleados */}
                    {grupo.map((emp) => (
                      <div
                        key={emp.usuarioId}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          background: col.bg,
                          borderLeft: `3px solid ${col.border}`,
                          borderRadius: 6, padding: "8px 10px", marginBottom: 6,
                        }}
                      >
                        {emp.fotoUrl ? (
                          <img
                            src={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${emp.fotoUrl}`}
                            alt={emp.nombre}
                            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "var(--bg-secondary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, flexShrink: 0,
                          }}>
                            👤
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600, fontSize: 14,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {emp.nombre}
                          </div>
                          {emp.puestoNombre && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{emp.puestoNombre}</div>
                          )}
                          {emp.incidenciaActiva?.tipo && (
                            <div style={{ fontSize: 11, color: col.text, marginTop: 1 }}>
                              {emp.incidenciaActiva.tipo}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11, background: col.badge, color: "#fff",
                          padding: "2px 8px", borderRadius: 10, flexShrink: 0, fontWeight: 600,
                        }}>
                          {col.label}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Sin incidencias relevantes */}
              {diaDetalle.empleados.every((emp) => !categorizarEmpleado(emp)) && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                  <p>Sin incidencias registradas este día</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDiaDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendario;
