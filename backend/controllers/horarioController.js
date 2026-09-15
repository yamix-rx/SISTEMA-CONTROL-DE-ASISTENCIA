const pool = require('../config/database');

// 1. Obtener plantilla de horarios agrupada por colaborador
exports.listarHorarios = async (req, res) => {
  const { empresa_id, area_id, buscar } = req.query;

  try {
    let whereConditions = ['e.estado = "activo"'];
    const params = [];

    if (empresa_id) {
      whereConditions.push('e.empresa_id = ?');
      params.push(empresa_id);
    }

    if (area_id) {
      whereConditions.push('e.area_id = ?');
      params.push(area_id);
    }

    if (buscar) {
      whereConditions.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.numero_documento LIKE ?)');
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    const query = `
      SELECT 
        e.id AS empleado_id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.numero_documento,
        e.tipo_vinculo,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        COALESCE(
          JSON_ARRAYAGG(
            IF(h.id IS NOT NULL,
              JSON_OBJECT(
                'id', h.id,
                'dia_semana', h.dia_semana,
                'hora_entrada', h.hora_entrada,
                'hora_salida', h.hora_salida,
                'tolerancia_minutos', 0,
                'activo', h.activo
              ),
              NULL
            )
          ),
          JSON_ARRAY()
        ) AS malla_horarios
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      INNER JOIN areas ar ON e.area_id = ar.id
      INNER JOIN cargos c ON e.cargo_id = c.id
      LEFT JOIN horarios h ON h.empleado_id = e.id AND h.activo = TRUE
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY e.id, e.nombres, e.apellidos, e.numero_documento, e.tipo_vinculo, emp.razon_social, ar.nombre, c.nombre
      ORDER BY e.apellidos ASC
    `;

    const [rows] = await pool.query(query, params);

    // Limpiar nulos dentro del array de horarios agregados
    const data = rows.map(r => ({
      ...r,
      malla_horarios: Array.isArray(r.malla_horarios) 
        ? r.malla_horarios.filter(item => item !== null)
        : JSON.parse(r.malla_horarios || '[]').filter(item => item !== null)
    }));

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error('Error al listar horarios:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar horarios.' });
  }
};

// 2. Asignar o actualizar horario semanal de un colaborador
exports.guardarHorarioSemanal = async (req, res) => {
  const { empleado_id, dias, hora_entrada, hora_salida } = req.body;

  if (!empleado_id || !Array.isArray(dias) || dias.length === 0 || !hora_entrada || !hora_salida) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan datos requeridos (colaborador, días y horas).' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Eliminar o desactivar horarios existentes de los días seleccionados
    await connection.query(`
      DELETE FROM horarios 
      WHERE empleado_id = ? AND dia_semana IN (?)
    `, [empleado_id, dias]);

    // Insertar los nuevos registros
    const values = dias.map(d => [
      empleado_id,
      d,
      hora_entrada,
      hora_salida,
      true
    ]);

    await connection.query(`
      INSERT INTO horarios (empleado_id, dia_semana, hora_entrada, hora_salida, activo)
      VALUES ?
    `, [values]);

    await connection.commit();
    return res.status(200).json({ ok: true, mensaje: 'Horario semanal actualizado correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al guardar horario:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al registrar horario.' });
  } finally {
    connection.release();
  }
};

// 3. Eliminar horario de un día específico
exports.eliminarHorarioDia = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM horarios WHERE id = ?', [id]);
    return res.status(200).json({ ok: true, mensaje: 'Turno eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar el turno.' });
  }
};
