const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const express = require('express');
const reglas = require('../services/asistenciaReglas');
let queryImpl = async () => { throw new Error('Consulta inesperada'); };
const llamadas = [];
const pool = { query: (sql,params=[]) => { llamadas.push({sql,params}); return queryImpl(sql,params); }, async getConnection(){return {...pool,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}};} };
const databasePath=require.resolve('../config/database');
require.cache[databasePath]={id:databasePath,filename:databasePath,loaded:true,exports:pool};
const auditPath=require.resolve('../middlewares/auditoriaMiddleware');
require.cache[auditPath]={id:auditPath,filename:auditPath,loaded:true,exports:(req,res,next)=>next()};
const {ROLES}=require('../config/accessPolicy');
const userPath=require.resolve('../services/usuarioService');
const users={1:{usuario_id:1,empleado_id:10,rol_nombre:ROLES.ADMIN,activo:1},2:{usuario_id:2,empleado_id:10,rol_nombre:ROLES.RRHH,activo:1},3:{usuario_id:3,empleado_id:10,rol_nombre:ROLES.COLABORADOR,activo:1},4:{usuario_id:4,empleado_id:11,rol_nombre:ROLES.COLABORADOR,activo:1}};
require.cache[userPath]={id:userPath,filename:userPath,loaded:true,exports:{buscarPorId:async id=>users[id],usuarioPublico:u=>({id:u.usuario_id,empleado_id:u.empleado_id,rol:u.rol_nombre})}};
const originalArchivos=require('../services/documentoArchivoService');
const archivoPath=require.resolve('../services/documentoArchivoService');
let temp,storage=new Map(),serial=0;
require.cache[archivoPath].exports={...originalArchivos,
 async guardarArchivo(archivo){const key=`test-${++serial}${archivo.extension}`;const ruta=path.join(temp,key);await fs.writeFile(ruta,archivo.contenido);storage.set(key,{ruta,mime_type:archivo.mime_type});return key;},
 async eliminarArchivo(key){const a=storage.get(key);if(a){await fs.unlink(a.ruta);storage.delete(key);}},
 async obtenerArchivo(key){const a=storage.get(key);if(!a)throw Object.assign(new Error('No encontrado'),{status:404});return a;}
};
const asistencia=require('../controllers/asistenciaController');
const horario=require('../controllers/horarioController');
const reporte=require('../controllers/reporteController');
function response(){return{statusCode:200,locals:{},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
const req=body=>({body,query:{},params:{},usuario:{id:1,empleado_id:10,rol:ROLES.ADMIN}});
let server,base;
test.before(async()=>{
 process.env.JWT_SECRET='solo-pruebas-core-no-produccion';temp=await fs.mkdtemp(path.join(os.tmpdir(),'sbss-core-'));
 const app=express();app.use('/api/asistencias',require('../routes/asistenciaRoutes'));
 app.use((err,req,res,next)=>res.status(err.type==='entity.too.large'?413:500).json({ok:false,mensaje:'Solicitud inválida'}));
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}`;
});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));if(temp)await fs.rm(temp,{recursive:true,force:true});});
test.beforeEach(()=>{llamadas.length=0;});
async function http(route,{id=1,method='GET',body}={}){
 const headers={};if(id)headers.Authorization='Bearer '+jwt.sign({usuario_id:id},process.env.JWT_SECRET,{expiresIn:'5m'});
 if(body)headers['Content-Type']='application/json';
 const res=await fetch(base+route,{method,headers,body:body?JSON.stringify(body):undefined});
 return{status:res.status,type:res.headers.get('content-type'),disposition:res.headers.get('content-disposition'),text:await res.text()};
}
test('fechas y horas rechazan valores imposibles, segundos y rangos invertidos',()=>{
 assert.throws(()=>reglas.fecha('2026-02-30'),/no válida/);assert.equal(reglas.fecha('2024-02-29'),'2024-02-29');
 for(const h of ['24:00','8:00','12:61','12:30:59'])assert.throws(()=>reglas.hora(h),/no válida/);
 assert.throws(()=>reglas.rango('2026-09-20','2026-09-01'),/posterior/);
 assert.throws(()=>reglas.filtrosPersonal({empresa_id:'1 OR 1=1'}),/no válido/);
});
test('cálculo de tardanza exacta, tolerancia configurada y horas trabajadas',()=>{
 const b={estado:'presente',hora_ingreso:'08:17',hora_salida:'17:00'};
 const result=reglas.calcularMarcacion(b,{hora_entrada:'08:00:00',hora_salida:'17:00:00',tolerancia_minutos:0});
 assert.deepEqual(result,{estado:'tardanza',hora_ingreso:'08:17:00',hora_salida:'17:00:00',minutos_tardanza:17,horas_trabajadas:8.72});
 const tolerada=reglas.calcularMarcacion({...b,hora_ingreso:'08:05'},{hora_entrada:'08:00',hora_salida:'17:00',tolerancia_minutos:10});assert.equal(tolerada.minutos_tardanza,0);assert.equal(tolerada.estado,'presente');
});
test('horas invertidas requieren horario nocturno; estados administrativos no suman horas',()=>{
 const b={estado:'presente',hora_ingreso:'22:00',hora_salida:'06:00'};
 assert.throws(()=>reglas.calcularMarcacion(b,{hora_entrada:'08:00',hora_salida:'17:00'}),/posterior/);
 assert.equal(reglas.calcularMarcacion(b,{hora_entrada:'22:00',hora_salida:'06:00'}).horas_trabajadas,8);
 const nocturno=reglas.calcularMarcacion({...b,hora_ingreso:'00:17'},{hora_entrada:'22:00',hora_salida:'06:00'});assert.equal(nocturno.minutos_tardanza,137);
 for(const estado of ['falta','permiso','descanso','feriado','vacaciones']){const x=reglas.calcularMarcacion({...b,estado},null);assert.equal(x.horas_trabajadas,0);assert.equal(x.hora_ingreso,null);}
});
test('editar asistencia usa programación histórica y audita UPDATE con ID real',async()=>{
 const anterior={id:77,empleado_id:10,fecha:'2026-09-01',hora_programada_entrada:'08:00:00',hora_programada_salida:'17:00:00',tolerancia_minutos:0,hora_ingreso:'08:17:00',hora_salida:'17:00:00',estado:'tardanza',minutos_tardanza:17};
 queryImpl=async(sql)=>{if(sql.startsWith('SELECT id,estado FROM empleados'))return[[{id:10,estado:'activo'}]];if(sql.startsWith('SELECT * FROM asistencias'))return[[anterior]];if(sql.startsWith('SELECT hora_entrada'))return[[{hora_entrada:'09:00',hora_salida:'18:00',tolerancia_minutos:10}]];if(sql.startsWith('UPDATE asistencias'))return[{affectedRows:1}];throw new Error(sql);};
 const res=response();await asistencia.registrarMarcacion(req({empleado_id:10,fecha:'2026-09-01',hora_ingreso:'08:17',hora_salida:'17:00',estado:'presente',observacion:'Corregida'}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data.minutos_tardanza,17);assert.equal(res.body.data.hora_programada_entrada,'08:00:00');assert.equal(res.locals.auditoria.accion,'UPDATE');assert.equal(res.locals.auditoria.registroId,77);
 const update=llamadas.find(x=>x.sql.startsWith('UPDATE asistencias'));assert.ok(!update.sql.includes('hora_programada_entrada='));
});
test('nueva asistencia persiste instantánea, horas y auditoría INSERT',async()=>{
 queryImpl=async sql=>{if(sql.startsWith('SELECT id,estado FROM empleados'))return[[{id:10,estado:'activo'}]];if(sql.startsWith('SELECT * FROM asistencias'))return[[]];if(sql.startsWith('SELECT hora_entrada'))return[[{hora_entrada:'08:00',hora_salida:'17:00',tolerancia_minutos:5}]];if(sql.startsWith('INSERT INTO asistencias'))return[{insertId:88}];throw new Error(sql);};
 const res=response();await asistencia.registrarMarcacion(req({empleado_id:10,fecha:'2026-09-01',hora_ingreso:'08:17',hora_salida:'17:00',estado:'presente'}),res);
 assert.equal(res.statusCode,200);assert.equal(res.locals.auditoria.registroId,88);assert.equal(res.locals.auditoria.accion,'INSERT');assert.equal(res.body.data.tolerancia_minutos,5);assert.equal(llamadas.find(x=>x.sql.startsWith('INSERT')).params[4],5);
});
test('registro antiguo sin programación conserva tardanza y horas al editar observaciones',async()=>{
 const anterior={id:79,empleado_id:10,hora_programada_entrada:null,hora_programada_salida:null,tolerancia_minutos:null,hora_ingreso:'08:17:00',hora_salida:'17:00:00',estado:'tardanza',minutos_tardanza:7,horas_trabajadas:8.72};
 queryImpl=async sql=>{if(sql.startsWith('SELECT id,estado FROM empleados'))return[[{id:10,estado:'activo'}]];if(sql.startsWith('SELECT * FROM asistencias'))return[[anterior]];if(sql.startsWith('SELECT hora_entrada'))return[[{hora_entrada:'09:00',hora_salida:'18:00',tolerancia_minutos:0}]];if(sql.startsWith('UPDATE asistencias'))return[{affectedRows:1}];throw new Error(sql);};
 const res=response();await asistencia.registrarMarcacion(req({empleado_id:10,fecha:'2026-09-01',hora_ingreso:'08:17',hora_salida:'17:00',estado:'tardanza',observacion:'Nota corregida'}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data.minutos_tardanza,7);assert.equal(res.body.data.horas_trabajadas,8.72);assert.equal(res.body.data.hora_programada_entrada,null);
 assert.throws(()=>reglas.calcularMarcacion({hora_ingreso:'08:30',hora_salida:'17:00',estado:'presente'},null,anterior),/programación histórica/);
 const nocturno={...anterior,hora_ingreso:'22:00:00',hora_salida:'06:00:00',horas_trabajadas:8};
 assert.equal(reglas.calcularMarcacion({hora_ingreso:'22:00',hora_salida:'06:00',estado:'tardanza'},null,nocturno).horas_trabajadas,8);
});
test('horario guarda descanso y tolerancia sin eliminar registros',async()=>{
 queryImpl=async sql=>{if(sql.startsWith('SELECT id FROM empleados'))return[[{id:10}]];if(sql.startsWith('SELECT * FROM horarios'))return[[{id:20,empleado_id:10,dia_semana:1}]];if(sql.startsWith('UPDATE horarios'))return[{affectedRows:1}];throw new Error(sql);};
 const res=response();await horario.guardarHorarioSemanal(req({empleado_id:10,dias:[1],hora_entrada:'08:00',hora_salida:'17:00',tolerancia_minutos:12,estado:'descanso'}),res);
 assert.equal(res.statusCode,200);assert.deepEqual(llamadas.find(x=>x.sql.startsWith('UPDATE horarios')).params,['08:00:00','17:00:00',12,false,20]);assert.ok(!llamadas.some(x=>x.sql.startsWith('DELETE')));
 const bad=response();await horario.guardarHorarioSemanal(req({empleado_id:10,dias:[8],hora_entrada:'08:00',hora_salida:'17:00'}),bad);assert.equal(bad.statusCode,400);
});
test('reportes: horas pendientes usan acumulado completo, faltas/permisos no duplican y % documentado',()=>{
 const datos=reporte.construirReporte([{empleado_id:10,colaborador:'Persona',horas_meta:320}],
 [{empleado_id:10,estado:'presente',hora_ingreso:'08:00',horas_trabajadas:8,minutos_tardanza:0},{empleado_id:10,estado:'falta',horas_trabajadas:0},{empleado_id:10,estado:'permiso',horas_trabajadas:0}],
 [{empleado_id:10,horas_acumuladas:245}],[{empleado_id:10,estado:'Aprobado',cantidad:2}]);
 const e=datos.detalles[0];assert.equal(e.total_horas_laboradas,8);assert.equal(e.horas_pendientes,75);assert.equal(e.porcentaje_avance,76.6);assert.equal(e.porcentaje_asistencia,50);assert.equal(e.total_permisos,2);assert.equal(datos.kpis.total_faltas,1);
 const filtro=reglas.filtrosPersonal({empresa_id:'2',area_id:'4',cargo_id:'6',empleado_id:'10',tipo_vinculo:'practicante'});assert.deepEqual(filtro.params,[2,4,6,10]);assert.match(filtro.where,/LIKE 'practicante%'/);
});
test('reporte consulta filtros en WHERE y respeta trabajador, cargo, estado y vínculo',async()=>{
 queryImpl=async sql=>sql.includes('SELECT e.id AS empleado_id')?[[{empleado_id:10,horas_meta:320}]]:[[]];
 const res=response();await reporte.obtenerConsolidado({query:{fecha_inicio:'2026-09-01',fecha_fin:'2026-09-10',empresa_id:'2',cargo_id:'6',empleado_id:'10',tipo_vinculo:'practicante',estado:'tardanza'}},res);
 assert.equal(res.statusCode,200);const e=llamadas[0];assert.match(e.sql,/WHERE e\.empresa_id = \?/);assert.match(e.sql,/EXISTS/);assert.deepEqual(e.params,[2,6,10,'2026-09-01','2026-09-10','tardanza']);assert.equal(res.body.data.fecha_fin,'2026-09-10');
});
let permiso;
function permisoQueries(sql,params){
 if(sql.startsWith('SELECT id FROM empleados'))return[[{id:10}]];
 if(sql.startsWith('INSERT INTO permisos')){permiso={id:91,empleado_id:params[0],archivo_sustento:params[8],archivo_sustento_nombre:params[9]};return[{insertId:91}];}
 if(sql.startsWith('SELECT empleado_id,archivo_sustento'))return[[...(permiso&&(!sql.includes('AND empleado_id=?')||Number(params[1])===permiso.empleado_id)?[permiso]:[])]];
 throw new Error(sql);
}
test('permiso carga archivo real; propietario/RRHH acceden y otro colaborador recibe 404',async()=>{
 queryImpl=async(sql,params)=>permisoQueries(sql,params);
 const payload={empleado_id:10,fecha_inicio:'2026-09-01',fecha_fin:'2026-09-01',hora_desde:'09:00',hora_hasta:'10:00',motivo:'Cita',sustento:{nombre:'cita.pdf',base64:Buffer.from('%PDF-1.4\nfixture').toString('base64')}};
 const created=await http('/api/asistencias/permisos',{method:'POST',body:payload});assert.equal(created.status,201);
 for(const id of [1,2,3]){const file=await http('/api/asistencias/permisos/91/sustento',{id});assert.equal(file.status,200);assert.match(file.type,/application\/pdf/);assert.match(file.text,/%PDF/);}
 assert.equal((await http('/api/asistencias/permisos/91/sustento',{id:4})).status,404);
 assert.equal((await http('/api/asistencias/permisos/91/sustento',{id:null})).status,401);
 assert.match((await http('/api/asistencias/permisos/91/sustento?descargar=1',{id:3})).disposition,/attachment/);
 assert.equal((await http('/api/asistencias/permisos',{id:3,method:'POST',body:payload})).status,403);
});
test('permiso rechaza sustento falso, exceso de tamaño y fechas/horas invertidas antes de persistir',async()=>{
 queryImpl=async(sql,params)=>permisoQueries(sql,params);
 const b={empleado_id:10,fecha_inicio:'2026-09-01',fecha_fin:'2026-09-01',motivo:'Cita'};
 for(const sustento of [{nombre:'falso.pdf',base64:Buffer.from('no es pdf').toString('base64')},{nombre:'peligro.exe',base64:Buffer.from('%PDF').toString('base64')}])assert.equal((await http('/api/asistencias/permisos',{method:'POST',body:{...b,sustento}})).status,400);
 const huge=Buffer.alloc(5*1024*1024+1,65);huge.write('%PDF-');assert.equal((await http('/api/asistencias/permisos',{method:'POST',body:{...b,sustento:{nombre:'grande.pdf',base64:huge.toString('base64')}}})).status,413);
 assert.equal((await http('/api/asistencias/permisos',{method:'POST',body:{...b,hora_desde:'11:00',hora_hasta:'10:00'}})).status,400);
 assert.ok(!llamadas.some(x=>x.sql.startsWith('INSERT')));
});
