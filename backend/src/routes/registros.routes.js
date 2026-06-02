/**
 * registros.routes.js
 * Endpoints para registros de acceso, captura manual y eventos en tiempo real.
 */

const express = require("express");
const multer = require("multer");
const router = express.Router();
const store = require("../data/store");
const { dentroDeGeocerca } = require("../utils/geo");
const { calcularMinutosTrabajados } = require("../utils/minutos");
const { verificarToken } = require("../middleware/auth");
const { requireRoles, ROLES } = require("../middleware/roles");
const notifService = require("../services/notificaciones.service");
const { getAllowedSucursalIds, canAccessSucursal, canAccessUsuario } = require("../utils/access-scope");
const { saveFile } = require("../services/storage.service");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

router.use(verificarToken);

const ONE_HOUR_MS = 60 * 60 * 1000;
const ROLES_GESTION = [
  ROLES.SUPER_ADMIN,
  ROLES.AGENTE_SOPORTE_TI,
  ROLES.SUPERVISOR_SUCURSALES,
  ROLES.AGENTE_CONTROL_ASISTENCIA,
  ROLES.VISOR_REPORTES,
];
const ROLES_EDICION_MANUAL = [ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.SUPERVISOR_SUCURSALES];

const enrichRegistro = (registro) => {
  const usuario = store.getUsuarioById(registro.usuarioId);
  const sucursal = store.getSucursalById(registro.sucursalId);
  const captadoPor = registro.captadoPor ? store.getUsuarioById(registro.captadoPor) : null;
  const editadoPor = registro.editadoPor ? store.getUsuarioById(registro.editadoPor) : null;
  return {
    ...registro,
    usuarioNombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : "N/A",
    usuarioEmail: usuario?.email || null,
    sucursalNombre: sucursal ? sucursal.nombre : "N/A",
    captadoPorNombre: captadoPor ? `${captadoPor.nombre} ${captadoPor.apellido}` : null,
    editadoPorNombre: editadoPor ? `${editadoPor.nombre} ${editadoPor.apellido}` : null,
  };
};

const filtrarPorAlcance = (req, items, getSucursalId) => {
  const allowedSucursalIds = getAllowedSucursalIds(req.user, store);
  if (allowedSucursalIds === null) return items;
  const permitidas = new Set(allowedSucursalIds);
  return items.filter((item) => permitidas.has(getSucursalId(item)));
};

const validarAccesoASucursal = (req, sucursalId) => {
  if (!sucursalId) return false;
  return canAccessSucursal(req.user, sucursalId, store);
};

const validarAccesoARegistro = (req, registro) => {
  if (!registro) return false;
  if (!ROLES_GESTION.includes(req.user.rol)) return registro.usuarioId === req.user.id;
  return validarAccesoASucursal(req, registro.sucursalId);
};

const emitirEventoRegistro = (accion, registro) => {
  notifService.emitirEventoRegistro({
    accion,
    registro: enrichRegistro(registro),
    timestamp: new Date().toISOString(),
  });
};

router.get("/", (req, res) => {
  const filtros = {};

  if (!ROLES_GESTION.includes(req.user.rol)) {
    filtros.usuarioId = req.user.id;
  } else {
    if (req.query.usuarioId) {
      const usuarioObjetivo = store.getUsuarioById(req.query.usuarioId);
      if (!canAccessUsuario(req.user, usuarioObjetivo, store)) {
        return res.status(403).json({ error: "No tienes acceso al usuario solicitado" });
      }
      filtros.usuarioId = req.query.usuarioId;
    }

    if (req.query.sucursalId) {
      if (!validarAccesoASucursal(req, req.query.sucursalId)) {
        return res.status(403).json({ error: "No tienes acceso a la sucursal solicitada" });
      }
      filtros.sucursalId = req.query.sucursalId;
    }

    if (req.query.fechaInicio) filtros.fechaInicio = req.query.fechaInicio;
    if (req.query.fechaFin) filtros.fechaFin = req.query.fechaFin;
  }

  if (req.query.fecha) filtros.fecha = req.query.fecha;
  if (req.query.tipo) filtros.tipo = req.query.tipo;
  if (req.query.estadoAprobacion) filtros.estadoAprobacion = req.query.estadoAprobacion;

  let registros = store.getRegistros(filtros);
  registros = filtrarPorAlcance(req, registros, (registro) => registro.sucursalId);

  return res.json(registros.map(enrichRegistro));
});

