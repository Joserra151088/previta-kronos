-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011: Asegurar rol administrador_general en roles + actualizar jose.estrada
-- Ejecutar: mysql -u root -p kronos < migrations/011_roles_administrador_general.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Insertar administrador_general en la tabla roles si no existe
INSERT IGNORE INTO roles (clave, nombre, descripcion, activo, created_at, updated_at)
VALUES ('administrador_general', 'Administrador General',
        'Acceso total al sistema. Gestiona licencias, roles y configuración global.',
        1, NOW(), NOW());

-- 2. Asegurarse de que nominas también esté en roles
INSERT IGNORE INTO roles (clave, nombre, descripcion, activo, created_at, updated_at)
VALUES ('nominas', 'Nóminas',
        'Consulta reportes de incidencias y horas trabajadas.',
        1, NOW(), NOW());

-- 3. Asegurarse de que desarrollo_organizacional esté en roles
INSERT IGNORE INTO roles (clave, nombre, descripcion, activo, created_at, updated_at)
VALUES ('desarrollo_organizacional', 'Desarrollo Organizacional',
        'Evaluaciones de desempeño, competencias e indicadores organizacionales.',
        1, NOW(), NOW());

-- 4. Actualizar jose.estrada si su rol no es administrador_general
UPDATE usuarios
SET rol_clave = 'administrador_general', updated_at = NOW()
WHERE email = 'jose.estrada@previta.com.mx'
  AND rol_clave != 'administrador_general';

-- 5. Verificar resultado
SELECT id, nombre, apellido, email, rol_clave
FROM usuarios
WHERE email = 'jose.estrada@previta.com.mx';
