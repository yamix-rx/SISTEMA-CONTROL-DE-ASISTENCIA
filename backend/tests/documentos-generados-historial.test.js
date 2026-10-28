'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const serviceCode=readFileSync(join(__dirname,'../services/documentosGeneradosService.js'),'utf8');
const frontend=readFileSync(join(__dirname,'../../frontend/js/documentos.js'),'utf8');
const html=readFileSync(join(__dirname,'../../frontend/Documentos.html'),'utf8');
const routes=readFileSync(join(__dirname,'../routes/documentoRoutes.js'),'utf8');

function setup({failInsert=false,failUpload=false}={}){
  const calls=[],stored=[];
  const pool={query:async (sql,values)=>{
    calls.push({sql,values});
    if(sql.startsWith('INSERT INTO documentos_generados')){
      if(failInsert)throw new Error('ERROR_TEST_INSERCION');
      return [{insertId:51}];
    }
    if(sql.includes('FROM documentos_generados dg'))
      return [[{id:51,nombre_archivo:'carta.pdf',tipo_nombre:'Carta de aceptación',
        colaborador:'Persona de prueba',empresa:'Empresa de prueba',created_at:'2026-10-28T13:00:00Z'}]];
    if(sql.includes('WHERE id=? LIMIT 1'))
      return [[{id:51,nombre_archivo:'carta.pdf',ruta_archivo:'9ba1cb72-c5fb-4eaf-ae65-40fa8509d2f3.pdf'}]];
    return [[]];
  }};
  const storage={
    subirObjeto:async(name,buffer,mime)=>{
      if(failUpload)throw new Error('ERROR_TEST_STORAGE');
      stored.push(['upload',name,buffer.length,mime]);
    },
    eliminarObjeto:async name=>stored.push(['delete',name]),
    urlDescarga:async()=> 'https://example.supabase.co/storage/v1/object/sign/sbss-documentos/test?token=short'
  };
  const mod={exports:{}};
  new Function('require','module','exports','process',serviceCode)(
    name=>{
      if(name==='node:crypto')return require('node:crypto');
      if(name==='../config/database')return pool;
      if(name==='./storagePrivadoService')return storage;
      if(name==='./documentoArchivoService')return {MAX_BYTES:5242880};
      throw new Error('Unexpected module: '+name);
    },mod,mod.exports,{env:{DATABASE_URL:'postgresql://test'}});
  return {service:mod.exports,calls,stored};
}
const doc={
  codigo:'aceptacion',tipo_documento_nombre:'Carta de aceptación',
  nombre_archivo:'carta-12345678-2026-10-28.pdf',fecha:'2026-10-28'
};
const body={empleado_id:3,empresa_id:1};
const pdf=Buffer.from('%PDF-1.4\n%%EOF','ascii');

test('Archiva un PDF como objeto privado y guarda referencia con empleado y autor',async()=>{
  const {service,calls,stored}=setup();
  const result=await service.guardar(doc,pdf,body,1);
  assert.equal(result.id,51);
  assert.equal(stored.length,1);
  assert.equal(stored[0][0],'upload');
  assert.match(stored[0][1],/^[0-9a-f-]+\.pdf$/i);
  assert.equal(stored[0][3],'application/pdf');
  const insert=calls.find(x=>x.sql.startsWith('INSERT INTO documentos_generados'));
  assert.ok(insert);
  assert.deepEqual(insert.values.slice(0,3),[3,1,1]);
  assert.equal(insert.values.at(-1),'2026-10-28');
});

test('Si falla la base, limpia el objeto recién subido para evitar huérfanos',async()=>{
  const {service,stored}=setup({failInsert:true});
  await assert.rejects(service.guardar(doc,pdf,body,1),/ERROR_TEST_INSERCION/);
  assert.equal(stored[0][0],'upload');
  assert.deepEqual(stored[1],['delete',stored[0][1]]);
});
test('Si falla Storage, no crea un registro de documento inexistente',async()=>{
  const {service,calls}=setup({failUpload:true});
  await assert.rejects(service.guardar(doc,pdf,body,1),/ERROR_TEST_STORAGE/);
  assert.ok(!calls.length);
});
test('Rechaza PDFs inválidos y limita el tamaño de archivos privados',async()=>{
  const {service,stored}=setup();
  await assert.rejects(service.guardar(doc,Buffer.from('notPDF'),body,1),{status:413});
  await assert.rejects(service.guardar(doc,Buffer.alloc(5242881),body,1),{status:413});
  assert.equal(stored.length,0);
});
test('Historial reciente solo devuelve metadatos y descarga con enlace firmado',async()=>{
  const {service,calls}=setup();
  const list=await service.recientes(20);
  assert.equal(list.length,1);
  assert.match(calls[0].sql,/ORDER BY dg\.created_at DESC,dg\.id DESC LIMIT \?/);
  assert.ok(!Object.hasOwn(list[0],'ruta_archivo'));
  const signed=await service.obtenerEnlace(51);
  assert.match(signed.url,/\/object\/sign\/sbss-documentos\//);
  assert.equal(signed.nombre_archivo,'carta.pdf');
  await assert.rejects(service.obtenerEnlace('../etc/passwd'),{status:400});
});
test('Las rutas de historial están detrás de token y roles de administración o RRHH',()=>{
  const access=routes.indexOf('router.use(autorizarRoles(ROLES.ADMIN, ROLES.RRHH))');
  const recent=routes.indexOf("router.get('/generados/recientes'");
  assert.ok(access>=0&&recent>access);
  assert.match(routes,/router\.get\('\/generados\/:id\/descarga',controller\.enlaceGenerado\)/);
});
test('La interfaz muestra historial y re-descarga sin usar localStorage',()=>{
  assert.match(html,/id="tituloGenerados">Documentos generados recientemente/);
  assert.match(html,/id="filasGenerados"/);
  assert.match(frontend,/loadRecentGenerated\(\)/);
  assert.match(frontend,/downloadRecentGenerated\(item,button\)/);
  assert.match(frontend,/loadRecentGenerated\(\);\s*\}\s*catch \(error\) \{ formError\('errorGenerar'/);
});
