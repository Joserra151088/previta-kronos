-- ============================================================
-- Migración 010: Desarrollo Organizacional
-- Tablas para evaluaciones, competencias, Nine-Box,
-- indicadores estratégicos y sesiones 1 a 1.
-- ============================================================

-- ── 1. Módulo en catálogo ────────────────────────────────────
INSERT IGNORE INTO modulos (clave, nombre, descripcion, orden_menu, activo, created_at, updated_at)
VALUES (
  'desarrollo_organizacional',
  'Desarrollo Organizacional',
  'Evaluaciones de competencias, 360°, Nine-Box e indicadores estratégicos',
  12,
  1,
  NOW(),
  NOW()
);

-- ── 2. Acceso al módulo por rol ──────────────────────────────
INSERT IGNORE INTO rol_modulo (rol_clave, modulo_clave, created_at)
VALUES
  ('super_admin',               'desarrollo_organizacional', NOW()),
  ('administrador_general',     'desarrollo_organizacional', NOW()),
  ('desarrollo_organizacional', 'desarrollo_organizacional', NOW());

-- ── 3. Competencias ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS do_competencias (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  tipo          ENUM('dura','blanda') NOT NULL DEFAULT 'blanda',
  descripcion   TEXT,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Evaluaciones por competencias ─────────────────────────
CREATE TABLE IF NOT EXISTS do_eval_competencias (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  evaluado_id   VARCHAR(36)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  evaluador_id  VARCHAR(36)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  periodo       VARCHAR(20)  NOT NULL COMMENT 'Ej: 2026-Q1',
  fecha         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comentarios   TEXT,
  estado        VARCHAR(30)  NOT NULL DEFAULT 'borrador' COMMENT 'borrador | publicado',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_eval_comp_evaluado  FOREIGN KEY (evaluado_id)  REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_comp_evaluador FOREIGN KEY (evaluador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Detalles de evaluación por competencia ─────────────────
CREATE TABLE IF NOT EXISTS do_eval_competencias_detalle (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  evaluacion_id   VARCHAR(36)  NOT NULL,
  competencia_id  VARCHAR(36)  NOT NULL,
  calificacion    TINYINT      NOT NULL COMMENT '1-5',
  comentario      TEXT,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_evaluacion  (evaluacion_id),
  INDEX idx_competencia (competencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. Evaluaciones 360° ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS do_eval_360 (
  id               VARCHAR(36)  NOT NULL PRIMARY KEY,
  evaluado_id      VARCHAR(36)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  evaluador_id     VARCHAR(36)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  tipo_evaluador   ENUM('jefe','par','personal','compañero') NOT NULL,
  periodo          VARCHAR(20)  NOT NULL,
  calificacion     DECIMAL(3,1) NOT NULL COMMENT '1.0-5.0',
  comentarios      TEXT,
  fecha            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_360_evaluado  FOREIGN KEY (evaluado_id)  REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_360_evaluador FOREIGN KEY (evaluador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 7. Sesiones 1 a 1 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS do_eval_1a1 (
  id               VARCHAR(36) NOT NULL PRIMARY KEY,
  participante1_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  participante2_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  plantilla_id     VARCHAR(36),
  periodo          VARCHAR(20) NOT NULL,
  fecha            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notas            TEXT,
  estado           VARCHAR(30) NOT NULL DEFAULT 'pendiente' COMMENT 'pendiente | completado',
  respuestas       JSON,
  created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_1a1_p1 FOREIGN KEY (participante1_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_1a1_p2 FOREIGN KEY (participante2_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 8. Plantillas para sesiones 1 a 1 ───────────────────────
CREATE TABLE IF NOT EXISTS do_plantillas_1a1 (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  descripcion   TEXT,
  preguntas     JSON COMMENT 'Array de strings con las preguntas',
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 9. Indicadores estratégicos (máx 3 por puesto) ──────────
CREATE TABLE IF NOT EXISTS do_indicadores (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  puesto_id     VARCHAR(36)   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  nombre        VARCHAR(120)  NOT NULL,
  descripcion   TEXT,
  unidad        VARCHAR(30)   COMMENT 'Ej: %, unidades, horas',
  meta          DECIMAL(10,2) COMMENT 'Valor objetivo',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_indicador_puesto FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 10. Valores de indicadores por periodo ───────────────────
CREATE TABLE IF NOT EXISTS do_indicadores_valores (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  indicador_id    VARCHAR(36)   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  usuario_id      VARCHAR(36)   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  periodo         VARCHAR(20)   NOT NULL,
  valor           DECIMAL(10,2) NOT NULL,
  meta            DECIMAL(10,2) COMMENT 'Override de meta para este periodo',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_valor_indicador FOREIGN KEY (indicador_id) REFERENCES do_indicadores(id) ON DELETE CASCADE,
  CONSTRAINT fk_valor_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)       ON DELETE CASCADE,
  UNIQUE KEY uq_valor_periodo (indicador_id, usuario_id, periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 11. Satisfacción de clientes ────────────────────────────
CREATE TABLE IF NOT EXISTS do_satisfaccion (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  usuario_id    VARCHAR(36)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  periodo       VARCHAR(20)  NOT NULL,
  calificacion  DECIMAL(3,1) NOT NULL COMMENT '1.0-5.0',
  comentarios   TEXT,
  fecha         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_satisfaccion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Confirmación ────────────────────────────────────────────
SELECT 'Migración 010_desarrollo_organizacional completada ✓' AS resultado;
