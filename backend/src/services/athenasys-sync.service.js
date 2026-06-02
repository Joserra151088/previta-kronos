/**
 * athenasys-sync.service.js
 * Lee empleados y sucursales desde la BD Athenasys y los sincroniza en previta_kronos.
 */

const bcrypt         = require("bcryptjs");
const { pool, athenasysPool } = require("../config/db");

/**
 * Sincroniza sucursales: Athenasys → previta_kronos
 * Mapeo de columnas:
 *   athenasys.sucursales.estado  → sucursales.ciudad  (y .estado)
 *   athenasys.sucursales.lat/lng → sucursales.latitud / longitud
 *   radio_metros fijo = 100 m por defecto
 */
async function syncSucursales() {
  if (!athenasysPool) throw new Error("ATHENASYS_DB_NAME no configurado en .env");
  if (!pool)          throw new Error("Pool de previta_kronos no disponible");

  const [rows] = await athenasysPool.query(
    "SELECT id, nombre, tipo, direccion, estado, lat, lng FROM sucursales WHERE activo = 1"
  );

  let count = 0;
  for (const row of rows) {
    await pool.query(
      `INSERT INTO sucursales
         (id, nombre, direccion, ciudad, estado, latitud, longitud, radio_metros, activa, tipo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 100, 1, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         nombre       = VALUES(nombre),
         ciudad       = VALUES(ciudad),
         estado       = VALUES(estado),
         latitud      = VALUES(latitud),
         longitud     = VALUES(longitud),
         radio_metros = VALUES(radio_metros),
         tipo         = VALUES(tipo),
         updated_at   = NOW()`,
      [
        row.id,
        row.nombre,
        row.direccion || "",
        row.estado    || "",
        row.estado    || "",
        row.lat != null ? Number(row.lat) : null,
        row.lng != null ? Number(row.lng) : null,
        row.tipo      || "sucursal",
      ]
    );
    count++;
  }
  return count;
}

/**
 * Sincroniza empleados: Athenasys → previta_kronos
 * Contraseña por defecto = num_empleado (hasheado con bcrypt)
 * Rol asignado = medico_titular (puede cambiarse por admin después)
 */
async function syncEmpleados() {
  if (!athenasysPool) throw new Error("ATHENASYS_DB_NAME no configurado en .env");
  if (!pool)          throw new Error("Pool de previta_kronos no disponible");

  const [rows] = await athenasysPool.query(
    `SELECT id, nombre_completo, num_empleado, puesto, area,
            sucursal_id, email, foto_url
     FROM empleados
     WHERE activo = 1`
  );

  let count = 0;
  for (const row of rows) {
    // Separar nombre_completo → nombre + apellido
    const parts    = (row.nombre_completo || "").trim().split(/\s+/);
    const nombre   = parts[0]             || "";
    const apellido = parts.slice(1).join(" ") || "";

    // Email: usar el real si existe; si no, generar uno único basado en num_empleado
    // para cumplir la restricción NOT NULL de la tabla usuarios.
    const emailReal = (row.email || "").trim();
    const email = emailReal
      ? emailReal
      : `${(row.num_empleado || row.id).toLowerCase().replace(/[^a-z0-9]/g, "")}@noemail.previta.com.mx`;

    // Contraseña por defecto = num_empleado
    const defaultPwd  = row.num_empleado || "Previta2026";
    const passwordHash = await bcrypt.hash(defaultPwd, 10);

    await pool.query(
      `INSERT INTO usuarios
         (id, nombre, apellido, email, password_hash, rol_clave, tipo_usuario,
          puesto_id, sucursal_id, activo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'medico_titular', 'sucursal', NULL, ?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         nombre      = VALUES(nombre),
         apellido    = VALUES(apellido),
         -- Solo actualizar email si Athenasys tiene un valor real (no el generado)
         email       = IF(VALUES(email) LIKE '%@noemail.previta.com.mx', email, VALUES(email)),
         sucursal_id = VALUES(sucursal_id),
         updated_at  = NOW()`,
      [
        row.id,
        nombre,
        apellido,
        email,
        passwordHash,
        row.sucursal_id || null,
      ]
    );
    count++;
  }
  return count;
}

/**
 * Ejecuta la sincronización completa: primero sucursales, luego empleados.
 */
async function syncAll() {
  const sucursales = await syncSucursales();
  const empleados  = await syncEmpleados();
  return { sucursales, empleados };
}

/**
 * Devuelve conteos de Athenasys sin escribir nada.
 */
async function previewCounts() {
  if (!athenasysPool) throw new Error("ATHENASYS_DB_NAME no configurado en .env");

  const [[sucResult]] = await athenasysPool.query(
    "SELECT COUNT(*) AS total FROM sucursales WHERE activo = 1"
  );
  const [[empResult]] = await athenasysPool.query(
    "SELECT COUNT(*) AS total FROM empleados WHERE activo = 1"
  );

  return {
    sucursales: Number(sucResult.total),
    empleados:  Number(empResult.total),
  };
}

module.exports = { syncSucursales, syncEmpleados, syncAll, previewCounts };
