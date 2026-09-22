const { obtenerFicha, obtenerHistorial, fichaPublica } = require('../services/fichaService');

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
    const historial = await obtenerHistorial(empleadoId, req.query);
    return res.json({ ok: true, data: { ...fichaPublica(ficha), ...historial } });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ ok: false, mensaje: error.message });
    console.error('Error al consultar panel personal:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar su panel personal.' });
  }
};
