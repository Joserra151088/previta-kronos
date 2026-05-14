-- ============================================================
--  KRONOS — Sistema de Control de Acceso y Asistencia
--  Previta S.A. de C.V.
--
--  Base de datos : previta_kronos
--  Versión       : 2.0 (limpia, producción)
--  Fecha         : 2026-05-14
--
--  INTEGRACIÓN CROSS-DB
--  ─────────────────────────────────────────────────────────
--  Esta base de datos vive en el mismo servidor RDS que
--  'athenasys'. Las consultas de empleados y sucursales
--  pueden referenciar: athenasys.<tabla>
--
--  TIPOS DE ID
--  ─────────────────────────────────────────────────────────
--  • Tablas de catálogo: INT UNSIGNED AUTO_INCREMENT
--  • Tablas de datos   : VARCHAR(36) UUID (generado en JS)
--
--  CONVENCIONES
--  ─────────────────────────────────────────────────────────
--  • Timestamps  : DATETIME DEFAULT CURRENT_TIMESTAMP
--  • URLs S3     : VARCHAR(2048) — solo la URL, nunca el archivo
--  • Booleans    : TINYINT(1)   (0 = false, 1 = true)
--  • Enums       : ENUM(…)      para valores fijos y conocidos
--  • snake_case  : todos los nombres de columna
-- ============================================================

CREATE DATABASE IF NOT EXISTS previta_kronos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE previta_kronos;

SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
--  1. ROLES
--     Catálogo de perfiles de acceso.
--     ID: INT AUTO_INCREMENT (el código no inserta ID explícito).
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  clave       VARCHAR(60)  NOT NULL  COMMENT 'Identificador único en snake_case. Ej: super_admin, visor_reportes',
  nombre      VARCHAR(120) NOT NULL  COMMENT 'Nombre legible para mostrar en la interfaz',
  descripcion TEXT                   COMMENT 'Responsabilidades y alcance del rol',
  activo      TINYINT(1)   NOT NULL  DEFAULT 1,
  created_at  DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_clave (clave)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de roles. Controla qué módulos puede ver y qué acciones puede realizar cada perfil.';

INSERT IGNORE INTO roles (clave, nombre, descripcion) VALUES
  ('super_admin',               'Super Administrador',          'Acceso total al sistema sin restricciones'),
  ('agente_soporte_ti',         'Agente Soporte TI',            'Soporte técnico y administración de plataforma'),
  ('supervisor_sucursales',     'Supervisor de Sucursales',     'Gestiona grupos, empleados y asistencias de sus sucursales'),
  ('agente_control_asistencia', 'Agente Control de Asistencia', 'Registra y revisa asistencias del personal'),
  ('visor_reportes',            'Visor de Reportes',            'Acceso de solo lectura a reportes y mapas'),
  ('medico_titular',            'Médico Titular',               'Gestiona incidencias médicas de su sucursal asignada'),
  ('medico_de_guardia',         'Médico de Guardia',            'Gestiona incidencias médicas sin sucursal fija');