router.get("/hoy", (req, res) => {
  const hoyFecha = new Date().toISOString().split("T")[0];
  const hoy = store.getRegistrosHoyDeUsuario(req.user.id);
  const siguiente = store.getSiguienteRegistro(req.user.id);
  const ultimo = store.getLastRegistroDeUsuario(req.user.id);

  // El cooldown solo aplica si el último registro fue HOY.
  // Si el último registro fue ayer o antes, no bloquea el nuevo día.
  let cooldownRestanteMs = 0;
  if (ultimo && ultimo.fecha === hoyFecha) {
    const diffMs = Date.now() - new Date(ultimo.creadoEn).getTime();
    cooldownRestanteMs = Math.max(0, ONE_HOUR_MS - diffMs);
  }

  return res.json({
    registros: hoy,
    siguienteRegistro: siguiente,
    cooldownRestanteMs,
    cooldownRestanteMin: Math.ceil(cooldownRestanteMs / 60000),
  });
});

router.get("/reporte", requireRoles(...ROLES_GESTION), (req, res) => {
  const { sucursalId, fecha } = req.query;
  if (!sucursalId || !fecha) {
    return res.status(400).json({ error: "sucursalId y fecha son requeridos" });
  }

  if (!validarAccesoASucursal(req, sucursalId)) {
    return res.status(403).json({ error: "No tienes acceso a la sucursal solicitada" });
  }

  const registros = store.getRegistros({ sucursalId, fecha });
  const usuarios = store.getUsuarios({ sucursalId });

  const resumen = usuarios.map((u) => {
    const regsUsuario = registros.filter((r) => r.usuarioId === u.id);
    const puesto = u.puestoId ? store.getPuestoById(u.puestoId) : null;
    return {
      usuario: `${u.nombre} ${u.apellido}`,
      puesto: puesto?.nombre || u.puesto || "N/A",
      entrada: regsUsuario.find((r) => r.tipo === "entrada")?.hora || null,
      salida_alimentos: regsUsuario.find((r) => r.tipo === "salida_alimentos")?.hora || null,
      regreso_alimentos: regsUsuario.find((r) => r.tipo === "regreso_alimentos")?.hora || null,
      salida: regsUsuario.find((r) => r.tipo === "salida")?.hora || null,
      minutosTrabajados: calcularMinutosTrabajados(regsUsuario),
      completo: regsUsuario.length === 4,
    };
  });

  return res.json({ fecha, sucursalId, resumen });
});

router.get("/minutos", (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta (YYYY-MM-DD) son requeridos" });
  }

  const registros = store.getRegistrosByDateRange(req.user.id, desde, hasta);
  const porFecha = {};
  registros.forEach((r) => {
    if (!porFecha[r.fecha]) porFecha[r.fecha] = [];
    porFecha[r.fecha].push(r);
  });

  const dias = Object.entries(porFecha).map(([fecha, regs]) => ({
    fecha,
    minutos: calcularMinutosTrabajados(regs) || 0,
  }));

  const totalMinutos = dias.reduce((acc, d) => acc + d.minutos, 0);
  return res.json({ desde, hasta, totalMinutos, dias });
});

