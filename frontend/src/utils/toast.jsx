/**
 * toast.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilidades de notificación centralizada (react-hot-toast).
 * Importar siempre desde aquí para mantener consistencia en toda la plataforma.
 *
 * Uso:
 *   import { toastExito, toastError, toastCargando, confirmar } from "../utils/toast";
 *
 *   toastExito("Empleado guardado correctamente");
 *   toastError("No se pudo conectar al servidor");
 *   const id = toastCargando("Guardando...");
 *   toast.dismiss(id);
 *   const ok = await confirmar("¿Eliminar este registro?");
 */

import toast from "react-hot-toast";

/** Notificación de éxito */
export const toastExito = (msg, opts = {}) =>
  toast.success(msg, { duration: 4000, ...opts });

/** Notificación de error (extrae mensaje de Error o string) */
export const toastError = (err, opts = {}) => {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Ocurrió un error inesperado";
  return toast.error(msg, { duration: 5000, ...opts });
};

/** Notificación de advertencia */
export const toastAviso = (msg, opts = {}) =>
  toast(msg, {
    icon: "⚠️",
    style: {
      background: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#92400e",
    },
    duration: 5000,
    ...opts,
  });

/** Notificación de información */
export const toastInfo = (msg, opts = {}) =>
  toast(msg, {
    icon: "ℹ️",
    style: {
      background: "#eff6ff",
      border: "1px solid #93c5fd",
      color: "#1e40af",
    },
    duration: 4000,
    ...opts,
  });

/** Toast de carga (devuelve el id para poder cerrarlo con toast.dismiss(id)) */
export const toastCargando = (msg = "Procesando…", opts = {}) =>
  toast.loading(msg, { ...opts });

/**
 * Diálogo de confirmación centrado (reemplaza window.confirm).
 * Muestra un modal animado en el centro de la pantalla y devuelve una Promise<boolean>.
 *
 * @param {string} mensaje - Texto / pregunta principal
 * @param {string} [labelConfirmar="Confirmar"] - Texto del botón de confirmación
 * @param {string} [tipo="danger"] - "danger" (rojo) | "warning" (naranja) | "info" (azul)
 * @returns {Promise<boolean>}
 */
export const confirmar = (mensaje, labelConfirmar = "Confirmar", tipo = "danger") =>
  new Promise((resolve) => {
    const btnColors = { danger: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };
    const iconos    = { danger: "🗑️", warning: "⚠️", info: "❓" };
    const btnColor  = btnColors[tipo] || btnColors.danger;
    const icono     = iconos[tipo]    || iconos.danger;

    // Contenedor overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = [
      "position:fixed;inset:0;z-index:9000",
      "background:rgba(0,0,0,0.55);backdrop-filter:blur(3px)",
      "display:flex;align-items:center;justify-content:center;padding:16px",
      "opacity:0;transition:opacity 0.2s ease",
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "background:var(--bg2,#1e1e2e);border:1px solid var(--border,#333)",
      "border-radius:14px;padding:28px 32px;max-width:420px;width:100%",
      "box-shadow:0 24px 60px rgba(0,0,0,0.5)",
      "transform:scale(0.92) translateY(16px);transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1),opacity 0.2s",
      "opacity:0",
    ].join(";");

    card.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgba(248,113,113,0.15);font-size:1.8rem">${icono}</div>
      </div>
      <p style="margin:0 0 10px;font-size:1rem;font-weight:700;text-align:center;color:var(--text,#fff)">${mensaje.split("\n")[0]}</p>
      ${mensaje.split("\n").slice(1).join("<br>") ? `<p style="margin:0 0 24px;font-size:0.85rem;color:var(--text2,#aaa);text-align:center;line-height:1.5">${mensaje.split("\n").slice(1).join("<br>")}</p>` : '<div style="margin-bottom:24px"></div>'}
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="btn-cancel" style="flex:1;padding:10px 20px;border-radius:8px;font-weight:600;background:var(--bg3,#2a2a3e);border:1px solid var(--border,#333);color:var(--text,#fff);cursor:pointer;font-size:0.9rem">Cancelar</button>
        <button id="btn-confirm" style="flex:1;padding:10px 20px;border-radius:8px;font-weight:700;background:${btnColor};border:none;color:#fff;cursor:pointer;font-size:0.9rem;box-shadow:0 4px 12px rgba(0,0,0,0.3)">${labelConfirmar}</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animar entrada
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.opacity    = "1";
      card.style.transform  = "scale(1) translateY(0)";
    });

    const cleanup = (answer) => {
      overlay.style.opacity = "0";
      card.style.opacity    = "0";
      card.style.transform  = "scale(0.92) translateY(16px)";
      setTimeout(() => { document.body.removeChild(overlay); resolve(answer); }, 200);
    };

    card.querySelector("#btn-cancel").addEventListener("click",  () => cleanup(false));
    card.querySelector("#btn-confirm").addEventListener("click", () => cleanup(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { document.removeEventListener("keydown", esc); cleanup(false); }
    });
  });

/**
 * Muestra una notificación flotante de éxito con animación de entrada/salida centrada
 * en la parte inferior de la pantalla. Complementa a toastExito() para acciones importantes
 * como eliminaciones exitosas.
 *
 * @param {string} msg - Mensaje a mostrar
 * @param {number} [duration=1800] - Duración en ms antes de desaparecer
 */
export const mostrarExitoAnimado = (msg = "Operación exitosa", duration = 1800) => {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(20px)",
    "opacity:0;transition:opacity 0.25s,transform 0.25s cubic-bezier(0.34,1.4,0.64,1)",
    "z-index:9100;background:var(--accent,#77b328);color:#fff",
    "border-radius:40px;padding:12px 24px",
    "display:flex;align-items:center;gap:10px",
    "font-size:0.92rem;font-weight:600",
    "box-shadow:0 8px 28px rgba(0,0,0,0.35)",
    "pointer-events:none;white-space:nowrap",
  ].join(";");
  el.innerHTML = `<span style="width:24px;height:24px;background:rgba(255,255,255,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem">✓</span>${msg}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }, duration);
};

export { toast };
export default toast;