-- ============================================================
--  2. MÓDULOS
--     Secciones / vistas de la aplicación.
--     ID: INT AUTO_INCREMENT.
-- ============================================================
CREATE TABLE IF NOT EXISTS modulos (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  clave       VARCHAR(60)      NOT NULL  COMMENT 'Identificador único. Ej: dashboard, eventos',
  nombre      VARCHAR(120)     NOT NULL  COMMENT 'Etiqueta en el menú lateral',
  descripcion TEXT                       COMMENT 'Para qué sirve este módulo',
  orden_menu  TINYINT UNSIGNED NOT NULL  DEFAULT 0  COMMENT 'Posición en el menú (ascendente)',
  activo      TINYINT(1)       NOT NULL  DEFAULT 1,
  created_at  DATETIME         NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME         NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_modulos_clave (clave)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de módulos del sistema.';

INSERT IGNORE INTO modulos (clave, nombre, orden_menu) VALUES
  ('dashboard',      'Inicio / Dashboard',          1),
  ('eventos',        'Eventos',                     2),
  ('incidencias',    'Incidencias',                 3),
  ('reportes',       'Reportes',                    4),
  ('sucursales',     'Sucursales',                  5),
  ('empleados',      'Empleados',                   6),
  ('grupos',         'Grupos de Sucursales',        7),
  ('mapa',           'Mapa',                        8),
  ('administracion', 'Administración',              9),
  ('auditoria',      'Auditoría',                  10),
  ('logs',           'Logs / Salud de Plataforma', 11),
  ('notificaciones', 'Notificaciones',             12);


-- ============================================================
--  3. ROL_MODULO
--     Permisos N:M entre roles y módulos.
--     ID: INT AUTO_INCREMENT.
-- ============================================================
CREATE TABLE IF NOT EXISTS rol_modulo (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rol_clave    VARCHAR(60)  NOT NULL  COMMENT 'FK → roles.clave',
  modulo_clave VARCHAR(60)  NOT NULL  COMMENT 'FK → modulos.clave',
  created_at   DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_modulo (rol_clave, modulo_clave),

  CONSTRAINT fk_rolmod_rol    FOREIGN KEY (rol_clave)    REFERENCES roles  (clave) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rolmod_modulo FOREIGN KEY (modulo_clave) REFERENCES modulos(clave) ON DELETE CASCADE ON UPDATE CASCADE

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Permisos N:M: qué módulos puede acceder cada rol.';

INSERT IGNORE INTO rol_modulo (rol_clave, modulo_clave) VALUES
  ('super_admin','dashboard'),('super_admin','eventos'),('super_admin','incidencias'),
  ('super_admin','reportes'),('super_admin','sucursales'),('super_admin','empleados'),
  ('super_admin','grupos'),('super_admin','mapa'),('super_admin','administracion'),
  ('super_admin','auditoria'),('super_admin','logs'),('super_admin','notificaciones'),
  ('agente_soporte_ti','dashboard'),('agente_soporte_ti','eventos'),('agente_soporte_ti','incidencias'),
  ('agente_soporte_ti','reportes'),('agente_soporte_ti','sucursales'),('agente_soporte_ti','empleados'),
  ('agente_soporte_ti','grupos'),('agente_soporte_ti','mapa'),('agente_soporte_ti','administracion'),
  ('agente_soporte_ti','logs'),('agente_soporte_ti','notificaciones'),
  ('supervisor_sucursales','dashboard'),('supervisor_sucursales','eventos'),
  ('supervisor_sucursales','incidencias'),('supervisor_sucursales','reportes'),
  ('supervisor_sucursales','empleados'),('supervisor_sucursales','grupos'),
  ('supervisor_sucursales','mapa'),('supervisor_sucursales','notificaciones'),
  ('agente_control_asistencia','dashboard'),('agente_control_asistencia','eventos'),
  ('agente_control_asistencia','incidencias'),('agente_control_asistencia','notificaciones'),
  ('visor_reportes','dashboard'),('visor_reportes','reportes'),
  ('visor_reportes','mapa'),('visor_reportes','notificaciones'),
  ('medico_titular','dashboard'),('medico_titular','incidencias'),('medico_titular','notificaciones'),
  ('medico_de_guardia','dashboard'),('medico_de_guardia','incidencias'),('medico_de_guardia','notificaciones');


-- ============================================================
--  4. SUCURSALES
--     Oficinas con geocerca GPS.
--     ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS sucursales (
  id           VARCHAR(36)    NOT NULL  COMMENT 'UUID generado por la aplicación',
  nombre       VARCHAR(150)   NOT NULL  COMMENT 'Nombre de la sucursal. Ej: Sucursal Centro Monterrey',
  direccion    VARCHAR(300)   NOT NULL,
  ciudad       VARCHAR(100)   NOT NULL,
  estado       VARCHAR(100)   NOT NULL,

  -- Geocerca: el radio define el área válida para registrar asistencia
  latitud      DECIMAL(10, 7) NOT NULL  COMMENT 'Latitud del centro de la geocerca (WGS84)',
  longitud     DECIMAL(11, 7) NOT NULL  COMMENT 'Longitud del centro de la geocerca (WGS84)',
  radio_metros INT UNSIGNED   NOT NULL  DEFAULT 200  COMMENT 'Radio en metros. Defecto: 200 m',

  activa       TINYINT(1)     NOT NULL  DEFAULT 1  COMMENT '0 = sucursal fuera de operación',
  created_at   DATETIME       NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME       NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_sucursales_activa (activa)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de sucursales con geocerca GPS para validar presencia física al registrar asistencia.';


-- ============================================================
--  5. HORARIOS
--     Turnos de trabajo.
--     ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios (
  id                     VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  nombre                 VARCHAR(120) NOT NULL  COMMENT 'Ej: Turno Matutino 8-5',
  hora_entrada           TIME         NOT NULL  COMMENT 'Hora esperada de entrada. Ej: 08:00:00',
  hora_salida_alimentos  TIME         NOT NULL  COMMENT 'Inicio de comida. Ej: 14:00:00',
  hora_regreso_alimentos TIME         NOT NULL  COMMENT 'Fin de comida. Ej: 15:00:00',
  hora_salida            TIME         NOT NULL  COMMENT 'Hora esperada de salida. Ej: 17:00:00',
  tolerancia_minutos     TINYINT UNSIGNED NOT NULL DEFAULT 10  COMMENT 'Minutos de gracia antes de marcar fuera de horario',
  activo                 TINYINT(1)   NOT NULL  DEFAULT 1,
  created_at             DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Turnos de trabajo: horas esperadas de entrada, comida y salida, más tolerancia.';


-- ============================================================
--  6. HORARIO_DIAS
--     Días laborales de cada horario.
--     ID: INT AUTO_INCREMENT (el código no inserta ID explícito).
-- ============================================================
CREATE TABLE IF NOT EXISTS horario_dias (
  id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  horario_id VARCHAR(36)      NOT NULL  COMMENT 'FK → horarios.id (UUID)',
  dia_semana TINYINT UNSIGNED NOT NULL  COMMENT '0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb',

  PRIMARY KEY (id),
  UNIQUE KEY uq_horario_dia (horario_id, dia_semana),

  CONSTRAINT fk_hdia_horario FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Días de la semana en que aplica cada horario.';


-- ============================================================
--  7. PUESTOS
--     Cargos de trabajo.
--     ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS puestos (
  id          VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  nombre      VARCHAR(150) NOT NULL  COMMENT 'Ej: Médico General, Enfermera, Recepcionista',
  descripcion TEXT                   COMMENT 'Funciones y responsabilidades del puesto',
  horario_id  VARCHAR(36)            COMMENT 'FK → horarios.id (UUID). NULL = sin horario predeterminado',
  activo      TINYINT(1)   NOT NULL  DEFAULT 1,
  created_at  DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_puestos_horario (horario_id),

  CONSTRAINT fk_puesto_horario FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de puestos. Puede tener un horario predeterminado y campos extra de perfil.';


-- ============================================================
--  8. PUESTO_CAMPOS_EXTRA
--     Campos dinámicos de perfil por puesto.
--     ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS puesto_campos_extra (
  id           VARCHAR(36)   NOT NULL  COMMENT 'UUID generado por la aplicación',
  puesto_id    VARCHAR(36)   NOT NULL  COMMENT 'FK → puestos.id (UUID)',
  nombre       VARCHAR(120)  NOT NULL  COMMENT 'Etiqueta del campo. Ej: Cédula Profesional',
  tipo         ENUM('texto', 'numero', 'fecha', 'seleccion', 'booleano') NOT NULL DEFAULT 'texto',
  opciones_json JSON                   COMMENT 'Solo para tipo=seleccion. Array JSON de opciones',
  obligatorio  TINYINT(1)    NOT NULL  DEFAULT 0  COMMENT '1 = campo requerido al crear el empleado',
  orden_visual TINYINT UNSIGNED NOT NULL DEFAULT 0,
  activo       TINYINT(1)    NOT NULL  DEFAULT 1,
  created_at   DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_pce_puesto (puesto_id),

  CONSTRAINT fk_pce_puesto FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE CASCADE

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Campos dinámicos de perfil por puesto. Valores almacenados en usuarios.datos_extra_json.';


-- ============================================================
--  9. GRUPOS
--     Agrupaciones de sucursales por zona/región.
--     ID: VARCHAR(36) UUID.
--     NOTA: FK supervisor_id se agrega al final (dep. circular).
-- ============================================================
CREATE TABLE IF NOT EXISTS grupos (
  id            VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  nombre        VARCHAR(150) NOT NULL  COMMENT 'Ej: Zona Norte, Región Bajío',
  supervisor_id VARCHAR(36)            COMMENT 'FK → usuarios.id (UUID). Se agrega con ALTER TABLE al final',
  activo        TINYINT(1)   NOT NULL  DEFAULT 1,
  created_at    DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Grupos de sucursales administrados por un supervisor regional.';


-- ============================================================
--  10. USUARIOS
--      Empleados y personal administrativo.
--      ID: VARCHAR(36) UUID.
--
--      COLUMNAS DE ARCHIVO (AWS S3):
--        foto_url → URL pública del avatar en S3.
--        El archivo físico vive en S3; aquí solo la URL.
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id               VARCHAR(36)   NOT NULL  COMMENT 'UUID generado por la aplicación',
  nombre           VARCHAR(100)  NOT NULL,
  apellido         VARCHAR(100)  NOT NULL,
  email            VARCHAR(180)  NOT NULL  COMMENT 'Correo corporativo único. Usado para login',
  password_hash    VARCHAR(255)  NOT NULL  COMMENT 'Hash bcrypt. NUNCA almacenar texto plano',
  sexo             ENUM('masculino', 'femenino', 'otro') NOT NULL,
  edad             TINYINT UNSIGNED          COMMENT 'Edad en años',
  telefono         VARCHAR(20)               COMMENT 'Teléfono de contacto',

  -- Rol y tipo de usuario
  rol_clave        VARCHAR(60)   NOT NULL    COMMENT 'FK → roles.clave. Define permisos de acceso al sistema',
  tipo_usuario     ENUM('sucursal', 'corporativo') NOT NULL
                                             COMMENT 'sucursal = trabaja en una sucursal fija | corporativo = sin sucursal asignada',
  departamento     VARCHAR(120)              COMMENT 'Área. Ej: Recursos Humanos, Finanzas',
  datos_extra_json JSON                      COMMENT 'Valores de campos extra del puesto. Formato: { "campo_id": valor }',

  -- Relaciones organizacionales
  puesto_id        VARCHAR(36)               COMMENT 'FK → puestos.id (UUID). NULL = sin puesto',
  sucursal_id      VARCHAR(36)               COMMENT 'FK → sucursales.id (UUID). NULL para usuarios corporativos',
  horario_id       VARCHAR(36)               COMMENT 'FK → horarios.id (UUID). NULL = sin horario asignado',
  grupo_id         VARCHAR(36)               COMMENT 'FK → grupos.id (UUID). NULL = sin grupo',

  -- Foto de perfil (almacenada en AWS S3, aquí solo la URL)
  -- Formato: https://<bucket>.s3.<region>.amazonaws.com/usuarios/<archivo>
  foto_url         VARCHAR(2048)             COMMENT 'URL pública del avatar en AWS S3. NULL = sin foto',

  activo           TINYINT(1)    NOT NULL    DEFAULT 1  COMMENT '0 = usuario desactivado',
  created_at       DATETIME      NOT NULL    DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email   (email),
  KEY idx_usuarios_rol           (rol_clave),
  KEY idx_usuarios_tipo          (tipo_usuario),
  KEY idx_usuarios_sucursal      (sucursal_id),
  KEY idx_usuarios_grupo         (grupo_id),
  KEY idx_usuarios_horario       (horario_id),
  KEY idx_usuarios_puesto        (puesto_id),
  KEY idx_usuarios_activo        (activo),

  CONSTRAINT fk_usuario_rol      FOREIGN KEY (rol_clave)   REFERENCES roles     (clave) ON UPDATE CASCADE,
  CONSTRAINT fk_usuario_puesto   FOREIGN KEY (puesto_id)   REFERENCES puestos   (id)    ON DELETE SET NULL,
  CONSTRAINT fk_usuario_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)    ON DELETE SET NULL,
  CONSTRAINT fk_usuario_horario  FOREIGN KEY (horario_id)  REFERENCES horarios  (id)    ON DELETE SET NULL,
  CONSTRAINT fk_usuario_grupo    FOREIGN KEY (grupo_id)    REFERENCES grupos    (id)    ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Usuarios del sistema. Foto de perfil en AWS S3 (solo URL). Contraseña como hash bcrypt.';


-- ============================================================
--  11. GRUPO_SUCURSALES
--      Sucursales que pertenecen a cada grupo (N:M).
--      ID: INT AUTO_INCREMENT.
-- ============================================================
CREATE TABLE IF NOT EXISTS grupo_sucursales (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo_id    VARCHAR(36)  NOT NULL  COMMENT 'FK → grupos.id (UUID)',
  sucursal_id VARCHAR(36)  NOT NULL  COMMENT 'FK → sucursales.id (UUID)',
  created_at  DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_grupo_sucursal (grupo_id, sucursal_id),
  KEY idx_gs_sucursal (sucursal_id),

  CONSTRAINT fk_gs_grupo    FOREIGN KEY (grupo_id)    REFERENCES grupos    (id) ON DELETE CASCADE,
  CONSTRAINT fk_gs_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Relación N:M: sucursales asignadas a cada grupo regional.';


-- ============================================================
--  12. REGISTROS
--      Movimientos de asistencia: entrada, comida, salida.
--      ID: VARCHAR(36) UUID.
--
--      COLUMNAS DE ARCHIVO (AWS S3):
--        foto_url → foto del empleado al momento del checkin.
--                   Obligatoria para registros nuevos.
-- ============================================================
CREATE TABLE IF NOT EXISTS registros (
  id                    VARCHAR(36)   NOT NULL  COMMENT 'UUID generado por la aplicación',
  usuario_id            VARCHAR(36)   NOT NULL  COMMENT 'FK → usuarios.id (UUID)',
  sucursal_id           VARCHAR(36)             COMMENT 'FK → sucursales.id (UUID). NULL si fue remoto',

  tipo                  ENUM('entrada', 'salida_alimentos', 'regreso_alimentos', 'salida')
                        NOT NULL               COMMENT 'Tipo de movimiento. Orden esperado en el día: entrada → salida_alimentos → regreso_alimentos → salida',
  fecha                 DATE          NOT NULL  COMMENT 'Fecha del registro (YYYY-MM-DD)',
  hora                  TIME          NOT NULL  COMMENT 'Hora del registro (HH:MM:SS)',

  -- Foto del empleado
  -- Obligatoria en registros nuevos. El archivo está en AWS S3;
  -- aquí se guarda únicamente la URL pública del objeto.
  -- Formato: https://<bucket>.s3.<region>.amazonaws.com/registros/<archivo>
  foto_url              VARCHAR(2048)           COMMENT 'URL pública de la foto en AWS S3. NULL solo en registros históricos anteriores a la funcionalidad',

  -- Ubicación GPS
  latitud               DECIMAL(10, 7)          COMMENT 'Latitud GPS al registrarse (WGS84). NULL si no se obtuvo',
  longitud              DECIMAL(11, 7)          COMMENT 'Longitud GPS al registrarse (WGS84). NULL si no se obtuvo',
  dentro_geocerca       TINYINT(1)              COMMENT '1=dentro del radio | 0=fuera | NULL=sin GPS',
  distancia_al_centro   DECIMAL(8, 2)           COMMENT 'Distancia en metros al centro de la geocerca',
  fuera_de_geocerca     TINYINT(1)    NOT NULL  DEFAULT 0  COMMENT '1 = registró desde fuera del área permitida',
  motivo_fuera_geocerca VARCHAR(500)            COMMENT 'Justificación cuando fuera_de_geocerca = 1',

  -- Horario
  fuera_de_horario      TINYINT(1)    NOT NULL  DEFAULT 0  COMMENT '1 = registró fuera del horario establecido',
  motivo_fuera_horario  VARCHAR(500)            COMMENT 'Justificación cuando fuera_de_horario = 1',

  -- Registro manual (creado por supervisor o agente)
  es_manual             TINYINT(1)    NOT NULL  DEFAULT 0  COMMENT '1 = creado por un supervisor o agente, no por el empleado',
  justificacion         VARCHAR(500)            COMMENT 'Motivo del registro manual',
  captado_por           VARCHAR(36)             COMMENT 'FK → usuarios.id (UUID). NULL = registro automático',

  -- Flujo de aprobación (para registros fuera de geocerca)
  estado_aprobacion     ENUM('pendiente', 'aprobado', 'rechazado')
                                                COMMENT 'NULL = no requiere aprobación',
  aprobado_por          VARCHAR(36)             COMMENT 'FK → usuarios.id (UUID)',
  aprobado_en           DATETIME                COMMENT 'Fecha y hora de la resolución',
  comentario_supervisor VARCHAR(500)            COMMENT 'Observación del supervisor al aprobar/rechazar',

  -- Historial de ediciones
  editado_manual        TINYINT(1)    NOT NULL  DEFAULT 0  COMMENT '1 = fue modificado manualmente',
  editado_por           VARCHAR(36)             COMMENT 'FK → usuarios.id (UUID)',
  editado_en            DATETIME                COMMENT 'Fecha y hora de la última edición',
  motivo_edicion_manual VARCHAR(500)            COMMENT 'Justificación de la edición',
  manual_original_json  JSON                    COMMENT 'Snapshot JSON de los valores originales antes de editar',

  created_at            DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_reg_usuario_fecha  (usuario_id, fecha)   COMMENT 'Consulta más frecuente: registros de un empleado en un día',
  KEY idx_reg_sucursal_fecha (sucursal_id, fecha)  COMMENT 'Reportes de una sucursal por rango de fechas',
  KEY idx_reg_fecha          (fecha),
  KEY idx_reg_tipo           (tipo),
  KEY idx_reg_aprobacion     (estado_aprobacion),

  CONSTRAINT fk_reg_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios  (id),
  CONSTRAINT fk_reg_sucursal  FOREIGN KEY (sucursal_id)  REFERENCES sucursales(id) ON DELETE SET NULL,
  CONSTRAINT fk_reg_captador  FOREIGN KEY (captado_por)  REFERENCES usuarios  (id) ON DELETE SET NULL,
  CONSTRAINT fk_reg_aprobador FOREIGN KEY (aprobado_por) REFERENCES usuarios  (id) ON DELETE SET NULL,
  CONSTRAINT fk_reg_editor    FOREIGN KEY (editado_por)  REFERENCES usuarios  (id) ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Registros de asistencia. Foto en AWS S3, GPS, geocerca y flujo de aprobación.';


-- ============================================================
--  13. TIPOS_INCIDENCIA
--      Catálogo de tipos de ausencias y permisos.
--      ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_incidencia (
  id               VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  nombre           VARCHAR(120) NOT NULL  COMMENT 'Ej: Enfermedad, Permiso Personal',
  descripcion      TEXT                   COMMENT 'Criterios de aplicación del tipo',
  requiere_archivo TINYINT(1)   NOT NULL  DEFAULT 0  COMMENT '1 = debe adjuntar documento de respaldo',
  activo           TINYINT(1)   NOT NULL  DEFAULT 1,
  created_at       DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de tipos de incidencias. Define si requieren archivo de respaldo.';

-- Nota: los tipos iniciales los inserta la aplicación al arrancar.
-- Si deseas datos de ejemplo:
-- INSERT IGNORE INTO tipos_incidencia (id, nombre, descripcion, requiere_archivo) VALUES
--   (UUID(), 'Enfermedad',     'Ausencia por salud. Requiere constancia médica', 1),
--   (UUID(), 'Permiso Personal','Permiso por asuntos personales',                0), ...


-- ============================================================
--  14. INCIDENCIAS
--      Solicitudes de ausencias y permisos.
--      ID: VARCHAR(36) UUID.
--
--      COLUMNAS DE ARCHIVO (AWS S3):
--        archivo_url → documento de respaldo (PDF, imagen).
-- ============================================================
CREATE TABLE IF NOT EXISTS incidencias (
  id                   VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  usuario_id           VARCHAR(36)  NOT NULL  COMMENT 'FK → usuarios.id (UUID)',
  sucursal_id          VARCHAR(36)            COMMENT 'FK → sucursales.id (UUID). NULL si es corporativo',
  tipo_incidencia_id   VARCHAR(36)  NOT NULL  COMMENT 'FK → tipos_incidencia.id (UUID)',
  descripcion          TEXT                   COMMENT 'Motivo escrito por el empleado',
  estado               ENUM('pendiente', 'aceptada', 'rechazada') NOT NULL DEFAULT 'pendiente',

  -- Documento de respaldo en AWS S3
  -- El archivo (PDF, imagen) se sube a S3; aquí solo se guarda la URL.
  -- Formato: https://<bucket>.s3.<region>.amazonaws.com/incidencias/<archivo>
  archivo_url          VARCHAR(2048)           COMMENT 'URL pública del documento en AWS S3. NULL = sin archivo',
  archivo_nombre       VARCHAR(255)            COMMENT 'Nombre original del archivo. Ej: constancia_medica.pdf',
  archivo_mime         VARCHAR(100)            COMMENT 'Tipo MIME. Ej: application/pdf, image/jpeg',

  -- Revisión del supervisor
  supervisor_id        VARCHAR(36)             COMMENT 'FK → usuarios.id (UUID)',
  comentario_supervisor VARCHAR(500)           COMMENT 'Observación o motivo de rechazo',
  revisado_en          DATETIME                COMMENT 'Fecha y hora de la resolución',

  created_at           DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_inc_usuario    (usuario_id),
  KEY idx_inc_sucursal   (sucursal_id),
  KEY idx_inc_tipo       (tipo_incidencia_id),
  KEY idx_inc_estado     (estado),
  KEY idx_inc_supervisor (supervisor_id),

  CONSTRAINT fk_inc_usuario    FOREIGN KEY (usuario_id)         REFERENCES usuarios       (id),
  CONSTRAINT fk_inc_sucursal   FOREIGN KEY (sucursal_id)        REFERENCES sucursales     (id) ON DELETE SET NULL,
  CONSTRAINT fk_inc_tipo       FOREIGN KEY (tipo_incidencia_id) REFERENCES tipos_incidencia(id),
  CONSTRAINT fk_inc_supervisor FOREIGN KEY (supervisor_id)      REFERENCES usuarios       (id) ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Solicitudes de ausencias y permisos. Documento de respaldo en AWS S3 (solo URL).';


-- ============================================================
--  15. ACLARACIONES
--      Correcciones sobre registros de asistencia.
--      ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS aclaraciones (
  id                    VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  usuario_id            VARCHAR(36)  NOT NULL  COMMENT 'FK → usuarios.id (UUID)',
  registro_id           VARCHAR(36)            COMMENT 'FK → registros.id (UUID). NULL si el registro no existe',
  fecha_registro        DATE         NOT NULL  COMMENT 'Fecha del día a aclarar (YYYY-MM-DD)',
  tipo_registro         ENUM('entrada', 'salida_alimentos', 'regreso_alimentos', 'salida') NOT NULL,
  motivo                TEXT         NOT NULL  COMMENT 'Explicación del empleado',
  estado                ENUM('pendiente', 'aceptada', 'rechazada') NOT NULL DEFAULT 'pendiente',

  supervisor_id         VARCHAR(36)            COMMENT 'FK → usuarios.id (UUID)',
  comentario_supervisor VARCHAR(500)           COMMENT 'Respuesta del supervisor',
  revisado_en           DATETIME               COMMENT 'Fecha y hora de la resolución',

  created_at            DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_acl_usuario  (usuario_id),
  KEY idx_acl_registro (registro_id),
  KEY idx_acl_estado   (estado),
  KEY idx_acl_fecha    (fecha_registro),

  CONSTRAINT fk_acl_usuario    FOREIGN KEY (usuario_id)    REFERENCES usuarios (id),
  CONSTRAINT fk_acl_registro   FOREIGN KEY (registro_id)   REFERENCES registros(id) ON DELETE SET NULL,
  CONSTRAINT fk_acl_supervisor FOREIGN KEY (supervisor_id) REFERENCES usuarios (id) ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Aclaraciones sobre registros. El supervisor puede aprobar, rechazar y corregir.';


-- ============================================================
--  16. NOTIFICACIONES
--      Alertas internas del sistema.
--      ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id              VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',
  para_usuario_id VARCHAR(36)  NOT NULL  COMMENT 'FK → usuarios.id (UUID)',
  de_usuario_id   VARCHAR(36)            COMMENT 'FK → usuarios.id (UUID). NULL = generada por el sistema',
  tipo            VARCHAR(80)  NOT NULL  COMMENT 'Código del tipo. Ej: aclaracion_nueva, incidencia_resuelta',
  titulo          VARCHAR(200) NOT NULL,
  mensaje         TEXT         NOT NULL,
  referencia_id   VARCHAR(36)            COMMENT 'ID de la entidad relacionada (incidencia, aclaración, etc.)',
  leida           TINYINT(1)   NOT NULL  DEFAULT 0  COMMENT '0 = no leída | 1 = leída',
  created_at      DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_notif_para      (para_usuario_id),
  KEY idx_notif_no_leidas (para_usuario_id, leida)  COMMENT 'Optimiza el badge de no leídas',

  CONSTRAINT fk_notif_para FOREIGN KEY (para_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_de   FOREIGN KEY (de_usuario_id)   REFERENCES usuarios(id) ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Notificaciones internas. Se marcan como leídas cuando el usuario las abre.';


-- ============================================================
--  17. AUDITORIA_EVENTOS
--      Log de acciones del sistema. Solo INSERT, nunca UPDATE.
--      ID: VARCHAR(36) UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id             VARCHAR(36)  NOT NULL  COMMENT 'UUID generado por la aplicación',

  -- Snapshot del usuario al momento de la acción (no solo FK,
  -- para preservar historial aunque el usuario sea eliminado)
  usuario_id     VARCHAR(36)            COMMENT 'FK → usuarios.id (UUID). NULL = usuario no autenticado',
  usuario_nombre VARCHAR(200)           COMMENT 'Nombre completo al momento de la acción (snapshot)',
  usuario_rol    VARCHAR(60)            COMMENT 'Rol al momento de la acción (snapshot)',

  accion         VARCHAR(200) NOT NULL  COMMENT 'Descripción de la acción. Ej: Incidencia aprobada',
  metodo         ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE') NOT NULL,
  ruta           VARCHAR(300) NOT NULL  COMMENT 'Ruta de la API. Ej: /api/registros',
  status_code    SMALLINT UNSIGNED NOT NULL  COMMENT 'Código HTTP de respuesta',
  exito          TINYINT(1)   NOT NULL  COMMENT '1 = exitoso (2xx) | 0 = error (4xx/5xx)',
  ip             VARCHAR(45)            COMMENT 'IP del cliente (IPv4 o IPv6)',
  detalles_json  JSON                   COMMENT 'Contexto adicional en JSON libre',

  created_at     DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP  COMMENT 'Solo INSERT, nunca se actualiza',

  PRIMARY KEY (id),
  KEY idx_audit_usuario (usuario_id),
  KEY idx_audit_fecha   (created_at),
  KEY idx_audit_exito   (exito),
  KEY idx_audit_ruta    (ruta(100)),

  CONSTRAINT fk_audit_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Log de auditoría. Solo INSERT. Retención recomendada: 1 año.';


-- ============================================================
--  18. EMPRESA_CONFIG
--      Configuración global de la empresa (singleton id=1).
--      ID: INT AUTO_INCREMENT (fijo en 1).
--
--      COLUMNAS DE ARCHIVO (AWS S3):
--        logo_url → logotipo de la empresa.
-- ============================================================
CREATE TABLE IF NOT EXISTS empresa_config (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(200)  NOT NULL   COMMENT 'Nombre comercial',
  razon_social VARCHAR(250)             COMMENT 'Razón social legal',
  rfc          VARCHAR(13)              COMMENT 'RFC de la empresa',
  domicilio    VARCHAR(400)             COMMENT 'Domicilio fiscal completo',
  telefono     VARCHAR(20)              COMMENT 'Teléfono de contacto',
  email        VARCHAR(180)             COMMENT 'Correo institucional',

  -- Logotipo en AWS S3 (aquí solo la URL pública)
  -- Formato: https://<bucket>.s3.<region>.amazonaws.com/empresa/logo.png
  logo_url     VARCHAR(2048)            COMMENT 'URL pública del logotipo en AWS S3. NULL = sin logo',

  updated_at   DATETIME      NOT NULL   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)

) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Configuración de la empresa. Singleton (solo id=1). Logo en AWS S3 (solo URL).';

INSERT IGNORE INTO empresa_config (id, nombre, razon_social, email) VALUES (1, 'Previta', 'Previta S.A. de C.V.', 'contacto@previta.com.mx');


-- ============================================================
--  CLAVES FORÁNEAS DIFERIDAS
--  Resuelve la dependencia circular: grupos ↔ usuarios
-- ============================================================
ALTER TABLE grupos
  ADD CONSTRAINT fk_grupo_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES usuarios(id) ON DELETE SET NULL;


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
--  RESUMEN DE ARCHIVOS EN AWS S3
--  (Solo se almacena la URL, nunca el archivo en la BD)
--  ──────────────────────────────────────────────────────────
--  Tabla          │ Columna      │ Contenido
--  ──────────────────────────────────────────────────────────
--  usuarios       │ foto_url     │ Avatar / foto de perfil
--  registros      │ foto_url     │ Foto del empleado al hacer checkin
--  incidencias    │ archivo_url  │ Documento de respaldo (constancia, acta)
--  empresa_config │ logo_url     │ Logotipo de la empresa
--  ──────────────────────────────────────────────────────────
--  URL esperada:
--  https://<bucket>.s3.<region>.amazonaws.com/<ruta/archivo.ext>
-- ============================================================