router.get("/personal-hoy", requireRoles(
  ROLES.SUPER_ADMIN,
  ROLES.ADMINISTRADOR_GENERAL,
  ROLES.AGENTE_SOPORTE_TI,
  ROLES.SUPERVISOR_SUCURSALES,
  ROLES.AGENTE_CONTROL_ASISTENCIA,
  ROLES.NOMINAS,
), (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  let registros = store.getRegistros({ fecha: hoy });
  registros = filtrarPorAlcance(req, registros, (r) => r.sucursalId);

  // Deduplicar por usuarioId, quedarse con el último registro del día
  const porUsuario = {};
  registros.forEach((r) => {
    if (!porUsuario[r.usuarioId] || r.hora > porUsuario[r.usuarioId].hora) {
      porUsuario[r.usuarioId] = r;
    }
  });

  const resultado = Object.values(porUsuario).map((r) => {
    const u = store.getUsuarioById(r.usuarioId);
    const puesto = u?.puestoId ? store.getPuestoById(u.puestoId) : null;
    const sucursal = u?.sucursalId ? store.getSucursalById(u.sucursalId) : null;
    return {
      usuarioId: r.usuarioId,
      nombre: u ? `${u.nombre} ${u.apellido}` : "N/A",
      fotoUrl: u?.fotoUrl || null,
      hora: r.hora,
      tipo: r.tipo,
      puestoNombre: puesto?.nombre || null,
      sucursalNombre: sucursal?.nombre || null,
    };
  }).sort((a, b) => b.hora.localeCompare(a.hora));

  return res.json(resultado);
});

