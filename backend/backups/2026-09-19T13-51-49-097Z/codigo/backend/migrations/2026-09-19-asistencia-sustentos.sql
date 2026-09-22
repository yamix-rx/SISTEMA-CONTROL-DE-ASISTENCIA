-- No altera marcaciones ni rutas antiguas. Ejecutar una vez tras la base original.
-- El instalador debe comprobar INFORMATION_SCHEMA antes de agregar estas columnas.
ALTER TABLE asistencias ADD COLUMN tolerancia_minutos INT NULL AFTER hora_programada_salida;
ALTER TABLE permisos ADD COLUMN archivo_sustento_nombre VARCHAR(200) NULL AFTER archivo_sustento;
