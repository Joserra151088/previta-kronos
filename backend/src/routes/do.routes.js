/**
 * do.routes.js - Rutas de Desarrollo Organizacional
 */
const express = require("express");
const router = express.Router();
const store = require("../data/store");
const { verificarToken } = require("../middleware/auth");
const { requireRoles, ROLES } = require("../middleware/roles");

router.use(verificarToken);

const DO_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL];
router.use(requireRoles(...DO_ROLES));

// ─── Competencias ─────────────────────────────────────────────────────────────

router.get("/competencias", (req, res) => {
  res.json(store.getDoCompetencias());
});

router.post("/competencias", requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL), (req, res) => {
  const { nombre, tipo, descripcion } = req.body;
  if (!nombre || !tipo) return res.status(400).json({ error: "nombre y tipo son obligatorios" });
  if (!["dura", "blanda"].includes(tipo)) return res.status(400).json({ error: "tipo debe ser 'dura' o 'blanda'" });
  const nueva = store.createDoCompetencia({ nombre, tipo, descripcion: descripcion || "" });
  res.status(201).json(nueva);
});

router.put("/competencias/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL), (req, res) => {
  const { nombre, tipo, descripcion, activo } = req.body;
  const actualizada = store.updateDoCompetencia(req.params.id, {
    ...(nombre !== undefined && { nombre }),
    ...(tipo !== undefined && { tipo }),
    ...(descripcion !== undefined && { descripcion }),
    ...(activo !== undefined && { activo }),
  });
  if (!actualizada) return res.status(404).json({ error: "Competencia no encontrada" });
  res.json(actualizada);
});

router.delete("/competencias/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL), (req, res) => {
  const ok = store.deleteDoCompetencia(req.params.id);
  if (!ok) return res.status(404).json({ error: "Competencia no encontrada" });
  res.json({ mensaje: "Competencia eliminada" });
});

// ─── Evaluaciones por Competencias ────────────────────────────────────────────

router.get("/evaluaciones-competencias", (req, res) => {
  const { evaluadoId, periodo } = req.query;
  res.json(store.getDoEvalCompetencias({ evaluadoId, periodo }));
});

router.get("/evaluaciones-competencias/:id", (req, res) => {
  const ev = store.getDoEvalCompetenciaById(req.params.id);
  if (!ev) return res.status(404).json({ error: "Evaluación no encontrada" });
  res.json(ev);
});

router.post("/evaluaciones-competencias", (req, res) => {
  const { evaluadoId, periodo, detalles, comentarios } = req.body;
  if (!evaluadoId || !periodo || !Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: "evaluadoId, periodo y detalles son obligatorios" });
  }
  const evaluadorId = req.usuario?.id;
  const fecha = new Date().toISOString();
  const nueva = store.createDoEvalCompetencia({ evaluadoId, evaluadorId, periodo, fecha, detalles, comentarios: comentarios || "" });
  res.status(201).json(nueva);
});

router.put("/evaluaciones-competencias/:id", (req, res) => {
  const { detalles, comentarios, estado } = req.body;
  const actualizada = store.updateDoEvalCompetencia(req.params.id, {
    ...(detalles !== undefined && { detalles }),
    ...(comentarios !== undefined && { comentarios }),
    ...(estado !== undefined && { estado }),
  });
  if (!actualizada) return res.status(404).json({ error: "Evaluación no encontrada" });
  res.json(actualizada);
});

// ─── Evaluaciones 360 ─────────────────────────────────────────────────────────

router.get("/evaluaciones-360", (req, res) => {
  const { evaluadoId, periodo } = req.query;
  res.json(store.getDoEval360({ evaluadoId, periodo }));
});

router.post("/evaluaciones-360", (req, res) => {
  const { evaluadoId, tipoEvaluador, periodo, calificacion, comentarios } = req.body;
  if (!evaluadoId || !tipoEvaluador || !periodo || calificacion === undefined) {
    return res.status(400).json({ error: "evaluadoId, tipoEvaluador, periodo y calificacion son obligatorios" });
  }
  const TIPOS = ["jefe", "par", "personal", "compañero"];
  if (!TIPOS.includes(tipoEvaluador)) {
    return res.status(400).json({ error: `tipoEvaluador debe ser uno de: ${TIPOS.join(", ")}` });
  }
  if (calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ error: "calificacion debe estar entre 1 y 5" });
  }
  const evaluadorId = req.usuario?.id;
  const fecha = new Date().toISOString();
  const nueva = store.createDoEval360({ evaluadoId, evaluadorId, tipoEvaluador, periodo, calificacion: Number(calificacion), comentarios: comentarios || "", fecha });
  res.status(201).json(nueva);
});

