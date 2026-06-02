/**
 * sync.routes.js
 * Endpoints para sincronizar datos desde Athenasys.
 * Solo accesible por super_admin, agente_soporte_ti y administrador_general.
 */

const express = require("express");
const router  = express.Router();

const { verificarToken }                   = require("../middleware/auth");
const { requireRoles, ROLES }              = require("../middleware/roles");
const { syncAll, previewCounts }           = require("../services/athenasys-sync.service");
const store                                = require("../data/store");

const ROLES_SYNC = [ROLES.SUPER_ADMIN, ROLES.AGENTE_SOPORTE_TI, ROLES.ADMINISTRADOR_GENERAL];

router.use(verificarToken);

/**
 * GET /api/sync/athenasys/preview
 * Devuelve cuántos registros se sincronizarían (sin ejecutar cambios).
 */
router.get("/athenasys/preview", requireRoles(...ROLES_SYNC), async (req, res) => {
  try {
    const counts = await previewCounts();
    return res.json(counts);
  } catch (error) {
    console.error("[sync] Error en preview:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sync/athenasys
 * Sincroniza sucursales y empleados de Athenasys hacia previta_kronos,
 * luego recarga el store en memoria.
 */
router.post("/athenasys", requireRoles(...ROLES_SYNC), async (req, res) => {
  try {
    const result = await syncAll();
    // Recargar store en memoria con los datos recién sincronizados
    await store.initializeFromDatabase();
    return res.json({
      ok: true,
      syncedSucursales: result.sucursales,
      syncedEmpleados:  result.empleados,
    });
  } catch (error) {
    console.error("[sync] Error en sincronización:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
