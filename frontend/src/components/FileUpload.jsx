/**
 * FileUpload.jsx
 * Componente reutilizable para subir archivos (imágenes/PDF).
 * Valida MIME type, extensión y tamaño antes de aceptar el archivo.
 */

import { useRef, useState } from "react";

const MIME_PERMITIDOS = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf",
]);
const EXT_PERMITIDAS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const ACCEPT_ATTR    = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_SIZE_MB    = 10;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileUpload = ({ onChange, archivoActual, label = "Adjuntar evidencia (imagen o PDF)", requerido = false }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [nombre, setNombre]   = useState("");
  const [tamano, setTamano]   = useState("");
  const [error, setError]     = useState("");

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ── Validar MIME type ───────────────────────────────────────────────
    if (!MIME_PERMITIDOS.has(file.type)) {
      setError(`Tipo de archivo no permitido: "${file.type || "desconocido"}". Solo se aceptan JPG, PNG, WebP y PDF.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // ── Validar extensión ───────────────────────────────────────────────
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!EXT_PERMITIDAS.has(ext)) {
      setError(`Extensión no permitida (${ext}). Solo: .jpg, .png, .webp, .pdf`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // ── Validar tamaño ──────────────────────────────────────────────────
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo pesa ${formatBytes(file.size)}, supera el límite de ${MAX_SIZE_MB} MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError("");
    setNombre(file.name);
    setTamano(formatBytes(file.size));
    onChange(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const limpiar = (e) => {
    e.stopPropagation();
    setPreview(null);
    setNombre("");
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="file-upload-container">
      <label className="file-upload-label">
        {label}
        {requerido && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
      </label>

      {!nombre ? (
        <div className="file-upload-area" onClick={() => inputRef.current?.click()}>
          <span className="file-upload-icon">📎</span>
          <span>Haz clic o arrastra un archivo</span>
          <span className="file-upload-hint">JPG, PNG, WebP o PDF · máx {MAX_SIZE_MB} MB</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            onChange={handleChange}
            style={{ display: "none" }}
          />
        </div>
      ) : (
        <div className="file-upload-preview">
          {preview ? (
            <img src={preview} alt="Vista previa" className="file-upload-img" />
          ) : (
            <div className="file-upload-pdf-icon">📄</div>
          )}
          <div className="file-upload-info">
            <span className="file-upload-nombre">{nombre}</span>
            {tamano && <span style={{ fontSize: 11, color: "var(--text2)" }}>{tamano}</span>}
            <button className="btn-danger-sm" onClick={limpiar}>Quitar</button>
          </div>
        </div>
      )}

      {archivoActual && !nombre && (
        <div className="file-upload-existing">
          <a href={`${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${archivoActual}`} target="_blank" rel="noopener noreferrer">
            📎 Ver archivo adjunto actual
          </a>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
};

export default FileUpload;
