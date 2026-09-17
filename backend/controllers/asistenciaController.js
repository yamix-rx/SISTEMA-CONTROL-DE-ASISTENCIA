const pool = require('../config/database');

// 1. Listar asistencias por fecha y filtros
exports.listarAsistencias = async (req, res) => {
  const { fecha, empresa_id, area_id, estado, buscar } = req.query;
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

  try {
    let query = `
      SELECT 
        a.id AS asistencia_id,
        e.id AS empleado_id,
        a.fecha,
        a.hora_ingreso,
        a.hora_salida,
        a.hora_programada_entrada,
        a.hora_programada_salida,
        a.minutos_tardanza,
        a.horas_trabajadas,
        a.estado,
        a.observacion,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.numero_documento,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        COALESCE(a.hora_programada_entrada, h.hora_entrada) AS hora_programada,
        COALESCE(a.hora_programada_salida, h.hora_salida) AS hora_programada_salida
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
  const {
    empleado_id,
    fecha,
    hora_ingreso,
    hora_salida,
    estado: estadoSolicitado,
    observacion
  } = req.body;

  const ESTADOS = ['presente', 'falta', 'tardanza', 'permiso', 'descanso', 'feriado', 'vacaciones', 'justificado'];
  if (!empleado_id || !fecha) {
    return res.status(400).json({ ok: false, mensaje: 'Empleado y fecha son obligatorios.' });
  }
  if (estadoSolicitado && !ESTADOS.includes(estadoSolicitado)) {
    return res.status(400).json({ ok: false, mensaje: 'Estado de asistencia no válido.' });
  }
  if (['presente', 'tardanza'].includes(estadoSolicitado || 'presente') && !hora_ingreso) {
    return res.status(400).json({ ok: false, mensaje: 'La hora de ingreso es obligatoria para una asistencia presente o tardanza.' });
  }

  try {
    const [empleadoRows] = await pool.query(
      `SELECT id FROM empleados WHERE id = ? AND estado = 'activo' LIMIT 1`,
      [empleado_id]
    );
    if (!empleadoRows.length) {
      return res.status(404).json({ ok: false, mensaje: 'El trabajador no existe o no está activo.' });
    }

    // El horario se obtiene del día registrado y queda también guardado en la asistencia
    // para conservar exactamente la programación usada al momento de registrar.
    const [horarioRows] = await pool.query(`
      SELECT hora_entrada, hora_salida, tolerancia_minutos
      FROM horarios
      WHERE empleado_id = ? AND dia_semana = (WEEKDAY(?) + 1) AND activo = TRUE
      LIMIT 1
    `, [empleado_id, fecha]);

    const horario = horarioRows[0] || null;
    const horaProgramadaEntrada = horario?.hora_entrada || null;
    const horaProgramadaSalida = horario?.hora_salida || null;
    let minutosTardanza = 0;
    let estado = estadoSolicitado || 'presente';

    // Para estados administrativos (falta, permiso, descanso, feriado, vacaciones, justificado),
    // no se fuerza una marcación de ingreso. Para presente/tardanza sí se calcula automáticamente.
    if (hora_ingreso && ['presente', 'tardanza'].includes(estado)) {
      if (horario) {
        const [hProg, mProg] = String(horario.hora_entrada).split(':').map(Number);
        const [hIng, mIng] = String(hora_ingreso).split(':').map(Number);
        const diferencia = ((hIng * 60) + mIng) - ((hProg * 60) + mProg);
        const tolerancia = Number(horario.tolerancia_minutos || 0);

        if (diferencia > tolerancia) {
          minutosTardanza = diferencia;
          estado = 'tardanza';
        } else if (estado === 'tardanza') {
          // Si RR. HH. selecciona tardanza pero el cálculo no la confirma, prevalece el cálculo automático.
          estado = 'presente';
        }
      }
    } else {
      minutosTardanza = 0;
    }

    // Las horas trabajadas se calculan automáticamente cuando existe ingreso y salida.
    let horasTrabajadas = 0;
    if (hora_ingreso && hora_salida && !['falta', 'permiso', 'descanso', 'feriado', 'vacaciones'].includes(estado)) {
      const [hIng, mIng] = String(hora_ingreso).split(':').map(Number);
      const [hSal, mSal] = String(hora_salida).split(':').map(Number);
      let minutosTotales = ((hSal * 60) + mSal) - ((hIng * 60) + mIng);
      if (minutosTotales < 0) minutosTotales += 24 * 60; // permite turnos que cruzan medianoche
      horasTrabajadas = Number((minutosTotales / 60).toFixed(2));
    }

    const query = `
      INSERT INTO asistencias (
        empleado_id, fecha, hora_programada_entrada, hora_programada_salida,
        hora_ingreso, hora_salida, minutos_tardanza, horas_trabajadas,
        estado, observacion, registrado_por_usuario_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hora_programada_entrada = VALUES(hora_programada_entrada),
        hora_programada_salida = VALUES(hora_programada_salida),
        hora_ingreso = VALUES(hora_ingreso),
        hora_salida = VALUES(hora_salida),
        minutos_tardanza = VALUES(minutos_tardanza),
        horas_trabajadas = VALUES(horas_trabajadas),
        estado = VALUES(estado),
        observacion = VALUES(observacion),
        registrado_por_usuario_id = VALUES(registrado_por_usuario_id)
    `;

    await pool.query(query, [
      empleado_id,
      fecha,
      horaProgramadaEntrada,
      horaProgramadaSalida,
      hora_ingreso || null,
      hora_salida || null,
      minutosTardanza,
      horasTrabajadas,
      estado,
      observacion || null,
      req.usuario?.id || req.usuario?.usuario_id || null
    ]);

    return res.status(200).json({
      ok: true,
      mensaje: 'Asistencia registrada exitosamente.',
      data: {
        horaProgramadaEntrada,
        horaProgramadaSalida,
        minutosTardanza,
        estado,
        horasTrabajadas
      }
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
        p.empleado_id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        p.fecha_inicio,
        p.fecha_fin,
        p.hora_desde,
        p.hora_hasta,
        p.tipo_permiso,
        p.motivo,
        p.observaciones,
        p.estado,
        p.archivo_sustento
      FROM permisos p
      INNER JOIN empleados e ON p.empleado_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_desde) {
      query += ` AND p.fecha_fin >= ?`;
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ` AND p.fecha_inicio <= ?`;
      params.push(fecha_hasta);
    }
    if (empresa_id) {
      query += ` AND e.empresa_id = ?`;
      params.push(empresa_id);
    }
    if (req.query.area_id) {
      query += ` AND e.area_id = ?`;
      params.push(req.query.area_id);
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

// 5. Registrar permiso
exports.crearPermiso = async (req, res) => {
  const {
    empleado_id, tipo_permiso, fecha_inicio, fecha_fin,
    hora_desde, hora_hasta, motivo, observaciones, archivo_sustento
  } = req.body;

  if (!empleado_id || !fecha_inicio || !fecha_fin || !motivo) {
    return res.status(400).json({ ok: false, mensaje: 'Empleado, fechas y motivo son obligatorios.' });
  }

  if (fecha_fin < fecha_inicio) {
    return res.status(400).json({ ok: false, mensaje: 'La fecha fin no puede ser anterior a la fecha inicio.' });
  }

  try {
    const [empleado] = await pool.query(
      `SELECT id FROM empleados WHERE id = ? AND estado = 'activo' LIMIT 1`,
      [empleado_id]
    );
    if (!empleado.length) {
      return res.status(404).json({ ok: false, mensaje: 'El trabajador no existe o no está activo.' });
    }

    const [result] = await pool.query(`
      INSERT INTO permisos
        (empleado_id, tipo_permiso, fecha_inicio, fecha_fin, hora_desde, hora_hasta, motivo, observaciones, estado, archivo_sustento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', ?)
    `, [
      empleado_id,
      tipo_permiso || 'Personal',
      fecha_inicio,
      fecha_fin,
      hora_desde || null,
      hora_hasta || null,
      motivo,
      observaciones || null,
      archivo_sustento || null
    ]);

    return res.status(201).json({ ok: true, mensaje: 'Permiso registrado correctamente.', id: result.insertId });
  } catch (error) {
    console.error('Error al crear permiso:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al registrar permiso.' });
  }
};

// 6. Actualizar estado de permiso
exports.actualizarEstadoPermiso = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const estadosPermitidos = ['Solicitado', 'Aprobado', 'Rechazado'];

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ ok: false, mensaje: 'Estado de permiso no válido.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE permisos SET estado = ? WHERE id = ?`,
      [estado, id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, mensaje: 'Permiso no encontrado.' });
    }
    return res.status(200).json({ ok: true, mensaje: `Permiso ${estado.toLowerCase()} correctamente.` });
  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar permiso.' });
  }
};
