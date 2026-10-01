-- Punto 6: ampliar permisos con observaciones sin eliminar historial existente.
ALTER TABLE permisos
  ADD COLUMN observaciones TEXT NULL AFTER motivo;
