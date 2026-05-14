/**
 * seed.js — Inicialización de base de datos previta_kronos
 *
 * Uso:
 *   cd backend
 *   node scripts/seed.js
 *
 * Qué hace:
 *   1. Limpia todos los datos de usuario (preserva catálogos)
 *   2. Crea el super administrador: jose.estrada@previta.com.mx
 *   3. Crea un usuario de prueba por cada rol del sistema
 *
 * Contraseñas iniciales:
 *   Super admin  → Previta@Admin2026!
 *   Usuarios TI  → Previta@TI2026!
 *   Demás roles  → Previta2026!
 *
 * IMPORTANTE: Cambiar contraseñas después del primer acceso.
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "previta_kronos",
  charset: "utf8mb4",
};

const hash = (password) => bcrypt.hash(password, 10);

const USUARIOS_INICIALES = [
  {
    nombre: "Jose Ramon",
    apellido: "Estrada Rendon",
    email: "jose.estrada@previta.com.mx",
    password: "Previta@Admin2026!",
    sexo: "masculino",
    rol_clave: "super_admin",
    tipo_usuario: "corporativo",
    departamento: "Dirección General",
  },
  {
    nombre: "Soporte",
    apellido: "TI Previta",
    email: "soporte.ti@previta.com.mx",
    password: "Previta@TI2026!",
    sexo: "masculino",
    rol_clave: "agente_soporte_ti",
    tipo_usuario: "corporativo",
    departamento: "Tecnología",
  },
  {
    nombre: "Supervisor",
    apellido: "Prueba",
    email: "supervisor@previta.com.mx",
    password: "Previta2026!",
    sexo: "masculino",
    rol_clave: "supervisor_sucursales",
    tipo_usuario: "corporativo",
    departamento: "Operaciones",
  },
  {
    nombre: "Agente",
    apellido: "Asistencia",
    email: "asistencia@previta.com.mx",
    password: "Previta2026!",
    sexo: "femenino",
    rol_clave: "agente_control_asistencia",
    tipo_usuario: "corporativo",
    departamento: "Recursos Humanos",
  },
  {
    nombre: "Visor",
    apellido: "Reportes",
    email: "visor@previta.com.mx",
    password: "Previta2026!",
    sexo: "masculino",
    rol_clave: "visor_reportes",
    tipo_usuario: "corporativo",
    departamento: "Dirección General",
  },
  {
    nombre: "Medico",
    apellido: "Titular Prueba",
    email: "medico.titular@previta.com.mx",
    password: "Previta2026!",
    sexo: "femenino",
    rol_clave: "medico_titular",
    tipo_usuario: "sucursal",
    departamento: "Médica",
  },
  {
    nombre: "Medico",
    apellido: "Guardia Prueba",
    email: "medico.guardia@previta.com.mx",
    password: "Previta2026!",
    sexo: "masculino",
    rol_clave: "medico_de_guardia",
    tipo_usuario: "corporativo",
    departamento: "Médica",
  },
];

async function seed() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log(`\nConectado a ${DB_CONFIG.host}/${DB_CONFIG.database}\n`);

    // ── 1. Limpiar datos de usuarios (preserva catálogos) ──────────────────
    console.log("Limpiando datos existentes...");
    await connection.execute("SET FOREIGN_KEY_CHECKS = 0");
    const tablas = [
      "auditoria_eventos",
      "notificaciones",
      "aclaraciones",
      "incidencias",
      "registros",
      "vacaciones",
      "anuncios",
      "grupo_sucursales",
      "grupos",
      "usuarios",
      "puesto_campos_extra",
      "puestos",
      "horario_dias",
      "horarios",
      "sucursales",
      "tipos_incidencia",
      "calendario",
      "areas",
    ];
    for (const tabla of tablas) {
      try {
        await connection.execute(`TRUNCATE TABLE \`${tabla}\``);
        process.stdout.write(`  ✓ ${tabla}\n`);
      } catch {
        process.stdout.write(`  - ${tabla} (no existe, omitida)\n`);
      }
    }
    await connection.execute("SET FOREIGN_KEY_CHECKS = 1");

    // ── 2. Actualizar config de empresa ────────────────────────────────────
    console.log("\nActualizando configuración de empresa...");
    await connection.execute(
      `UPDATE empresa_config SET nombre = 'Previta', razon_social = 'Previta S.A. de C.V.', email = 'contacto@previta.com.mx' WHERE id = 1`
    );
    console.log("  ✓ empresa_config actualizada");

    // ── 3. Crear usuarios iniciales ────────────────────────────────────────
    console.log("\nCreando usuarios iniciales...");
    for (const u of USUARIOS_INICIALES) {
      const id = uuidv4();
      const passwordHash = await hash(u.password);
      await connection.execute(
        `INSERT INTO usuarios
           (id, nombre, apellido, email, password_hash, sexo, rol_clave, tipo_usuario, departamento, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, u.nombre, u.apellido, u.email, passwordHash, u.sexo, u.rol_clave, u.tipo_usuario, u.departamento || null]
      );
      console.log(`  ✓ ${u.email} [${u.rol_clave}]`);
    }

    // ── 4. Tipos de incidencia iniciales ───────────────────────────────────
    console.log("\nCreando tipos de incidencia...");
    const tipos = [
      { nombre: "Enfermedad", descripcion: "Ausencia por enfermedad o padecimiento médico. Requiere constancia.", requiere_archivo: 1 },
      { nombre: "Permiso Personal", descripcion: "Permiso por asuntos personales.", requiere_archivo: 0 },
      { nombre: "Incapacidad IMSS", descripcion: "Incapacidad emitida por el IMSS. Requiere documento oficial.", requiere_archivo: 1 },
      { nombre: "Cita Médica", descripcion: "Ausencia parcial por cita médica.", requiere_archivo: 0 },
      { nombre: "Duelo Familiar", descripcion: "Ausencia por fallecimiento de familiar. Requiere acta.", requiere_archivo: 1 },
      { nombre: "Maternidad/Paternidad", descripcion: "Licencia por nacimiento de hijo. Requiere acta de nacimiento.", requiere_archivo: 1 },
      { nombre: "Capacitación", descripcion: "Ausencia por capacitación interna o externa.", requiere_archivo: 0 },
      { nombre: "Vacaciones", descripcion: "Periodo vacacional autorizado.", requiere_archivo: 0 },
    ];
    for (const t of tipos) {
      await connection.execute(
        `INSERT INTO tipos_incidencia (id, nombre, descripcion, requiere_archivo) VALUES (?, ?, ?, ?)`,
        [uuidv4(), t.nombre, t.descripcion, t.requiere_archivo]
      );
      console.log(`  ✓ ${t.nombre}`);
    }

    console.log("\n✅ Seed completado exitosamente.\n");
    console.log("Credenciales iniciales:");
    console.log("─────────────────────────────────────────────────────");
    for (const u of USUARIOS_INICIALES) {
      console.log(`  ${u.email.padEnd(42)} → ${u.password}`);
    }
    console.log("─────────────────────────────────────────────────────");
    console.log("⚠️  Cambia las contraseñas después del primer acceso.\n");
  } catch (error) {
    console.error("\n❌ Error durante el seed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seed();