router.post("/", upload.single("foto"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Se requiere una foto del empleado para registrar la asistencia." });
  }

  const { latitud, longitud, motivoFueraHorario, motivoFueraGeocerca, sucursalId: sucursalIdBody } = req.body;

  if (latitud === undefined || longitud === undefined) {
    return res.status(400).json({ error: "Se requieren coordenadas GPS (latitud y longitud)" });
  }

  const esMedicoGuardia = req.user.rol === ROLES.MEDICO_DE_GUARDIA;

  // ── Regla de bloqueo: incidencia aprobada que cubre hoy ──────────────────
  const hoyFecha = new Date().toISOString().split("T")[0];
  const incidenciasActivasHoy = store.getIncidenciasActivasParaUsuario(req.user.id, hoyFecha);
  const incidenciaBloqueo = incidenciasActivasHoy.find((inc) => {
    const tipo = store.getTipoIncidenciaById(inc.tipoIncidenciaId);
    return tipo && tipo.categoriaBloqueo !== null;
  });

  if (incidenciaBloqueo) {
    const tipo = store.getTipoIncidenciaById(incidenciaBloqueo.tipoIncidenciaId);
    const categoria = tipo?.categoriaBloqueo;
    const empleado = store.getUsuarioById(req.user.id);
    const nombreEmpleado = empleado ? `${empleado.nombre} ${empleado.apellido}` : "Un empleado";

    // Notificar a todos los roles administrativos
    const receptores = store.getSupervisoresPorRoles([
      ROLES.SUPER_ADMIN,
      ROLES.AGENTE_SOPORTE_TI,
      ROLES.SUPERVISOR_SUCURSALES,
      ROLES.AGENTE_CONTROL_ASISTENCIA,
    ]);
    receptores.forEach((r) => {
      if (r.id !== req.user.id) {
        notifService.crearNotificacion({
          paraUsuarioId: r.id,
          deUsuarioId: req.user.id,
          tipo: "bloqueo_registro",
          titulo: "Intento de registro bloqueado",
          mensaje: `${nombreEmpleado} intentó registrar asistencia pero tiene ${categoria} aprobada para hoy.`,
          referenciaId: incidenciaBloqueo.id,
        });
      }
    });

    return res.status(403).json({
      error: `No puedes registrar asistencia: tienes una ${categoria} aprobada para hoy.`,
      categoriaBloqueo: categoria,
      incidenciaId: incidenciaBloqueo.id,
      bloqueado: true,
    });
  }

  // El cooldown solo aplica si el último registro fue HOY.
  // Al cambiar de día, los registros se reinician y no hay cooldown.
  const ultimo = store.getLastRegistroDeUsuario(req.user.id);
  if (ultimo && ultimo.fecha === hoyFecha) {
    const diffMs = Date.now() - new Date(ultimo.creadoEn).getTime();
    if (diffMs < ONE_HOUR_MS) {
      const minutosRestantes = Math.ceil((ONE_HOUR_MS - diffMs) / 60000);
      return res.status(429).json({
        error: `Debes esperar ${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""} antes de tu siguiente registro.`,
        minutosRestantes,
        cooldownRestanteMs: ONE_HOUR_MS - diffMs,
      });
    }
  }

  // Determinar sucursal de registro:
  // - Médico de guardia puede pasar sucursalId en el body (o usar la de su sesión)
  // - Otros roles siempre usan la sucursal de su token (con fallback a la BD, por si el token
  //   fue generado antes de que se asignara la sucursal).
  let sucursalId;
  if (esMedicoGuardia && sucursalIdBody) {
    sucursalId = sucursalIdBody;
  } else {
    // Usar el valor del token; si está vacío (token viejo), leer directamente del store.
    sucursalId = req.user.sucursalId || store.getUsuarioById(req.user.id)?.sucursalId;
  }

  if (!sucursalId) {
    return res.status(400).json({ error: "No tienes sucursal asignada. Contacta a soporte." });
  }

  const sucursal = store.getSucursalById(sucursalId);
  if (!sucursal) return res.status(404).json({ error: "Sucursal no encontrada" });

  // Para médico de guardia con sucursal del body, verificar que la sucursal esté activa
  if (esMedicoGuardia && sucursalIdBody && !sucursal.activa) {
    return res.status(400).json({ error: "La sucursal seleccionada no está activa" });
  }

  // Determinar siguiente tipo de registro.
  // Para médico de guardia registrando en una sucursal diferente a la de sesión,
  // el siguiente registro se calcula sobre los registros del día en esa sucursal específica.
  let tipo;
  if (esMedicoGuardia && sucursalIdBody && sucursalIdBody !== req.user.sucursalId) {
    const hoy = new Date().toISOString().split("T")[0];
    const ORDEN_TIPOS = ["entrada", "salida_alimentos", "regreso_alimentos", "salida"];
    const regsEnSucursal = store.getRegistros({ usuarioId: req.user.id, fecha: hoy })
      .filter((r) => r.sucursalId === sucursalIdBody);
    const hechos = regsEnSucursal.map((r) => r.tipo);
    tipo = ORDEN_TIPOS.find((t) => !hechos.includes(t)) || null;
  } else {
    tipo = store.getSiguienteRegistro(req.user.id);
  }

  if (!tipo) {
    return res.status(400).json({ error: "Ya completaste los 4 registros del día en esta ubicación. ¡Hasta mañana!" });
  }

  // Validar si la geocerca tiene coordenadas válidas configuradas
  const geo = sucursal.geocerca;
  const geocercaValida = geo && geo.latitud && geo.longitud && geo.radio > 0;

  let dentro = true;
  let distancia = 0;

  if (geocercaValida) {
    const result = dentroDeGeocerca(geo, parseFloat(latitud), parseFloat(longitud));
    dentro = result.dentro;
    distancia = result.distancia;
  }

  // Super admin y soporte siempre pueden registrar sin importar ubicación
  const puedeBypassGeocerca = [ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI].includes(req.user.rol);

  if (!dentro && !motivoFueraGeocerca && !puedeBypassGeocerca) {
    return res.status(403).json({
      error: `Fuera de la geocerca. Estás a ${distancia}m del punto permitido (radio: ${geo.radio}m).`,
      distancia,
      radioPermitido: geo.radio,
      fueraDeGeocerca: true,
    });
  }

  const ahora = new Date();
  const fecha = ahora.toISOString().split("T")[0];
  const hora = ahora.toTimeString().split(" ")[0];

  const nuevoRegistro = store.createRegistro({
    usuarioId: req.user.id,
    sucursalId,
    tipo,
    latitud: parseFloat(latitud),
    longitud: parseFloat(longitud),
    dentroGeocerca: dentro,
    distanciaAlCentro: distancia,
    fecha,
    hora,
    ...(motivoFueraHorario ? { fueraDeHorario: true, motivoFueraHorario } : {}),
    ...((!dentro && motivoFueraGeocerca) ? { fueraDeGeocerca: true, motivoFueraGeocerca } : {}),
  });

  try {
    const fotoResult = await saveFile(req.file);
    store.updateRegistro(nuevoRegistro.id, { fotoUrl: fotoResult.url });
    nuevoRegistro.fotoUrl = fotoResult.url;
  } catch (errFoto) {
    console.error("Error al guardar foto del registro:", errFoto.message);
  }

  emitirEventoRegistro("creado", nuevoRegistro);

  return res.status(201).json({
    registro: nuevoRegistro,
    mensaje: `Registro de ${tipo.replace(/_/g, " ")} guardado correctamente`,
    siguienteRegistro: store.getSiguienteRegistro(req.user.id),
  });
});

