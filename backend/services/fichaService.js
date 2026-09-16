const pool = require('../config/database');

// Toda consulta se acota al empleado recibido por el controlador autorizado.
async function obtenerFicha(id) {
  const [empleadoRows] = await pool.query(`
    SELECT e.id, e.tipo_documento, e.numero_documento, e.nombres, e.apellidos,
           CONCAT(e.nombres, ' ', e.apellidos) AS colaborador_completo,
           e.tipo_vinculo, COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0) AS horas_totales_asignadas,
           e.fecha_nacimiento, e.telefono, e.correo_personal, e.direccion, e.carrera, e.institucion_educativa,
           e.fecha_ingreso, e.fecha_finalizacion, e.estado, e.observaciones_rrhh,
           emp.id AS empresa_id, emp.razon_social AS empresa,
           ar.id AS area_id, ar.nombre AS area, c.id AS cargo_id, c.nombre AS cargo
    FROM empleados e
    INNER JOIN empresas emp ON e.empresa_id = emp.id
    INNER JOIN areas ar ON e.area_id = ar.id
    INNER JOIN cargos c ON e.cargo_id = c.id
    LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id
    WHERE e.id = ?
  `, [id]);
  if (!empleadoRows.length) return null;
  const empleado = empleadoRows[0];

  const [[horasRows], [horarios], [legajoDigital]] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(horas_trabajadas), 0) AS total_horas_reales
                FROM asistencias WHERE empleado_id = ?`, [id]),
    pool.query(`SELECT dia_semana, hora_entrada, hora_salida, 0 AS tolerancia_minutos
                FROM horarios WHERE empleado_id = ? AND activo = TRUE
                ORDER BY dia_semana ASC, hora_entrada ASC`, [id]),
    pool.query(`
      SELECT td.id AS tipo_documento_id, td.nombre AS tipo_documento, td.es_obligatorio,
             de.id AS documento_id, de.nombre_archivo,
             CASE WHEN de.id IS NULL THEN 'sin_entregar' ELSE de.estado END AS estado_documento,
             de.fecha_subida
      FROM tipo_documentos td
      LEFT JOIN documentos_empleado de ON de.id = (
        SELECT MAX(ultimo.id) FROM documentos_empleado ultimo
        WHERE ultimo.tipo_documento_id = td.id AND ultimo.empleado_id = ?
      )
      ORDER BY td.es_obligatorio DESC, td.id ASC
    `, [id])
  ]);

  const horasRealizadas = Number(horasRows[0].total_horas_reales || 0);
  const horasMeta = Number(empleado.horas_totales_asignadas || 0);
  const horasPendientes = horasMeta > 0 ? Math.max(0, horasMeta - horasRealizadas) : 0;
  const porcentajeAvance = horasMeta > 0 ? Math.min(100, Math.round(horasRealizadas / horasMeta * 100)) : 0;
  const esPracticante = String(empleado.tipo_vinculo || '').toLowerCase().startsWith('practicante');
  const horasCompletadas = esPracticante && horasMeta > 0 && horasRealizadas >= horasMeta;

  return {
    empleado,
    progresoHoras: {
      esPracticante,
      horasMeta,
      horasRealizadas: Number(horasRealizadas.toFixed(2)),
      horasPendientes: Number(horasPendientes.toFixed(2)),
      porcentajeAvance: `${porcentajeAvance}%`,
      horasCompletadas,
      estado: horasCompletadas ? 'HORAS DE PRÁCTICAS COMPLETADAS' : 'EN PROGRESO'
    },
    horarios,
    legajoDigital
  };
}

module.exports = { obtenerFicha };
