const pool = require('../config/database');

function parseJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return value; }
}

exports.listar = async (req, res) => {
  try {
    const { usuario_id, accion, tabla, desde, hasta, limite = 100 } = req.query;
    const params = [];
    const where = [];

    if (usuario_id) {
      if (/^\d+$/.test(usuario_id)) {
        where.push('h.usuario_id = ?'); params.push(Number(usuario_id));
      } else {
        where.push(`(u.email LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ? OR CONCAT(e.nombres,' ',e.apellidos) LIKE ?)`);
        const q = `%${usuario_id}%`;
        params.push(q, q, q, q);
      }
    }
    if (accion) { where.push('h.accion = ?'); params.push(accion); }
    if (tabla) { where.push('h.tabla_afectada = ?'); params.push(tabla); }
    if (desde) { where.push('h.created_at >= ?'); params.push(`${desde} 00:00:00`); }
    if (hasta) { where.push('h.created_at <= ?'); params.push(`${hasta} 23:59:59`); }

    const max = Math.min(Math.max(Number(limite) || 100, 1), 500);
    const sql = `
      SELECT h.id, h.usuario_id, h.tabla_afectada, h.registro_id, h.accion,
             h.datos_anteriores, h.datos_nuevos, h.ip_origen, h.created_at,
             u.email,
             CONCAT(COALESCE(e.nombres,''), ' ', COALESCE(e.apellidos,'')) AS usuario_nombre,
             r.nombre AS rol
      FROM historial_cambios h
      LEFT JOIN usuarios u ON u.id = h.usuario_id
      LEFT JOIN empleados e ON e.id = u.empleado_id
      LEFT JOIN roles r ON r.id = u.rol_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT ${max}`;
    const [rows] = await pool.query(sql, params);
    res.json({
      ok: true,
      registros: rows.map(row => ({
        ...row,
        datos_anteriores: parseJson(row.datos_anteriores),
        datos_nuevos: parseJson(row.datos_nuevos)
      }))
    });
  } catch (error) {
    console.error('Error al listar auditoría:', error.code || error.message);
    res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el historial de auditoría.' });
  }
};

exports.resumen = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT accion, COUNT(*) AS cantidad
      FROM historial_cambios
      GROUP BY accion
      ORDER BY cantidad DESC
    `);
    res.json({ ok: true, resumen: rows });
  } catch (error) {
    console.error('Error al obtener resumen de auditoría:', error.code || error.message);
    res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el resumen.' });
  }
};