router.post("/manual", requireRoles(
  ROLES.AGENTE_CONTROL_ASISTENCIA,
  ROLES.SUPERVISOR_SUCURSALES,
  ROLES.AGENTE_SOPORTE_TI,
  ROLES.SUPER_ADMIN
), (req, res) => {
  const { usuarioId, tipo, sucursalId, fecha, hora, justificacion } = req.body;

  if (!usuarioId || !tipo || !sucursalId || !fecha || !hora) {
    return res.status(400).json({ error: "usuarioId, tipo, sucursalId, fecha y hora son obligatorios" });
  }

  // No se puede registrar asistencia en fechas futuras
  const hoyStr = new Date().toISOString().split("T")[0];
  if (fecha > hoyStr) {
    return res.status(400).json({ error: "No se puede registrar asistencia en fechas futuras." });
  }

  if (!validarAccesoASucursal(req, sucursalId)) {
    return res.status(403).json({ error: "No tienes acceso a la sucursal solicitada" });
  }

  const usuario = store.getUsuarioById(usuarioId);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  if (!canAccessUsuario(req.user, usuario, store)) {
    return res.status(403).json({ error: "No tienes acceso al usuario solicitado" });
  }

  const sucursal = store.getSucursalById(sucursalId);
  if (!sucursal) return res.status(404).json({ error: "Sucursal no encontrada" });

  const nuevo = store.createRegistro({
    usuarioId,
    sucursalId,
    tipo,
    latitud: null,
    longitud: null,
    dentroGeocerca: null,
    distanciaAlCentro: null,
    fecha,
    hora,
    esManual: true,
    captadoPor: req.user.id,
    estadoAprobacion: "pendiente",
    justificacion: justificacion || "",
  });

  emitirEventoRegistro("manual_creado", nuevo);

  const agente = store.getUsuarioById(req.user.id);
  notifService.notificarSupervisoresDeSucursal(sucursalId, req.user.id, {
    tipo: "asistencia_manual",
    titulo: "Registro manual pendiente de aprobación",
    mensaje: `${agente?.nombre || "Un agente"} capturó un registro manual de ${usuario.nombre} ${usuario.apellido} (${tipo}) que requiere tu aprobación.`,
    referenciaId: nuevo.id,
  });

  return res.status(201).json(enrichRegistro(nuevo));
});

router.put("/:id/manual", requireRoles(...ROLES_EDICION_MANUAL), (req, res) => {
  const registro = store.getRegistroById(req.params.id);
  if (!registro) return res.status(404).json({ error: "Registro no encontrado" });
  if (!validarAccesoARegistro(req, registro)) {
    return res.status(403).json({ error: "No tienes acceso a este registro" });
  }

  const { tipo, fecha, hora, justificacion, motivoEdicionManual } = req.body;
  if (!tipo || !fecha || !hora) {
    return res.status(400).json({ error: "tipo, fecha y hora son obligatorios" });
  }

  const actualizado = store.updateRegistro(req.params.id, {
    tipo,
    fecha,
    hora,
    // horaModificada se actualiza solo cuando la hora realmente cambia
    horaModificada: hora !== registro.hora ? hora : (registro.horaModificada || null),
    justificacion: justificacion || registro.justificacion || "",
    esManual: true,
    editadoManual: true,
    editadoPor: req.user.id,
    editadoEn: new Date().toISOString(),
    motivoEdicionManual: motivoEdicionManual || "Corrección manual desde eventos",
    manualOriginal: registro.manualOriginal || {
      tipo: registro.tipo,
      fecha: registro.fecha,
      hora: registro.hora,
      justificacion: registro.justificacion || "",
    },
  });

  emitirEventoRegistro("manual_editado", actualizado);
  return res.json(enrichRegistro(actualizado));
});

