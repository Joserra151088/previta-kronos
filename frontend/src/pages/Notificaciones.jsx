/**
 * Notificaciones.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página unificada de Notificaciones + Anuncios.
 * • Notificaciones: feed tipo timeline con filtros y marcado
 * • Anuncios: tarjetas tipo Mailchimp con imagen, color y CTA
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useNotificaciones } from "../context/NotificacionesContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUsuarios, enviarNotificacion, getAnuncios, getAnunciosAdmin, crearAnuncioConImagen, actualizarAnuncioConImagen, eliminarAnuncio } from "../utils/api";
import { toastError, toastExito, toastAviso, confirmar } from "../utils/toast";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const ROLES_ENVIO  = ["super_admin", "agente_soporte_ti", "supervisor_sucursales", "agente_control_asistencia"];
const ROLES_ADMIN  = ["super_admin", "administrador_general"];

// ─── Notificaciones: config de tipos ──────────────────────────────────────────

const TIPO_CONFIG = {
  info:                { icon: "🔔", label: "Info",       color: "#3b82f6", bg: "#eff6ff" },
  alerta:              { icon: "⚠️",  label: "Alerta",     color: "#f97316", bg: "#fff7ed" },
  success:             { icon: "✅", label: "Éxito",      color: "#22c55e", bg: "#f0fdf4" },
  error:               { icon: "❌", label: "Error",      color: "#ef4444", bg: "#fef2f2" },
  incidencia_nueva:    { icon: "📋", label: "Incidencia", color: "#f97316", bg: "#fff7ed" },
  incidencia_resuelta: { icon: "✅", label: "Resuelta",   color: "#22c55e", bg: "#f0fdf4" },
  asistencia_manual:   { icon: "🖊️", label: "Asistencia", color: "#3b82f6", bg: "#eff6ff" },
  asistencia_aprobada: { icon: "✔️",  label: "Aprobada",   color: "#22c55e", bg: "#f0fdf4" },
  asistencia_rechazada:{ icon: "❌", label: "Rechazada",  color: "#ef4444", bg: "#fef2f2" },
  mensaje_general:     { icon: "💬", label: "Mensaje",    color: "#6366f1", bg: "#eef2ff" },
};

const TIPOS_FILTRO = [
  { value: "todos",   label: "Todos" },
  { value: "info",    label: "🔔 Info" },
  { value: "alerta",  label: "⚠️ Alerta" },
  { value: "success", label: "✅ Éxito" },
  { value: "error",   label: "❌ Error" },
];

const GRUPO_TIPO = {
  info:    ["info", "asistencia_manual", "mensaje_general"],
  alerta:  ["alerta", "incidencia_nueva"],
  success: ["success", "incidencia_resuelta", "asistencia_aprobada"],
  error:   ["error", "asistencia_rechazada"],
};

// ─── Anuncios: config de categorías ──────────────────────────────────────────

const CATEGORIAS = [
  { value: "general",     label: "📢 General",     color: "#6366f1" },
  { value: "urgente",     label: "🚨 Urgente",      color: "#ef4444" },
  { value: "evento",      label: "🎉 Evento",       color: "#f97316" },
  { value: "beneficio",   label: "🎁 Beneficio",    color: "#22c55e" },
  { value: "capacitacion",label: "📚 Capacitación", color: "#3b82f6" },
  { value: "mantenimiento",label:"🔧 Mantenimiento",color: "#64748b" },
];

const getCategoriaConfig = (cat) =>
  CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[0];

const COLORES_BANNER = [
  { value: "#6366f1", label: "Índigo"    },
  { value: "#3b82f6", label: "Azul"      },
  { value: "#22c55e", label: "Verde"     },
  { value: "#f97316", label: "Naranja"   },
  { value: "#ef4444", label: "Rojo"      },
  { value: "#8b5cf6", label: "Violeta"   },
  { value: "#0ea5e9", label: "Celeste"   },
  { value: "#64748b", label: "Gris"      },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFecha = (iso) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const tiempoRelativo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d !== 1 ? "s" : ""}`;
};

const viasImg = (url) =>
  url ? (url.startsWith("http") ? url : `${BASE}${url}`) : null;

// ─── Componente: tarjeta de anuncio ──────────────────────────────────────────

function AnuncioCard({ anuncio, puedeAdmin, onEdit, onDelete }) {
  const cat = getCategoriaConfig(anuncio.categoria);
  const bannerColor = anuncio.color || cat.color;
  const img = viasImg(anuncio.imageUrl);

  const vencido = anuncio.fechaExpiracion && anuncio.fechaExpiracion < new Date().toISOString().split("T")[0];
  const programado = anuncio.fechaInicio && anuncio.fechaInicio > new Date().toISOString().split("T")[0];

  return (
    <div style={{
      background: "var(--bg2)",
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid var(--border)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      transition: "transform 0.15s, box-shadow 0.15s",
      opacity: vencido || !anuncio.activo ? 0.65 : 1,
      position: "relative",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
    >
      {/* Banner de color / imagen */}
      {img ? (
        <div style={{ height: 180, overflow: "hidden", position: "relative" }}>
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${bannerColor}dd)`,
          }} />
        </div>
      ) : (
        <div style={{
          height: 8,
          background: `linear-gradient(90deg, ${bannerColor}, ${bannerColor}88)`,
        }} />
      )}

      <div style={{ padding: "18px 20px" }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: bannerColor + "22", color: bannerColor,
          }}>
            {cat.label}
          </span>
          {vencido && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fef2f2", color: "#ef4444", fontWeight: 600 }}>
              Vencido
            </span>
          )}
          {programado && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fffbeb", color: "#d97706", fontWeight: 600 }}>
              Programado
            </span>
          )}
          {!anuncio.activo && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--bg3)", color: "var(--text2)", fontWeight: 600 }}>
              Inactivo
            </span>
          )}
        </div>

        {/* Título */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: 8, lineHeight: 1.3 }}>
          {anuncio.titulo}
        </h3>

        {/* Cuerpo */}
        <p style={{ fontSize: "0.875rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {anuncio.texto}
        </p>

        {/* CTA */}
        {anuncio.ctaUrl && anuncio.ctaLabel && (
          <a
            href={anuncio.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block", padding: "8px 18px",
              background: bannerColor, color: "#fff",
              borderRadius: 8, fontWeight: 600, fontSize: "0.85rem",
              textDecoration: "none", marginBottom: 12,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {anuncio.ctaLabel} →
          </a>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
            {anuncio.creadoPorNombre && <span>✍️ {anuncio.creadoPorNombre} · </span>}
            {tiempoRelativo(anuncio.creadoEn)}
            {anuncio.fechaExpiracion && (
              <span> · Vence: {new Date(anuncio.fechaExpiracion + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
            )}
          </div>
          {puedeAdmin && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                onClick={() => onEdit(anuncio)}
              >
                ✏️ Editar
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                onClick={() => onDelete(anuncio)}
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente: modal editor de anuncio ──────────────────────────────────────

const FORM_VACIO = {
  titulo: "", texto: "", categoria: "general", color: "#6366f1",
  ctaLabel: "", ctaUrl: "", fechaInicio: "", fechaExpiracion: "",
  diasDuracion: "30",
};

function ModalAnuncio({ anuncio, onClose, onSaved }) {
  const [form, setForm] = useState(anuncio
    ? {
        titulo:          anuncio.titulo || "",
        texto:           anuncio.texto  || "",
        categoria:       anuncio.categoria || "general",
        color:           anuncio.color || "#6366f1",
        ctaLabel:        anuncio.ctaLabel || "",
        ctaUrl:          anuncio.ctaUrl || "",
        fechaInicio:     anuncio.fechaInicio || "",
        fechaExpiracion: anuncio.fechaExpiracion || "",
        diasDuracion:    "",
      }
    : { ...FORM_VACIO }
  );

  const [imagenFile, setImagenFile]   = useState(null);
  const [imagenPreview, setImagenPreview] = useState(anuncio?.imageUrl ? viasImg(anuncio.imageUrl) : null);
  const [quitarImagen, setQuitarImagen]   = useState(false);
  const [guardando, setGuardando]         = useState(false);
  const [tab, setTab]                     = useState("contenido"); // "contenido" | "apariencia" | "entrega"
  const inputImgRef = useRef(null);

  const handleImagenChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImagenFile(f);
    setImagenPreview(URL.createObjectURL(f));
    setQuitarImagen(false);
  };

  const handleQuitarImagen = () => {
    setImagenFile(null);
    setImagenPreview(null);
    setQuitarImagen(true);
    if (inputImgRef.current) inputImgRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.texto.trim()) {
      toastAviso("El título y el texto son obligatorios");
      return;
    }
    setGuardando(true);
    try {
      const campos = {
        titulo:    form.titulo.trim(),
        texto:     form.texto.trim(),
        categoria: form.categoria,
        color:     form.color,
        ...(form.ctaLabel       ? { ctaLabel: form.ctaLabel }           : {}),
        ...(form.ctaUrl         ? { ctaUrl:   form.ctaUrl }             : {}),
        ...(form.fechaInicio    ? { fechaInicio: form.fechaInicio }     : {}),
        ...(form.fechaExpiracion ? { fechaExpiracion: form.fechaExpiracion } : {}),
        ...(form.diasDuracion && !form.fechaExpiracion
            ? { diasDuracion: form.diasDuracion } : {}),
        ...(quitarImagen        ? { quitarImagen: "true" }              : {}),
      };

      if (anuncio) {
        await actualizarAnuncioConImagen(anuncio.id, campos, imagenFile);
      } else {
        await crearAnuncioConImagen(campos, imagenFile);
      }
      toastExito(anuncio ? "Anuncio actualizado" : "Anuncio publicado");
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  const bannerColor = form.color || "#6366f1";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 680, width: "95vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "1.1rem" }}>
            {anuncio ? "✏️ Editar anuncio" : "📢 Nuevo anuncio"}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Preview banner */}
        <div style={{
          height: 6,
          background: `linear-gradient(90deg, ${bannerColor}, ${bannerColor}55)`,
        }} />

        {/* Sub-tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg3)" }}>
          {[
            { key: "contenido",  label: "📝 Contenido"  },
            { key: "apariencia", label: "🎨 Apariencia" },
            { key: "entrega",    label: "📅 Entrega"    },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontSize: "0.85rem", fontWeight: tab === t.key ? 700 : 400,
                background: "transparent",
                color: tab === t.key ? bannerColor : "var(--text2)",
                borderBottom: tab === t.key ? `2px solid ${bannerColor}` : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>

            {/* ─── Tab: Contenido ──────────────────────────────── */}
            {tab === "contenido" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Título del anuncio *</label>
                  <input
                    className="form-control"
                    style={{ fontSize: "1rem", fontWeight: 600 }}
                    placeholder="Ej: Reunión de equipo — viernes 10:00 AM"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Mensaje *</label>
                  <textarea
                    className="form-control"
                    rows={5}
                    placeholder="Escribe el contenido del anuncio aquí. Puedes usar saltos de línea para mejor legibilidad."
                    value={form.texto}
                    onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                    required
                    style={{ resize: "vertical", lineHeight: 1.6 }}
                  />
                  <small style={{ color: "var(--text2)" }}>{form.texto.length} caracteres</small>
                </div>

                {/* Imagen */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Imagen de portada</label>
                  <input
                    ref={inputImgRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={handleImagenChange}
                  />

                  {imagenPreview ? (
                    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "2px solid var(--border)" }}>
                      <img src={imagenPreview} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          style={{ background: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                          onClick={() => inputImgRef.current?.click()}
                        >
                          🔄 Cambiar
                        </button>
                        <button
                          type="button"
                          style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                          onClick={handleQuitarImagen}
                        >
                          ✕ Quitar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => inputImgRef.current?.click()}
                      style={{
                        border: "2px dashed var(--border)", borderRadius: 10,
                        padding: "32px 20px", textAlign: "center", cursor: "pointer",
                        color: "var(--text2)", transition: "border-color 0.15s",
                        background: "var(--bg3)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = bannerColor; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <div style={{ fontSize: "2rem", marginBottom: 6 }}>🖼️</div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Arrastra o haz clic para subir imagen</div>
                      <div style={{ fontSize: "0.78rem", marginTop: 4 }}>JPG, PNG, WebP o GIF · máx 5 MB</div>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, fontSize: "0.9rem" }}>🔗 Botón de acción (opcional)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "0.8rem" }}>Texto del botón</label>
                      <input
                        className="form-control"
                        placeholder="Ver más"
                        value={form.ctaLabel}
                        onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "0.8rem" }}>URL de destino</label>
                      <input
                        className="form-control"
                        placeholder="https://..."
                        type="url"
                        value={form.ctaUrl}
                        onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Tab: Apariencia ─────────────────────────────── */}
            {tab === "apariencia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Categoría</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginTop: 8 }}>
                    {CATEGORIAS.map((cat) => (
                      <label
                        key={cat.value}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                          border: `2px solid ${form.categoria === cat.value ? cat.color : "var(--border)"}`,
                          background: form.categoria === cat.value ? cat.color + "18" : "var(--bg3)",
                          transition: "all 0.15s", fontSize: "0.85rem", fontWeight: 600,
                        }}
                      >
                        <input
                          type="radio"
                          name="categoria"
                          value={cat.value}
                          checked={form.categoria === cat.value}
                          onChange={() => {
                            setForm((f) => ({ ...f, categoria: cat.value, color: cat.color }));
                          }}
                          style={{ display: "none" }}
                        />
                        <span style={{ color: cat.color }}>{cat.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Color de acento</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {COLORES_BANNER.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                        style={{
                          width: 36, height: 36, borderRadius: "50%", border: "none",
                          background: c.value, cursor: "pointer",
                          boxShadow: form.color === c.value ? `0 0 0 3px var(--bg2), 0 0 0 5px ${c.value}` : "none",
                          transition: "box-shadow 0.15s, transform 0.15s",
                          transform: form.color === c.value ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      title="Color personalizado"
                      style={{ width: 36, height: 36, border: "none", borderRadius: "50%", cursor: "pointer", padding: 0, background: "none" }}
                    />
                  </div>
                  <small style={{ color: "var(--text2)", marginTop: 4, display: "block" }}>Seleccionado: {form.color}</small>
                </div>

                {/* Preview card */}
                <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, fontSize: "0.9rem" }}>👁 Vista previa</div>
                  <div style={{
                    background: "var(--bg2)", borderRadius: 12, overflow: "hidden",
                    border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}>
                    {imagenPreview ? (
                      <div style={{ height: 100, overflow: "hidden", position: "relative" }}>
                        <img src={imagenPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${bannerColor}dd)` }} />
                      </div>
                    ) : (
                      <div style={{ height: 6, background: `linear-gradient(90deg, ${bannerColor}, ${bannerColor}55)` }} />
                    )}
                    <div style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: bannerColor + "22", color: bannerColor }}>
                        {getCategoriaConfig(form.categoria).label}
                      </span>
                      <div style={{ fontWeight: 700, marginTop: 6, fontSize: "0.9rem" }}>
                        {form.titulo || "Título del anuncio"}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 4, lineHeight: 1.4 }}>
                        {form.texto ? form.texto.slice(0, 80) + (form.texto.length > 80 ? "…" : "") : "El texto del anuncio aparecerá aquí."}
                      </div>
                      {form.ctaLabel && (
                        <div style={{ marginTop: 8, display: "inline-block", padding: "5px 12px", background: bannerColor, color: "#fff", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600 }}>
                          {form.ctaLabel} →
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Tab: Entrega ─────────────────────────────────── */}
            {tab === "entrega" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>📅 Fecha de inicio</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.fechaInicio}
                      onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    />
                    <small style={{ color: "var(--text2)" }}>Dejar en blanco = publicar ahora</small>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>⏰ Fecha de expiración</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.fechaExpiracion}
                      min={form.fechaInicio || undefined}
                      onChange={(e) => setForm((f) => ({ ...f, fechaExpiracion: e.target.value, diasDuracion: "" }))}
                    />
                  </div>
                </div>

                {!form.fechaExpiracion && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>⏳ Duración (días)</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[7, 14, 30, 60, 90].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, diasDuracion: String(d) }))}
                          style={{
                            padding: "6px 14px", borderRadius: 8, border: "2px solid",
                            borderColor: form.diasDuracion === String(d) ? bannerColor : "var(--border)",
                            background: form.diasDuracion === String(d) ? bannerColor + "18" : "var(--bg3)",
                            color: form.diasDuracion === String(d) ? bannerColor : "var(--text)",
                            fontWeight: form.diasDuracion === String(d) ? 700 : 400,
                            cursor: "pointer", fontSize: "0.85rem", transition: "all 0.15s",
                          }}
                        >
                          {d} días
                        </button>
                      ))}
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 90 }}
                        min={1} max={365}
                        placeholder="Otro"
                        value={![7, 14, 30, 60, 90].includes(Number(form.diasDuracion)) ? form.diasDuracion : ""}
                        onChange={(e) => setForm((f) => ({ ...f, diasDuracion: e.target.value }))}
                      />
                    </div>
                    <small style={{ color: "var(--text2)" }}>
                      {form.diasDuracion ? `Vence en ${form.diasDuracion} días a partir de hoy` : "Duración predeterminada: 30 días"}
                    </small>
                  </div>
                )}

                {/* Resumen */}
                <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 Resumen del anuncio</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem", color: "var(--text2)" }}>
                    <div>📢 <strong>Categoría:</strong> {getCategoriaConfig(form.categoria).label}</div>
                    <div>📅 <strong>Inicio:</strong> {form.fechaInicio ? new Date(form.fechaInicio + "T00:00:00").toLocaleDateString("es-MX") : "Inmediato"}</div>
                    <div>⏰ <strong>Expiración:</strong> {form.fechaExpiracion
                      ? new Date(form.fechaExpiracion + "T00:00:00").toLocaleDateString("es-MX")
                      : form.diasDuracion
                        ? `En ${form.diasDuracion} días`
                        : "30 días (predeterminado)"
                    }</div>
                    {form.ctaUrl && <div>🔗 <strong>CTA:</strong> {form.ctaLabel || "Ver más"} → {form.ctaUrl}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {tab !== "entrega" && (
                <button
                  type="button"
                  style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${bannerColor}`, background: "transparent", color: bannerColor, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => setTab(tab === "contenido" ? "apariencia" : "entrega")}
                >
                  Siguiente →
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: bannerColor, borderColor: bannerColor }}
                disabled={guardando}
              >
                {guardando ? "Guardando..." : anuncio ? "💾 Guardar cambios" : "📢 Publicar anuncio"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sección Notificaciones ───────────────────────────────────────────────────

function SeccionNotificaciones({ puedeEnviar }) {
  const { notificaciones, noLeidas, marcarLeida, marcarTodas } = useNotificaciones();
  const [tabActiva, setTabActiva] = useState("todas");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [usuarios, setUsuarios] = useState([]);
  const [modalEnviar, setModalEnviar] = useState(false);
  const [form, setForm] = useState({ paraUsuarioIds: [], titulo: "", mensaje: "" });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (puedeEnviar) getUsuarios().then(setUsuarios).catch(() => {});
  }, [puedeEnviar]);

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (form.paraUsuarioIds.length === 0) { toastAviso("Selecciona al menos un destinatario"); return; }
    try {
      setEnviando(true);
      await enviarNotificacion({ ...form, tipo: "mensaje_general" });
      toastExito("Notificación enviada correctamente");
      setModalEnviar(false);
      setForm({ paraUsuarioIds: [], titulo: "", mensaje: "" });
    } catch (e) {
      toastError(e);
    } finally {
      setEnviando(false);
    }
  };

  const notifFiltradas = notificaciones.filter((n) => {
    if (tabActiva === "no_leidas" && n.leida) return false;
    if (tabActiva === "leidas" && !n.leida) return false;
    if (tipoFiltro !== "todos") {
      const grupo = GRUPO_TIPO[tipoFiltro] || [tipoFiltro];
      if (!grupo.includes(n.tipo)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg3)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[
            { key: "todas",     label: `Todas (${notificaciones.length})` },
            { key: "no_leidas", label: `Sin leer (${noLeidas})` },
            { key: "leidas",    label: `Leídas (${notificaciones.length - noLeidas})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTabActiva(tab.key)}
              style={{
                padding: "6px 14px", border: "none", borderRadius: 7, cursor: "pointer",
                fontSize: "0.85rem", fontWeight: tabActiva === tab.key ? 700 : 400,
                background: tabActiva === tab.key ? "var(--accent)" : "transparent",
                color: tabActiva === tab.key ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          className="form-control"
          style={{ width: "auto", minWidth: 150 }}
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
        >
          {TIPOS_FILTRO.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {noLeidas > 0 && (
            <button className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={marcarTodas}>
              ✅ Marcar todas
            </button>
          )}
          {puedeEnviar && (
            <button className="btn btn-primary" style={{ fontSize: "0.85rem" }} onClick={() => setModalEnviar(true)}>
              + Enviar notificación
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {notifFiltradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔕</div>
          <p style={{ color: "var(--text2)" }}>
            {tabActiva === "no_leidas" ? "Sin notificaciones pendientes" :
             tabActiva === "leidas"    ? "Sin notificaciones leídas"     :
             "No tienes notificaciones"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifFiltradas.map((n) => {
            const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info;
            return (
              <div
                key={n.id}
                onClick={() => !n.leida && marcarLeida(n.id)}
                style={{
                  display: "flex", gap: 14, alignItems: "flex-start",
                  padding: "14px 16px",
                  background: n.leida ? "var(--bg2)" : cfg.bg,
                  borderRadius: 12,
                  border: `1px solid ${n.leida ? "var(--border)" : cfg.color + "44"}`,
                  borderLeft: `4px solid ${cfg.color}`,
                  cursor: n.leida ? "default" : "pointer",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { if (!n.leida) e.currentTarget.style.boxShadow = `0 4px 12px ${cfg.color}22`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                {/* Dot */}
                {!n.leida && (
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: cfg.color, flexShrink: 0, marginTop: 6,
                  }} />
                )}

                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1 }}>{cfg.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{n.titulo}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginTop: 2, lineHeight: 1.5 }}>{n.mensaje}</div>
                  <div style={{ display: "flex", gap: 10, fontSize: "0.75rem", color: "var(--text2)", marginTop: 6, flexWrap: "wrap" }}>
                    <span title={formatFecha(n.creadoEn)}>{tiempoRelativo(n.creadoEn)}</span>
                    <span>·</span>
                    <span>{formatFecha(n.creadoEn)}</span>
                    <span style={{
                      background: cfg.color + "22", color: cfg.color,
                      borderRadius: 4, padding: "0px 6px", fontWeight: 600,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {!n.leida && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "4px 10px", flexShrink: 0, alignSelf: "center" }}
                    onClick={(e) => { e.stopPropagation(); marcarLeida(n.id); }}
                  >
                    Leída
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal enviar */}
      {modalEnviar && (
        <div className="modal-overlay" onClick={() => setModalEnviar(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>💬 Enviar Notificación</h2>
              <button className="modal-close" onClick={() => setModalEnviar(false)}>✕</button>
            </div>
            <form onSubmit={handleEnviar} className="modal-body">
              <div className="form-group">
                <label>Destinatarios * <small style={{ color: "var(--text2)" }}>(Ctrl/Cmd para varios)</small></label>
                <select
                  multiple
                  className="form-control"
                  style={{ minHeight: 130 }}
                  value={form.paraUsuarioIds}
                  onChange={(e) => setForm({ ...form, paraUsuarioIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                >
                  {usuarios.filter((u) => u.activo).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.apellido} — {u.rol.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Título *</label>
                <input className="form-control" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Mensaje *</label>
                <textarea className="form-control" rows={3} value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalEnviar(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={enviando}>
                  {enviando ? "Enviando..." : "📤 Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sección Anuncios ─────────────────────────────────────────────────────────

function SeccionAnuncios({ puedeAdmin }) {
  const [anuncios, setAnuncios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro]     = useState("todos"); // "todos" | "activos" | "vencidos" | categoria
  const [modalEditor, setModalEditor] = useState(null); // null | "nuevo" | anuncio object

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const lista = puedeAdmin ? await getAnunciosAdmin() : await getAnuncios();
      setAnuncios(lista);
    } catch (err) {
      toastError(err);
    } finally {
      setCargando(false);
    }
  }, [puedeAdmin]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleDelete = async (anuncio) => {
    const ok = await confirmar(`¿Eliminar el anuncio "${anuncio.titulo}"?`, "Eliminar", "danger");
    if (!ok) return;
    try {
      await eliminarAnuncio(anuncio.id);
      toastExito("Anuncio eliminado");
      cargar();
    } catch (err) {
      toastError(err);
    }
  };

  const hoy = new Date().toISOString().split("T")[0];

  const filtrados = anuncios.filter((a) => {
    if (filtro === "activos")  return a.activo && (!a.fechaExpiracion || a.fechaExpiracion >= hoy);
    if (filtro === "vencidos") return a.fechaExpiracion && a.fechaExpiracion < hoy;
    if (filtro !== "todos")    return a.categoria === filtro;
    return true;
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg3)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", flexWrap: "wrap" }}>
          {[
            { key: "todos",   label: `Todos (${anuncios.length})` },
            { key: "activos", label: "Activos" },
            { key: "vencidos",label: "Vencidos" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: "6px 14px", border: "none", borderRadius: 7, cursor: "pointer",
                fontSize: "0.85rem", fontWeight: filtro === f.key ? 700 : 400,
                background: filtro === f.key ? "var(--accent)" : "transparent",
                color: filtro === f.key ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="form-control"
          style={{ width: "auto", minWidth: 160 }}
          value={CATEGORIAS.some((c) => c.value === filtro) ? filtro : ""}
          onChange={(e) => setFiltro(e.target.value || "todos")}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {puedeAdmin && (
          <button
            className="btn btn-primary"
            style={{ marginLeft: "auto", fontSize: "0.85rem" }}
            onClick={() => setModalEditor("nuevo")}
          >
            + Nuevo anuncio
          </button>
        )}
      </div>

      {/* Grid de anuncios */}
      {cargando ? (
        <div className="loading" style={{ padding: "40px 0" }}>Cargando anuncios...</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p style={{ color: "var(--text2)" }}>No hay anuncios {filtro !== "todos" ? "con este filtro" : ""}</p>
          {puedeAdmin && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModalEditor("nuevo")}>
              Crear primer anuncio
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {filtrados.map((a) => (
            <AnuncioCard
              key={a.id}
              anuncio={a}
              puedeAdmin={puedeAdmin}
              onEdit={() => setModalEditor(a)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal editor */}
      {modalEditor && (
        <ModalAnuncio
          anuncio={modalEditor === "nuevo" ? null : modalEditor}
          onClose={() => setModalEditor(null)}
          onSaved={() => { setModalEditor(null); cargar(); }}
        />
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const Notificaciones = () => {
  const { usuario } = useAuth();
  const { noLeidas } = useNotificaciones();
  const puedeEnviar = ROLES_ENVIO.includes(usuario?.rol);
  const puedeAdmin  = ROLES_ADMIN.includes(usuario?.rol);

  const [seccion, setSeccion] = useState("notificaciones"); // "notificaciones" | "anuncios"

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Centro de Comunicaciones</h1>
          <p className="page-subtitle" style={{ color: "var(--text2)" }}>
            Notificaciones y anuncios de la plataforma
          </p>
        </div>
      </div>

      {/* Tabs principales */}
      <div style={{ display: "flex", gap: 0, background: "var(--bg3)", borderRadius: 12, padding: 4, border: "1px solid var(--border)", marginBottom: 24, width: "fit-content" }}>
        <button
          onClick={() => setSeccion("notificaciones")}
          style={{
            padding: "10px 24px", border: "none", borderRadius: 9, cursor: "pointer",
            fontWeight: seccion === "notificaciones" ? 700 : 400,
            fontSize: "0.9rem",
            background: seccion === "notificaciones" ? "var(--bg2)" : "transparent",
            color: seccion === "notificaciones" ? "var(--accent)" : "var(--text2)",
            boxShadow: seccion === "notificaciones" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          🔔 Notificaciones
          {noLeidas > 0 && (
            <span style={{
              background: "var(--danger)", color: "#fff", borderRadius: 20,
              padding: "1px 7px", fontSize: "0.75rem", fontWeight: 700,
            }}>
              {noLeidas}
            </span>
          )}
        </button>
        <button
          onClick={() => setSeccion("anuncios")}
          style={{
            padding: "10px 24px", border: "none", borderRadius: 9, cursor: "pointer",
            fontWeight: seccion === "anuncios" ? 700 : 400,
            fontSize: "0.9rem",
            background: seccion === "anuncios" ? "var(--bg2)" : "transparent",
            color: seccion === "anuncios" ? "var(--accent)" : "var(--text2)",
            boxShadow: seccion === "anuncios" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.2s",
          }}
        >
          📢 Anuncios
        </button>
      </div>

      {/* Contenido */}
      {seccion === "notificaciones" && (
        <SeccionNotificaciones puedeEnviar={puedeEnviar} />
      )}
      {seccion === "anuncios" && (
        <SeccionAnuncios puedeAdmin={puedeAdmin} />
      )}
    </div>
  );
};

export default Notificaciones;
