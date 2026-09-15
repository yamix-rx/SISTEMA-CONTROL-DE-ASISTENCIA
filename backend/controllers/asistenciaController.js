const pool = require('../config/database');

// 1. Listar asistencias por fecha y filtros
exports.listarAsistencias = async (req, res) => {
  const { fecha, empresa_id, area_id, estado, buscar } = req.query;
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

  try {
    let query = `
      SELECT 
        a.id,
        a.fecha,
        a.hora_ingreso,
        a.hora_salida,
        a.minutos_tardanza,
        a.horas_trabajadas,
        a.estado,
        a.observacion,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.numero_documento,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        h.hora_entrada AS hora_programada
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      INNER JOIN areas ar ON e.area_id = ar.id
      INNER JOIN cargos c ON e.cargo_id = c.id
      LEFT JOIN horarios h ON h.empleado_id = e.id 
        AND h.dia_semana = (WEEKDAY(?) + 1) AND h.activo = TRUE
      LEFT JOIN asistencias a ON a.empleado_id = e.id AND a.fecha = ?
      WHERE e.estado = 'activo'
    `;

    const params = [fechaConsulta, fechaConsulta];

    if (empresa_id) {
      query += ` AND e.empresa_id = ?`;
      params.push(empresa_id);
    }
    if (area_id) {
      query += ` AND e.area_id = ?`;
      params.push(area_id);
    }
    if (estado) {
      query += ` AND a.estado = ?`;
      params.push(estado);
    }
    if (buscar) {
      query += ` AND (e.nombres LIKE ? OR e.apellidos LIKE ? OR e.numero_documento LIKE ?)`;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    query += ` ORDER BY e.apellidos ASC`;

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ ok: true, fecha: fechaConsulta, data: rows });
  } catch (error) {
    console.error('Error al listar asistencias:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar asistencias.' });
  }
};

// 2. Registrar o Actualizar Marcación con Cálculo de Tardanza
exports.registrarMarcacion = async (req, res) => {
  const { empleado_id, fecha, hora_ingreso, hora_salida, observacion } = req.body;

  if (!empleado_id || !fecha || !hora_ingreso) {
    return res.status(400).json({ ok: false, mensaje: 'Empleado, fecha y hora de ingreso son obligatorios.' });
  }

  try {
    // Consultar horario programado para ese día de la semana
    const [horarioRows] = await pool.query(`
      SELECT hora_entrada, 0 AS tolerancia_minutos 
      FROM horarios 
      WHERE empleado_id = ? AND dia_semana = (WEEKDAY(?) + 1) AND activo = TRUE
      LIMIT 1
    `, [empleado_id, fecha]);

    let minutosTardanza = 0;
    let estado = 'presente';

    if (horarioRows.length > 0) {
      const { hora_entrada, tolerancia_minutos } = horarioRows[0];
      
      const [hProg, mProg] = hora_entrada.split(':').map(Number);
      const [hIng, mIng] = hora_ingreso.split(':').map(Number);

      const minProgramados = (hProg * 60) + mProg;
      const minIngreso = (hIng * 60) + mIng;
      const diferencia = minIngreso - minProgramados;

      if (diferencia > (tolerancia_minutos || 0)) {
        minutosTardanza = diferencia;
        estado = 'tardanza';
      }
    }

    // Cálculo de horas trabajadas si existe salida
    let horasTrabajadas = 0;
    if (hora_salida) {
      const [hIng, mIng] = hora_ingreso.split(':').map(Number);
      const [hSal, mSal] = hora_salida.split(':').map(Number);
      const minutosTotales = ((hSal * 60) + mSal) - ((hIng * 60) + mIng);
      horasTrabajadas = (minutosTotales > 0) ? (minutosTotales / 60).toFixed(2) : 0;
    }

    // Insertar o actualizar
    const query = `
      INSERT INTO asistencias (empleado_id, fecha, hora_ingreso, hora_salida, minutos_tardanza, horas_trabajadas, estado, observacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hora_ingreso = VALUES(hora_ingreso),
        hora_salida = VALUES(hora_salida),
        minutos_tardanza = VALUES(minutos_tardanza),
        horas_trabajadas = VALUES(horas_trabajadas),
        estado = VALUES(estado),
        observacion = VALUES(observacion)
    `;

    await pool.query(query, [
      empleado_id, fecha, hora_ingreso, hora_salida || null, 
      minutosTardanza, horasTrabajadas, estado, observacion || null
    ]);

    return res.status(200).json({ 
      ok: true, 
      mensaje: 'Asistencia registrada exitosamente.',
      data: { minutosTardanza, estado, horasTrabajadas }
    });
  } catch (error) {
    console.error('Error al registrar marcación:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al registrar marcación.' });
  }
};

