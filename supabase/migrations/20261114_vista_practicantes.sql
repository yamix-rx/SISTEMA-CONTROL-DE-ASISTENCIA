-- Vista de solo lectura con únicamente los practicantes.
-- No duplica datos: lee empleados + practicante_detalles y calcula las horas
-- realizadas desde asistencias, igual que el dashboard de Recursos Humanos.
-- security_invoker respeta RLS y se revoca el acceso a los roles públicos de la API;
-- solo el backend (conexión privada DATABASE_URL) la consulta.
CREATE OR REPLACE VIEW public.practicantes
WITH (security_invoker = true) AS
SELECT
  e.id                              AS empleado_id,
  pd.id                             AS detalle_id,
  e.tipo_documento,
  e.numero_documento,
  e.nombres,
  e.apellidos,
  e.carrera,
  e.institucion_educativa,
  e.telefono,
  e.correo_personal,
  e.empresa_id,
  emp.razon_social                  AS empresa,
  e.area_id,
  ar.nombre                         AS area,
  e.cargo_id,
  c.nombre                          AS cargo,
  e.puesto,
  e.tipo_vinculo,
  e.estado,
  e.fecha_ingreso,
  e.fecha_finalizacion,
  pd.horas_meta,
  COALESCE(h.horas_realizadas, 0)   AS horas_realizadas,
  GREATEST(pd.horas_meta - COALESCE(h.horas_realizadas, 0), 0) AS horas_pendientes,
  CASE WHEN pd.horas_meta > 0
       THEN ROUND(LEAST(COALESCE(h.horas_realizadas, 0) / pd.horas_meta * 100, 100), 1)
       ELSE 0 END                   AS porcentaje_avance,
  pd.fecha_vencimiento_convenio,
  pd.estado_completado,
  pd.fecha_completado
FROM public.empleados e
JOIN public.practicante_detalles pd ON pd.empleado_id = e.id
JOIN public.empresas emp ON emp.id = e.empresa_id
JOIN public.areas ar ON ar.id = e.area_id
JOIN public.cargos c ON c.id = e.cargo_id
LEFT JOIN LATERAL (
  SELECT ROUND(SUM(a.horas_trabajadas), 2) AS horas_realizadas
  FROM public.asistencias a
  WHERE a.empleado_id = e.id
) h ON TRUE
WHERE LOWER(COALESCE(e.tipo_vinculo, '')) LIKE 'practicante%';

REVOKE ALL ON public.practicantes FROM anon, authenticated;
COMMENT ON VIEW public.practicantes IS 'Solo practicantes (empleados + practicante_detalles) con horas e indicadores de avance.';
