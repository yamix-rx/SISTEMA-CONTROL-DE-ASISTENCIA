-- Ejecutar desde Supabase SQL Editor después del instalador inicial.
-- No contiene secretos ni modifica datos.
SELECT 'tablas_sbss' AS comprobacion, COUNT(*)::bigint AS cantidad
FROM information_schema.tables WHERE table_schema='public' AND table_name IN
('roles','empresas','areas','cargos','empleados','usuarios','practicante_detalles',
 'horarios','asistencias','tipo_permisos','permisos','tipo_documentos','documentos_empleado',
 'plantillas_documentos','contratos','capacitaciones','capacitacion_participantes','historial_cambios')
UNION ALL SELECT 'administradores', COUNT(*) FROM public.usuarios
UNION ALL SELECT 'fichas_personal', COUNT(*) FROM public.empleados
UNION ALL SELECT 'empresas', COUNT(*) FROM public.empresas
UNION ALL SELECT 'asistencias', COUNT(*) FROM public.asistencias
UNION ALL SELECT 'horarios', COUNT(*) FROM public.horarios
UNION ALL SELECT 'contratos', COUNT(*) FROM public.contratos
UNION ALL SELECT 'documentos', COUNT(*) FROM public.documentos_empleado;
