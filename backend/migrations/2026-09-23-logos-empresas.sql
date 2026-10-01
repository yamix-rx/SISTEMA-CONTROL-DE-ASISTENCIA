-- Logo cifrado opcional por empresa. Puede ejecutarse varias veces.
SET @db = DATABASE();

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db AND table_name = 'empresas' AND column_name = 'logo_url'),
  'SELECT 1',
  'ALTER TABLE empresas ADD COLUMN logo_url VARCHAR(255) NULL AFTER direccion'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db AND table_name = 'empresas' AND column_name = 'logo_data'),
  'SELECT 1',
  'ALTER TABLE empresas ADD COLUMN logo_data MEDIUMBLOB NULL AFTER logo_url'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db AND table_name = 'empresas' AND column_name = 'logo_iv'),
  'SELECT 1',
  'ALTER TABLE empresas ADD COLUMN logo_iv VARBINARY(12) NULL AFTER logo_data'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db AND table_name = 'empresas' AND column_name = 'logo_tag'),
  'SELECT 1',
  'ALTER TABLE empresas ADD COLUMN logo_tag VARBINARY(16) NULL AFTER logo_iv'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db AND table_name = 'empresas' AND column_name = 'logo_mime'),
  'SELECT 1',
  'ALTER TABLE empresas ADD COLUMN logo_mime VARCHAR(50) NULL AFTER logo_tag'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
