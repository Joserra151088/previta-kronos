/**
 * roles.routes.js
 * CRUD de roles del sistema.
 * GET    /api/roles            → listar todos los roles activos
 * POST   /api/roles            → crear rol personalizado
 * PUT    /api/roles/:clave     → editar nombre/descripcion de un rol
 * DELETE /api/roles/:clave     → eliminar rol (solo si no tiene usuarios asignados)
 */
const express = require("express");
const router  = express.Router();
const { pool, DB_ENABLED } = require("../config/db");
const { verificarToken } = require("../middleware/auth");
const { requireRoles, ROLES } = require("../middleware/roles");

router.use(verificarToken);

const SOLO_ADMINS = [ROLES.SUPER_ADMIN, ROLES.ADMINISTRADOR_GENERAL, ROLES.AGENTE_SOPORTE_TI];

// ── GET /api/roles ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    if (DB_ENABLED && pool) {
      const [rows] = await pool.query(
        `SELECT id, clave, nombre, descripcion, activo, puede_editar FROM roles WHERE activo = 1 ORDER BY nombre`
      );
      return res.json(rows);
    }
    // Fallback: roles del store si DB no está disponible
    const store = require("../data/store");
    const defs  = store.getRoleDefinitions ? store.getRoleDefinitions() : {};
    const lista = Object.entries(defs).map(([clave, nombre]) => ({ clave, nombre, descripcion: "", activo: 1 }));
    return res.json(lista);
  } catch (err) {
    console.error("[roles] GET /", err.message);
    return res.status(500).json({ error: "Error al obtener roles" });
  }
});

// ── POST /api/roles ─────────────────────────────────────────────────────────────
router.post("/", requireRoles(...SOLO_ADMINS), async (req, res) => {
  const { clave, nombre, descripcion, puede_editar } = req.body;
  if (!clave || !nombre) return res.status(400).json({ error: "clave y nombre son obligatorios" });

  // clave solo letras/numeros/guiones bajos
  if (!/^[a-z_][a-z0-9_]{1,58}$/.test(clave)) {
    return res.status(400).json({ error: "La clave solo puede contener letras minúsculas, números y guiones bajos (ej: vendedor_senior)" });
  }

  const puedeEditarVal = puede_editar ? 1 : 0;

  try {
    if (!DB_ENABLED || !pool) return res.status(503).json({ error: "Base de datos no disponible" });

    const [existe] = await pool.query("SELECT clave FROM roles WHERE clave = ?", [clave]);
    if (existe.length > 0) return res.status(409).json({ error: "Ya existe un rol con esa clave" });

    await pool.query(
      `INSERT INTO roles (clave, nombre, descripcion, activo, puede_editar, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, NOW(), NOW())`,
      [clave, nombre, descripcion || null, puedeEditarVal]
    );
    return res.status(201).json({ clave, nombre, descripcion: descripcion || "", activo: 1, puede_editar: puedeEditarVal });
  } catch (err) {
    console.error("[roles] POST /", err.message);
    return res.status(500).json({ error: "Error al crear rol" });
  }
});

// ── PUT /api/roles/:clave ───────────────────────────────────────────────────────
router.put("/:clave", requireRoles(...SOLO_ADMINS), async (req, res) => {
  const { nombre, descripcion, puede_editar } = req.body;
  if (!nombre) return res.status(400).json({ error: "nombre es obligatorio" });

  const puedeEditarVal = puede_editar ? 1 : 0;

  try {
    if (!DB_ENABLED || !pool) return res.status(503).json({ error: "Base de datos no disponible" });

    const [result] = await pool.query(
      `UPDATE roles SET nombre = ?, descripcion = ?, puede_editar = ?, updated_at = NOW() WHERE clave = ?`,
      [nombre, descripcion || null, puedeEditarVal, req.params.clave]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Rol no encontrado" });

    return res.json({ clave: req.params.clave, nombre, descripcion: descripcion || "", puede_editar: puedeEditarVal });
  } catch (err) {
    console.error("[roles] PUT /:clave", err.message);
    return res.status(500).json({ error: "Error al actualizar rol" });
  }
});

// ── DELETE /api/roles/:clave ────────────────────────────────────────────────────
router.delete("/:clave", requireRoles(...SOLO_ADMINS), async (req, res) => {
  try {
    if (!DB_ENABLED || !pool) return res.status(503).json({ error: "Base de datos no disponible" });

    // Verificar que no haya usuarios con ese rol
    const [enUso] = await pool.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE rol_clave = ? AND activo = 1`,
      [req.params.clave]
    );
    if (enUso[0]?.total > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: hay ${enUso[0].total} empleado(s) con este rol. Reasigna su rol primero.`,
      });
    }

    const [result] = await pool.query("DELETE FROM roles WHERE clave = ?", [req.params.clave]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Rol no encontrado" });

    return res.json({ ok: true, mensaje: "Rol eliminado correctamente" });
  } catch (err) {
    console.error("[roles] DELETE /:clave", err.message);
    return res.status(500).json({ error: "Error al eliminar rol" });
  }
});

module.exports = router;
