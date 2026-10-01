const contratos = require('../services/contratoService');

function responderError(res, error) {
  if (res.headersSent) return;
  if (error.status) return res.status(error.status).json({ ok: false, mensaje: error.message });
  if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    return res.status(503).json({
      ok: false,
      mensaje: 'Falta preparar la base de datos de Contratos. Ejecute npm run migrar:rrhh desde la carpeta backend.'
    });
  }
  console.error('Error en Contratos:', error.code || error.name);
  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la operación de contratos.' });
}

exports.catalogos = async (req, res) => {
  try { return res.json({ ok: true, data: await contratos.catalogos() }); }
  catch (error) { return responderError(res, error); }
};
exports.resumen = async (req, res) => {
  try { return res.json({ ok: true, data: await contratos.resumen() }); }
  catch (error) { return responderError(res, error); }
};
exports.listar = async (req, res) => {
  try { return res.json({ ok: true, ...(await contratos.listar(req.query)) }); }
  catch (error) { return responderError(res, error); }
};
exports.detalle = async (req, res) => {
  try { return res.json({ ok: true, data: await contratos.obtenerPorId(req.params.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.crear = async (req, res) => {
  try { return res.status(201).json({ ok: true, data: await contratos.crear(req.body || {}, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.actualizar = async (req, res) => {
  try { return res.json({ ok: true, data: await contratos.actualizar(req.params.id, req.body || {}, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.cambiarEstado = async (req, res) => {
  try { return res.json({ ok: true, data: await contratos.cambiarEstado(req.params.id, req.body?.estado, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};
exports.eliminar = async (req, res) => {
  try { return res.json({ ok: true, ...(await contratos.eliminar(req.params.id)) }); }
  catch (error) { return responderError(res, error); }
};
