const pool = require('../config/database');
const r = require('./asistenciaReglas');

const ESTADOS_LISTADO = [...r.ESTADOS, 'pendiente'];
const POSTGRES = Boolean(process.env.DATABASE_URL);
const AHORA_PERU_SQL = POSTGRES ? "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')" : "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')";
const INICIO_TURNO_SQL = POSTGRES ? '(d.fecha::timestamp + h.hora_entrada)' : 'TIMESTAMP(d.fecha,h.hora_entrada)';
const FIN_TURNO_SQL = POSTGRES ? "(d.fecha::timestamp + h.hora_salida + CASE WHEN h.hora_salida<h.hora_entrada THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END)" : 'DATE_ADD(TIMESTAMP(d.fecha,h.hora_salida), INTERVAL (h.hora_salida<h.hora_entrada) DAY)';
const PERMISO_TURNO_SQL = POSTGRES ? `EXISTS (
  SELECT 1 FROM permisos p WHERE p.empleado_id=e.id AND p.estado='Aprobado'
    AND (p.fecha_inicio::timestamp + COALESCE(p.hora_desde,TIME '00:00:00')) <= ${INICIO_TURNO_SQL}
    AND (CASE WHEN p.hora_hasta IS NULL THEN p.fecha_fin::timestamp + INTERVAL '1 day'
      ELSE p.fecha_fin::timestamp + p.hora_hasta END) >= ${FIN_TURNO_SQL}
)` : `EXISTS (
  SELECT 1 FROM permisos p WHERE p.empleado_id=e.id AND p.estado='Aprobado'
    AND TIMESTAMP(p.fecha_inicio,COALESCE(p.hora_desde,'00:00:00'))<=${INICIO_TURNO_SQL}
    AND (CASE WHEN p.hora_hasta IS NULL THEN TIMESTAMP(DATE_ADD(p.fecha_fin,INTERVAL 1 DAY),'00:00:00')
      ELSE TIMESTAMP(p.fecha_fin,p.hora_hasta) END)>=${FIN_TURNO_SQL}
)`;

// Las marcaciones guardadas prevalecen. Los turnos sin marcar se calculan al
// consultar, sin crear registros ficticios ni sobrescribir estados de RR. HH.
async function listar({ desde, hasta = desde, filtros = {}, soloAutomaticas = false }) {
  const [inicio, fin] = r.rango(desde, hasta, 'diario');
  const f = r.filtrosPersonal(filtros), estado = filtros.estado;
  if (estado && !ESTADOS_LISTADO.includes(estado)) throw r.error('Estado no válido.');
  const [rows] = await pool.query(`WITH RECURSIVE fechas AS (
    SELECT CAST(? AS DATE) AS fecha
    UNION ALL SELECT ${POSTGRES ? 'fecha + 1' : 'DATE_ADD(fecha,INTERVAL 1 DAY)'} FROM fechas WHERE fecha<CAST(? AS DATE)
  ), diaria AS (
    SELECT a.id AS asistencia_id,e.id AS empleado_id,d.fecha,
      a.hora_ingreso,a.hora_salida,
      CASE WHEN a.id IS NULL THEN h.tolerancia_minutos ELSE a.tolerancia_minutos END AS tolerancia_minutos,
      CASE WHEN a.id IS NULL THEN h.hora_entrada ELSE a.hora_programada_entrada END AS hora_programada,
      CASE WHEN a.id IS NULL THEN h.hora_entrada ELSE a.hora_programada_entrada END AS hora_programada_entrada,
      CASE WHEN a.id IS NULL THEN h.hora_salida ELSE a.hora_programada_salida END AS hora_programada_salida,
      COALESCE(a.minutos_tardanza,0) AS minutos_tardanza,COALESCE(a.horas_trabajadas,0) AS horas_trabajadas,
      CASE WHEN a.id IS NOT NULL THEN a.estado
        WHEN ${PERMISO_TURNO_SQL} THEN 'permiso'
        WHEN ${AHORA_PERU_SQL}>=${FIN_TURNO_SQL} THEN 'falta'
        ELSE 'pendiente' END AS estado,
      a.observacion,CONCAT(e.nombres,' ',e.apellidos) AS colaborador,e.numero_documento,
      e.empresa_id,e.area_id,e.cargo_id,emp.razon_social AS empresa,ar.nombre AS area,c.nombre AS cargo
    FROM fechas d CROSS JOIN empleados e
    JOIN empresas emp ON emp.id=e.empresa_id JOIN areas ar ON ar.id=e.area_id JOIN cargos c ON c.id=e.cargo_id
    LEFT JOIN horarios h ON h.empleado_id=e.id AND h.dia_semana=${POSTGRES ? 'EXTRACT(ISODOW FROM d.fecha)' : 'WEEKDAY(d.fecha)+1'} AND h.activo=TRUE
    LEFT JOIN asistencias a ON a.empleado_id=e.id AND a.fecha=d.fecha
    WHERE (a.id IS NOT NULL OR (e.estado='activo' AND h.id IS NOT NULL
      AND e.fecha_ingreso<=d.fecha AND (e.fecha_finalizacion IS NULL OR e.fecha_finalizacion>=d.fecha)))
      AND ${f.where}
  ) SELECT *,asistencia_id IS NULL AS automatico FROM diaria
    WHERE 1=1 ${soloAutomaticas ? "AND asistencia_id IS NULL AND estado IN ('falta','permiso')" : ''}
      ${estado ? 'AND estado=?' : ''}
    ORDER BY fecha,colaborador,empleado_id`, [inicio,fin,...f.params,...(estado ? [estado] : [])]);
  return rows;
}

module.exports = { listar, ESTADOS_LISTADO };