router.put("/:id/aprobar", requireRoles(ROLES.SUPERVISOR_SUCURSALES, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI), (req, res) => {
  const registro = store.getRegistroById(req.params.id);
  if (!registro) return res.status(404).json({ error: "Registro no encontrado" });
  if (!registro.esManual) return res.status(400).json({ error: "Solo se pueden aprobar registros manuales" });
  if (!validarAccesoARegistro(req, registro)) {
    return res.status(403).json({ error: "No tienes acceso a este registro" });
  }
  if (registro.estadoAprobacion !== "pendiente") return res.status(400).json({ error: "El registro ya fue procesado" });

  const actualizado = store.updateRegistro(req.params.id, {
    estadoAprobacion: "aprobada",
    aprobadoPor: req.user.id,
    aprobadoEn: new Date().toISOString(),
  });

  emitRegistroAprobacion("asistencia_aprobada", "Registro manual aprobado", req, registro);
  emitirEventoRegistro("manual_aprobado", actualizado);
  return res.json(enrichRegistro(actualizado));
});

router.put("/:id/rechazar", requireRoles(ROLES.SUPERVISOR_SUCURSALES, ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI), (req, res) => {
  const registro = store.getRegistroById(req.params.id);
  if (!registro) return res.status(404).json({ error: "Registro no encontrado" });
  if (!registro.esManual) return res.status(400).json({ error: "Solo se pueden rechazar registros manuales" });
  if (!validarAccesoARegistro(req, registro)) {
    return res.status(403).json({ error: "No tienes acceso a este registro" });
  }
  if (registro.estadoAprobacion !== "pendiente") return res.status(400).json({ error: "El registro ya fue procesado" });

  const actualizado = store.updateRegistro(req.params.id, {
    estadoAprobacion: "rechazada",
    aprobadoPor: req.user.id,
    aprobadoEn: new Date().toISOString(),
    comentarioSupervisor: req.body.motivo || null,
  });

  emitRegistroAprobacion("asistencia_rechazada", "Registro manual rechazado", req, registro, req.body.motivo);
  emitirEventoRegistro("manual_rechazado", actualizado);
  return res.json(enrichRegistro(actualizado));
});

router.get("/minutos-empleados", requireRoles(...ROLES_GESTION), (req, res) => {
  const { sucursalId, fechaInicio, fechaFin } = req.query;
  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({ error: "fechaInicio y fechaFin son obligatorios" });
  }

  if (sucursalId && !validarAccesoASucursal(req, sucursalId)) {
    return res.status(403).json({ error: "No tienes acceso a la sucursal solicitada" });
  }

  const filtros = { fechaInicio, fechaFin };
  if (sucursalId) filtros.sucursalId = sucursalId;

  let registros = store.getRegistros(filtros);
  registros = filtrarPorAlcance(req, registros, (registro) => registro.sucursalId);

  const porUsuario = {};
  registros.forEach((r) => {
    if (!porUsuario[r.usuarioId]) porUsuario[r.usuarioId] = {};
    if (!porUsuario[r.usuarioId][r.fecha]) porUsuario[r.usuarioId][r.fecha] = [];
    porUsuario[r.usuarioId][r.fecha].push(r);
  });

  const resultado = Object.entries(porUsuario).map(([usuarioId, dias]) => {
    const u = store.getUsuarioById(usuarioId);
    const puesto = u?.puestoId ? store.getPuestoById(u.puestoId) : null;
    const diasArr = Object.entries(dias).map(([fecha, regs]) => ({
      fecha,
      minutos: calcularMinutosTrabajados(regs),
      registros: regs.length,
      tipos: regs.map((r) => r.tipo),
    }));
    const totalMinutos = diasArr.reduce((acc, d) => acc + (d.minutos || 0), 0);
    return {
      usuarioId,
      nombre: u ? `${u.nombre} ${u.apellido}` : "N/A",
      fotoUrl: u?.fotoUrl || null,
      puestoNombre: puesto?.nombre || "N/A",
      totalMinutos,
      dias: diasArr,
    };
  });

  return res.json({ fechaInicio, fechaFin, empleados: resultado });
});

