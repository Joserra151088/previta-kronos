/**
 * Organigrama.jsx
 * Árbol jerárquico interactivo:
 *  - Pan con arrastre del mouse
 *  - Zoom con rueda del mouse o botones
 *  - Exportar a PDF (jsPDF) o JPG (canvas nativo)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getUsuarios } from "../utils/api";
import jsPDF from "jspdf";

// ─── Constantes de layout para el canvas de exportación ───────────────────────
const EX_CARD_W  = 210;
const EX_CARD_H  = 85;
const EX_V_GAP   = 110;
const EX_H_GAP   = 36;
const EX_PAD     = 60;

// ─── Construcción del árbol ────────────────────────────────────────────────────
const buildTree = (users) => {
  const byId = {};
  users.forEach((u) => { byId[u.id] = { ...u, children: [] }; });
  const roots = [];
  users.forEach((u) => {
    if (u.jefeInmediatoId && byId[u.jefeInmediatoId]) {
      byId[u.jefeInmediatoId].children.push(byId[u.id]);
    } else {
      roots.push(byId[u.id]);
    }
  });
  return roots;
};

// ─── Algoritmo de layout para exportación ─────────────────────────────────────
const computeSubtreeW = (node) => {
  if (!node.children.length) return EX_CARD_W;
  const kidW = node.children.reduce((s, c) => s + computeSubtreeW(c), 0)
    + Math.max(0, node.children.length - 1) * EX_H_GAP;
  return Math.max(EX_CARD_W, kidW);
};

const assignPositions = (node, x, level) => {
  node._w = computeSubtreeW(node);
  node._y = EX_PAD + level * (EX_CARD_H + EX_V_GAP);
  if (!node.children.length) {
    node._x = x;
    return;
  }
  const totalKidW = node.children.reduce((s, c) => s + computeSubtreeW(c), 0)
    + Math.max(0, node.children.length - 1) * EX_H_GAP;
  let cx = x + node._w / 2 - totalKidW / 2;
  node.children.forEach((c) => {
    assignPositions(c, cx, level + 1);
    cx += computeSubtreeW(c) + EX_H_GAP;
  });
  const fc = node.children[0];
  const lc = node.children[node.children.length - 1];
  node._x = (fc._x + lc._x + EX_CARD_W) / 2 - EX_CARD_W / 2;
};

// ─── Dibujo en canvas para exportación ───────────────────────────────────────
const rrect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawNode = (ctx, node) => {
  const { _x: x, _y: y } = node;
  const cx = x + EX_CARD_W / 2;
  const isRoot = !node._isChild;

  // Card shadow
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  // Card background
  rrect(ctx, x, y, EX_CARD_W, EX_CARD_H, 10);
  const grad = ctx.createLinearGradient(x, y, x + EX_CARD_W, y + EX_CARD_H);
  if (isRoot) {
    grad.addColorStop(0, "#1a4a6e");
    grad.addColorStop(1, "#2a6a9a");
  } else {
    grad.addColorStop(0, "#2d5f7a");
    grad.addColorStop(1, "#3a7a9c");
  }
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = "transparent";

  // Border highlight
  rrect(ctx, x, y, EX_CARD_W, EX_CARD_H, 10);
  ctx.strokeStyle = isRoot ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.textAlign = "center";
  const nombre = `${node.nombre || ""} ${node.apellido || ""}`.trim();
  const nombreCorto = nombre.length > 26 ? nombre.substring(0, 24) + "…" : nombre;
  ctx.fillText(nombreCorto, cx, y + 30);

  // Position
  if (node.puestoNombre || node.area) {
    ctx.font = "11px Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    const puesto = (node.puestoNombre || node.area || "").substring(0, 30);
    ctx.fillText(puesto, cx, y + 48);
  }

  // Department chip
  if (node.departamento || node.area) {
    const chip = (node.departamento || node.area || "").substring(0, 22);
    const chipW = ctx.measureText(chip).width + 16;
    const chipX = cx - chipW / 2;
    const chipY = y + 58;
    rrect(ctx, chipX, chipY, chipW, 18, 9);
    ctx.fillStyle = "rgba(119,179,40,0.82)";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "10px Arial";
    ctx.fillText(chip, cx, chipY + 13);
  }

  // Children count badge
  if (node.children.length > 0) {
    ctx.fillStyle = "#77b328";
    ctx.beginPath();
    ctx.arc(x + EX_CARD_W - 14, y + 14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(node.children.length), x + EX_CARD_W - 14, y + 18);
  }

  // Connection lines
  if (node.children.length > 0) {
    ctx.strokeStyle = "rgba(160,180,200,0.55)";
    ctx.lineWidth = 2;
    const parentCX = cx;
    const parentBottom = y + EX_CARD_H;
    const midY = parentBottom + EX_V_GAP / 2;

    ctx.beginPath();
    ctx.moveTo(parentCX, parentBottom);
    ctx.lineTo(parentCX, midY);
    ctx.stroke();

    if (node.children.length > 1) {
      const fCX = node.children[0]._x + EX_CARD_W / 2;
      const lCX = node.children[node.children.length - 1]._x + EX_CARD_W / 2;
      ctx.beginPath();
      ctx.moveTo(fCX, midY);
      ctx.lineTo(lCX, midY);
      ctx.stroke();
    }

    node.children.forEach((c) => {
      c._isChild = true;
      const cCX = c._x + EX_CARD_W / 2;
      ctx.beginPath();
      ctx.moveTo(cCX, midY);
      ctx.lineTo(cCX, c._y);
      ctx.stroke();
      drawNode(ctx, c);
    });
  }
};

const crearCanvasOrg = (roots) => {
  // Assign positions
  let totalW = EX_PAD * 2;
  roots.forEach((r) => {
    r._isChild = false;
    assignPositions(r, totalW, 0);
    totalW += computeSubtreeW(r) + EX_H_GAP;
  });
  totalW += EX_PAD - EX_H_GAP;

  // Calculate height
  const allNodes = [];
  const collectNodes = (n) => { allNodes.push(n); n.children.forEach(collectNodes); };
  roots.forEach(collectNodes);
  const maxLevel = Math.max(...allNodes.map((n) => Math.floor((n._y - EX_PAD) / (EX_CARD_H + EX_V_GAP))));
  const totalH = EX_PAD + (maxLevel + 1) * (EX_CARD_H + EX_V_GAP) + EX_PAD;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(totalW, 600);
  canvas.height = Math.max(totalH, 400);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0f2335";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  roots.forEach((r) => { r._isChild = false; drawNode(ctx, r); });
  return canvas;
};

// ─── Tarjeta interactiva del nodo ─────────────────────────────────────────────
const OrgNode = ({ nodo, nivel = 0 }) => {
  const [expandido, setExpandido] = useState(nivel < 2);
  const tieneHijos = nodo.children && nodo.children.length > 0;

  const nivelColors = [
    { bg: "linear-gradient(135deg,#1a4a6e,#2a6a9a)", border: "#2a6a9a", shadow: "0 4px 16px rgba(26,74,110,0.45)" },
    { bg: "linear-gradient(135deg,#1e5f74,#2d8c9e)", border: "#2d8c9e", shadow: "0 3px 10px rgba(30,95,116,0.35)" },
    { bg: "linear-gradient(135deg,#2a5f3f,#3a8c5a)", border: "#3a8c5a", shadow: "0 2px 8px rgba(42,95,63,0.3)" },
    { bg: "linear-gradient(135deg,#4a3a6e,#6a5a9e)", border: "#6a5a9e", shadow: "0 2px 6px rgba(74,58,110,0.25)" },
  ];
  const colors = nivelColors[Math.min(nivel, nivelColors.length - 1)];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      {nivel > 0 && <div style={{ width: 2, height: 24, background: "rgba(120,150,170,0.4)" }} />}

      {/* Card */}
      <div
        style={{
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: 12,
          padding: "14px 16px",
          textAlign: "center",
          minWidth: 150,
          maxWidth: 185,
          boxShadow: colors.shadow,
          cursor: tieneHijos ? "pointer" : "default",
          transition: "transform 0.15s, box-shadow 0.15s",
          position: "relative",
          userSelect: "none",
        }}
        onClick={(e) => { e.stopPropagation(); tieneHijos && setExpandido((v) => !v); }}
        onMouseEnter={(e) => { if (tieneHijos) e.currentTarget.style.transform = "scale(1.03)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {/* Avatar */}
        {nodo.fotoUrl ? (
          <img
            src={nodo.fotoUrl.startsWith("http") ? nodo.fotoUrl : `${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${nodo.fotoUrl}`}
            alt={nodo.nombre}
            style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", marginBottom: 8, border: "2px solid rgba(255,255,255,0.3)" }}
          />
        ) : (
          <div style={{
            width: 50, height: 50, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 8px", fontSize: 22, color: "rgba(255,255,255,0.8)",
          }}>
            👤
          </div>
        )}

        <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 3, lineHeight: 1.3 }}>
          {nodo.nombre} {nodo.apellido || ""}
        </div>

        {(nodo.puestoNombre || nodo.area) && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginBottom: 4, lineHeight: 1.3 }}>
            {nodo.puestoNombre || nodo.area}
          </div>
        )}

        {nodo.departamento && (
          <span style={{
            display: "inline-block", fontSize: 10, padding: "2px 8px",
            background: "rgba(119,179,40,0.7)", color: "#fff", borderRadius: 10,
          }}>
            {nodo.departamento}
          </span>
        )}

        {/* Expand badge */}
        {tieneHijos && (
          <div style={{
            position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)",
            background: "#77b328", color: "#fff", borderRadius: "50%",
            width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            zIndex: 1,
          }}>
            {expandido ? "−" : nodo.children.length}
          </div>
        )}
      </div>

      {/* Children */}
      {tieneHijos && expandido && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 2, height: 28, background: "rgba(120,150,170,0.4)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start" }}>
            {nodo.children.length > 1 && (
              <div style={{
                position: "absolute", top: 0, left: "calc(50% / " + nodo.children.length + ")",
                right: "calc(50% / " + nodo.children.length + ")",
                height: 2, background: "rgba(120,150,170,0.4)",
              }} />
            )}
            <div style={{ display: "flex", gap: 20, paddingTop: 0 }}>
              {nodo.children.map((hijo) => (
                <OrgNode key={hijo.id} nodo={hijo} nivel={nivel + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const Organigrama = () => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios]       = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState("");
  const [busqueda, setBusqueda]       = useState("");
  const [exportando, setExportando]   = useState(false);

  // Pan/zoom
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]     = useState(0.85);
  const [dragging, setDragging] = useState(false);
  const lastPos   = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    getUsuarios({ activo: true })
      .then(setUsuarios)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // ── Mouse events ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    if (e.button !== 0) return;
    setDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setZoom((z) => Math.min(Math.max(z * factor, 0.2), 3));
  }, []);

  const resetView = () => { setPan({ x: 0, y: 0 }); setZoom(0.85); };
  const zoomIn    = () => setZoom((z) => Math.min(z * 1.15, 3));
  const zoomOut   = () => setZoom((z) => Math.max(z / 1.15, 0.2));

  // ── Filtering ─────────────────────────────────────────────────────────────
  const usuariosFiltrados = busqueda
    ? usuarios.filter((u) =>
        `${u.nombre} ${u.apellido} ${u.area || ""} ${u.puestoNombre || ""} ${u.departamento || ""}`
          .toLowerCase().includes(busqueda.toLowerCase())
      )
    : usuarios;

  const arbol = buildTree(usuariosFiltrados);

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildExportTree = () => {
    const tree = buildTree(usuariosFiltrados);
    let x = EX_PAD;
    tree.forEach((r) => {
      r._isChild = false;
      assignPositions(r, x, 0);
      x += computeSubtreeW(r) + EX_H_GAP;
    });
    return tree;
  };

  const exportarJPG = useCallback(async () => {
    if (!arbol.length) return;
    setExportando(true);
    try {
      const roots = buildExportTree();
      const canvas = crearCanvasOrg(roots);
      const link = document.createElement("a");
      link.download = "organigrama.jpg";
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } finally { setExportando(false); }
  }, [usuariosFiltrados]);

  const exportarPDF = useCallback(async () => {
    if (!arbol.length) return;
    setExportando(true);
    try {
      const roots = buildExportTree();
      const canvas = crearCanvasOrg(roots);
      const ratio = canvas.height / canvas.width;
      const pdf = new jsPDF({ orientation: ratio < 1 ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgW = pw - 10;
      const imgH = Math.min(imgW * ratio, ph - 10);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 5, 5, imgW, imgH);
      pdf.save("organigrama.pdf");
    } finally { setExportando(false); }
  }, [usuariosFiltrados]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🌲 Organigrama</h1>
          <p className="page-subtitle">
            Jerarquía organizacional — {usuarios.length} empleados activos
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={exportarPDF} disabled={exportando || !arbol.length}>
            {exportando ? "⟳" : "📄"} PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportarJPG} disabled={exportando || !arbol.length}>
            {exportando ? "⟳" : "🖼️"} JPG
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍  Buscar por nombre, área o puesto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <button className="btn btn-secondary btn-sm" onClick={zoomOut} title="Alejar">−</button>
          <span style={{ padding: "4px 10px", fontSize: 13, color: "var(--text2)", userSelect: "none", minWidth: 52, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn btn-secondary btn-sm" onClick={zoomIn}  title="Acercar">+</button>
          <button className="btn btn-secondary btn-sm" onClick={resetView} title="Restablecer vista">⌂</button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {cargando ? (
        <div className="loading">Cargando organigrama…</div>
      ) : arbol.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌲</div>
          <p>No hay empleados con jerarquía configurada.</p>
          <small style={{ color: "var(--text2)" }}>
            Asigna el "Jefe Inmediato" en el perfil de cada empleado para construir el árbol.
          </small>
        </div>
      ) : (
        /* Pan/Zoom container */
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            overflow: "hidden",
            cursor: dragging ? "grabbing" : "grab",
            border: "1px solid var(--border)",
            borderRadius: 14,
            background: "linear-gradient(135deg, #0d1b2a 0%, #0f2335 50%, #112840 100%)",
            height: "calc(100vh - 280px)",
            minHeight: 450,
            userSelect: "none",
            position: "relative",
          }}
        >
          {/* Zoom hint */}
          <div style={{
            position: "absolute", top: 10, right: 14, fontSize: 11,
            color: "rgba(255,255,255,0.35)", pointerEvents: "none", zIndex: 5,
          }}>
            🖱️ Arrastra para mover · Rueda para zoom
          </div>

          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center top",
              padding: "40px 60px 80px",
              display: "inline-flex",
              gap: 48,
              minWidth: "100%",
              boxSizing: "border-box",
              willChange: "transform",
            }}
          >
            {arbol.map((raiz) => (
              <OrgNode key={raiz.id} nodo={raiz} nivel={0} />
            ))}
          </div>
        </div>
      )}

      {/* Leyenda */}
      {!cargando && arbol.length > 0 && (
        <div style={{
          marginTop: 12, padding: "10px 16px",
          background: "var(--bg2)", borderRadius: 8,
          fontSize: 12, color: "var(--text2)",
          display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
        }}>
          <span>💡 Haz clic en <strong style={{ color: "#77b328" }}>●</strong> para expandir ramas</span>
          <span>🌲 Raíces (sin jefe): <strong>{arbol.length}</strong></span>
          <span>👥 Total: <strong>{usuariosFiltrados.length}</strong> empleados</span>
          {busqueda && <span style={{ color: "var(--primary)" }}>🔍 Filtrado por: <em>"{busqueda}"</em></span>}
        </div>
      )}
    </div>
  );
};

export default Organigrama;
