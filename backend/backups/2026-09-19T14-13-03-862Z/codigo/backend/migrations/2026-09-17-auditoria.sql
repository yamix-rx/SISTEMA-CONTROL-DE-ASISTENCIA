-- ==========================================================
-- AUDITORÍA DE ACCESOS Y CAMBIOS
-- Migración segura para una base de datos existente.
-- No elimina ni recrea información existente.
-- ==========================================================

-- 1) Si la tabla no existe, se crea con la estructura requerida.
CREATE TABLE IF NOT EXISTS historial_cambios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    tabla_afectada VARCHAR(60) NOT NULL,
    registro_id INT NOT NULL DEFAULT 0,
    accion ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO') NOT NULL,
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    ip_origen VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 2) Actualizar la columna de acciones si la tabla ya existía con la versión anterior.
ALTER TABLE historial_cambios
  MODIFY COLUMN accion ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO') NOT NULL;

-- 3) Crear índices solo cuando todavía no existen.
SET @idx_created := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'historial_cambios'
    AND index_name = 'idx_historial_created_at'
);
SET @sql_created := IF(@idx_created = 0,
  'CREATE INDEX idx_historial_created_at ON historial_cambios (created_at)',
  'SELECT 1'
);
PREPARE stmt_created FROM @sql_created;
EXECUTE stmt_created;
DEALLOCATE PREPARE stmt_created;

SET @idx_usuario := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'historial_cambios'
    AND index_name = 'idx_historial_usuario'
);
SET @sql_usuario := IF(@idx_usuario = 0,
  'CREATE INDEX idx_historial_usuario ON historial_cambios (usuario_id)',
  'SELECT 1'
);
PREPARE stmt_usuario FROM @sql_usuario;
EXECUTE stmt_usuario;
DEALLOCATE PREPARE stmt_usuario;

SET @idx_tabla := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'historial_cambios'
    AND index_name = 'idx_historial_tabla_accion'
);
SET @sql_tabla := IF(@idx_tabla = 0,
  'CREATE INDEX idx_historial_tabla_accion ON historial_cambios (tabla_afectada, accion)',
  'SELECT 1'
);
PREPARE stmt_tabla FROM @sql_tabla;
EXECUTE stmt_tabla;
DEALLOCATE PREPARE stmt_tabla;
