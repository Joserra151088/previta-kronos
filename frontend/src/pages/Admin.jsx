/**
 * Admin.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Administración del sistema: Puestos, Horarios, configuración de Roles y Empresa.
 * Acceso: super_admin y agente_soporte_ti (la pestaña Roles/Empresa solo super_admin).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useEmpresa } from "../context/EmpresaContext";
import {
  getPuestosAdmin, crearPuesto, actualizarPuesto, eliminarPuesto,
  getHorarios, crearHorario, actualizarHorario, eliminarHorario,
  getConfigRoles, updateConfigRol,
  getEmpresaConfig, updateEmpresaConfig, uploadLogoEmpresa, actualizarCamposPuesto,
  getAnunciosAdmin, crearAnuncio, actualizarAnuncio, eliminarAnuncio,
  getAreasAdmin, crearArea, actualizarArea, eliminarArea,
  getGrupos, getUsuarios,
  getRoles, crearRol, actualizarRol, eliminarRol,
} from "../utils/api";
import { toastExito, toastError, confirmar } from "../utils/toast";

// ─── Rich Text Editor ─────────────────────────────────────────────────────────
/**
 * Editor de texto enriquecido sin dependencias externas.
 * Usa contentEditable + document.execCommand para formateo básico.
 */
const RichTextEditor = ({ initialValue = "", onChange, minHeight = 130 }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialValue;
    }
  }, []); // solo al montar

  const exec = useCallback((cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (onChange) onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleInput = () => {
    if (onChange) onChange(editorRef.current?.innerHTML || "");
  };

  const btnStyle = (active = false) => ({
    border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
    background: active ? "color-mix(in srgb, var(--primary) 15%, var(--bg-card))" : "var(--bg-card)",
    borderRadius: 4, padding: "3px 7px", cursor: "pointer",
    fontSize: 13, color: "var(--text)", lineHeight: 1.4,
  });

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      {/* Barra de herramientas */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 4,
        padding: "6px 8px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
      }}>
        <button type="button" title="Negrita" style={btnStyle()} onClick={() => exec("bold")}>
          <strong>N</strong>
        </button>
        <button type="button" title="Cursiva" style={btnStyle()} onClick={() => exec("italic")}>
          <em>I</em>
        </button>
        <button type="button" title="Subrayado" style={btnStyle()} onClick={() => exec("underline")}>
          <u>S</u>
        </button>
        <div style={{ width: 1, background: "var(--border)", margin: "0 3px" }} />
        <button type="button" title="Alinear izquierda" style={btnStyle()} onClick={() => exec("justifyLeft")}>⬅</button>
        <button type="button" title="Centrar" style={btnStyle()} onClick={() => exec("justifyCenter")}>☰</button>
        <button type="button" title="Alinear derecha" style={btnStyle()} onClick={() => exec("justifyRight")}>➡</button>
        <div style={{ width: 1, background: "var(--border)", margin: "0 3px" }} />
        <select
          title="Tamaño de fuente"
          style={{ ...btnStyle(), padding: "3px 4px" }}
          defaultValue="3"
          onChange={(e) => exec("fontSize", e.target.value)}
        >
          <option value="1">Pequeño</option>
          <option value="2">Chico</option>
          <option value="3">Normal</option>
          <option value="4">Mediano</option>
          <option value="5">Grande</option>
          <option value="6">Más grande</option>
          <option value="7">Máximo</option>
        </select>
        <div style={{ width: 1, background: "var(--border)", margin: "0 3px" }} />
        <button type="button" title="Lista" style={btnStyle()} onClick={() => exec("insertUnorderedList")}>• Lista</button>
        <button type="button" title="Limpiar formato" style={btnStyle()} onClick={() => exec("removeFormat")}>✖ Formato</button>
      </div>

      {/* Área de escritura */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        style={{
          minHeight, padding: "10px 12px",
          outline: "none", fontSize: 14,
          lineHeight: 1.6, color: "var(--text)",
          background: "var(--bg-card)",
        }}
      />
    </div>
  );
};

const DIAS = [
  { val: 1, label: "Lun" }, { val: 2, label: "Mar" }, { val: 3, label: "Mié" },
  { val: 4, label: "Jue" }, { val: 5, label: "Vie" }, { val: 6, label: "Sáb" }, { val: 0, label: "Dom" },
];

const FORM_PUESTO_VACIO  = { nombre: "", descripcion: "", horarioId: "", areaId: "" };
const FORM_AREA_VACIO    = { nombre: "", descripcion: "" };
const FORM_NOTIF_VACIO   = {
  titulo: "", contenidoHtml: "", fechaInicio: "", fechaExpiracion: "",
  destinatariosTodos: true, destinatariosGrupos: [], destinatariosUsuarios: [],
};
const FORM_HORARIO_VACIO = {
  nombre: "", horaEntrada: "08:00", horaSalida: "17:00",
  horaSalidaAlimentos: "", horaRegresoAlimentos: "",
  diasLaborales: [1, 2, 3, 4, 5], toleranciaMinutos: 10,
};

const ROLES_SISTEMA = [
  { key: "administrador_general",     label: "Administrador General",
    desc: "Acceso total al sistema. Gestiona licencias y configuración global." },
  { key: "super_admin",               label: "Super Administrador",
    desc: "Administración completa de la plataforma (usuarios, módulos, empresa)." },
  { key: "agente_soporte_ti",         label: "Agente Soporte TI",
    desc: "Soporte técnico con acceso a logs y configuración operativa." },
  { key: "supervisor_sucursales",     label: "Supervisor de Sucursales",
    desc: "Aprueba incidencias y monitorea asistencia de su sucursal." },
  { key: "agente_control_asistencia", label: "Agente Control Asistencia",
    desc: "Captura registros manuales y gestiona asistencia del personal." },
  { key: "nominas",                   label: "Nóminas",
    desc: "Consulta reportes de incidencias y horas trabajadas." },
  { key: "visor_reportes",            label: "Visor de Reportes",
    desc: "Solo lectura: reportes, dashboard y mapa." },
  { key: "medico_titular",            label: "Médico Titular",
    desc: "Registra su propia asistencia y solicita incidencias." },
  { key: "medico_de_guardia",         label: "Médico de Guardia",
    desc: "Registro de acceso en cualquier sucursal disponible." },
];

