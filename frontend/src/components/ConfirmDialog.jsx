/**
 * ConfirmDialog.jsx
 * Modal de confirmación centrado con animación de entrada.
 * Uso:
 *   import { useConfirm } from "./ConfirmDialog";
 *   const { confirm, ConfirmDialogComponent } = useConfirm();
 *   ...
 *   const ok = await confirm({ title: "¿Eliminar?", message: "Esta acción no se puede deshacer." });
 *   if (ok) { ... }
 *   ...
 *   return <>{ConfirmDialogComponent}</>
 *
 * También exporta <SuccessToast /> para mostrar animación de éxito.
 */
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

// ─── ConfirmDialog hook ───────────────────────────────────────────────────────
export function useConfirm() {
  const [dialogState, setDialogState] = useState(null); // null | { title, message, type, resolve }
  const [visible, setVisible] = useState(false);

  const confirm = useCallback(({ title = "¿Confirmar acción?", message = "", type = "danger" } = {}) => {
    return new Promise((resolve) => {
      setDialogState({ title, message, type, resolve });
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const handleResponse = useCallback((answer) => {
    setVisible(false);
    setTimeout(() => {
      dialogState?.resolve(answer);
      setDialogState(null);
    }, 200);
  }, [dialogState]);

  // Cerrar con Escape
  useEffect(() => {
    if (!dialogState) return;
    const handler = (e) => { if (e.key === "Escape") handleResponse(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialogState, handleResponse]);

  const ConfirmDialogComponent = dialogState ? createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
      onClick={() => handleResponse(false)}
    >
      <div
        style={{
          background: "var(--bg2, #1e1e2e)",
          border: "1px solid var(--border, #333)",
          borderRadius: 14,
          padding: "28px 32px",
          maxWidth: 420, width: "100%",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)",
          transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icono */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: "50%",
            background: dialogState.type === "danger"
              ? "rgba(248,113,113,0.15)"
              : dialogState.type === "warning"
              ? "rgba(251,191,36,0.15)"
              : "rgba(119,179,40,0.15)",
            fontSize: "1.8rem",
          }}>
            {dialogState.type === "danger" ? "🗑️" : dialogState.type === "warning" ? "⚠️" : "❓"}
          </div>
        </div>

        {/* Título */}
        <h2 style={{ margin: "0 0 10px", fontSize: "1.05rem", fontWeight: 700, textAlign: "center", color: "var(--text, #fff)" }}>
          {dialogState.title}
        </h2>

        {/* Mensaje */}
        {dialogState.message && (
          <p style={{ margin: "0 0 24px", fontSize: "0.88rem", color: "var(--text2, #aaa)", textAlign: "center", lineHeight: 1.5 }}>
            {dialogState.message}
          </p>
        )}

        {/* Botones */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => handleResponse(false)}
            style={{
              flex: 1, padding: "10px 20px", borderRadius: 8, fontWeight: 600,
              background: "var(--bg3, #2a2a3e)", border: "1px solid var(--border, #333)",
              color: "var(--text, #fff)", cursor: "pointer", fontSize: "0.9rem",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => e.target.style.background = "var(--border, #444)"}
            onMouseLeave={(e) => e.target.style.background = "var(--bg3, #2a2a3e)"}
          >
            Cancelar
          </button>
          <button
            onClick={() => handleResponse(true)}
            style={{
              flex: 1, padding: "10px 20px", borderRadius: 8, fontWeight: 700,
              background: dialogState.type === "danger"
                ? "var(--danger, #ef4444)"
                : dialogState.type === "warning"
                ? "#f59e0b"
                : "var(--primary, #77b328)",
              border: "none",
              color: "#fff", cursor: "pointer", fontSize: "0.9rem",
              transition: "opacity 0.15s", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => e.target.style.opacity = "0.88"}
            onMouseLeave={(e) => e.target.style.opacity = "1"}
          >
            {dialogState.type === "danger" ? "Sí, eliminar" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return { confirm, ConfirmDialogComponent };
}

// ─── SuccessToast ─────────────────────────────────────────────────────────────
/**
 * Muestra una animación de éxito (checkmark) centrada en pantalla por 1.5s.
 * Uso: const { showSuccess, SuccessToastComponent } = useSuccessToast();
 *      showSuccess("¡Eliminado correctamente!");
 */
export function useSuccessToast() {
  const [toastMsg, setToastMsg] = useState(null);
  const [visible, setVisible] = useState(false);

  const showSuccess = useCallback((message = "Operación exitosa") => {
    setToastMsg(message);
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => setToastMsg(null), 300);
    }, 1800);
  }, []);

  const SuccessToastComponent = toastMsg ? createPortal(
    <div
      style={{
        position: "fixed", bottom: 32, left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s, transform 0.25s cubic-bezier(0.34,1.4,0.64,1)",
        zIndex: 9100,
        background: "var(--accent, #77b328)",
        color: "#fff",
        borderRadius: 40,
        padding: "12px 24px",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: "0.92rem", fontWeight: 600,
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{
        width: 24, height: 24, background: "rgba(255,255,255,0.25)",
        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.85rem",
      }}>✓</span>
      {toastMsg}
    </div>,
    document.body
  ) : null;

  return { showSuccess, SuccessToastComponent };
}
