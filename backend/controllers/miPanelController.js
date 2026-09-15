const pool = require('../config/database');
const { obtenerFicha } = require('../services/fichaService');

exports.obtenerMiPanel = async (req, res) => {
  // No se aceptan IDs por ruta, query o body: identidad vigente de la sesión.
  const empleadoId = req.usuario.empleado_id;
  if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
    return res.status(403).json({ ok: false, mensaje: 'La cuenta no tiene un colaborador asociado.' });
  }

  try {
    const ficha = await obtenerFicha(empleadoId);
    if (!ficha) {
      return res.status(404).json({ ok: false, mensaje: 'No se encontró su ficha de colaborador.' });
    }
    const [[asistencias], [permisos]] = await Promise.all([
      pool.query(`
        SELECT fecha, hora_ingreso, hora_salida, minutos_tardanza, horas_trabajadas, estado
        FROM asistencias WHERE empleado_id = ? ORDER BY fecha DESC, id DESC LIMIT 30
      `, [empleadoId]),
      pool.query(`
        SELECT p.fecha, tp.nombre AS tipo_permiso, p.motivo, p.estado
        FROM permisos p INNER JOIN tipo_permisos tp ON p.tipo_permiso_id = tp.id
        WHERE p.empleado_id = ? ORDER BY p.fecha DESC, p.id DESC LIMIT 20
      `, [empleadoId])
    ]);
    return res.json({ ok: true, data: { ...ficha, asistencias, permisos } });
  } catch (error) {
    console.error('Error al consultar panel personal:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar su panel personal.' });
  }
};
