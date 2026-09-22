const pool = require('../config/database');

exports.obtenerDatosDashboard = async (req, res) => {
  const { empresa_id } = req.query;

  try {
    // 1. Obtener empresas para el selector superior
    const [empresas] = await pool.query(`SELECT id, razon_social FROM empresas WHERE estado = 'activo'`);

    // Filtro dinámico opcional por empresa
    const filtroEmpresaHorario = empresa_id ? 'AND e.empresa_id = ?' : '';
    const filtroEmpresaAsistencia = empresa_id ? 'AND a.empleado_id IN (SELECT id FROM empleados WHERE empresa_id = ?)' : '';
    const paramsEmpresa = empresa_id ? [empresa_id] : [];

    // 2. KPI: Colaboradores en turno hoy (Lunes=1 ... Domingo=7)
    // En MySQL WEEKDAY() devuelve: 0 = Lunes, 1 = Martes ... 6 = Domingo
    const [filasEnTurno] = await pool.query(`
      SELECT 
        e.id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.tipo_vinculo,
        emp.razon_social AS empresa,
        h.hora_entrada,
        h.hora_salida
      FROM horarios h
      INNER JOIN empleados e ON h.empleado_id = e.id
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      WHERE h.dia_semana = (WEEKDAY(CURDATE()) + 1)
        AND h.activo = TRUE
        AND e.estado = 'activo'
        ${filtroEmpresaHorario}
      ORDER BY h.hora_entrada ASC
    `, paramsEmpresa);

    const totalEnTurno = new Set(filasEnTurno.map(item => item.id)).size;

    // 3. Asistencias registradas hoy
    const [asistenciasHoy] = await pool.query(`
      SELECT estado, COUNT(*) as total 
      FROM asistencias a
      WHERE a.fecha = CURDATE()
      ${filtroEmpresaAsistencia}
      GROUP BY estado
    `, paramsEmpresa);

    let totalPresentes = 0;
    let totalTardanzas = 0;

    asistenciasHoy.forEach(item => {
      if (item.estado === 'presente') totalPresentes += Number(item.total);
      if (item.estado === 'tardanza') totalTardanzas += Number(item.total);
    });

    const porcentajeAsistencia = totalEnTurno > 0 
      ? Math.min(100, Math.round(((totalPresentes + totalTardanzas) / totalEnTurno) * 100))
      : 0;

    // 4. Seguimiento de horas de practicantes próximos a completar.
    // El requerimiento no fija un umbral; para V1 se considera "próximo" desde 80%.
    const filtroEmpresaPracticas = empresa_id ? 'AND e.empresa_id = ?' : '';
    const [seguimientoPracticas] = await pool.query(`
      SELECT
        e.id AS empleado_id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0) AS horas_meta,
        ROUND(COALESCE(SUM(a.horas_trabajadas), 0), 2) AS horas_realizadas,
        ROUND(GREATEST(COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0) - COALESCE(SUM(a.horas_trabajadas), 0), 0), 2) AS horas_pendientes,
        LEAST(100, ROUND(
          CASE WHEN COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0) > 0
            THEN (COALESCE(SUM(a.horas_trabajadas), 0) / COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0)) * 100
            ELSE 0 END, 1
        )) AS porcentaje_avance
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      INNER JOIN areas ar ON e.area_id = ar.id
      INNER JOIN cargos c ON e.cargo_id = c.id
      LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id
      LEFT JOIN asistencias a ON a.empleado_id = e.id
      WHERE e.estado = 'activo'
        AND LOWER(e.tipo_vinculo) LIKE 'practicante%'
        ${filtroEmpresaPracticas}
      GROUP BY e.id, e.nombres, e.apellidos, emp.razon_social, ar.nombre, c.nombre, pd.horas_meta, e.horas_totales_asignadas
      HAVING horas_meta > 0
      ORDER BY porcentaje_avance DESC, horas_pendientes ASC, e.apellidos ASC
    `, paramsEmpresa);

    // 5. El contador incluye todos los faltantes; la lista de alertas muestra hasta 10.
    const faltantesBase = `
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      CROSS JOIN tipo_documentos td
      WHERE td.es_obligatorio = TRUE AND e.estado = 'activo'
        ${filtroEmpresaHorario}
        AND NOT EXISTS (
          SELECT 1 FROM documentos_empleado de
          WHERE de.empleado_id = e.id AND de.tipo_documento_id = td.id
        )`;
    const [[totalFaltantes], [documentosPendientes]] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${faltantesBase}`, paramsEmpresa),
      pool.query(`SELECT e.id AS empleado_id,
          CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
          emp.razon_social AS empresa, td.id AS tipo_documento_id,
          td.nombre AS documento_faltante
        ${faltantesBase} ORDER BY e.apellidos, e.id, td.id LIMIT 10`, paramsEmpresa)
    ]);

    const [[contratosPorVencer], [tardanzasAcumuladas], [personalActivo]] = await Promise.all([
      pool.query(`SELECT c.id, c.empleado_id, c.tipo_contrato, c.fecha_fin,
          CONCAT(e.nombres,' ',e.apellidos) AS colaborador, emp.razon_social AS empresa,
          DATEDIFF(c.fecha_fin,CURDATE()) AS dias_restantes
        FROM contratos c JOIN empleados e ON e.id=c.empleado_id JOIN empresas emp ON emp.id=e.empresa_id
        WHERE c.estado='vigente' AND e.estado='activo'
          AND c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          ${filtroEmpresaHorario}
        ORDER BY c.fecha_fin, c.id LIMIT 30`, paramsEmpresa),
      pool.query(`SELECT e.id AS empleado_id, CONCAT(e.nombres,' ',e.apellidos) AS colaborador,
          emp.razon_social AS empresa, COUNT(*) AS tardanzas, SUM(a.minutos_tardanza) AS minutos
        FROM asistencias a JOIN empleados e ON e.id=a.empleado_id JOIN empresas emp ON emp.id=e.empresa_id
        WHERE a.minutos_tardanza>0 AND a.fecha BETWEEN DATE_FORMAT(CURDATE(),'%Y-%m-01') AND CURDATE()
          ${filtroEmpresaHorario}
        GROUP BY e.id,e.nombres,e.apellidos,emp.razon_social HAVING COUNT(*)>=3
        ORDER BY tardanzas DESC, minutos DESC LIMIT 30`, paramsEmpresa),
      pool.query(`SELECT COALESCE(SUM(e.tipo_vinculo='trabajador'),0) AS trabajadores,
          COALESCE(SUM(LOWER(e.tipo_vinculo) LIKE 'practicante%'),0) AS practicantes
        FROM empleados e WHERE e.estado='activo' ${filtroEmpresaHorario}`, paramsEmpresa)
    ]);
    const practicantesProximos = seguimientoPracticas.filter(item => Number(item.horas_realizadas) < Number(item.horas_meta) && Number(item.porcentaje_avance) >= 80);
    const practicantesCompletados = seguimientoPracticas.filter(item => Number(item.horas_realizadas) >= Number(item.horas_meta));

    return res.status(200).json({
      ok: true,
      empresas,
      kpis: {
        enTurnoHoy: totalEnTurno,
        porcentajeAsistencia: `${porcentajeAsistencia}%`,
        tardanzasHoy: totalTardanzas,
        trabajadoresActivos: Number(personalActivo[0]?.trabajadores || 0),
        practicantesActivos: Number(personalActivo[0]?.practicantes || 0),
        faltasHoy: Number(asistenciasHoy.find(item => item.estado === 'falta')?.total || 0),
        permisosHoy: Number(asistenciasHoy.find(item => item.estado === 'permiso')?.total || 0),
        documentosPendientes: Number(totalFaltantes[0]?.total || 0)
      },
      personalEnTurno: filasEnTurno,
      alertasDocumentos: documentosPendientes,
      practicantesProximos,
      practicantesCompletados,
      seguimientoPracticas,
      contratosPorVencer,
      tardanzasAcumuladas
    });

  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar el dashboard.' });
  }
};
