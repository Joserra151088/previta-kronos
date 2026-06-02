/**
 * Mapa.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Muestra las sucursales en un mapa interactivo (Leaflet).
 * • Marcador verde  → sucursal con al menos 1 empleado con "entrada" hoy.
 * • Marcador gris   → sucursal sin actividad hoy.
 * • Botón "Informe" → tabla paginada de registros del día por sucursal.
 * • Filtros: grupo de sucursales y estado de la república.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getMapaSucursales, getGrupos } from "../utils/api";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const ROWS_PER_PAGE = 10;

// Corrige el path de los íconos de Leaflet cuando se usa con bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Ícono personalizado: círculo de color
const crearIcono = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);">
    </div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
    popupAnchor:[0, -12],
  });

const iconoVerde = crearIcono("#3fb950");
const iconoGris  = crearIcono("#8b949e");

const TIPO_LABEL = {
  entrada:           "🟢 Entrada",
  salida_alimentos:  "🍽️ Salida comida",
  regreso_alimentos: "↩️ Regreso comida",
  salida:            "🔴 Salida",
};

// Estados de la República Mexicana
const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche",
  "Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango",
  "Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán",
  "Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo",
  "San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala",
  "Veracruz","Yucatán","Zacatecas",
];

// ─── Componente principal ──────────────────────────────────────────────────
const Mapa = () => {
  const mapRef      = useRef(null);   // contenedor DOM
  const leafletRef  = useRef(null);   // instancia L.Map
  const markersRef  = useRef([]);     // array de L.Marker activos

  const [sucursales,   setSucursales]   = useState([]);
  const [grupos,       setGrupos]       = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [error,        setError]        = useState("");
  const [ultimaActual, setUltimaActual] = useState(null);

  // Filtros
  const [filtroGrupo,  setFiltroGrupo]  = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Informe
  const [modalInforme,    setModalInforme]    = useState(false);
  const [sucursalInforme, setSucursalInforme] = useState(null); // null = todas
  const [paginaActual,    setPaginaActual]    = useState(1);

  // ── Carga de datos ─────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [data, gruposData] = await Promise.all([
        getMapaSucursales(),
        getGrupos(),
      ]);
      setSucursales(Array.isArray(data) ? data : []);
      setGrupos(Array.isArray(gruposData) ? gruposData : []);
      setUltimaActual(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    // Refresca automáticamente cada 60 s
    const interval = setInterval(cargar, 60_000);
    return () => clearInterval(interval);
  }, [cargar]);

  // ── Sucursales filtradas ────────────────────────────────────────────────
  const sucursalesFiltradas = sucursales.filter((s) => {
    if (filtroGrupo) {
      const grupo = grupos.find((g) => g.id === filtroGrupo);
      if (!grupo || !Array.isArray(grupo.sucursalIds) || !grupo.sucursalIds.includes(s.id)) return false;
    }
    if (filtroEstado) {
      const ciudadLow = (s.ciudad || "").toLowerCase();
      const estadoLow = filtroEstado.toLowerCase();
      if (!ciudadLow.includes(estadoLow) && !(s.estado || "").toLowerCase().includes(estadoLow)) return false;
    }
    return true;
  });

  // ── Inicializar mapa Leaflet ────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    leafletRef.current = L.map(mapRef.current, {
      center: [20.0, -99.5],
      zoom: 6,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletRef.current);
    return () => {
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  }, []);

  // ── Actualizar marcadores cuando cambian los datos o filtros ───────────
  useEffect(() => {
    if (!leafletRef.current) return;
    // Eliminar marcadores anteriores
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (sucursalesFiltradas.length === 0) return;

    const bounds = [];
    sucursalesFiltradas.forEach((s) => {
      if (!s.latitud || !s.longitud) return;
      const marker = L.marker([s.latitud, s.longitud], {
        icon: s.conActividad ? iconoVerde : iconoGris,
        title: s.nombre,
      });

      // Popup
      const empleadosHtml = s.conActividad
        ? s.empleadosActivos.map((e) =>
            `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
              ${e.fotoUrl
                ? `<img src="${BASE}${e.fotoUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />`
                : `<span style="font-size:1.2rem;">👤</span>`}
              <span>${e.nombre}</span>
              <span style="color:#8b949e;font-size:0.8rem;margin-left:auto;">${e.hora}</span>
            </div>`
          ).join("")
        : "<p style='color:#8b949e;margin-top:4px;font-size:0.82rem;'>Sin actividad hoy</p>";

      marker.bindPopup(`
        <div style="min-width:200px;">
          <strong style="font-size:0.95rem;">${s.nombre}</strong><br/>
          <span style="color:#8b949e;font-size:0.8rem;">📍 ${s.direccion}, ${s.ciudad}</span>
          <hr style="border-color:#30363d;margin:6px 0;"/>
          ${s.conActividad
            ? `<span style="color:#3fb950;font-size:0.82rem;">● ${s.totalEntradas} entrada${s.totalEntradas !== 1 ? "s" : ""} hoy</span>`
            : ""}
          ${empleadosHtml}
        </div>
      `);

      marker.addTo(leafletRef.current);
      markersRef.current.push(marker);
      bounds.push([s.latitud, s.longitud]);
    });

    if (bounds.length > 0) {
      leafletRef.current.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [sucursalesFiltradas]);

  // ── Datos del informe ───────────────────────────────────────────────────
  const registrosInforme = sucursalInforme
    ? sucursalesFiltradas.find((s) => s.id === sucursalInforme)?.informeHoy || []
    : sucursalesFiltradas.flatMap((s) => s.informeHoy || []);

  const totalPaginas   = Math.ceil(registrosInforme.length / ROWS_PER_PAGE);
  const registrosPag   = registrosInforme.slice(
    (paginaActual - 1) * ROWS_PER_PAGE,
    paginaActual * ROWS_PER_PAGE
  );

  const abrirInforme = () => {
    setSucursalInforme(null);
    setPaginaActual(1);
    setModalInforme(true);
  };

  const hayFiltros = filtroGrupo || filtroEstado;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page mapa-page">
      {/* Cabecera */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Mapa de Sucursales</h1>
          <p className="page-subtitle">
            Ubicación en tiempo real · última actualización: {ultimaActual || "…"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={cargar} disabled={cargando} title="Refrescar">
            {cargando ? "⟳ Cargando…" : "⟳ Refrescar"}
          </button>
          <button className="btn btn-primary" onClick={abrirInforme}>
            📋 Informe
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="filtros-bar" style={{ marginBottom: 12 }}>
        <select
          className="filter-select"
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
        >
          <option value="">Todos los grupos</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>{g.nombre}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_MX.map((est) => (
            <option key={est} value={est}>{est}</option>
          ))}
        </select>

        {hayFiltros && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setFiltroGrupo(""); setFiltroEstado(""); }}
          >
            ✕ Limpiar filtros
          </button>
        )}

        {hayFiltros && (
          <span style={{ fontSize: "0.85rem", color: "var(--text2)", alignSelf: "center" }}>
            {sucursalesFiltradas.length} de {sucursales.length} sucursal{sucursales.length !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {/* Leyenda */}
      <div className="mapa-legend">
        <span><span className="legend-dot legend-dot-green" /> Con actividad hoy</span>
        <span><span className="legend-dot legend-dot-gray"  /> Sin actividad</span>
        {sucursalesFiltradas.filter((s) => s.conActividad).length > 0 && (
          <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 500 }}>
            {sucursalesFiltradas.filter((s) => s.conActividad).length} sucursal{sucursalesFiltradas.filter((s) => s.conActividad).length !== 1 ? "es" : ""} activa{sucursalesFiltradas.filter((s) => s.conActividad).length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Mapa */}
      <div className="mapa-wrapper">
        <div ref={mapRef} className="mapa-container" />
      </div>

      {/* Tarjetas de resumen */}
      {!cargando && sucursalesFiltradas.length > 0 && (
        <div className="mapa-cards">
          {sucursalesFiltradas.map((s) => (
            <div
              key={s.id}
              className={`mapa-card ${s.conActividad ? "mapa-card-active" : ""}`}
              onClick={() => {
                const marker = markersRef.current[
                  sucursalesFiltradas.filter((x) => x.latitud && x.longitud).findIndex((x) => x.id === s.id)
                ];
                if (marker) {
                  leafletRef.current.flyTo([s.latitud, s.longitud], 15, { duration: 1 });
                  marker.openPopup();
                }
              }}
            >
              <div className="mapa-card-header">
                <span className={`legend-dot ${s.conActividad ? "legend-dot-green" : "legend-dot-gray"}`} style={{ flexShrink: 0 }} />
                <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.nombre}
                </strong>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 2 }}>
                📍 {s.ciudad}
              </div>
              <div style={{ fontSize: "0.82rem", marginTop: 6, color: s.conActividad ? "var(--success)" : "var(--text2)" }}>
                {s.conActividad ? `${s.totalEntradas} entrada${s.totalEntradas !== 1 ? "s" : ""} hoy` : "Sin actividad"}
              </div>
            </div>
          ))}
        </div>
      )}

      {!cargando && sucursalesFiltradas.length === 0 && sucursales.length > 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <div className="empty-icon">🗺️</div>
          <p>No hay sucursales para los filtros seleccionados.</p>
          <button className="btn btn-secondary" onClick={() => { setFiltroGrupo(""); setFiltroEstado(""); }}>
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Modal Informe ───────────────────────────────────────────────── */}
      {modalInforme && (
        <div className="modal-overlay" onClick={() => setModalInforme(false)}>
          <div
            className="modal"
            style={{ maxWidth: 780, width: "95vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📋 Informe de registros — hoy</h2>
              <button className="modal-close" onClick={() => setModalInforme(false)}>✕</button>
            </div>

            {/* Filtro por sucursal */}
            <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)" }}>
              <select
                className="filter-select"
                value={sucursalInforme || ""}
                onChange={(e) => {
                  setSucursalInforme(e.target.value || null);
                  setPaginaActual(1);
                }}
                style={{ minWidth: 220 }}
              >
                <option value="">Todas las sucursales</option>
                {sucursalesFiltradas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              <span style={{ marginLeft: 12, fontSize: "0.85rem", color: "var(--text2)" }}>
                {registrosInforme.length} registro{registrosInforme.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Tabla */}
            <div className="modal-body" style={{ padding: 0, overflowX: "auto" }}>
              {registrosInforme.length === 0 ? (
                <div className="empty-state" style={{ padding: "40px 0" }}>
                  <div className="empty-icon">📋</div>
                  <p>Sin registros para los filtros seleccionados.</p>
                </div>
              ) : (
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Tipo</th>
                      <th>Hora</th>
                      <th>Fecha</th>
                      <th>Dirección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosPag.map((r) => (
                      <tr key={r.registroId}>
                        <td>
                          <div className="user-cell">
                            {r.fotoUrl ? (
                              <img
                                src={`${BASE}${r.fotoUrl}`}
                                alt={r.nombre}
                                className="emp-foto-sm"
                              />
                            ) : (
                              <div className="user-avatar" style={{ fontSize: "1rem" }}>👤</div>
                            )}
                            <span>{r.nombre}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${r.tipo === "entrada" ? "badge-success" : r.tipo === "salida" ? "badge-danger" : "badge-default"}`}>
                            {TIPO_LABEL[r.tipo] || r.tipo}
                          </span>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{r.hora}</td>
                        <td>{r.fecha}</td>
                        <td style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                          {r.direccion}, {r.ciudad}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="modal-footer" style={{ justifyContent: "center", gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={paginaActual === 1}
                  onClick={() => setPaginaActual((p) => p - 1)}
                >← Anterior</button>
                <span style={{ fontSize: "0.85rem", color: "var(--text2)", alignSelf: "center" }}>
                  Página {paginaActual} de {totalPaginas}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={paginaActual === totalPaginas}
                  onClick={() => setPaginaActual((p) => p + 1)}
                >Siguiente →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Mapa;
