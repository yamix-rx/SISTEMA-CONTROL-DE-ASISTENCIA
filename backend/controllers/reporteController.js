const pool = require('../config/database');

// 1. Resumen consolidado y KPIs del rango seleccionado
exports.obtenerConsolidado = async (req, res) => {
  const { fecha_inicio, fecha_fin, empresa_id, tipo_vinculo } = req.query;

  try {
    let whereConditions = ['1=1'];
    const params = [];

    if (fecha_inicio && fecha_fin) {
      whereConditions.push('a.fecha BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    } else {
      whereConditions.push('MONTH(a.fecha) = MONTH(CURRENT_DATE()) AND YEAR(a.fecha) = YEAR(CURRENT_DATE())');
    }

    if (empresa_id) {
      whereConditions.push('e.empresa_id = ?');
      params.push(empresa_id);
    }

    if (tipo_vinculo) {
      whereConditions.push('e.tipo_vinculo = ?');
      params.push(tipo_vinculo);
    }

    const whereClause = whereConditions.join(' AND ');

    // Métricas globales
    const [kpiRows] = await pool.query(`
      SELECT 
        COUNT(a.id) AS total_marcaciones,
        COALESCE(SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END), 0) AS total_presentes,
        COALESCE(SUM(CASE WHEN a.estado = 'tardanza' THEN 1 ELSE 0 END), 0) AS total_tardanzas,
        COALESCE(SUM(CASE WHEN a.estado = 'falta' THEN 1 ELSE 0 END), 0) AS total_faltas,
        COALESCE(SUM(a.minutos_tardanza), 0) AS minutos_tardanza_acumulados,
        COALESCE(SUM(a.horas_trabajadas), 0) AS horas_trabajadas_acumuladas
      FROM asistencias a
      INNER JOIN empleados e ON a.empleado_id = e.id
      WHERE ${whereClause}
    `, params);

    // Desglose detallado por colaborador
    const [detalleRows] = await pool.query(`
      SELECT 
        e.id AS empleado_id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.numero_documento,
        e.tipo_vinculo,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        COUNT(a.id) AS dias_registrados,
        COALESCE(SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END), 0) AS dias_puntual,
        COALESCE(SUM(CASE WHEN a.estado = 'tardanza' THEN 1 ELSE 0 END), 0) AS dias_tardanza,
        COALESCE(SUM(CASE WHEN a.estado = 'falta' THEN 1 ELSE 0 END), 0) AS dias_falta,
        COALESCE(SUM(a.minutos_tardanza), 0) AS total_minutos_tardanza,
        ROUND(COALESCE(SUM(a.horas_trabajadas), 0), 2) AS total_horas_laboradas,
        ROUND(COALESCE(pd.horas_meta, 0), 2) AS horas_meta
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      INNER JOIN areas ar ON e.area_id = ar.id
      INNER JOIN cargos c ON e.cargo_id = c.id
      LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id
      LEFT JOIN asistencias a ON a.empleado_id = e.id AND ${whereClause.replace(/e\./g, 'e.')}
      GROUP BY e.id, e.nombres, e.apellidos, e.numero_documento, e.tipo_vinculo, emp.razon_social, ar.nombre, c.nombre, pd.horas_meta
      ORDER BY total_minutos_tardanza DESC, e.apellidos ASC
    `, params);

    // Resumen por Empresa
    const [empresaStats] = await pool.query(`
      SELECT 
        emp.razon_social AS empresa,
        COUNT(DISTINCT e.id) AS total_personal,
        COALESCE(SUM(a.horas_trabajadas), 0) AS horas_empresa,
        COALESCE(SUM(a.minutos_tardanza), 0) AS tardanzas_empresa
      FROM empresas emp
      LEFT JOIN empleados e ON e.empresa_id = emp.id AND e.estado = 'activo'
      LEFT JOIN asistencias a ON a.empleado_id = e.id AND ${whereClause.replace(/e\./g, 'e.')}
      GROUP BY emp.id, emp.razon_social
    `, params);

    return res.status(200).json({
      ok: true,
      data: {
        kpis: kpiRows[0],
        detalles: detalleRows,
        empresas: empresaStats
      }
    });

  } catch (error) {
    console.error('Error al generar reporte:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al generar reporte consolidado.' });
  }
};
