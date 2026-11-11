const documentos = require('../services/documentoService');
const subidas = require('../services/subidaDirectaService');
const archivos = require('../services/documentoArchivoService');
const generacion = require('../services/documentoGeneracionService');
const { generarPdf } = require('../services/documentoPdfService');
const generados = require('../services/documentosGeneradosService');

function responderError(res, error) {
  if (res.headersSent) return;
  if (error.status) return res.status(error.status).json({ ok: false, mensaje: error.message });
  if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    return res.status(503).json({ ok: false, mensaje: 'Falta preparar la base de datos de Documentos. Ejecute npm run migrar:documentos desde la carpeta backend y compruebe la tabla plantillas_documentos del esquema base.' });
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
  try {
    const resultado = await documentos.subir(req.body || {});
    res.locals.auditoria = { tabla: 'documentos_empleado', registroId: resultado.documento_id };
    return res.status(201).json({ ok: true, ...resultado });
  }
  catch (error) { return responderError(res, error); }
};

exports.revisar = async (req, res) => {
  try { return res.json({ ok: true, ...await documentos.revisar(req.params.id, req.body || {}, req.usuario.id) }); }
  catch (error) { return responderError(res, error); }
};

function entregar(descargar, propia = false) {
  return async (req, res) => {
    try {
      if (propia && !Number.isInteger(req.usuario.empleado_id)) return res.status(403).json({ ok: false, mensaje: 'La cuenta no tiene un colaborador asociado.' });
      const documento = await documentos.obtenerPorId(req.params.id, propia ? req.usuario.empleado_id : null);
      const archivo = await archivos.obtenerArchivo(documento.ruta_archivo, {descargar,nombre:documento.nombre_archivo});
      res.set({
        'Content-Type': archivo.mime_type,
        'Content-Disposition': archivos.disposicionArchivo(documento.nombre_archivo, descargar),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "sandbox; default-src 'none'"
      });
      if (archivo.url) return res.redirect(302,archivo.url);
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
exports.archivoPropio = entregar(false, true);
exports.descargarPropio = entregar(true, true);

exports.catalogosGeneracion = async (req, res) => {
  try { return res.json({ ok: true, ...await generacion.catalogos() }); }
  catch (error) { return responderError(res, error); }
};
exports.guardarPlantilla = async (req, res) => {
  try {
    const plantilla = await generacion.guardarPlantilla(req.params.codigo, req.body || {});
    res.locals.auditoria = { tabla: 'plantillas_documentos', registroId: plantilla.id, nuevos: plantilla };
    return res.json({ ok: true, plantilla });
  }
  catch (error) { return responderError(res, error); }
};
exports.vistaGenerada = async (req, res) => {
  try { return res.json({ ok: true, documento: await generacion.preparar(req.body || {}) }); }
  catch (error) { return responderError(res, error); }
};
exports.pdfGenerado = async (req, res) => {
  try {
    const documento = await generacion.preparar(req.body || {});
    const pdf=await generarPdf(documento);
    // Se archiva al abrir la vista previa, aunque el usuario cierre el navegador
    // sin pulsar Descargar. Jamás depende de localStorage ni de /tmp de Vercel.
    const archivo=process.env.DATABASE_URL
      ? await generados.guardar(documento,pdf,req.body,req.usuario.id)
      : null;
    if(archivo) {
      res.locals.auditoria={tabla:'documentos_generados',registroId:archivo.id,
        nuevos:{empleado_id:Number(req.body.empleado_id),tipo_codigo:documento.codigo}};
      res.set('X-SBSS-Generated-Id',String(archivo.id));
    }
    return res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': archivos.disposicionArchivo(documento.nombre_archivo, true),
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store'
    }).send(pdf);
  } catch (error) { return responderError(res, error); }
};

exports.prepararSubida = async (req,res)=>{
  try{
    const subida=await subidas.preparar(req.body||{},req.usuario.id,'documento');
    return res.json({ok:true,...subida});
  }catch(error){return responderError(res,error);}
};
exports.confirmarSubida = async (req,res)=>{
  try{
    const item=await subidas.consumir(req.body?.ticket,req.usuario.id,'documento');
    const pool=require('../config/database');
    const [result]=await pool.query('INSERT INTO documentos_empleado '
      +'(empleado_id,tipo_documento_id,nombre_archivo,ruta_archivo,estado,fecha_subida,mime_type) '
      +"VALUES (?,?,?,?,'pendiente',CURRENT_TIMESTAMP,?)",
      [item.empleado_id,item.tipo_documento_id,item.nombre_archivo,item.ruta_archivo,item.mime_type]);
    res.locals.auditoria={tabla:'documentos_empleado',registroId:result.insertId};
    return res.status(201).json({ok:true,documento_id:result.insertId,
      mensaje:'Documento guardado y pendiente de revisión.'});
  }catch(error){return responderError(res,error);}
};

exports.listarGenerados = async (_req,res) => {
  try { return res.json({ok:true,documentos:await generados.recientes()}); }
  catch(error){return responderError(res,error);}
};
exports.enlaceGenerado = async (req,res) => {
  try {return res.json({ok:true,...await generados.obtenerEnlace(req.params.id)});}
  catch(error){return responderError(res,error);}
};