// ─── Componente principal ─────────────────────────────────────────────────────
const Admin = ({ defaultTab = "puestos", visibleTabs = null }) => {
  const { usuario } = useAuth();
  const { setEmpresa: setEmpresaGlobal, refreshEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const esSuperAdmin = ["super_admin", "administrador_general"].includes(usuario?.rol);
  const puedeEditar  = usuario?.puedeEditar !== false;

  const [tab,       setTab]       = useState(defaultTab);
  // Sync tab when defaultTab prop changes (e.g. navigating from /empresa → /puestos)
  useEffect(() => { setTab(defaultTab); }, [defaultTab]);

  const [puestos,   setPuestos]   = useState([]);
  const [areas,     setAreas]     = useState([]);
  const [horarios,  setHorarios]  = useState([]);
  const [modal,     setModal]     = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [formP,     setFormP]     = useState(FORM_PUESTO_VACIO);
  const [formH,     setFormH]     = useState(FORM_HORARIO_VACIO);
  const [error,     setError]     = useState("");
  const [guardando, setGuardando] = useState(false);

  // Config de roles (permisos por módulo)
  const [modulosSistema, setModulosSistema] = useState([]);
  const [configRoles,    setConfigRoles]    = useState({});
  const [cargandoRoles,  setCargandoRoles]  = useState(false);
  const [guardandoRol,   setGuardandoRol]   = useState(null);

  // CRUD de roles (lista de roles del sistema)
  const [rolesList,       setRolesList]       = useState([]);
  const [rolModal,        setRolModal]        = useState(false);
  const [rolEditando,     setRolEditando]     = useState(null);
  const [formRol,         setFormRol]         = useState({ clave: "", nombre: "", descripcion: "", puedeEditar: false });
  const [guardandoNuevoRol, setGuardandoNuevoRol] = useState(false);
  const [rolError,        setRolError]        = useState("");

  // Campos adicionales del puesto
  const [camposEditando, setCamposEditando] = useState([]);

  // Empresa
  const [empresa,         setEmpresa]         = useState({ nombre: "", razonSocial: "", rfc: "", domicilio: "", telefono: "", email: "" });
  const [logoUrl,         setLogoUrl]         = useState(null);
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [logoFile,        setLogoFile]        = useState(null);
  const [logoPreview,     setLogoPreview]     = useState(null);
  const logoInputRef = useRef(null);

  // Áreas
  const [areaModal,      setAreaModal]      = useState(false);
  const [areaEditando,   setAreaEditando]   = useState(null);
  const [formArea,       setFormArea]       = useState(FORM_AREA_VACIO);
  const [guardandoArea,  setGuardandoArea]  = useState(false);
  const [areaError,      setAreaError]      = useState("");

  // Notificaciones (anuncios)
  const [notificaciones,     setNotificaciones]     = useState([]);
  const [notifModal,         setNotifModal]         = useState(false);
  const [notifEditando,      setNotifEditando]      = useState(null);
  const [formNotif,          setFormNotif]          = useState(FORM_NOTIF_VACIO);
  const [guardandoNotif,     setGuardandoNotif]     = useState(false);
  const [notifError,         setNotifError]         = useState("");
  // Listas para seleccionar destinatarios
  const [notifGrupos,        setNotifGrupos]        = useState([]);
  const [notifUsuarios,      setNotifUsuarios]      = useState([]);

  // ── Carga ───────────────────────────────────────────────────────────────────
  const cargar = () => {
    getPuestosAdmin().then(setPuestos).catch(() => {});
    getHorarios().then(setHorarios).catch(() => {});
    getAreasAdmin().then(setAreas).catch(() => {});
    if (esSuperAdmin) {
      getEmpresaConfig().then(e => {
        setEmpresa({ nombre: e.nombre || "", razonSocial: e.razonSocial || "", rfc: e.rfc || "", domicilio: e.domicilio || "", telefono: e.telefono || "", email: e.email || "" });
        setLogoUrl(e.logoUrl);
      }).catch(() => {});
    }
  };

  const cargarConfigRoles = async () => {
    if (!esSuperAdmin) return;
    setCargandoRoles(true);
    try {
      const [data, roles] = await Promise.all([getConfigRoles(), getRoles().catch(() => [])]);
      setModulosSistema(data.modulos || []);
      setConfigRoles(data.config   || {});
      setRolesList(Array.isArray(roles) ? roles : []);
    } catch { /* silencioso */ } finally { setCargandoRoles(false); }
  };

  const cargarNotificaciones = () => {
    getAnunciosAdmin().then(setNotificaciones).catch(() => {});
    // Cargar listas de destinatarios al abrir la pestaña (lazy)
    if (notifGrupos.length === 0)   getGrupos().then(setNotifGrupos).catch(() => {});
    if (notifUsuarios.length === 0) getUsuarios().then((u) => setNotifUsuarios(Array.isArray(u) ? u.filter((x) => x.activo) : [])).catch(() => {});
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (tab === "roles") cargarConfigRoles(); }, [tab]);
  useEffect(() => { if (tab === "notificaciones") cargarNotificaciones(); }, [tab]);

  // ── Modal crear / editar ────────────────────────────────────────────────────
  const abrirModal = (item = null) => {
    setEditando(item);
    setError("");
    if (tab === "puestos") {
      setFormP(item
        ? { nombre: item.nombre, descripcion: item.descripcion || "", horarioId: item.horarioId || "" }
        : FORM_PUESTO_VACIO);
      setCamposEditando(item?.camposExtra || []);
    } else {
      setFormH(item
        ? {
            nombre:               item.nombre,
            horaEntrada:          item.horaEntrada,
            horaSalida:           item.horaSalida,
            horaSalidaAlimentos:  item.horaSalidaAlimentos  || "",
            horaRegresoAlimentos: item.horaRegresoAlimentos || "",
            diasLaborales:        item.diasLaborales,
            toleranciaMinutos:    item.toleranciaMinutos,
          }
        : FORM_HORARIO_VACIO);
    }
    setModal(true);
  };

  const handleSubmitPuesto = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datos = { ...formP, horarioId: formP.horarioId || null };
      let puestoResult;
      if (editando) {
        puestoResult = await actualizarPuesto(editando.id, datos);
        await actualizarCamposPuesto(editando.id, camposEditando);
      } else {
        puestoResult = await crearPuesto(datos);
        await actualizarCamposPuesto(puestoResult.id, camposEditando);
      }
      setModal(false);
      cargar();
      // Invalidar caché de puestos para que Empleados y otras páginas lo reflejen de inmediato
      queryClient.invalidateQueries({ queryKey: ["puestos"] });
      toastExito(editando ? "Puesto actualizado" : "Puesto creado correctamente");
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  const handleSubmitHorario = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const data = {
        ...formH,
        toleranciaMinutos:    parseInt(formH.toleranciaMinutos, 10),
        horaSalidaAlimentos:  formH.horaSalidaAlimentos  || null,
        horaRegresoAlimentos: formH.horaRegresoAlimentos || null,
      };
      if (editando) await actualizarHorario(editando.id, data);
      else          await crearHorario(data);
      setModal(false);
      cargar();
      queryClient.invalidateQueries({ queryKey: ["horarios"] });
      toastExito(editando ? "Horario actualizado" : "Horario creado correctamente");
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };

  const handleEliminar = async (id, nombre) => {
    const tipo = tab === "puestos" ? "puesto" : "horario";
    if (!(await confirmar(`¿Eliminar ${tipo} "${nombre}"? Esta acción no se puede deshacer.`, "Eliminar", "danger"))) return;
    try {
      if (tab === "puestos") {
        await eliminarPuesto(id);
        queryClient.invalidateQueries({ queryKey: ["puestos"] });
      } else {
        await eliminarHorario(id);
        queryClient.invalidateQueries({ queryKey: ["horarios"] });
      }
      cargar();
      toastExito(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} eliminado correctamente`);
    } catch (err) { toastError(err); }
  };

  const toggleDia = (dia) => {
    setFormH((prev) => ({
      ...prev,
      diasLaborales: prev.diasLaborales.includes(dia)
        ? prev.diasLaborales.filter((d) => d !== dia)
        : [...prev.diasLaborales, dia],
    }));
  };

  // ── Gestión de roles ────────────────────────────────────────────────────────
  const toggleModulo = (rol, moduloKey) => {
    setConfigRoles((prev) => {
      const modulos    = prev[rol] || [];
      const nuevosMod  = modulos.includes(moduloKey)
        ? modulos.filter((m) => m !== moduloKey)
        : [...modulos, moduloKey];
      return { ...prev, [rol]: nuevosMod };
    });
  };

  const guardarRol = async (rolKey) => {
    setGuardandoRol(rolKey);
    try { await updateConfigRol(rolKey, configRoles[rolKey] || []); }
    catch (err) { toastError(err); }
    finally { setGuardandoRol(null); }
  };

  // ── CRUD Roles ─────────────────────────────────────────────────────────────
  const abrirRolModal = (rol = null) => {
    setRolEditando(rol);
    setRolError("");
    setFormRol(rol
      ? { clave: rol.clave, nombre: rol.nombre, descripcion: rol.descripcion || "", puedeEditar: !!rol.puede_editar }
      : { clave: "", nombre: "", descripcion: "", puedeEditar: false });
    setRolModal(true);
  };

  const guardarNuevoRol = async (e) => {
    e.preventDefault();
    setGuardandoNuevoRol(true);
    setRolError("");
    try {
      if (rolEditando) {
        const actualizado = await actualizarRol(rolEditando.clave, {
          nombre: formRol.nombre,
          descripcion: formRol.descripcion,
          puede_editar: formRol.puedeEditar,
        });
        setRolesList((prev) => prev.map((r) => r.clave === rolEditando.clave ? { ...r, ...actualizado } : r));
        toastExito("Rol actualizado correctamente");
      } else {
        const nuevo = await crearRol({ ...formRol, puede_editar: formRol.puedeEditar });
        setRolesList((prev) => [...prev, nuevo]);
        toastExito("Rol creado correctamente");
      }
      setRolModal(false);
    } catch (err) {
      setRolError(err.message || "Error al guardar el rol");
    } finally {
      setGuardandoNuevoRol(false);
    }
  };

  const handleEliminarRol = async (rol) => {
    const ok = await confirmar(`¿Eliminar el rol "${rol.nombre}"?\n\nSolo se puede eliminar si ningún empleado tiene este rol asignado.`);
    if (!ok) return;
    try {
      await eliminarRol(rol.clave);
      setRolesList((prev) => prev.filter((r) => r.clave !== rol.clave));
      toastExito("Rol eliminado correctamente");
    } catch (err) {
      toastError(err.message || "No se pudo eliminar el rol");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const nombreHorario = (id) => horarios.find((h) => h.id === id)?.nombre || "Sin horario";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Administración</h1>
          <p className="page-subtitle">Puestos, horarios y configuración del sistema</p>
        </div>
        {tab !== "roles" && tab !== "empresa" && tab !== "notificaciones" && tab !== "areas" && puedeEditar && (
          <button className="btn btn-primary" onClick={() => abrirModal()}>
            + Nuevo {tab === "puestos" ? "Puesto" : "Horario"}
          </button>
        )}
        {tab === "areas" && puedeEditar && (
          <button className="btn btn-primary" onClick={() => {
            setAreaEditando(null);
            setFormArea(FORM_AREA_VACIO);
            setAreaError("");
            setAreaModal(true);
          }}>
            + Nueva Área
          </button>
        )}
        {tab === "notificaciones" && esSuperAdmin && puedeEditar && (
          <button className="btn btn-primary" onClick={() => {
            setNotifEditando(null);
            setFormNotif(FORM_NOTIF_VACIO);
            setNotifError("");
            setNotifModal(true);
          }}>
            + Nueva notificación
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {/* Mostrar solo las pestañas permitidas (visibleTabs=null → todas) */}
        {(!visibleTabs || visibleTabs.includes("puestos")) && (
          <button className={`tab-btn ${tab === "puestos" ? "tab-active" : ""}`} onClick={() => setTab("puestos")}>💼 Puestos</button>
        )}
        {(!visibleTabs || visibleTabs.includes("areas")) && (
          <button className={`tab-btn ${tab === "areas" ? "tab-active" : ""}`} onClick={() => setTab("areas")}>🏗️ Áreas</button>
        )}
        {(!visibleTabs || visibleTabs.includes("horarios")) && (
          <button className={`tab-btn ${tab === "horarios" ? "tab-active" : ""}`} onClick={() => setTab("horarios")}>⏰ Horarios</button>
        )}
        {esSuperAdmin && (!visibleTabs || visibleTabs.includes("roles")) && (
          <button className={`tab-btn ${tab === "roles" ? "tab-active" : ""}`} onClick={() => setTab("roles")}>
            🔐 Roles
          </button>
        )}
        {esSuperAdmin && (!visibleTabs || visibleTabs.includes("empresa")) && (
          <button className={`tab-btn ${tab === "empresa" ? "tab-active" : ""}`} onClick={() => setTab("empresa")}>
            🏛️ Empresa
          </button>
        )}
        {esSuperAdmin && (!visibleTabs || visibleTabs.includes("notificaciones")) && (
          <button className={`tab-btn ${tab === "notificaciones" ? "tab-active" : ""}`} onClick={() => setTab("notificaciones")}>
            🔔 Notificaciones
          </button>
        )}
      </div>

      {/* ── Tab: Puestos ─────────────────────────────────────────────────────── */}
      {tab === "puestos" && (
        <div className="cards-grid">
          {puestos.length === 0 && (
            <div className="empty-state" style={{ gridColumn: "1/-1" }}>
              <div className="empty-icon">💼</div><p>No hay puestos registrados.</p>
            </div>
          )}
          {puestos.map((p) => (
            <div key={p.id} className="card">
              <div className="card-body">
                <h3 style={{ margin: "0 0 6px" }}>{p.nombre}</h3>
                {p.descripcion && (
                  <p style={{ color: "var(--text2)", margin: "0 0 8px", fontSize: 13 }}>{p.descripcion}</p>
                )}
                <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>
                  ⏱ Horario: <strong>{nombreHorario(p.horarioId)}</strong>
                </p>
                {p.camposExtra && p.camposExtra.length > 0 && (
                  <p style={{ fontSize: 12, color: "var(--text2)", margin: "4px 0 0" }}>
                    📋 Campos extra: {p.camposExtra.length}
                  </p>
                )}
              </div>
              {puedeEditar && (
                <div className="card-footer">
                  <button className="btn btn-sm btn-secondary" onClick={() => abrirModal(p)}>✏️ Editar</button>
                  <button className="btn btn-sm btn-danger"    onClick={() => handleEliminar(p.id, p.nombre)}>🗑️ Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Horarios ────────────────────────────────────────────────────── */}
      {tab === "horarios" && (
        <div className="cards-grid">
          {horarios.length === 0 && (
            <div className="empty-state" style={{ gridColumn: "1/-1" }}>
              <div className="empty-icon">🕐</div><p>No hay horarios registrados.</p>
            </div>
          )}
          {horarios.map((h) => (
            <div key={h.id} className="card">
              <div className="card-body">
                <h3 style={{ margin: "0 0 8px" }}>{h.nombre}</h3>
                <p style={{ margin: "3px 0", fontSize: 13, color: "var(--text2)" }}>
                  🕐 Entrada: <strong>{h.horaEntrada}</strong> · Salida: <strong>{h.horaSalida}</strong>
                </p>
                {(h.horaSalidaAlimentos || h.horaRegresoAlimentos) && (
                  <p style={{ margin: "3px 0", fontSize: 13, color: "var(--text2)" }}>
                    🍽️ Alimentos: <strong>{h.horaSalidaAlimentos || "—"}</strong> → <strong>{h.horaRegresoAlimentos || "—"}</strong>
                  </p>
                )}
                <p style={{ margin: "3px 0", fontSize: 13, color: "var(--text2)" }}>
                  📅 {DIAS.filter((d) => h.diasLaborales.includes(d.val)).map((d) => d.label).join(", ")}
                </p>
                <p style={{ margin: "3px 0", fontSize: 13, color: "var(--text2)" }}>
                  ⏱ Tolerancia: {h.toleranciaMinutos} min
                </p>
              </div>
              {puedeEditar && (
                <div className="card-footer">
                  <button className="btn btn-sm btn-secondary" onClick={() => abrirModal(h)}>✏️ Editar</button>
                  <button className="btn btn-sm btn-danger"    onClick={() => handleEliminar(h.id, h.nombre)}>🗑️ Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Roles ───────────────────────────────────────────────────────── */}
      {tab === "roles" && esSuperAdmin && (
        cargandoRoles
          ? <div className="loading">Cargando configuración de roles…</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

              {/* ── Sección: Gestión de roles (CRUD) ──────────────────────── */}
              <div className="card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>🔐 Roles del sistema</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      Crea, edita y elimina roles. Los roles aparecen en la ficha del empleado.
                    </p>
                  </div>
                  {puedeEditar && <button className="btn btn-primary btn-sm" onClick={() => abrirRolModal()}>+ Nuevo rol</button>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rolesList.length === 0 && (
                    <p style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>No hay roles registrados.</p>
                  )}
                  {rolesList.map((rol) => (
                    <div key={rol.clave} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 8,
                      background: "var(--bg3)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{rol.nombre}</span>
                          <code style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-code, #1a1a2e)", padding: "1px 6px", borderRadius: 4 }}>{rol.clave}</code>
                          {rol.puede_editar
                            ? <span style={{ fontSize: "0.72rem", background: "color-mix(in srgb, var(--primary) 18%, transparent)", color: "var(--primary)", border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>✏️ Puede editar</span>
                            : <span style={{ fontSize: "0.72rem", background: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>👁️ Solo lectura</span>
                          }
                        </div>
                        {rol.descripcion && <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 2 }}>{rol.descripcion}</div>}
                      </div>
                      {puedeEditar && <button className="btn btn-sm" style={{ background: "none", border: "1px solid var(--border)" }} onClick={() => abrirRolModal(rol)}>✏️</button>}
                      {puedeEditar && <button className="btn btn-sm" style={{ background: "none", border: "1px solid var(--danger)", color: "var(--danger)" }} onClick={() => handleEliminarRol(rol)}>🗑️</button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Sección: Permisos por módulo ──────────────────────────── */}
              <div>
                <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 16 }}>
                  Activa o desactiva los módulos que cada rol puede ver en el menú. Guarda los cambios por rol de forma independiente.
                </p>

              {ROLES_SISTEMA.map((rol) => (
                <div key={rol.key} className="card" style={{ padding: "16px 20px", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem" }}>👤 {rol.label}</h3>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => guardarRol(rol.key)}
                      disabled={guardandoRol === rol.key}
                    >
                      {guardandoRol === rol.key ? "Guardando…" : "💾 Guardar"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {modulosSistema.map((modulo) => {
                      const activo = (configRoles[rol.key] || []).includes(modulo.key);
                      return (
                        <label
                          key={modulo.key}
                          style={{
                            display: "flex", alignItems: "center", gap: 7,
                            cursor: "pointer", userSelect: "none",
                            padding: "5px 12px", borderRadius: 6,
                            border: `1px solid ${activo ? "var(--primary)" : "var(--border)"}`,
                            background: activo
                              ? "color-mix(in srgb, var(--primary) 12%, var(--surface))"
                              : "var(--surface)",
                            fontSize: 13, transition: "all 0.15s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={() => toggleModulo(rol.key, modulo.key)}
                            style={{ accentColor: "var(--primary)", width: 14, height: 14 }}
                          />
                          {modulo.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              </div>{/* fin sección permisos por módulo */}
            </div>
          )
      )}

      {/* ── Modal: Crear / Editar rol ──────────────────────────────────────────── */}
      {rolModal && (
        <div className="modal-overlay" onClick={() => setRolModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{rolEditando ? "✏️ Editar rol" : "➕ Nuevo rol"}</h2>
              <button className="modal-close" onClick={() => setRolModal(false)}>✕</button>
            </div>
            <form onSubmit={guardarNuevoRol} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {!rolEditando && (
                <div className="form-group">
                  <label>Clave del rol *</label>
                  <input
                    className="form-control"
                    placeholder="ej: vendedor_senior"
                    value={formRol.clave}
                    onChange={(e) => setFormRol((f) => ({ ...f, clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
                    required
                  />
                  <small style={{ color: "var(--text-muted)" }}>Solo minúsculas, números y guiones bajos. Ej: <code>vendedor_senior</code></small>
                </div>
              )}
              {rolEditando && (
                <div className="form-group">
                  <label>Clave</label>
                  <input className="form-control" value={formRol.clave} disabled style={{ opacity: 0.6 }} />
                  <small style={{ color: "var(--text-muted)" }}>La clave no se puede cambiar</small>
                </div>
              )}
              <div className="form-group">
                <label>Nombre del rol *</label>
                <input
                  className="form-control"
                  placeholder="ej: Vendedor Senior"
                  value={formRol.nombre}
                  onChange={(e) => setFormRol((f) => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Describe las responsabilidades de este rol…"
                  value={formRol.descripcion}
                  onChange={(e) => setFormRol((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              {/* ── Permiso de edición ──────────────────────────────────────── */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px", borderRadius: 8,
                background: formRol.puedeEditar
                  ? "color-mix(in srgb, var(--primary) 10%, var(--bg3))"
                  : "var(--bg3)",
                border: `1px solid ${formRol.puedeEditar ? "color-mix(in srgb, var(--primary) 40%, transparent)" : "var(--border)"}`,
                cursor: "pointer", transition: "all 0.15s",
              }} onClick={() => setFormRol((f) => ({ ...f, puedeEditar: !f.puedeEditar }))}>
                <input
                  type="checkbox"
                  id="chk-puede-editar"
                  checked={formRol.puedeEditar}
                  onChange={(e) => setFormRol((f) => ({ ...f, puedeEditar: e.target.checked }))}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, accentColor: "var(--primary)", cursor: "pointer" }}
                />
                <div>
                  <label htmlFor="chk-puede-editar" style={{ fontWeight: 600, fontSize: "0.88rem", cursor: "pointer", display: "block" }}>
                    Puede editar registros
                  </label>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Los usuarios con este rol podrán crear, editar y eliminar registros en el sistema.
                    Sin esta opción el rol tendrá acceso de solo lectura.
                  </span>
                </div>
              </div>

              {rolError && <p style={{ color: "var(--danger)", fontSize: 13 }}>⚠️ {rolError}</p>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setRolModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoNuevoRol}>
                  {guardandoNuevoRol ? "Guardando…" : "💾 Guardar rol"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Empresa ─────────────────────────────────────────────────────── */}
      {tab === "empresa" && esSuperAdmin && (
        <div style={{ maxWidth: 640 }}>
          {/* Logo */}
          <div className="card" style={{ padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div
              style={{ width: 100, height: 100, border: "2px dashed var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}
              onClick={() => logoInputRef.current?.click()}
            >
              {(logoPreview || (logoUrl && `${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${logoUrl}`))
                ? <img src={logoPreview || `${import.meta.env.VITE_SERVER_URL || "http://localhost:4000"}${logoUrl}`} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: "2rem", color: "var(--text2)" }}>🏢</span>
              }
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }}} />
            <div>
              <p style={{ fontWeight: 600 }}>Logo de la empresa</p>
              <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>Se mostrará en el login y en la plataforma. PNG/JPG/SVG.</p>
              {logoFile && (
                <button className="btn btn-sm btn-primary" onClick={async () => {
                  try {
                    const r = await uploadLogoEmpresa(logoFile);
                    setLogoUrl(r.logoUrl);
                    setEmpresaGlobal((prev) => ({ ...prev, ...r.empresa, logoUrl: r.logoUrl }));
                    await refreshEmpresa();
                    setLogoFile(null);
                  } catch (err) { toastError(err); }
                }}>💾 Guardar logo</button>
              )}
            </div>
          </div>

          {/* Datos generales */}
          <div className="card" style={{ padding: "20px 24px" }}>
            <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Datos generales</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre de la empresa *</label>
                <input className="form-control" value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Razón social</label>
                <input className="form-control" value={empresa.razonSocial} onChange={e => setEmpresa({...empresa, razonSocial: e.target.value})} />
              </div>
              <div className="form-group">
                <label>RFC</label>
                <input className="form-control" value={empresa.rfc} onChange={e => setEmpresa({...empresa, rfc: e.target.value})} placeholder="XXXX000000XXX" />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input className="form-control" value={empresa.telefono} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Domicilio</label>
              <input className="form-control" value={empresa.domicilio} onChange={e => setEmpresa({...empresa, domicilio: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Correo electrónico</label>
              <input type="email" className="form-control" value={empresa.email} onChange={e => setEmpresa({...empresa, email: e.target.value})} />
            </div>
            <button
              className="btn btn-primary"
              disabled={guardandoEmpresa}
              onClick={async () => {
                setGuardandoEmpresa(true);
                try {
                  const actualizada = await updateEmpresaConfig(empresa);
                  setEmpresaGlobal((prev) => ({ ...prev, ...actualizada }));
                  await refreshEmpresa();
                  toastExito("Empresa actualizada");
                }
                catch (err) { toastError(err); }
                finally { setGuardandoEmpresa(false); }
              }}
            >
              {guardandoEmpresa ? "Guardando…" : "💾 Guardar datos de empresa"}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Áreas ───────────────────────────────────────────────────────── */}
      {tab === "areas" && (
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            Las áreas agrupan a los empleados por departamento o función. Se pueden asignar al crear o editar un empleado.
          </p>
          {areas.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🏗️</div>
              <p>No hay áreas registradas.</p>
            </div>
          )}
          <div className="cards-grid">
            {areas.filter((a) => a.activo !== false).map((area) => (
              <div key={area.id} className="card">
                <div className="card-body">
                  <h3 style={{ margin: "0 0 6px" }}>🏗️ {area.nombre}</h3>
                  {area.descripcion && (
                    <p style={{ color: "var(--text-muted)", margin: "0 0 8px", fontSize: 13 }}>{area.descripcion}</p>
                  )}
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                    👥 Empleados: <strong>{area.empleadosCount ?? 0}</strong>
                  </p>
                </div>
                <div className="card-footer">
                  <button className="btn btn-sm btn-secondary" onClick={() => {
                    setAreaEditando(area);
                    setFormArea({ nombre: area.nombre, descripcion: area.descripcion || "" });
                    setAreaError("");
                    setAreaModal(true);
                  }}>✏️ Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => {
                    if (!(await confirmar(`¿Eliminar el área "${area.nombre}"? Los empleados asignados quedarán sin área.`, "Eliminar", "danger"))) return;
                    try {
                      await eliminarArea(area.id);
                      cargar();
                      queryClient.invalidateQueries({ queryKey: ["areas"] });
                      toastExito("Área eliminada correctamente");
                    } catch (err) { toastError(err); }
                  }}>🗑️ Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal crear/editar área */}
          {areaModal && (
            <div className="modal-overlay" onClick={() => setAreaModal(false)}>
              <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{areaEditando ? "✏️ Editar Área" : "🏗️ Nueva Área"}</h2>
                  <button className="modal-close" onClick={() => setAreaModal(false)}>✕</button>
                </div>
                <div className="modal-body">
                  {areaError && <div className="alert alert-danger">{areaError}</div>}
                  <div className="form-group">
                    <label>Nombre del área *</label>
                    <input
                      className="form-control"
                      value={formArea.nombre}
                      onChange={(e) => setFormArea({ ...formArea, nombre: e.target.value })}
                      placeholder="Ej: Recursos Humanos, Finanzas, TI..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={formArea.descripcion}
                      onChange={(e) => setFormArea({ ...formArea, descripcion: e.target.value })}
                      placeholder="Descripción breve del área..."
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setAreaModal(false)}>Cancelar</button>
                  <button
                    className="btn btn-primary"
                    disabled={guardandoArea}
                    onClick={async () => {
                      if (!formArea.nombre.trim()) { setAreaError("El nombre es obligatorio."); return; }
                      setGuardandoArea(true);
                      setAreaError("");
                      try {
                        if (areaEditando) {
                          await actualizarArea(areaEditando.id, formArea);
                        } else {
                          await crearArea(formArea);
                        }
                        setAreaModal(false);
                        cargar();
                        queryClient.invalidateQueries({ queryKey: ["areas"] });
                        toastExito(areaEditando ? "Área actualizada" : "Área creada correctamente");
                      } catch (err) { setAreaError(err.message); }
                      finally { setGuardandoArea(false); }
                    }}
                  >
                    {guardandoArea ? "Guardando…" : "💾 Guardar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Notificaciones ──────────────────────────────────────────────── */}
      {tab === "notificaciones" && esSuperAdmin && (() => {
        const hoy = new Date().toISOString().split("T")[0];
        const getEstado = (n) => {
          if (!n.activo) return { label: "Desactivada", color: "#6b7280" };
          if (n.fechaInicio && n.fechaInicio > hoy) return { label: "Programada", color: "#f59e0b" };
          if (n.fechaExpiracion && n.fechaExpiracion < hoy) return { label: "Vencida", color: "#ef4444" };
          return { label: "Activa", color: "#22c55e" };
        };

        return (
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
              Crea y programa notificaciones para el panel lateral. Puedes definir cuándo comienzan a mostrarse y cuándo vencen.
            </p>

            {notificaciones.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔔</div>
                <p>No hay notificaciones registradas.</p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {notificaciones.map((n) => {
                const estado = getEstado(n);
                return (
                  <div key={n.id} className="card" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <strong style={{ fontSize: 15 }}>{n.titulo}</strong>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                            background: estado.color + "22", color: estado.color, border: `1px solid ${estado.color}44`,
                          }}>
                            {estado.label}
                          </span>
                        </div>
                        {/* Vista previa del contenido (texto plano) */}
                        <div
                          style={{ fontSize: 13, color: "var(--text-muted)", maxHeight: 40, overflow: "hidden", lineHeight: 1.4 }}
                          dangerouslySetInnerHTML={{ __html: n.texto || n.contenidoHtml || "" }}
                        />
                        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
                          {n.fechaInicio && (
                            <span>📅 Inicio: <strong>{n.fechaInicio}</strong></span>
                          )}
                          {n.fechaExpiracion && (
                            <span>⏱ Vence: <strong>{n.fechaExpiracion}</strong></span>
                          )}
                          {n.creadoPorNombre && (
                            <span>👤 {n.creadoPorNombre}</span>
                          )}
                          {n.destinatarios && !n.destinatarios.todos && (
                            <span title="Anuncio dirigido a grupos/personas específicas">
                              👥 {[
                                n.destinatarios.grupos?.length   ? `${n.destinatarios.grupos.length} grupo(s)` : null,
                                n.destinatarios.usuarios?.length ? `${n.destinatarios.usuarios.length} persona(s)` : null,
                              ].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {(!n.destinatarios || n.destinatarios.todos) && (
                            <span>🌐 Todos</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setNotifEditando(n);
                            const dest = n.destinatarios;
                            setFormNotif({
                              titulo: n.titulo || "",
                              contenidoHtml: n.texto || "",
                              fechaInicio: n.fechaInicio || "",
                              fechaExpiracion: n.fechaExpiracion || "",
                              destinatariosTodos:    !dest || dest.todos === true,
                              destinatariosGrupos:   dest?.grupos   || [],
                              destinatariosUsuarios: dest?.usuarios || [],
                            });
                            setNotifError("");
                            setNotifModal(true);
                          }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={async () => {
                            if (!(await confirmar(`¿Eliminar la notificación "${n.titulo}"?`, "Eliminar", "danger"))) return;
                            try {
                              await eliminarAnuncio(n.id);
                              cargarNotificaciones();
                            } catch (err) { toastError(err); }
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal crear/editar notificación */}
            {notifModal && (
              <div className="modal-overlay" onClick={() => setNotifModal(false)}>
                <div
                  className="modal"
                  style={{ maxWidth: 640 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h2>{notifEditando ? "✏️ Editar notificación" : "🔔 Nueva notificación"}</h2>
                    <button className="modal-close" onClick={() => setNotifModal(false)}>✕</button>
                  </div>

                  <div className="modal-body">
                    {notifError && <div className="alert alert-danger">{notifError}</div>}

                    <div className="form-group">
                      <label>Título *</label>
                      <input
                        className="form-control"
                        value={formNotif.titulo}
                        onChange={(e) => setFormNotif({ ...formNotif, titulo: e.target.value })}
                        placeholder="Título de la notificación"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Contenido *</label>
                      <RichTextEditor
                        key={notifEditando?.id || "new"}
                        initialValue={formNotif.contenidoHtml}
                        onChange={(html) => setFormNotif((prev) => ({ ...prev, contenidoHtml: html }))}
                        minHeight={150}
                      />
                      <p className="form-hint">Usa la barra de herramientas para dar formato: negritas, cursiva, tamaño, alineación.</p>
                    </div>

                    <div className="form-row two-cols">
                      <div className="form-group">
                        <label>📅 Fecha de inicio (programar)</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formNotif.fechaInicio}
                          onChange={(e) => setFormNotif({ ...formNotif, fechaInicio: e.target.value })}
                        />
                        <p className="form-hint">Dejar vacío para publicar de inmediato.</p>
                      </div>
                      <div className="form-group">
                        <label>⏱ Fecha de vencimiento</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formNotif.fechaExpiracion}
                          onChange={(e) => setFormNotif({ ...formNotif, fechaExpiracion: e.target.value })}
                        />
                        <p className="form-hint">Dejar vacío para duración de 7 días por defecto.</p>
                      </div>
                    </div>

                    {/* ── Destinatarios ──────────────────────────────────────── */}
                    <div className="form-group">
                      <label>👥 Destinatarios</label>
                      <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                          <input
                            type="radio"
                            name="destinatarios-tipo"
                            checked={formNotif.destinatariosTodos}
                            onChange={() => setFormNotif((f) => ({ ...f, destinatariosTodos: true, destinatariosGrupos: [], destinatariosUsuarios: [] }))}
                          />
                          Todos
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                          <input
                            type="radio"
                            name="destinatarios-tipo"
                            checked={!formNotif.destinatariosTodos}
                            onChange={() => setFormNotif((f) => ({ ...f, destinatariosTodos: false }))}
                          />
                          Grupos / personas específicas
                        </label>
                      </div>

                      {!formNotif.destinatariosTodos && (
                        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--bg3)" }}>
                          {/* Grupos */}
                          {notifGrupos.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text2)" }}>🔗 Grupos</p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {notifGrupos.map((g) => {
                                  const sel = formNotif.destinatariosGrupos.includes(g.id);
                                  return (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => setFormNotif((f) => ({
                                        ...f,
                                        destinatariosGrupos: sel
                                          ? f.destinatariosGrupos.filter((id) => id !== g.id)
                                          : [...f.destinatariosGrupos, g.id],
                                      }))}
                                      style={{
                                        padding: "3px 10px", borderRadius: 14, fontSize: 12,
                                        border: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                                        background: sel ? "var(--accent)" : "var(--bg-card)",
                                        color: sel ? "#fff" : "var(--text)",
                                        cursor: "pointer", fontWeight: sel ? 700 : 400,
                                      }}
                                    >
                                      {g.nombre}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Usuarios */}
                          {notifUsuarios.length > 0 && (
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text2)" }}>👤 Personas</p>
                              <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                                {notifUsuarios.map((u) => {
                                  const sel = formNotif.destinatariosUsuarios.includes(u.id);
                                  return (
                                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "3px 6px", borderRadius: 5, background: sel ? "rgba(var(--accent-rgb,89,107,237),0.1)" : "transparent" }}>
                                      <input
                                        type="checkbox"
                                        checked={sel}
                                        onChange={() => setFormNotif((f) => ({
                                          ...f,
                                          destinatariosUsuarios: sel
                                            ? f.destinatariosUsuarios.filter((id) => id !== u.id)
                                            : [...f.destinatariosUsuarios, u.id],
                                        }))}
                                        style={{ accentColor: "var(--accent)" }}
                                      />
                                      {u.nombre} {u.apellido}
                                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({u.rol})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {formNotif.destinatariosGrupos.length === 0 && formNotif.destinatariosUsuarios.length === 0 && (
                            <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>
                              ⚠ Selecciona al menos un grupo o persona, o cambia a "Todos".
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setNotifModal(false)}>Cancelar</button>
                    <button
                      className="btn btn-primary"
                      disabled={guardandoNotif}
                      onClick={async () => {
                        if (!formNotif.titulo.trim()) { setNotifError("El título es obligatorio."); return; }
                        if (!formNotif.contenidoHtml.trim() || formNotif.contenidoHtml === "<br>") {
                          setNotifError("El contenido no puede estar vacío."); return;
                        }
                        if (!formNotif.destinatariosTodos &&
                            formNotif.destinatariosGrupos.length === 0 &&
                            formNotif.destinatariosUsuarios.length === 0) {
                          setNotifError("Selecciona al menos un destinatario, o marca la opción 'Todos'."); return;
                        }
                        setGuardandoNotif(true);
                        setNotifError("");
                        try {
                          const destinatarios = formNotif.destinatariosTodos
                            ? { todos: true }
                            : { grupos: formNotif.destinatariosGrupos, usuarios: formNotif.destinatariosUsuarios };
                          const payload = {
                            titulo: formNotif.titulo.trim(),
                            texto: formNotif.contenidoHtml,
                            destinatarios,
                            ...(formNotif.fechaExpiracion ? { fechaExpiracion: formNotif.fechaExpiracion } : {}),
                            ...(formNotif.fechaInicio    ? { fechaInicio:    formNotif.fechaInicio }    : {}),
                          };
                          if (notifEditando) {
                            await actualizarAnuncio(notifEditando.id, payload);
                          } else {
                            await crearAnuncio(payload);
                          }
                          setNotifModal(false);
                          cargarNotificaciones();
                        } catch (err) {
                          setNotifError(err.message);
                        } finally {
                          setGuardandoNotif(false);
                        }
                      }}
                    >
                      {guardandoNotif ? "Guardando…" : "💾 Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Modal crear / editar ─────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editando ? "Editar" : "Nuevo"} {tab === "puestos" ? "Puesto" : "Horario"}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            {/* Form Puesto */}
            {tab === "puestos" && (
              <form onSubmit={handleSubmitPuesto} className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="form-group">
                  <label>Nombre *</label>
                  <input className="form-control" value={formP.nombre}
                    onChange={(e) => setFormP({ ...formP, nombre: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea className="form-control" rows={2} value={formP.descripcion}
                    onChange={(e) => setFormP({ ...formP, descripcion: e.target.value })} />
                </div>

                {/* Campos adicionales */}
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label>Campos adicionales</label>
                    <button type="button" className="btn btn-sm btn-secondary"
                      onClick={() => setCamposEditando(prev => [...prev, { nombre: "", tipo: "text", opciones: [], obligatorio: false }])}>
                      + Agregar campo
                    </button>
                  </div>
                  {camposEditando.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--text2)" }}>Sin campos adicionales. Haz clic en "+ Agregar campo".</p>
                  )}
                  {camposEditando.map((campo, idx) => (
                    <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 10, marginBottom: 8, background: "var(--bg3)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 12 }}>Nombre *</label>
                          <input className="form-control" value={campo.nombre} placeholder="Ej: Número de empleado"
                            onChange={e => { const nc = [...camposEditando]; nc[idx] = {...nc[idx], nombre: e.target.value}; setCamposEditando(nc); }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 12 }}>Tipo</label>
                          <select className="form-control" value={campo.tipo}
                            onChange={e => { const nc = [...camposEditando]; nc[idx] = {...nc[idx], tipo: e.target.value, opciones: []}; setCamposEditando(nc); }}>
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="fecha">Fecha</option>
                            <option value="select">Lista de opciones</option>
                          </select>
                        </div>
                        <button type="button" className="btn btn-sm btn-danger"
                          onClick={() => setCamposEditando(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                      </div>
                      {campo.tipo === "select" && (
                        <div style={{ marginTop: 8 }}>
                          <label style={{ fontSize: 12 }}>Opciones (una por línea)</label>
                          <textarea className="form-control" rows={2}
                            value={campo.opciones.join("\n")}
                            placeholder="Opción 1\nOpción 2"
                            onChange={e => { const nc = [...camposEditando]; nc[idx] = {...nc[idx], opciones: e.target.value.split("\n").filter(Boolean)}; setCamposEditando(nc); }} />
                        </div>
                      )}
                      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
                        <input type="checkbox" checked={campo.obligatorio} onChange={e => { const nc = [...camposEditando]; nc[idx] = {...nc[idx], obligatorio: e.target.checked}; setCamposEditando(nc); }} />
                        Obligatorio
                      </label>
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label>Área / Departamento</label>
                  <select className="form-control" value={formP.areaId || ""}
                    onChange={(e) => setFormP({ ...formP, areaId: e.target.value })}>
                    <option value="">Sin área asignada</option>
                    {areas.filter((a) => a.activo !== false).map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Horario por defecto</label>
                  <select className="form-control" value={formP.horarioId}
                    onChange={(e) => setFormP({ ...formP, horarioId: e.target.value })}>
                    <option value="">Sin horario asignado</option>
                    {horarios.map((h) => (
                      <option key={h.id} value={h.id}>{h.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </form>
            )}

            {/* Form Horario */}
            {tab === "horarios" && (
              <form onSubmit={handleSubmitHorario} className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="form-group">
                  <label>Nombre *</label>
                  <input className="form-control" value={formH.nombre}
                    onChange={(e) => setFormH({ ...formH, nombre: e.target.value })} required />
                </div>

                <p style={{ fontWeight: 600, fontSize: 13, margin: "10px 0 4px", color: "var(--text2)" }}>
                  Horario laboral
                </p>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Hora entrada *</label>
                    <input type="time" className="form-control" value={formH.horaEntrada}
                      onChange={(e) => setFormH({ ...formH, horaEntrada: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Hora salida *</label>
                    <input type="time" className="form-control" value={formH.horaSalida}
                      onChange={(e) => setFormH({ ...formH, horaSalida: e.target.value })} required />
                  </div>
                </div>

                <p style={{ fontWeight: 600, fontSize: 13, margin: "10px 0 4px", color: "var(--text2)" }}>
                  🍽️ Horario de alimentos <span style={{ fontWeight: 400 }}>(opcional)</span>
                </p>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Salida a comer</label>
                    <input type="time" className="form-control" value={formH.horaSalidaAlimentos}
                      onChange={(e) => setFormH({ ...formH, horaSalidaAlimentos: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Regreso de comer</label>
                    <input type="time" className="form-control" value={formH.horaRegresoAlimentos}
                      onChange={(e) => setFormH({ ...formH, horaRegresoAlimentos: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tolerancia (minutos)</label>
                  <input type="number" className="form-control" value={formH.toleranciaMinutos}
                    min={0} max={60}
                    onChange={(e) => setFormH({ ...formH, toleranciaMinutos: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Días laborales *</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {DIAS.map((d) => (
                      <button
                        key={d.val} type="button"
                        className={`btn btn-sm ${formH.diasLaborales.includes(d.val) ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => toggleDia(d.val)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