router.put("/evaluaciones-360/:id", (req, res) => {
  const { calificacion, comentarios } = req.body;
  const actualizada = store.updateDoEval360(req.params.id, {
    ...(calificacion !== undefined && { calificacion: Number(calificacion) }),
    ...(comentarios !== undefined && { comentarios }),
  });
  if (!actualizada) return res.status(404).json({ error: "Evaluación no encontrada" });
  res.json(actualizada);
});

// ─── Evaluaciones 1 a 1 ───────────────────────────────────────────────────────

router.get("/evaluaciones-1a1", (req, res) => {
  const { empleadoId } = req.query;
  res.json(store.getDoEval1a1({ empleadoId }));
});

router.post("/evaluaciones-1a1", (req, res) => {
  const { empleadoId, fecha, realizada, comentarios } = req.body;
  if (!empleadoId || !fecha) return res.status(400).json({ error: "empleadoId y fecha son obligatorios" });
  const evaluadorId = req.usuario?.id;
  const nueva = store.createDoEval1a1({ empleadoId, evaluadorId, fecha, realizada: realizada === true, comentarios: comentarios || "" });
  res.status(201).json(nueva);
});

router.put("/evaluaciones-1a1/:id", (req, res) => {
  const { realizada, comentarios } = req.body;
  const actualizada = store.updateDoEval1a1(req.params.id, {
    ...(realizada !== undefined && { realizada }),
    ...(comentarios !== undefined && { comentarios }),
  });
  if (!actualizada) return res.status(404).json({ error: "Evaluación no encontrada" });
  res.json(actualizada);
});

// ─── Satisfacción de Clientes ─────────────────────────────────────────────────

router.get("/satisfaccion-clientes", (req, res) => {
  const { periodo } = req.query;
  res.json(store.getDoSatisfaccion({ periodo }));
});

router.post("/satisfaccion-clientes", (req, res) => {
  const { periodo, calificacion, comentarios } = req.body;
  if (!periodo || calificacion === undefined) {
    return res.status(400).json({ error: "periodo y calificacion son obligatorios" });
  }
  if (calificacion < 1 || calificacion > 10) {
    return res.status(400).json({ error: "calificacion debe estar entre 1 y 10" });
  }
  const registradoPor = req.usuario?.id;
  const fecha = new Date().toISOString();
  const nueva = store.createDoSatisfaccion({ periodo, calificacion: Number(calificacion), comentarios: comentarios || "", registradoPor, fecha });
  res.status(201).json(nueva);
});

// ─── Indicadores Estratégicos ─────────────────────────────────────────────────

router.get("/indicadores", (req, res) => {
  const { puestoId } = req.query;
  res.json(store.getDoIndicadores({ puestoId }));
});

router.post("/indicadores", requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL), (req, res) => {
  const { puestoId, nombre, descripcion, unidad, meta } = req.body;
  if (!puestoId || !nombre) return res.status(400).json({ error: "puestoId y nombre son obligatorios" });
  const nuevo = store.createDoIndicador({ puestoId, nombre, descripcion: descripcion || "", unidad: unidad || "", meta: meta || null });
  if (!nuevo) return res.status(400).json({ error: "El puesto ya tiene 3 indicadores estratégicos (máximo permitido)" });
  res.status(201).json(nuevo);
});

router.put("/indicadores/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL), (req, res) => {
  const { nombre, descripcion, unidad, meta, activo } = req.body;
  const actualizado = store.updateDoIndicador(req.params.id, {
    ...(nombre !== undefined && { nombre }),
    ...(descripcion !== undefined && { descripcion }),
    ...(unidad !== undefined && { unidad }),
    ...(meta !== undefined && { meta }),
    ...(activo !== undefined && { activo }),
  });
  if (!actualizado) return res.status(404).json({ error: "Indicador no encontrado" });
  res.json(actualizado);
});

router.delete("/indicadores/:id", requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.DESARROLLO_ORGANIZACIONAL), (req, res) => {
  const ok = store.deleteDoIndicador(req.params.id);
  if (!ok) return res.status(404).json({ error: "Indicador no encontrado" });
  res.json({ mensaje: "Indicador eliminado" });
});

// ─── Valores de Indicadores ───────────────────────────────────────────────────

router.get("/indicadores-valores", (req, res) => {
  const { usuarioId, indicadorId, periodo } = req.query;
  res.json(store.getDoIndicadoresValores({ usuarioId, indicadorId, periodo }));
});

router.post("/indicadores-valores", (req, res) => {
  const { indicadorId, usuarioId, periodo, valor, meta } = req.body;
  if (!indicadorId || !usuarioId || !periodo || valor === undefined) {
    return res.status(400).json({ error: "indicadorId, usuarioId, periodo y valor son obligatorios" });
  }
  const nuevo = store.createDoIndicadorValor({ indicadorId, usuarioId, periodo, valor: Number(valor), meta: meta !== undefined ? Number(meta) : null });
  res.status(201).json(nuevo);
});

