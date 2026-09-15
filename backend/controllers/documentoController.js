const documentos = require('../services/documentoService');
const archivos = require('../services/documentoArchivoService');

function responderError(res, error) {
  if (res.headersSent) return;
  if (error.status) return res.status(error.status).json({ ok: false, mensaje: error.message });
  if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    return res.status(503).json({ ok: false, mensaje: 'Falta preparar la base de datos de Documentos. Ejecute npm run migrar:documentos desde la carpeta backend.' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(409).json({ ok: false, mensaje: 'El colaborador o el tipo de documento cambió. Actualice el panel e intente otra vez.' });
  }
  console.error('Error en Documentos:', error.code || error.name);
  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la operación de documentos. Intente nuevamente.' });
}

exports.catalogos = async (req, res) => {
  try { return res.json({ ok: true, ...await documentos.catalogos() }); }
  catch (error) { return responderError(res, error); }
};

exports.listar = async (req, res) => {
  try { return res.json({ ok: true, ...await documentos.listar(req.query) }); }
  catch (error) { return responderError(res, error); }
};

exports.subir = async (req, res) => {
  try { return res.status(201).json({ ok: true, ...await documentos.subir(req.body || {}) }); }
  catch (error) { return responderError(res, error); }
};

exports.revisar = async (req, res) => {
  try { return res.json({ ok: true, ...await documentos.revisar(req.params.id, req.body || {}, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};

function entregar(descargar) {
  return async (req, res) => {
    try {
      const documento = await documentos.obtenerPorId(req.params.id);
      const archivo = await archivos.obtenerArchivo(documento.ruta_archivo);
      res.set({
        'Content-Type': archivo.mime_type,
        'Content-Disposition': archivos.disposicionArchivo(documento.nombre_archivo, descargar),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "sandbox; default-src 'none'"
      });
      return res.sendFile(archivo.ruta, { dotfiles: 'deny' }, error => {
        if (!error) return;
        if (!res.headersSent) {
          res.removeHeader('Content-Disposition');
          res.removeHeader('Content-Type');
          responderError(res, error.code === 'ENOENT' ? Object.assign(error, { status: 404, message: 'El archivo no está disponible.' }) : error);
        }
      });
    } catch (error) { return responderError(res, error); }
  };
}

exports.archivo = entregar(false);
exports.descargar = entregar(true);