router.get("/mapa", requireRoles(...ROLES_GESTION), (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  let sucursales = store.getSucursales();
  sucursales = filtrarPorAlcance(req, sucursales, (sucursal) => sucursal.id);

  const datos = sucursales.map((s) => {
    const regsHoy = store.getRegistros({ sucursalId: s.id, fecha: hoy });

    // Agrupar por empleado: obtener el último registro de cada uno
    const porEmpleado = {};
    regsHoy.forEach((r) => {
      if (!porEmpleado[r.usuarioId] || r.hora > porEmpleado[r.usuarioId].hora) {
        porEmpleado[r.usuarioId] = r;
      }
    });

    // Solo empleados actualmente DENTRO: último registro es "entrada" o "regreso_alimentos"
    // (tienen entrada pero aún no han salido definitivamente)
    const TIPOS_DENTRO = new Set(["entrada", "regreso_alimentos"]);
    const empleadosDentro = Object.values(porEmpleado).filter(
      (r) => TIPOS_DENTRO.has(r.tipo) && r.tipo !== "salida"
    );

    const entradas = regsHoy.filter((r) => r.tipo === "entrada");

    const empleadosActivos = empleadosDentro.map((r) => {
      const u = store.getUsuarioById(r.usuarioId);
      return {
        registroId: r.id,
        usuarioId: r.usuarioId,
        nombre: u ? `${u.nombre} ${u.apellido}` : "N/A",
        fotoUrl: u?.fotoUrl || null,
        hora: r.hora,
        fecha: r.fecha,
      };
    });

    const informeHoy = regsHoy.map((r) => {
      const u = store.getUsuarioById(r.usuarioId);
      return {
        registroId: r.id,
        nombre: u ? `${u.nombre} ${u.apellido}` : "N/A",
        fotoUrl: u?.fotoUrl || null,
        tipo: r.tipo,
        hora: r.hora,
        fecha: r.fecha,
        direccion: s.direccion,
        ciudad: s.ciudad,
      };
    }).sort((a, b) => b.hora.localeCompare(a.hora));

    return {
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      ciudad: s.ciudad,
      activa: s.activa,
      latitud: s.geocerca?.latitud || null,
      longitud: s.geocerca?.longitud || null,
      radio: s.geocerca?.radio || null,
      conActividad: empleadosDentro.length > 0,
      empleadosActivos,                          // solo los que están DENTRO ahora
      totalEntradas: entradas.length,             // total del día (para el informe)
      totalDentroAhora: empleadosDentro.length,
      informeHoy,
    };
  });

  return res.json(datos);
});

function emitRegistroAprobacion(tipoNotif, titulo, req, registro, motivo = "") {
  notifService.notificarUsuario(registro.usuarioId, req.user.id, {
    tipo: tipoNotif,
    titulo,
    mensaje: `Tu registro manual de ${registro.tipo.replace(/_/g, " ")} del ${registro.fecha} fue ${tipoNotif === "asistencia_aprobada" ? "aprobado" : "rechazado"}${motivo ? `. Motivo: ${motivo}` : "."}`,
    referenciaId: registro.id,
  });
}

module.exports = router;