// ─── Nine-Box ─────────────────────────────────────────────────────────────────

router.get("/ninebox", (req, res) => {
  const { periodo } = req.query;
  if (!periodo) return res.status(400).json({ error: "periodo es obligatorio" });

  const usuarios = store.getUsuarios ? store.getUsuarios() : [];

  const resultado = usuarios.map((u) => {
    // Potencial = promedio de eval360 + eval competencias
    const eval360 = store.getDoEval360({ evaluadoId: u.id, periodo });
    const prom360 = eval360.length > 0
      ? eval360.reduce((s, e) => s + e.calificacion, 0) / eval360.length
      : null;

    const evalComp = store.getDoEvalCompetencias({ evaluadoId: u.id, periodo });
    let promComp = null;
    if (evalComp.length > 0) {
      const allDetalles = evalComp.flatMap((e) => e.detalles || []);
      if (allDetalles.length > 0) {
        promComp = allDetalles.reduce((s, d) => s + (d.calificacion || 0), 0) / allDetalles.length;
      }
    }

    let potencial = null;
    if (prom360 !== null && promComp !== null) potencial = (prom360 + promComp) / 2;
    else if (prom360 !== null) potencial = prom360;
    else if (promComp !== null) potencial = promComp;

    // Desempeño = promedio de indicadores (valor/meta)
    const indicadores = store.getDoIndicadores({ puestoId: u.puestoId });
    let desempeno = null;
    if (indicadores.length > 0) {
      const valores = store.getDoIndicadoresValores({ usuarioId: u.id, periodo });
      const ratios = indicadores.map((ind) => {
        const val = valores.find((v) => v.indicadorId === ind.id);
        if (!val) return null;
        const meta = val.meta || ind.meta;
        if (!meta) return val.valor / 100; // si no hay meta, valor como porcentaje
        return Math.min(val.valor / meta, 1.5); // cap a 150%
      }).filter((r) => r !== null);
      if (ratios.length > 0) {
        desempeno = (ratios.reduce((s, r) => s + r, 0) / ratios.length) * 5; // normalizar a escala 1-5
      }
    }

    if (potencial === null && desempeno === null) return null;

    return {
      usuarioId: u.id,
      nombre: `${u.nombre} ${u.apellido}`,
      puesto: u.puestoNombre || u.puestoId || "",
      potencial: potencial ? Math.round(potencial * 10) / 10 : null,
      desempeno: desempeno ? Math.round(desempeno * 10) / 10 : null,
      cuadrante: getCuadrante(potencial, desempeno),
    };
  }).filter(Boolean);

  res.json({ periodo, empleados: resultado });
});

// ── Plantillas 1 a 1 ──────────────────────────────────────────────────────────
router.get("/plantillas-1a1", (req, res) => {
  res.json(store.getDoPlantillas1a1());
});

router.post("/plantillas-1a1", (req, res) => {
  const { nombre, descripcion, preguntas } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es requerido" });
  const plantilla = store.createDoPlantilla1a1({ nombre, descripcion: descripcion || "", preguntas: Array.isArray(preguntas) ? preguntas : [] });
  res.status(201).json(plantilla);
});

router.put("/plantillas-1a1/:id", (req, res) => {
  const { nombre, descripcion, preguntas } = req.body;
  const actualizada = store.updateDoPlantilla1a1(req.params.id, {
    ...(nombre !== undefined && { nombre }),
    ...(descripcion !== undefined && { descripcion }),
    ...(preguntas !== undefined && { preguntas }),
  });
  if (!actualizada) return res.status(404).json({ error: "Plantilla no encontrada" });
  res.json(actualizada);
});

router.delete("/plantillas-1a1/:id", (req, res) => {
  const ok = store.deleteDoPlantilla1a1(req.params.id);
  if (!ok) return res.status(404).json({ error: "Plantilla no encontrada" });
  res.json({ ok: true });
});

function getCuadrante(potencial, desempeno) {
  if (potencial === null || desempeno === null) return null;
  const p = potencial <= 2.33 ? "bajo" : potencial <= 3.66 ? "medio" : "alto";
  const d = desempeno <= 2.33 ? "bajo" : desempeno <= 3.66 ? "medio" : "alto";
  const mapa = {
    "bajo-bajo": "Bajo rendimiento",
    "bajo-medio": "Empleado inconsistente",
    "bajo-alto": "Mal ajuste",
    "medio-bajo": "Enigma",
    "medio-medio": "Empleado clave",
    "medio-alto": "Alto rendimiento",
    "alto-bajo": "Diamante en bruto",
    "alto-medio": "Futuro líder",
    "alto-alto": "Estrella",
  };
  return mapa[`${p}-${d}`] || "Sin clasificar";
}

module.exports = router;
