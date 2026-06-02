/**
 * Sync.jsx — Página de sincronización con Athenasys
 * Permite a super_admin / agente_soporte_ti / administrador_general
 * importar empleados y sucursales desde la BD Athenasys.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const ROLES_PERMITIDOS = ["super_admin", "agente_soporte_ti", "administrador_general"];

const apiSync = (endpoint, method = "GET") => {
  const token = localStorage.getItem("token");
  return fetch(`${BASE_URL}/sync${endpoint}`, {
    method,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());
};

export default function Sync() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();

  const [preview,    setPreview]    = useState(null);
  const [loadingPrev,setLoadingPrev]= useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [log,        setLog]        = useState([]);
  const [error,      setError]      = useState(null);

  // Redirigir si no tiene permiso
  useEffect(() => {
    if (usuario && !ROLES_PERMITIDOS.includes(usuario.rol)) navigate("/dashboard");
  }, [usuario, navigate]);

  const cargarPreview = async () => {
    setLoadingPrev(true);
    setError(null);
    try {
      const data = await apiSync("/athenasys/preview");
      if (data.error) throw new Error(data.error);
      setPreview(data);
      addLog(`Vista previa: ${data.sucursales} sucursales, ${data.empleados} empleados disponibles.`);
    } catch (e) {
      setError(e.message);
      addLog(`Error: ${e.message}`);
    } finally {
      setLoadingPrev(false);
    }
  };

  const ejecutarSync = async () => {
    if (!window.confirm(`¿Sincronizar ${preview?.sucursales ?? "?"} sucursales y ${preview?.empleados ?? "?"} empleados?\n\nEsto actualizará los registros existentes y creará los nuevos. Las contraseñas por defecto serán el número de empleado.`)) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    addLog("Iniciando sincronización con Athenasys…");
    try {
      const data = await apiSync("/athenasys", "POST");
      if (data.error) throw new Error(data.error);
      setResult(data);
      addLog(`✅ Sincronización completa:`);
      addLog(`   Sucursales actualizadas: ${data.syncedSucursales}`);
      addLog(`   Empleados actualizados:  ${data.syncedEmpleados}`);
      addLog("El store en memoria fue recargado desde la BD.");
    } catch (e) {
      setError(e.message);
      addLog(`❌ Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString("es-MX", { hour12: false });
    setLog((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  if (!usuario || !ROLES_PERMITIDOS.includes(usuario.rol)) return null;

  return (
    <div className="page" style={{ padding: "32px 28px" }}>
      {/* Header */}
      <div className="k-page-head" style={{ marginBottom: 28 }}>
        <div>
          <div className="k-eyebrow">
            <span>🔄</span>
            <span>Sincronización</span>
          </div>
          <h1 className="k-h1">Sincronizar con Athenasys</h1>
          <p className="k-sub">Importa empleados y sucursales desde la base de datos corporativa de Athenasys.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>

        {/* Info card */}
        <div className="k-card" style={{ padding: "20px 24px", background: "color-mix(in srgb, var(--teal) 6%, var(--paper-2))", borderColor: "rgba(30,111,122,0.2)" }}>
          <div style={{ fontWeight: 700, color: "var(--teal)", marginBottom: 10, fontSize: "0.9rem" }}>ℹ️ ¿Qué hace la sincronización?</div>
          <ul style={{ paddingLeft: 18, color: "var(--ink-2)", fontSize: "0.85rem", lineHeight: 1.8, margin: 0 }}>
            <li>Lee las <b>sucursales activas</b> de Athenasys y las crea/actualiza con sus coordenadas GPS.</li>
            <li>Lee los <b>empleados activos</b> y los registra como usuarios con rol <code>médico_titular</code>.</li>
            <li>La contraseña por defecto es el <b>número de empleado</b> de cada persona.</li>
            <li>Si el usuario ya existe, solo se actualizan nombre, email y sucursal.</li>
          </ul>
        </div>

        {/* Preview card */}
        <div className="k-sync-card">
          <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 20, color: "var(--ink)" }}>
            Paso 1 — Ver qué se sincronizará
          </div>

          {preview && (
            <div style={{ marginBottom: 20 }}>
              <div className="k-sync-stat">
                <div className="k-sync-stat-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <div className="k-sync-stat-num">{preview.sucursales.toLocaleString("es-MX")}</div>
                  <div className="k-sync-stat-label">Sucursales activas en Athenasys</div>
                </div>
              </div>
              <div className="k-sync-stat">
                <div className="k-sync-stat-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
                </div>
                <div>
                  <div className="k-sync-stat-num">{preview.empleados.toLocaleString("es-MX")}</div>
                  <div className="k-sync-stat-label">Empleados activos en Athenasys</div>
                </div>
              </div>
            </div>
          )}

          <button
            className="k-btn k-btn-outline"
            onClick={cargarPreview}
            disabled={loadingPrev || syncing}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loadingPrev ? "⏳ Consultando Athenasys…" : "🔍 Ver datos disponibles"}
          </button>
        </div>

        {/* Sync card */}
        {preview && (
          <div className="k-sync-card">
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 12, color: "var(--ink)" }}>
              Paso 2 — Ejecutar sincronización
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginBottom: 20, lineHeight: 1.6 }}>
              Se sincronizarán <b>{preview.sucursales} sucursales</b> y <b>{preview.empleados} empleados</b>. El proceso puede tardar 1–3 minutos dependiendo del volumen.
            </p>

            {result && (
              <div className="alert alert-success" style={{ marginBottom: 16, fontSize: "0.85rem" }}>
                ✅ ¡Sincronización completada! Se actualizaron <b>{result.syncedSucursales}</b> sucursales y <b>{result.syncedEmpleados}</b> empleados.
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16, fontSize: "0.85rem" }}>
                ❌ {error}
              </div>
            )}

            <button
              className="k-btn k-btn-primary"
              onClick={ejecutarSync}
              disabled={syncing || !!result}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {syncing ? "⏳ Sincronizando… (puede tardar)" : result ? "✅ Sincronizado" : "🔄 Sincronizar ahora"}
            </button>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="k-sync-log">
            {log.join("\n")}
          </div>
        )}
      </div>
    </div>
  );
}
