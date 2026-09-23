-- Siembra tipo_permisos con los valores que hasta ahora estaban fijos en el
-- formulario (Registros.html). No modifica permisos.tipo_permiso, que sigue
-- siendo texto libre por compatibilidad con los registros existentes; desde
-- ahora el selector se alimenta de esta tabla y es administrable desde
-- Configuración > Usuarios y configuración.
INSERT IGNORE INTO tipo_permisos (nombre) VALUES ('Personal'),('Salud'),('Estudios'),('Familiar'),('Otro');
