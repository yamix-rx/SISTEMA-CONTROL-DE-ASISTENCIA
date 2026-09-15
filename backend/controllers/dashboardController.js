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

    const totalEnTurno = filasEnTurno.length;

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
      if (item.estado === 'presente') totalPresentes += item.total;
      if (item.estado === 'tardanza') totalTardanzas += item.total;
    });

    const porcentajeAsistencia = totalEnTurno > 0 
      ? Math.round(((totalPresentes + totalTardanzas) / totalEnTurno) * 100) 
      : 0;

    // 4. El contador incluye todos los faltantes; la lista de alertas muestra hasta 10.
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

    return res.status(200).json({
      ok: true,
      empresas,
      kpis: {
        enTurnoHoy: totalEnTurno,
        porcentajeAsistencia: `${porcentajeAsistencia}%`,
        tardanzasHoy: totalTardanzas,
        documentosPendientes: Number(totalFaltantes[0]?.total || 0)
      },
      personalEnTurno: filasEnTurno,
      alertasDocumentos: documentosPendientes
    });

  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar el dashboard.' });
  }
};