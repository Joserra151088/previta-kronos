/**
 * athenasys.service.js
 *
 * Integración cross-DB con la base de datos 'athenasys' en el mismo servidor RDS.
 * Permite consultar empleados y sucursales de Athenasys en tiempo real mediante
 * JOINs entre previta_kronos y athenasys sin necesidad de sincronización.
 *
 * Configuración requerida en .env:
 *   ATHENASYS_DB_NAME=athenasys   (nombre exacto de la BD en el RDS)
 *
 * IMPORTANTE: Para habilitar los JOINs cross-DB, el usuario de MySQL configurado
 * en DB_USER debe tener permisos SELECT sobre las tablas de athenasys.
 * Ejecutar en el RDS (como admin):
 *   GRANT SELECT ON athenasys.* TO 'tu_usuario'@'%';
 *   FLUSH PRIVILEGES;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO: Completar los nombres reales de tablas y columnas de Athenasys.
 *       Las consultas de ejemplo usan nombres placeholder.
 *       Verificar con el DBA de Athenasys los nombres exactos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool } = require("../config/db");

const ATHENASYS_DB = process.env.ATHENASYS_DB_NAME || "athenasys";

/**
 * Verifica que el usuario de BD tiene acceso a Athenasys.
 */
async function verificarAcceso() {
  if (!pool) return { acceso: false, error: "Pool de DB no disponible" };
  try {
    await pool.execute(`SELECT 1 FROM \`${ATHENASYS_DB}\`.\`TABLA_EMPLEADOS_AQUI\` LIMIT 1`);
    return { acceso: true };
  } catch (error) {
    return { acceso: false, error: error.message };
  }
}

/**
 * Obtiene empleados de Athenasys.
 *
 * TODO: Reemplazar los nombres de tabla y columnas según el esquema real de Athenasys.
 *
 * @param {object} filtros - { sucursalId, activo }
 * @returns {Promise<Array>} Lista de empleados
 */
async function getEmpleados(filtros = {}) {
  if (!pool) return [];

  // TODO: Reemplazar con el nombre real de la tabla y columnas de empleados en Athenasys
  // Ejemplo hipotético — confirmar con el DBA:
  //   tabla     : athenasys.empleados (o employees, personal, etc.)
  //   columnas  : id_empleado, nombre, apellidos, email, id_sucursal, activo, puesto
  const query = `
    SELECT
      e.id_empleado        AS athenasys_id,
      e.nombre             AS nombre,
      e.apellidos          AS apellido,
      e.email              AS email,
      e.id_sucursal        AS sucursal_id,
      e.puesto             AS puesto,
      e.activo             AS activo
    FROM \`${ATHENASYS_DB}\`.\`TABLA_EMPLEADOS_AQUI\` e
    WHERE 1=1
      ${filtros.sucursalId ? "AND e.id_sucursal = ?" : ""}
      ${filtros.activo !== undefined ? "AND e.activo = ?" : ""}
    ORDER BY e.nombre, e.apellidos
  `;

  const params = [];
  if (filtros.sucursalId) params.push(filtros.sucursalId);
  if (filtros.activo !== undefined) params.push(filtros.activo ? 1 : 0);

  const [rows] = await pool.execute(query, params);
  return rows;
}

/**
 * Obtiene sucursales/centros de trabajo de Athenasys.
 *
 * TODO: Reemplazar los nombres de tabla y columnas según el esquema real de Athenasys.
 */
async function getSucursales(soloActivas = true) {
  if (!pool) return [];

  // TODO: Reemplazar con el nombre real de la tabla y columnas de sucursales en Athenasys
  // Ejemplo hipotético — confirmar con el DBA:
  //   tabla     : athenasys.sucursales (o centros, unidades, etc.)
  //   columnas  : id_sucursal, nombre, direccion, ciudad, estado, activa
  const query = `
    SELECT
      s.id_sucursal  AS id,
      s.nombre       AS nombre,
      s.direccion    AS direccion,
      s.ciudad       AS ciudad,
      s.estado       AS estado,
      s.activa       AS activa
    FROM \`${ATHENASYS_DB}\`.\`TABLA_SUCURSALES_AQUI\` s
    ${soloActivas ? "WHERE s.activa = 1" : ""}
    ORDER BY s.nombre
  `;

  const [rows] = await pool.execute(query);
  return rows;
}

/**
 * Busca un empleado de Athenasys por email.
 */
async function getEmpleadoPorEmail(email) {
  if (!pool || !email) return null;

  // TODO: Ajustar nombre de tabla y columnas
  const query = `
    SELECT
      e.id_empleado  AS athenasys_id,
      e.nombre       AS nombre,
      e.apellidos    AS apellido,
      e.email        AS email,
      e.id_sucursal  AS sucursal_id,
      e.puesto       AS puesto,
      e.activo       AS activo
    FROM \`${ATHENASYS_DB}\`.\`TABLA_EMPLEADOS_AQUI\` e
    WHERE LOWER(e.email) = LOWER(?)
    LIMIT 1
  `;

  const [rows] = await pool.execute(query, [email]);
  return rows[0] || null;
}

module.exports = {
  verificarAcceso,
  getEmpleados,
  getSucursales,
  getEmpleadoPorEmail,
  ATHENASYS_DB,
};
