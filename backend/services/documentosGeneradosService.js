'use strict';
const {randomUUID}=require('node:crypto');
const pool=require('../config/database');
const storage=require('./storagePrivadoService');
const {MAX_BYTES}=require('./documentoArchivoService');

function exigirPostgres(){
  if(!process.env.DATABASE_URL)throw Object.assign(
    new Error('El historial de documentos generados requiere PostgreSQL y Storage privado.'),{status:503});
}
function idPositivo(valor) {
  const id=Number(valor);
  if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Identificador inválido.'),{status:400});
  return id;
}
function nombreSeguro(nombre) {
  const valido=String(nombre||'documento.pdf').replace(/[\/\\\r\n\u0000-\u001f\u007f]/g,'_').slice(0,200);
  return valido.toLowerCase().endsWith('.pdf')?valido:valido+'.pdf';
}
async function guardar(documento,contenido,body,usuarioId){
  exigirPostgres();
  if(!Buffer.isBuffer(contenido)||contenido.length<5||contenido.length>MAX_BYTES
      ||contenido.subarray(0,5).toString('ascii')!=='%PDF-')
    throw Object.assign(new Error('El PDF generado no es válido o supera 5 MB.'),{status:413});
  const empleado=idPositivo(body.empleado_id),empresa=idPositivo(body.empresa_id);
  const usuario=idPositivo(usuarioId),nombre=nombreSeguro(documento.nombre_archivo);
  const tipo=String(documento.tipo_documento_nombre||documento.titulo||'Documento').slice(0,150);
  const codigo=String(documento.codigo||'').slice(0,50);
  const ruta=randomUUID()+'.pdf';
  await storage.subirObjeto(ruta,contenido,'application/pdf');
  try {
    const [insertado]=await pool.query(
      'INSERT INTO documentos_generados '
      +'(empleado_id,empresa_id,creado_por_usuario_id,tipo_codigo,tipo_nombre,nombre_archivo,ruta_archivo,fecha_emision) '
      +'VALUES (?,?,?,?,?,?,?,?)',
      [empleado,empresa,usuario,codigo,tipo,nombre,ruta,documento.fecha]);
    return {id:Number(insertado.insertId),nombre_archivo:nombre};
  }catch(error){
    await storage.eliminarObjeto(ruta).catch(()=>{});
    throw error;
  }
}
async function recientes(limite=20){
  exigirPostgres();
  const total=Math.min(50,Math.max(1,Number(limite)||20));
  const [rows]=await pool.query(
    'SELECT dg.id,dg.empleado_id,dg.tipo_codigo,dg.tipo_nombre,dg.nombre_archivo,'
    +' dg.fecha_emision,dg.created_at,'
    +" CONCAT(e.nombres,' ',e.apellidos) AS colaborador,emp.razon_social AS empresa"
    +' FROM documentos_generados dg '
    +'INNER JOIN empleados e ON e.id=dg.empleado_id '
    +'INNER JOIN empresas emp ON emp.id=dg.empresa_id '
    +'ORDER BY dg.created_at DESC,dg.id DESC LIMIT ?',[total]);
  return rows;
}
async function obtenerEnlace(id){
  exigirPostgres();
  const [rows]=await pool.query(
    'SELECT id,nombre_archivo,ruta_archivo FROM documentos_generados WHERE id=? LIMIT 1',
    [idPositivo(id)]);
  if(!rows.length)throw Object.assign(new Error('El documento generado no existe.'),{status:404});
  return {nombre_archivo:rows[0].nombre_archivo,
    url:await storage.urlDescarga(rows[0].ruta_archivo,
      {download:true,filename:rows[0].nombre_archivo})};
}
module.exports={guardar,recientes,obtenerEnlace};
