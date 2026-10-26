'use strict';
const {randomUUID}=require('node:crypto');
const pool=require('../config/database');
const archivos=require('./documentoArchivoService');
const storage=require('./storagePrivadoService');

function fail(text,status=400){return Object.assign(new Error(text),{status});}
function uuid(value){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'')))
    throw fail('Identificador de subida inválido.');
  return value;
}
async function preparar(body,usuarioId,categoria='documento'){
  if(!process.env.DATABASE_URL)throw fail('La subida directa requiere PostgreSQL.',503);
  if(!['documento','permiso'].includes(categoria))throw fail('Categoría no permitida.');
  const empleadoId=Number(body?.empleado_id),tipoId=Number(body?.tipo_documento_id);
  if(!Number.isSafeInteger(empleadoId)||empleadoId<=0)throw fail('Colaborador no válido.');
  if(categoria==='documento'&&(!Number.isSafeInteger(tipoId)||tipoId<=0))throw fail('Tipo documental no válido.');
  const meta=archivos.validarMetadatos(body.nombre_archivo,body.mime_type,Number(body.tamano));
  const [[empleados],[tipos]]=await Promise.all([
    pool.query("SELECT id FROM empleados WHERE id=? AND estado='activo' LIMIT 1",[empleadoId]),
    categoria==='documento'
      ? pool.query('SELECT id FROM tipo_documentos WHERE id=? LIMIT 1',[tipoId])
      : Promise.resolve([[]])
  ]);
  if(!empleados.length)throw fail('Colaborador activo no encontrado.',404);
  if(categoria==='documento'&&!tipos.length)throw fail('Tipo documental no encontrado.',404);
  const ticket=randomUUID(),ruta=randomUUID()+meta.extension;
  await pool.query('INSERT INTO subidas_pendientes '
    +'(id,usuario_id,empleado_id,tipo_documento_id,categoria,nombre_archivo,ruta_archivo,mime_type,tamano) '
    +'VALUES (?,?,?,?,?,?,?,?,?)',
    [ticket,usuarioId,empleadoId,categoria==='documento'?tipoId:null,categoria,
      meta.nombre_archivo,ruta,meta.mime_type,meta.tamano]);
  try{
    const url=await storage.firmarSubida(ruta);
    return {ticket,url,mime_type:meta.mime_type,fecha_caducidad_minutos:20};
  }catch(e){
    await pool.query('DELETE FROM subidas_pendientes WHERE id=?',[ticket]).catch(()=>{});
    throw e;
  }
}
async function consumir(ticket,usuarioId,categoria){
  uuid(ticket);
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    const [rows]=await connection.query('SELECT * FROM subidas_pendientes '
      +'WHERE id=? AND usuario_id=? AND categoria=? AND consumido=FALSE '
      +'AND expires_at > now() FOR UPDATE',[ticket,usuarioId,categoria]);
    const item=rows[0];
    if(!item)throw fail('Subida expirada o utilizada. Carga el archivo nuevamente.',409);
    const content=await storage.verificarContenido(item.ruta_archivo);
    if(content.length!==Number(item.tamano))throw fail('El tamaño de la subida no coincide.',400);
    const verified=archivos.validarArchivo(item.nombre_archivo,content.toString('base64'));
    if(verified.mime_type!==item.mime_type)throw fail('El formato del archivo no coincide.');
    await connection.query('UPDATE subidas_pendientes SET consumido=TRUE WHERE id=?',[ticket]);
    await connection.commit();
    return item;
  }catch(e){await connection.rollback().catch(()=>{});throw e;}
  finally{connection.release();}
}
module.exports={preparar,consumir};
