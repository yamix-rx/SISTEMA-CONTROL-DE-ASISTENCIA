const capacitaciones = require('../services/capacitacionService');

function responderError(res, error) {
  if (res.headersSent) return;
  if (error.status) return res.status(error.status).json({ ok: false, mensaje: error.message });
  if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    return res.status(503).json({
      ok: false,
      mensaje: 'Falta preparar la base de datos de Capacitaciones. Ejecute npm run migrar:rrhh desde la carpeta backend.'
    });
  }
  console.error('Error en Capacitaciones:', error.code || error.name);
  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la operación de capacitaciones.' });
}

exports.catalogos = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.catalogos() }); }
  catch (error) { return responderError(res, error); }
};
exports.resumen = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.resumen() }); }
  catch (error) { return responderError(res, error); }
};
exports.listar = async (req, res) => {
  try { return res.json({ ok: true, ...(await capacitaciones.listar(req.query)) }); }
  catch (error) { return responderError(res, error); }
};
exports.detalle = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.detalle(req.params.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.crear = async (req, res) => {
  try { return res.status(201).json({ ok: true, data: await capacitaciones.crear(req.body || {}, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.actualizar = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.actualizar(req.params.id, req.body || {}, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.cambiarEstado = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.cambiarEstado(req.params.id, req.body?.estado, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.agregarParticipantes = async (req, res) => {
  try { return res.status(201).json({ ok: true, ...(await capacitaciones.agregarParticipantes(req.params.id, req.body || {})) }); }
  catch (error) { return responderError(res, error); }
};
exports.actualizarParticipante = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.actualizarParticipante(req.params.id, req.params.empleadoId, req.body || {}) }); }
  catch (error) { return responderError(res, error); }
};
exports.retirarParticipante = async (req, res) => {
  try { return res.json({ ok: true, ...(await capacitaciones.retirarParticipante(req.params.id, req.params.empleadoId)) }); }
  catch (error) { return responderError(res, error); }
};
exports.historialEmpleado = async (req, res) => {
  try { return res.json({ ok: true, data: await capacitaciones.historialEmpleado(req.params.empleadoId) }); }
  catch (error) { return responderError(res, error); }
};
exports.eliminar = async (req, res) => {
  try { return res.json({ ok: true, ...(await capacitaciones.eliminar(req.params.id)) }); }
  catch (error) { return responderError(res, error); }
};
