const pool = require('../config/database');

// 1. Listar colaboradores para el buscador o selector
exports.listarColaboradores = async (req, res) => {
  const { empresa_id, buscar } = req.query;

  try {
    let query = `
      SELECT 
        e.id,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.numero_documento,
        e.tipo_vinculo,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        e.estado
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      INNER JOIN areas ar ON e.area_id = ar.id
      INNER JOIN cargos c ON e.cargo_id = c.id
      WHERE e.estado = 'activo'
    `;
    const params = [];

    if (empresa_id) {
      query += ` AND e.empresa_id = ?`;
      params.push(empresa_id);
    }
    if (buscar) {
      query += ` AND (e.nombres LIKE ? OR e.apellidos LIKE ? OR e.numero_documento LIKE ?)`;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    query += ` ORDER BY e.apellidos ASC`;

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar colaboradores:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar colaboradores.' });
  }
};

// 2. Obtener el expediente del colaborador desde el servicio compartido.
exports.obtenerFichaColaborador = async (req, res) => {
  try {
    const ficha = await require('../services/fichaService').obtenerFicha(req.params.id);
    if (!ficha) {
      return res.status(404).json({ ok: false, mensaje: 'Colaborador no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: ficha });
  } catch (error) {
    console.error('Error al obtener ficha de colaborador:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar ficha individual.' });
  }
};