-- Eliminar una cuenta de acceso no debe borrar documentos ni registros operativos.
-- Las referencias históricas al usuario se conservan como NULL al eliminar su cuenta.
ALTER TABLE public.asistencias
  DROP CONSTRAINT IF EXISTS asistencias_registrado_por_usuario_id_fkey;
ALTER TABLE public.asistencias
  ADD CONSTRAINT asistencias_registrado_por_usuario_id_fkey
  FOREIGN KEY (registrado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_creado_por_usuario_id_fkey;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_creado_por_usuario_id_fkey
  FOREIGN KEY (creado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_actualizado_por_usuario_id_fkey;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_actualizado_por_usuario_id_fkey
  FOREIGN KEY (actualizado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.capacitaciones
  DROP CONSTRAINT IF EXISTS capacitaciones_creado_por_usuario_id_fkey;
ALTER TABLE public.capacitaciones
  ADD CONSTRAINT capacitaciones_creado_por_usuario_id_fkey
  FOREIGN KEY (creado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.capacitaciones
  DROP CONSTRAINT IF EXISTS capacitaciones_actualizado_por_usuario_id_fkey;
ALTER TABLE public.capacitaciones
  ADD CONSTRAINT capacitaciones_actualizado_por_usuario_id_fkey
  FOREIGN KEY (actualizado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.historial_cambios
  DROP CONSTRAINT IF EXISTS historial_cambios_usuario_id_fkey;
ALTER TABLE public.historial_cambios
  ADD CONSTRAINT historial_cambios_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.documentos_generados
  ALTER COLUMN creado_por_usuario_id DROP NOT NULL;
ALTER TABLE public.documentos_generados
  DROP CONSTRAINT IF EXISTS documentos_generados_creado_por_usuario_id_fkey;
ALTER TABLE public.documentos_generados
  ADD CONSTRAINT documentos_generados_creado_por_usuario_id_fkey
  FOREIGN KEY (creado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
