-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 012: Permiso puede_editar_registros en roles
-- Ejecutar: mysql -u root -p kronos < migrations/012_puede_editar_registros.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Agregar columna puede_editar a la tabla roles
ALTER TABLE roles
  ADD COLUMN puede_editar TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Si 1: usuarios con este rol pueden crear, editar y eliminar registros en el sistema';

-- 2. Habilitar edición para roles administrativos / operativos
UPDATE roles SET puede_editar = 1
WHERE clave IN (
  'super_admin',
  'administrador_general',
  'agente_soporte_ti',
  'supervisor_sucursales',
  'agente_control_asistencia',
  'nominas'
);

-- 3. Dejar en 0 los roles de solo lectura
UPDATE roles SET puede_editar = 0
WHERE clave IN ('visor_reportes', 'medico_titular', 'medico_de_guardia', 'desarrollo_organizacional');

-- 4. Asegurarse de que administrador_general existe con todos los permisos
INSERT IGNORE INTO roles (clave, nombre, descripcion, activo, puede_editar, created_at, updated_at)
VALUES ('administrador_general', 'Administrador General',
        'Acceso total al sistema. Gestiona licencias, roles y configuración global.',
        1, 1, NOW(), NOW());

-- 5. Darle a super_admin y administrador_general TODOS los módulos disponibles
INSERT IGNORE INTO rol_modulo (rol_clave, modulo_clave)
SELECT 'super_admin', clave FROM modulos;

INSERT IGNORE INTO rol_modulo (rol_clave, modulo_clave)
SELECT 'administrador_general', clave FROM modulos;

-- 6. Actualizar jose.estrada a super_admin (si por alguna razón cambió)
UPDATE usuarios
SET rol_clave = 'super_admin', updated_at = NOW()
WHERE email = 'jose.estrada@previta.com.mx';

-- 7. Verificar resultado
SELECT r.clave, r.nombre, r.puede_editar FROM roles r ORDER BY r.nombre;
SELECT u.email, u.rol_clave, r.puede_editar
FROM usuarios u
JOIN roles r ON r.clave = u.rol_clave
WHERE u.email = 'jose.estrada@previta.com.mx';