// 3. Control de Tardanzas Acumuladas
exports.acumuladoTardanzas = async (req, res) => {
  const { periodo, area_id } = req.query;

  let condicionFecha = 'a.fecha = CURDATE()';
  if (periodo === 'semanal') {
    condicionFecha = 'YEARWEEK(a.fecha, 1) = YEARWEEK(CURDATE(), 1)';
  } else if (periodo === 'mensual') {
    condicionFecha = 'MONTH(a.fecha) = MONTH(CURDATE()) AND YEAR(a.fecha) = YEAR(CURDATE())';
  } else if (periodo === 'trimestral') {
    condicionFecha = 'QUARTER(a.fecha) = QUARTER(CURDATE()) AND YEAR(a.fecha) = YEAR(CURDATE())';
  }

  try {
    let query = `
      SELECT 
        e.id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        ar.nombre AS area,
        COUNT(CASE WHEN a.estado = 'tardanza' THEN 1 END) AS total_tardanzas,
        COALESCE(SUM(a.minutos_tardanza), 0) AS minutos_acumulados,
        MAX(CASE WHEN a.estado = 'tardanza' THEN a.fecha END) AS ultima_tardanza
      FROM empleados e
      INNER JOIN areas ar ON e.area_id = ar.id
      LEFT JOIN asistencias a ON a.empleado_id = e.id AND ${condicionFecha}
      WHERE e.estado = 'activo'
    `;

    const params = [];
    if (area_id) {
      query += ` AND e.area_id = ?`;
      params.push(area_id);
    }

    query += `
      GROUP BY e.id, e.nombres, e.apellidos, ar.nombre
      ORDER BY minutos_acumulados DESC
    `;

    const [rows] = await pool.query(query, params);

    // Calcular KPIs
    let totalTardanzas = 0;
    let totalMinutos = 0;
    let empleadosConTardanza = 0;

    rows.forEach(r => {
      totalTardanzas += Number(r.total_tardanzas);
      totalMinutos += Number(r.minutos_acumulados);
      if (Number(r.total_tardanzas) > 0) empleadosConTardanza++;
    });

    const porcentaje = rows.length > 0 ? ((empleadosConTardanza / rows.length) * 100).toFixed(1) : 0;

    return res.status(200).json({
      ok: true,
      data: rows,
      kpis: {
        totalTardanzas,
        minutosAcumulados: totalMinutos,
        porcentajeConTardanzas: `${porcentaje}%`
      }
    });
  } catch (error) {
    console.error('Error en acumulado de tardanzas:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar tardanzas.' });
  }
};

// 4. Listar Permisos
exports.listarPermisos = async (req, res) => {
  const { fecha_desde, fecha_hasta, empresa_id, estado } = req.query;

  try {
    let query = `
      SELECT 
        p.id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        p.fecha AS fecha_inicio,
        p.fecha AS fecha_fin,
        p.hora_desde,
        p.hora_hasta,
        tp.nombre AS tipo_permiso,
        p.motivo,
        p.estado,
        p.ruta_sustento AS archivo_sustento
      FROM permisos p
      INNER JOIN empleados e ON p.empleado_id = e.id
      INNER JOIN tipo_permisos tp ON p.tipo_permiso_id = tp.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_desde && fecha_hasta) {
      query += ` AND p.fecha BETWEEN ? AND ?`;
      params.push(fecha_desde, fecha_hasta);
    }
    if (empresa_id) {
      query += ` AND e.empresa_id = ?`;
      params.push(empresa_id);
    }
    if (estado) {
      query += ` AND p.estado = ?`;
      params.push(estado);
    }

    query += ` ORDER BY p.id DESC`;

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar permisos:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar permisos.' });
  }
};
