/**
 * Anuncios.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de gestión de anuncios y comunicados.
 * • Vista de galería (cards tipo Mailchimp) con filtros avanzados
 * • Editor rico: imagen, color, categoría, CTA, fechas programadas
 * • Vista previa en tiempo real mientras se diseña
 * • Estadísticas de cobertura (activos, vencidos, programados)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getAnunciosAdmin, crearAnuncioConImagen, actualizarAnuncioConImagen, eliminarAnuncio,
  getGrupos, getAreas, getUsuarios,
} from "../utils/api";
import { toastError, toastExito, toastAviso, confirmar } from "../utils/toast";

const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { value: "general",      label: "General",       icon: "📢", color: "#6366f1" },
  { value: "urgente",      label: "Urgente",        icon: "🚨", color: "#ef4444" },
  { value: "evento",       label: "Evento",         icon: "🎉", color: "#f97316" },
  { value: "beneficio",    label: "Beneficio",      icon: "🎁", color: "#22c55e" },
  { value: "capacitacion", label: "Capacitación",   icon: "📚", color: "#3b82f6" },
  { value: "mantenimiento",label: "Mantenimiento",  icon: "🔧", color: "#64748b" },
];

const COLORES_PRESET = [
  "#6366f1","#3b82f6","#0ea5e9","#22c55e","#f97316","#ef4444","#8b5cf6","#ec4899","#64748b","#0f172a",
];

const getCat = (v) => CATEGORIAS.find((c) => c.value === v) || CATEGORIAS[0];

const viasImg = (url) => url ? (url.startsWith("http") ? url : `${BASE}${url}`) : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hoy = () => new Date().toISOString().split("T")[0];

const fmtFecha = (d) => d
  ? new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
  : null;

const tiempoRel = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "ahora mismo";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

const estadoAnuncio = (a) => {
  const td = hoy();
  if (!a.activo) return "inactivo";
  if (a.fechaExpiracion && a.fechaExpiracion < td) return "vencido";
  if (a.fechaInicio && a.fechaInicio > td) return "programado";
  return "activo";
};

const ESTADO_CFG = {
  activo:     { label: "Activo",      color: "#22c55e", bg: "#f0fdf4" },
  vencido:    { label: "Vencido",     color: "#ef4444", bg: "#fef2f2" },
  programado: { label: "Programado",  color: "#f97316", bg: "#fff7ed" },
  inactivo:   { label: "Inactivo",    color: "#64748b", bg: "#f8fafc" },
};

// ─── Tarjeta de anuncio ───────────────────────────────────────────────────────

function AnuncioCard({ a, onEdit, onDelete, vista }) {
  const cat    = getCat(a.categoria);
  const color  = a.color || cat.color;
  const img    = viasImg(a.imageUrl);
  const estado = estadoAnuncio(a);
  const ecfg   = ESTADO_CFG[estado];

  if (vista === "lista") {
    return (
      <div style={{
        display: "flex", gap: 16, alignItems: "flex-start",
        background: "var(--bg2)", borderRadius: 12,
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${color}`,
        padding: "14px 16px",
        transition: "box-shadow .15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${color}22`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
      >
        {img && (
          <img src={img} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color + "22", color }}>{cat.icon} {cat.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: ecfg.bg, color: ecfg.color }}>{ecfg.label}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", marginBottom: 3 }}>{a.titulo}</div>
          <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {a.texto}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: 6 }}>
            {a.creadoPorNombre && <span>✍️ {a.creadoPorNombre} · </span>}
            {tiempoRel(a.creadoEn)}
            {a.fechaExpiracion && <span> · Vence: {fmtFecha(a.fechaExpiracion)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }} onClick={() => onEdit(a)}>✏️</button>
          <button className="btn btn-danger"    style={{ fontSize: "0.78rem", padding: "5px 10px" }} onClick={() => onDelete(a)}>🗑</button>
        </div>
      </div>
    );
  }

  // Vista grilla
  return (
    <div style={{
      background: "var(--bg2)", borderRadius: 16, overflow: "hidden",
      border: "1px solid var(--border)",
      boxShadow: "0 2px 8px rgba(0,0,0,.06)",
      transition: "transform .15s, box-shadow .15s",
      display: "flex", flexDirection: "column",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${color}33`; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.06)"; }}
    >
      {/* Imagen / banner color */}
      {img ? (
        <div style={{ height: 160, overflow: "hidden", position: "relative", flexShrink: 0 }}>
          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${color}cc)` }} />
          <div style={{ position: "absolute", bottom: 10, left: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.9)", color }}>{cat.icon} {cat.label}</span>
          </div>
        </div>
      ) : (
        <div style={{ height: 6, background: `linear-gradient(90deg, ${color}, ${color}66)`, flexShrink: 0 }} />
      )}

      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        {!img && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color + "22", color }}>{cat.icon} {cat.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: ecfg.bg, color: ecfg.color }}>{ecfg.label}</span>
          </div>
        )}
        {img && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: ecfg.bg, color: ecfg.color, marginBottom: 8, width: "fit-content" }}>{ecfg.label}</span>
        )}

        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: 6, lineHeight: 1.35 }}>{a.titulo}</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.6, flex: 1,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {a.texto}
        </p>

        {a.ctaUrl && a.ctaLabel && (
          <a href={a.ctaUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-block", marginTop: 10, padding: "6px 14px",
            background: color, color: "#fff", borderRadius: 7, fontWeight: 600,
            fontSize: "0.8rem", textDecoration: "none",
          }}>
            {a.ctaLabel} →
          </a>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
            {a.creadoPorNombre && <div>✍️ {a.creadoPorNombre}</div>}
            <div>{tiempoRel(a.creadoEn)}{a.fechaExpiracion ? ` · Vence ${fmtFecha(a.fechaExpiracion)}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 9px" }} onClick={() => onEdit(a)}>✏️ Editar</button>
            <button className="btn btn-danger"    style={{ fontSize: "0.75rem", padding: "4px 9px" }} onClick={() => onDelete(a)}>🗑</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editor de anuncio ────────────────────────────────────────────────────────

const FORM_VACIO = {
  titulo: "", texto: "", categoria: "general", color: "#6366f1",
  ctaLabel: "", ctaUrl: "", fechaInicio: "", fechaExpiracion: "", diasDuracion: "30",
  destTipo: "todos",       // "todos" | "especifico"
  destGrupos: [],          // IDs de grupos seleccionados
  destAreas: [],           // IDs de áreas seleccionadas
  destUsuarios: [],        // IDs de usuarios seleccionados
};

function EditorAnuncio({ anuncio, onClose, onSaved }) {
  const [form, setForm] = useState(anuncio ? {
    titulo:          anuncio.titulo || "",
    texto:           anuncio.texto  || "",
    categoria:       anuncio.categoria || "general",
    color:           anuncio.color || getCat(anuncio.categoria || "general").color,
    ctaLabel:        anuncio.ctaLabel || "",
    ctaUrl:          anuncio.ctaUrl   || "",
    fechaInicio:     anuncio.fechaInicio || "",
    fechaExpiracion: anuncio.fechaExpiracion || "",
    diasDuracion:    "",
    destTipo:    anuncio.destinatarios?.todos ? "todos" : (anuncio.destinatarios ? "especifico" : "todos"),
    destGrupos:  anuncio.destinatarios?.grupos   || [],
    destAreas:   anuncio.destinatarios?.areas    || [],
    destUsuarios:anuncio.destinatarios?.usuarios || [],
  } : { ...FORM_VACIO });

  const [grupos, setGrupos]     = useState([]);
  const [areasCat, setAreasCat] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [busqUsuario, setBusqUsuario] = useState("");

  useEffect(() => {
    getGrupos().then((r) => setGrupos(Array.isArray(r) ? r : [])).catch(() => {});
    getAreas().then((r) => setAreasCat(Array.isArray(r) ? r : [])).catch(() => {});
    getUsuarios({ activo: true }).then((r) => {
      const lista = Array.isArray(r) ? r : (r.data || []);
      setUsuarios(lista.filter((u) => u.activo !== false));
    }).catch(() => {});
  }, []);

  const [imgFile, setImgFile]     = useState(null);
  const [imgPreview, setImgPreview] = useState(anuncio?.imageUrl ? viasImg(anuncio.imageUrl) : null);
  const [quitarImg, setQuitarImg] = useState(false);
  const [paso, setPaso]           = useState(0); // 0=Contenido 1=Diseño 2=Entrega
  const [guardando, setGuardando] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const imgRef = useRef(null);

  const color = form.color || "#6366f1";
  const cat   = getCat(form.categoria);

  const setImg = (file) => {
    if (!file) return;
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
    setQuitarImg(false);
  };

  const quitarImagen = () => {
    setImgFile(null); setImgPreview(null); setQuitarImg(true);
    if (imgRef.current) imgRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) setImg(f);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toastAviso("El título es obligatorio"); return; }
    if (!form.texto.trim())  { toastAviso("El mensaje es obligatorio"); return; }
    setGuardando(true);

    // Construir objeto destinatarios
    let destinatarios;
    if (form.destTipo === "todos") {
      destinatarios = { todos: true };
    } else {
      destinatarios = {
        grupos:   form.destGrupos,
        areas:    form.destAreas,
        usuarios: form.destUsuarios,
      };
    }

    try {
      const campos = {
        titulo:        form.titulo.trim(),
        texto:         form.texto.trim(),
        categoria:     form.categoria,
        color:         form.color,
        destinatarios,
        ...(form.ctaLabel       ? { ctaLabel: form.ctaLabel }       : {}),
        ...(form.ctaUrl         ? { ctaUrl:   form.ctaUrl }         : {}),
        ...(form.fechaInicio    ? { fechaInicio: form.fechaInicio } : {}),
        ...(form.fechaExpiracion
            ? { fechaExpiracion: form.fechaExpiracion }
            : form.diasDuracion
              ? { diasDuracion: form.diasDuracion }
              : {}),
        ...(quitarImg ? { quitarImagen: "true" } : {}),
      };
      if (anuncio) {
        await actualizarAnuncioConImagen(anuncio.id, campos, imgFile);
        toastExito("Anuncio actualizado");
      } else {
        await crearAnuncioConImagen(campos, imgFile);
        toastExito("¡Anuncio publicado!");
      }
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  const pasos = [
    { label: "📝 Contenido",     key: 0 },
    { label: "🎨 Diseño",        key: 1 },
    { label: "👥 Destinatarios", key: 2 },
    { label: "📅 Entrega",       key: 3 },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 900, width: "96vw", display: "flex", flexDirection: "column", maxHeight: "95vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1.4rem" }}>📢</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{anuncio ? "Editar comunicado" : "Nuevo comunicado"}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>Diseña y publica anuncios para tu organización</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Barra de color + pasos */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}55)`, flexShrink: 0 }} />
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg3)", flexShrink: 0 }}>
          {pasos.map((p, i) => (
            <button key={p.key} onClick={() => setPaso(p.key)} style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: paso === p.key ? 700 : 400,
              background: "transparent",
              color: paso === p.key ? color : i < paso ? "var(--success)" : "var(--text2)",
              borderBottom: `2px solid ${paso === p.key ? color : "transparent"}`,
              transition: "all .15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {i < paso ? "✓" : null} {p.label}
            </button>
          ))}
        </div>

        {/* Contenido con scroll */}
        <form onSubmit={handleGuardar} style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "20px 24px" }}>

            {/* ── PASO 0: Contenido ──────────────────────────────── */}
            {paso === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>Título del comunicado *</label>
                  <input
                    className="form-control"
                    style={{ fontSize: "1.05rem", fontWeight: 600, marginTop: 6 }}
                    placeholder="Ej: Reunión general — viernes 10:00 AM"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>Mensaje *</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    style={{ resize: "vertical", lineHeight: 1.7, marginTop: 6 }}
                    placeholder="Escribe el contenido del comunicado. Usa saltos de línea para mejor legibilidad..."
                    value={form.texto}
                    onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <small style={{ color: form.texto.length > 500 ? "var(--danger)" : "var(--text2)" }}>
                      {form.texto.length} caracteres
                    </small>
                  </div>
                </div>

                {/* Imagen drag & drop */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>Imagen de portada</label>
                  <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setImg(e.target.files[0])} />

                  {imgPreview ? (
                    <div style={{ position: "relative", marginTop: 8, borderRadius: 12, overflow: "hidden", border: `2px solid ${color}44` }}>
                      <img src={imgPreview} alt="portada" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => imgRef.current?.click()}
                          style={{ background: "rgba(255,255,255,.95)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
                          🔄 Cambiar imagen
                        </button>
                        <button type="button" onClick={quitarImagen}
                          style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}>
                          ✕ Quitar
                        </button>
                      </div>
                      <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: "0.75rem", color: "#fff", background: "rgba(0,0,0,.5)", borderRadius: 6, padding: "2px 8px" }}>
                        {imgFile ? imgFile.name : "Imagen actual"}
                      </div>
                    </div>
                  ) : (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => imgRef.current?.click()}
                      style={{
                        marginTop: 8, border: `2px dashed ${dragOver ? color : "var(--border)"}`,
                        borderRadius: 12, padding: "36px 24px", textAlign: "center",
                        cursor: "pointer", background: dragOver ? color + "0d" : "var(--bg3)",
                        transition: "all .15s",
                      }}
                    >
                      <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🖼️</div>
                      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                        Arrastra una imagen aquí o haz clic para seleccionar
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>
                        JPG, PNG, WebP o GIF · Tamaño máximo 5 MB · Recomendado 1200×600 px
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón CTA */}
                <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 12 }}>🔗 Botón de acción (opcional)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Texto del botón</label>
                      <input className="form-control" style={{ marginTop: 4 }} placeholder="Ver más, Inscríbete..."
                        value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>URL de destino</label>
                      <input className="form-control" style={{ marginTop: 4 }} type="url" placeholder="https://..."
                        value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PASO 1: Diseño ─────────────────────────────────── */}
            {paso === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Categoría */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 10 }}>Categoría del comunicado</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                    {CATEGORIAS.map((c) => (
                      <label key={c.value} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        border: `2px solid ${form.categoria === c.value ? c.color : "var(--border)"}`,
                        background: form.categoria === c.value ? c.color + "14" : "var(--bg3)",
                        transition: "all .15s",
                      }}>
                        <input type="radio" name="cat" value={c.value} checked={form.categoria === c.value}
                          onChange={() => setForm((f) => ({ ...f, categoria: c.value, color: c.color }))}
                          style={{ display: "none" }} />
                        <span style={{ fontSize: "1.1rem" }}>{c.icon}</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: form.categoria === c.value ? c.color : "var(--text)" }}>
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Color de acento */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 10 }}>Color de acento</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {COLORES_PRESET.map((c) => (
                      <button key={c} type="button" title={c} onClick={() => setForm((f) => ({ ...f, color: c }))}
                        style={{
                          width: 36, height: 36, borderRadius: "50%", border: "none",
                          background: c, cursor: "pointer", transition: "all .15s",
                          boxShadow: form.color === c ? `0 0 0 3px var(--bg2), 0 0 0 5px ${c}` : "none",
                          transform: form.color === c ? "scale(1.2)" : "scale(1)",
                        }} />
                    ))}
                    <input type="color" value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      title="Color personalizado"
                      style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--border)", cursor: "pointer", padding: 0, background: "none" }} />
                    <span style={{ fontSize: "0.82rem", color: "var(--text2)", marginLeft: 4 }}>
                      Seleccionado: <strong style={{ color }}>{form.color}</strong>
                    </span>
                  </div>
                </div>

                {/* Vista previa */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 10 }}>👁️ Vista previa de la tarjeta</div>
                  <div style={{ maxWidth: 360 }}>
                    <div style={{
                      background: "var(--bg2)", borderRadius: 16, overflow: "hidden",
                      border: "1px solid var(--border)", boxShadow: `0 4px 20px ${color}22`,
                    }}>
                      {imgPreview ? (
                        <div style={{ height: 140, overflow: "hidden", position: "relative" }}>
                          <img src={imgPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${color}cc)` }} />
                          <div style={{ position: "absolute", bottom: 8, left: 10 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,.9)", color }}>
                              {cat.icon} {cat.label}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: 6, background: `linear-gradient(90deg, ${color}, ${color}55)` }} />
                      )}
                      <div style={{ padding: "12px 14px" }}>
                        {!imgPreview && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color + "22", color, display: "inline-block", marginBottom: 6 }}>
                            {cat.icon} {cat.label}
                          </span>
                        )}
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 5 }}>
                          {form.titulo || <span style={{ color: "var(--text2)", fontStyle: "italic" }}>Sin título</span>}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text2)", lineHeight: 1.5 }}>
                          {form.texto ? form.texto.slice(0, 90) + (form.texto.length > 90 ? "…" : "") :
                            <span style={{ fontStyle: "italic" }}>Sin texto</span>}
                        </div>
                        {form.ctaLabel && (
                          <div style={{ marginTop: 8, display: "inline-block", padding: "5px 12px", background: color, color: "#fff", borderRadius: 7, fontSize: "0.75rem", fontWeight: 600 }}>
                            {form.ctaLabel} →
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PASO 2: Destinatarios ───────────────────────────── */}
            {paso === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Toggle todos / específico */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { key: "todos",      label: "🌐 Todos los colaboradores", desc: "El comunicado será visible para toda la organización" },
                    { key: "especifico", label: "🎯 Selección específica",    desc: "Elige grupos, áreas o personas específicas" },
                  ].map((opt) => (
                    <label key={opt.key}
                      style={{
                        flex: 1, padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                        border: `2px solid ${form.destTipo === opt.key ? color : "var(--border)"}`,
                        background: form.destTipo === opt.key ? color + "0f" : "var(--bg3)",
                        transition: "all .15s",
                      }}>
                      <input type="radio" name="destTipo" value={opt.key} checked={form.destTipo === opt.key}
                        onChange={() => setForm((f) => ({ ...f, destTipo: opt.key }))}
                        style={{ display: "none" }} />
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: form.destTipo === opt.key ? color : "var(--text)", marginBottom: 4 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>{opt.desc}</div>
                    </label>
                  ))}
                </div>

                {form.destTipo === "especifico" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* ── Grupos ── */}
                    <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>👥 Grupos</span>
                        {form.destGrupos.length > 0 && (
                          <span style={{ fontSize: "0.78rem", color: color, fontWeight: 600 }}>
                            {form.destGrupos.length} seleccionado{form.destGrupos.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {grupos.length === 0 ? (
                        <div style={{ fontSize: "0.82rem", color: "var(--text2)", fontStyle: "italic" }}>No hay grupos disponibles</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {grupos.map((g) => {
                            const sel = form.destGrupos.includes(g.id);
                            return (
                              <button key={g.id} type="button"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  destGrupos: sel ? f.destGrupos.filter((x) => x !== g.id) : [...f.destGrupos, g.id],
                                }))}
                                style={{
                                  padding: "6px 14px", borderRadius: 20, border: "2px solid",
                                  borderColor: sel ? color : "var(--border)",
                                  background: sel ? color : "var(--bg2)",
                                  color: sel ? "#fff" : "var(--text)",
                                  fontSize: "0.82rem", fontWeight: sel ? 700 : 400,
                                  cursor: "pointer", transition: "all .15s",
                                }}>
                                {g.nombre}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Áreas ── */}
                    <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>🏗️ Áreas</span>
                        {form.destAreas.length > 0 && (
                          <span style={{ fontSize: "0.78rem", color: color, fontWeight: 600 }}>
                            {form.destAreas.length} seleccionada{form.destAreas.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {areasCat.length === 0 ? (
                        <div style={{ fontSize: "0.82rem", color: "var(--text2)", fontStyle: "italic" }}>No hay áreas disponibles</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {areasCat.map((a) => {
                            const sel = form.destAreas.includes(a.id);
                            return (
                              <button key={a.id} type="button"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  destAreas: sel ? f.destAreas.filter((x) => x !== a.id) : [...f.destAreas, a.id],
                                }))}
                                style={{
                                  padding: "6px 14px", borderRadius: 20, border: "2px solid",
                                  borderColor: sel ? color : "var(--border)",
                                  background: sel ? color : "var(--bg2)",
                                  color: sel ? "#fff" : "var(--text)",
                                  fontSize: "0.82rem", fontWeight: sel ? 700 : 400,
                                  cursor: "pointer", transition: "all .15s",
                                }}>
                                {a.nombre}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Personas específicas ── */}
                    <div style={{ background: "var(--bg3)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>👤 Personas específicas</span>
                        {form.destUsuarios.length > 0 && (
                          <span style={{ fontSize: "0.78rem", color: color, fontWeight: 600 }}>
                            {form.destUsuarios.length} seleccionada{form.destUsuarios.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <input className="form-control" style={{ marginBottom: 8 }} placeholder="🔍 Buscar por nombre..."
                        value={busqUsuario} onChange={(e) => setBusqUsuario(e.target.value)} />
                      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                        {usuarios
                          .filter((u) => {
                            const q = busqUsuario.toLowerCase();
                            return !q || `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                          })
                          .map((u) => {
                            const sel = form.destUsuarios.includes(u.id);
                            return (
                              <label key={u.id}
                                style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                  background: sel ? color + "12" : "var(--bg2)",
                                  border: `1px solid ${sel ? color + "44" : "var(--border)"}`,
                                  transition: "all .15s",
                                }}>
                                <input type="checkbox" checked={sel}
                                  onChange={() => setForm((f) => ({
                                    ...f,
                                    destUsuarios: sel ? f.destUsuarios.filter((x) => x !== u.id) : [...f.destUsuarios, u.id],
                                  }))}
                                  style={{ accentColor: color, width: 16, height: 16, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: sel ? color : "var(--text)" }}>
                                    {u.nombre} {u.apellido}
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                                    {u.rol?.replace(/_/g, " ")} {u.area ? `· ${u.area}` : ""}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    {/* Resumen selección */}
                    {(form.destGrupos.length > 0 || form.destAreas.length > 0 || form.destUsuarios.length > 0) && (
                      <div style={{ background: color + "0d", borderRadius: 10, padding: 14, border: `1px solid ${color}33`, fontSize: "0.82rem" }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color }}>📊 Resumen de destinatarios</div>
                        {form.destGrupos.length > 0 && (
                          <div>👥 Grupos: {form.destGrupos.map((id) => grupos.find((g) => g.id === id)?.nombre).filter(Boolean).join(", ")}</div>
                        )}
                        {form.destAreas.length > 0 && (
                          <div>🏗️ Áreas: {form.destAreas.map((id) => areasCat.find((a) => a.id === id)?.nombre).filter(Boolean).join(", ")}</div>
                        )}
                        {form.destUsuarios.length > 0 && (
                          <div>👤 Personas: {form.destUsuarios.map((id) => { const u = usuarios.find((u) => u.id === id); return u ? `${u.nombre} ${u.apellido}` : null; }).filter(Boolean).join(", ")}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {form.destTipo === "todos" && (
                  <div style={{ background: color + "0d", borderRadius: 10, padding: 16, border: `1px solid ${color}33`, textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🌐</div>
                    <div style={{ fontWeight: 700, color, marginBottom: 4 }}>Comunicado para toda la organización</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
                      Este comunicado será visible para todos los colaboradores activos de la plataforma.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PASO 3: Entrega ─────────────────────────────────── */}
            {paso === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>📅 Publicar desde</label>
                    <input type="date" className="form-control" style={{ marginTop: 6 }}
                      value={form.fechaInicio}
                      onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
                    <small style={{ color: "var(--text2)", marginTop: 4, display: "block" }}>
                      Vacío = publicar inmediatamente
                    </small>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>⏰ Expirar el</label>
                    <input type="date" className="form-control" style={{ marginTop: 6 }}
                      value={form.fechaExpiracion}
                      min={form.fechaInicio || hoy()}
                      onChange={(e) => setForm((f) => ({ ...f, fechaExpiracion: e.target.value, diasDuracion: "" }))} />
                    <small style={{ color: "var(--text2)", marginTop: 4, display: "block" }}>
                      Define cuándo deja de mostrarse
                    </small>
                  </div>
                </div>

                {!form.fechaExpiracion && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 10 }}>⏳ O duración en días</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {[7, 14, 30, 60, 90, 180].map((d) => (
                        <button key={d} type="button"
                          onClick={() => setForm((f) => ({ ...f, diasDuracion: String(d) }))}
                          style={{
                            padding: "8px 16px", borderRadius: 9, border: "2px solid",
                            borderColor: form.diasDuracion === String(d) ? color : "var(--border)",
                            background: form.diasDuracion === String(d) ? color + "14" : "var(--bg3)",
                            color: form.diasDuracion === String(d) ? color : "var(--text)",
                            fontWeight: form.diasDuracion === String(d) ? 700 : 400,
                            cursor: "pointer", fontSize: "0.85rem", transition: "all .15s",
                          }}>
                          {d < 30 ? `${d} días` : d === 30 ? "1 mes" : d === 60 ? "2 meses" : d === 90 ? "3 meses" : "6 meses"}
                        </button>
                      ))}
                      <input type="number" className="form-control" style={{ width: 90 }} min={1} max={365}
                        placeholder="Otro" value={![7,14,30,60,90,180].includes(Number(form.diasDuracion)) ? form.diasDuracion : ""}
                        onChange={(e) => setForm((f) => ({ ...f, diasDuracion: e.target.value }))} />
                    </div>
                    <small style={{ color: "var(--text2)", marginTop: 6, display: "block" }}>
                      {form.diasDuracion ? `Expirará en ${form.diasDuracion} días` : "Predeterminado: 30 días"}
                    </small>
                  </div>
                )}

                {/* Resumen final */}
                <div style={{ background: `${color}0d`, borderRadius: 12, padding: 20, border: `1px solid ${color}33` }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 12, color }}>
                    📋 Resumen del comunicado
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { icon: "📌", label: "Título",         val: form.titulo || <em style={{ color: "var(--text2)" }}>Sin título</em> },
                      { icon: "🏷️", label: "Categoría",      val: `${cat.icon} ${cat.label}` },
                      { icon: "👥", label: "Destinatarios",  val: form.destTipo === "todos" ? "Todos" : `${form.destGrupos.length + form.destAreas.length + form.destUsuarios.length} seleccionados` },
                      { icon: "📅", label: "Publicación",    val: form.fechaInicio ? fmtFecha(form.fechaInicio) : "Inmediata" },
                      { icon: "⏰", label: "Expiración",     val: form.fechaExpiracion ? fmtFecha(form.fechaExpiracion) : form.diasDuracion ? `En ${form.diasDuracion} días` : "30 días (pred.)" },
                      { icon: "🖼️", label: "Imagen",         val: imgPreview ? "Sí ✓" : "Sin imagen" },
                      { icon: "🔗", label: "Botón CTA",      val: form.ctaLabel ? `"${form.ctaLabel}"` : "Sin botón" },
                    ].map((r) => (
                      <div key={r.label} style={{ display: "flex", gap: 8, fontSize: "0.85rem" }}>
                        <span style={{ flexShrink: 0 }}>{r.icon}</span>
                        <div>
                          <div style={{ color: "var(--text2)", fontSize: "0.75rem" }}>{r.label}</div>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>{r.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel de vista previa lateral — visible en desktop */}
          {paso === 0 && (
            <div style={{
              width: 280, flexShrink: 0, borderLeft: "1px solid var(--border)",
              background: "var(--bg3)", padding: "20px 16px", overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text2)", textAlign: "center" }}>VISTA PREVIA</div>
              <div style={{
                background: "var(--bg2)", borderRadius: 12, overflow: "hidden",
                border: "1px solid var(--border)", boxShadow: `0 2px 10px ${color}22`,
              }}>
                {imgPreview ? (
                  <div style={{ height: 110, overflow: "hidden", position: "relative" }}>
                    <img src={imgPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${color}bb)` }} />
                  </div>
                ) : (
                  <div style={{ height: 5, background: `linear-gradient(90deg, ${color}, ${color}55)` }} />
                )}
                <div style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: color + "22", color, display: "inline-block", marginBottom: 5 }}>
                    {cat.icon} {cat.label}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 4 }}>
                    {form.titulo || <em style={{ color: "var(--text2)", fontWeight: 400 }}>Tu título aquí</em>}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)", lineHeight: 1.5 }}>
                    {form.texto ? form.texto.slice(0, 70) + (form.texto.length > 70 ? "…" : "") :
                      <em>Tu mensaje aparecerá aquí...</em>}
                  </div>
                  {form.ctaLabel && (
                    <div style={{ marginTop: 7, display: "inline-block", padding: "4px 10px", background: color, color: "#fff", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600 }}>
                      {form.ctaLabel} →
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text2)", textAlign: "center" }}>
                La tarjeta se actualiza en tiempo real mientras escribes
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid var(--border)", flexShrink: 0, gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {paso > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => setPaso((p) => p - 1)}>
                ← Anterior
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            {paso < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: color, borderColor: color }}
                onClick={() => setPaso((p) => p + 1)}
                disabled={paso === 0 && (!form.titulo.trim() || !form.texto.trim())}
              >
                Siguiente →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: color, borderColor: color }}
                disabled={guardando}
                onClick={handleGuardar}
              >
                {guardando ? "Publicando..." : anuncio ? "💾 Guardar cambios" : "🚀 Publicar comunicado"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const Anuncios = () => {
  const { usuario } = useAuth();
  const [lista, setLista]         = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [filtro, setFiltro]       = useState("todos");
  const [catFiltro, setCatFiltro] = useState("");
  const [busqueda, setBusqueda]   = useState("");
  const [vista, setVista]         = useState("grid"); // "grid" | "lista"
  const [editor, setEditor]       = useState(null);   // null | "nuevo" | anuncio

  const puedeAdmin = ["super_admin", "administrador_general"].includes(usuario?.rol);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await getAnunciosAdmin();
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleDelete = async (a) => {
    const ok = await confirmar(`¿Eliminar el comunicado "${a.titulo}"? Esta acción no se puede deshacer.`, "Eliminar", "danger");
    if (!ok) return;
    try {
      await eliminarAnuncio(a.id);
      toastExito("Comunicado eliminado");
      cargar();
    } catch (err) {
      toastError(err);
    }
  };

  const td = hoy();

  // Estadísticas rápidas
  const stats = {
    total:      lista.length,
    activos:    lista.filter((a) => a.activo && (!a.fechaExpiracion || a.fechaExpiracion >= td) && (!a.fechaInicio || a.fechaInicio <= td)).length,
    programados:lista.filter((a) => a.fechaInicio && a.fechaInicio > td).length,
    vencidos:   lista.filter((a) => a.fechaExpiracion && a.fechaExpiracion < td).length,
  };

  // Filtrado
  const filtrados = lista.filter((a) => {
    if (filtro === "activos"    && estadoAnuncio(a) !== "activo")     return false;
    if (filtro === "vencidos"   && estadoAnuncio(a) !== "vencido")    return false;
    if (filtro === "programados"&& estadoAnuncio(a) !== "programado") return false;
    if (catFiltro && a.categoria !== catFiltro) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!a.titulo.toLowerCase().includes(q) && !a.texto.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">📢 Anuncios y Comunicados</h1>
          <p className="page-subtitle">Diseña y publica comunicados para toda la organización</p>
        </div>
        {puedeAdmin && (
          <button
            className="btn btn-primary"
            style={{ padding: "10px 20px", fontSize: "0.9rem", fontWeight: 700 }}
            onClick={() => setEditor("nuevo")}
          >
            + Nuevo comunicado
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total",       value: stats.total,       color: "#6366f1", icon: "📢" },
          { label: "Activos",     value: stats.activos,     color: "#22c55e", icon: "✅" },
          { label: "Programados", value: stats.programados, color: "#f97316", icon: "📅" },
          { label: "Vencidos",    value: stats.vencidos,    color: "#94a3b8", icon: "⏰" },
        ].map((s) => (
          <div key={s.label} onClick={() => setFiltro(s.label.toLowerCase())}
            style={{
              background: "var(--bg2)", borderRadius: 12, padding: "14px 16px",
              border: `1px solid var(--border)`, cursor: "pointer", transition: "all .15s",
              borderTop: `3px solid ${s.color}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${s.color}33`; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text2)", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        background: "var(--bg2)", borderRadius: 12, padding: "12px 16px",
        border: "1px solid var(--border)", marginBottom: 20,
      }}>
        {/* Búsqueda */}
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text2)" }}>🔍</span>
          <input
            className="form-control"
            style={{ paddingLeft: 32, marginBottom: 0 }}
            placeholder="Buscar comunicados..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* Estado */}
        <div style={{ display: "flex", gap: 4, background: "var(--bg3)", borderRadius: 9, padding: 3, border: "1px solid var(--border)" }}>
          {[
            { key: "todos",       label: "Todos"       },
            { key: "activos",     label: "Activos"     },
            { key: "programados", label: "Programados" },
            { key: "vencidos",    label: "Vencidos"    },
          ].map((f) => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{
                padding: "5px 12px", border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: "0.82rem", fontWeight: filtro === f.key ? 700 : 400,
                background: filtro === f.key ? "var(--accent)" : "transparent",
                color: filtro === f.key ? "#fff" : "var(--text2)",
                transition: "all .15s",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Categoría */}
        <select className="form-control" style={{ width: "auto", minWidth: 160, marginBottom: 0 }}
          value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
        </select>

        {/* Toggle vista */}
        <div style={{ display: "flex", gap: 3, background: "var(--bg3)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
          {[
            { key: "grid",  icon: "⊞" },
            { key: "lista", icon: "☰" },
          ].map((v) => (
            <button key={v.key} onClick={() => setVista(v.key)}
              style={{
                width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: "1rem", background: vista === v.key ? "var(--accent)" : "transparent",
                color: vista === v.key ? "#fff" : "var(--text2)", transition: "all .15s",
              }}>
              {v.icon}
            </button>
          ))}
        </div>

        {/* Contador */}
        <span style={{ fontSize: "0.82rem", color: "var(--text2)", whiteSpace: "nowrap" }}>
          {filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="loading" style={{ padding: "60px 0" }}>Cargando comunicados...</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state" style={{ padding: "60px 0" }}>
          <div className="empty-icon">📭</div>
          <p style={{ color: "var(--text2)", marginBottom: 16 }}>
            {busqueda || catFiltro || filtro !== "todos"
              ? "No se encontraron comunicados con ese filtro"
              : "Aún no hay comunicados publicados"}
          </p>
          {puedeAdmin && (
            <button className="btn btn-primary" onClick={() => setEditor("nuevo")}>
              Crear primer comunicado
            </button>
          )}
        </div>
      ) : vista === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {filtrados.map((a) => (
            <AnuncioCard key={a.id} a={a} onEdit={setEditor} onDelete={handleDelete} vista="grid" />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map((a) => (
            <AnuncioCard key={a.id} a={a} onEdit={setEditor} onDelete={handleDelete} vista="lista" />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editor && (
        <EditorAnuncio
          anuncio={editor === "nuevo" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); cargar(); }}
        />
      )}
    </div>
  );
};

export default Anuncios;
