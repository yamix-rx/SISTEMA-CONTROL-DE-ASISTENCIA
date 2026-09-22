// Verificación real, exclusivamente en una base restaurada cuyo nombre empieza sbss_validacion_.
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {options}=require('./db-options');
if(!/^sbss_validacion_[a-zA-Z0-9_]+$/.test(process.env.DB_NAME||''))throw new Error('Esta prueba solo admite una base separada sbss_validacion_*.');
process.env.DOCUMENTOS_DIR=path.resolve(__dirname,'../backups/validacion-archivos');
const mysql=require('mysql2/promise');
const bcrypt=require('bcryptjs');
const app=require('../server');
const pool=require('../config/database');
let server;
const comprobaciones=[];
async function main(){
  const connection=await mysql.createConnection(options());
  let ids;
  const stamp=Date.now().toString();
  const password='Verificacion-'+randomBytes(12).toString('hex');
  const email=`admin-${stamp}@sbss.invalid`;
  try{
    await connection.beginTransaction();
    const [empresa]=await connection.query('INSERT INTO empresas (razon_social) VALUES (?)',[`Empresa de validación ${stamp}`]);
    const [area]=await connection.query('INSERT INTO areas (empresa_id,nombre) VALUES (?,?)',[empresa.insertId,'Área de validación']);
    const [cargo]=await connection.query('INSERT INTO cargos (area_id,nombre) VALUES (?,?)',[area.insertId,'Cargo de validación']);
    const [empleado]=await connection.query(`INSERT INTO empleados (numero_documento,nombres,apellidos,empresa_id,area_id,cargo_id,fecha_ingreso) VALUES (?,?,?,?,?,?,'2026-01-01')`,[stamp,'Cuenta','Validación',empresa.insertId,area.insertId,cargo.insertId]);
    const [roles]=await connection.query('SELECT id,nombre FROM roles');
    const role=nombre=>roles.find(r=>r.nombre===nombre).id;
    const [usuario]=await connection.query('INSERT INTO usuarios (empleado_id,rol_id,email,password) VALUES (?,?,?,?)',[empleado.insertId,role('Administrador General'),email,await bcrypt.hash(password,10)]);
    await connection.commit();ids={empresaId:empresa.insertId,areaId:area.insertId,cargoId:cargo.insertId,adminId:usuario.insertId,roles};
  }catch(e){await connection.rollback();throw e;}finally{await connection.end();}
  const servir=process.argv.includes('--servir');
  server=await new Promise(resolve=>{const s=app.listen(servir?3101:0,'127.0.0.1',()=>resolve(s));});
  const baseUrl=`http://127.0.0.1:${server.address().port}`;
  const tokens={};
  async function request(route,{body,method=body?'POST':'GET',rol='admin',status=200,binary=false}={}){
    const response=await fetch(baseUrl+'/api'+route,{method,headers:{...(tokens[rol]?{Authorization:`Bearer ${tokens[rol]}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(binary){assert.equal(response.status,status,route);return Buffer.from(await response.arrayBuffer());}
    const data=await response.json();assert.equal(response.status,status,`${route}: ${JSON.stringify(data)}`);return data;
  }
  tokens.admin=(await request('/auth/login',{body:{email,password},rol:'sinCuenta'})).token;
  const log=text=>{comprobaciones.push(text);console.log('OK '+text);};
  log('inicio de sesión con MySQL real');
  const payload={numero_documento:(BigInt(stamp)+1n).toString(),nombres:'Persona María',apellidos:'Prueba Álvarez',empresa_id:ids.empresaId,area_id:ids.areaId,cargo_id:ids.cargoId,fecha_ingreso:'2026-01-01',tipo_vinculo:'practicante preprofesional',estado:'activo',horas_totales_asignadas:16,observaciones_rrhh:'NOTA INTERNA: solo Recursos Humanos'};
  const empleadoId=(await request('/personal',{body:payload,status:201})).id;
  const rolColaborador=ids.roles.find(r=>r.nombre==='Trabajador/Practicante').id;
  const correoPersona=`persona-${stamp}@sbss.invalid`;
  const cuenta=(await request('/administracion/usuarios',{body:{empleado_id:empleadoId,rol_id:rolColaborador,email:correoPersona,password},status:201})).id;
  tokens.colaborador=(await request('/auth/login',{body:{email:correoPersona,password},rol:'sinCuenta'})).token;
  const rrhh=(await request('/personal',{body:{...payload,numero_documento:(BigInt(stamp)+2n).toString(),nombres:'Responsable',apellidos:'Pruebas RRHH',tipo_vinculo:'trabajador'},status:201})).id;
  const correoRRHH=`rrhh-${stamp}@sbss.invalid`;
  await request('/administracion/usuarios',{body:{empleado_id:rrhh,rol_id:ids.roles.find(r=>r.nombre==='Recursos Humanos').id,email:correoRRHH,password},status:201});
  tokens.rrhh=(await request('/auth/login',{body:{email:correoRRHH,password},rol:'sinCuenta'})).token;
  await request('/administracion/usuarios',{rol:'rrhh',status:403});
  await request('/asistencias/marcar',{rol:'colaborador',body:{empleado_id:empleadoId,fecha:'2026-09-14'},status:403});
  log('cuentas y aislamiento de los tres perfiles');
  await request('/horarios/asignar',{body:{empleado_id:empleadoId,dias:[1,2],hora_entrada:'08:00',hora_salida:'17:00',tolerancia_minutos:0,estado:'asignado'}});
  const asistencia={empleado_id:empleadoId,fecha:'2026-09-14',hora_ingreso:'08:17',hora_salida:'16:17',estado:'presente',observacion:'Primera marcación'};
  const marcada=await request('/asistencias/marcar',{body:asistencia,rol:'rrhh'});
  assert.equal(marcada.data.minutosTardanza,17);assert.equal(marcada.data.horasTrabajadas,8);
  await request('/horarios/asignar',{body:{empleado_id:empleadoId,dias:[1],hora_entrada:'10:00',hora_salida:'18:00',tolerancia_minutos:10,estado:'asignado'}});
  const editada=await request('/asistencias/marcar',{body:{...asistencia,observacion:'Observación corregida'}});
  assert.equal(editada.data.minutosTardanza,17);
  await request('/asistencias/marcar',{body:{...asistencia,fecha:'2026-09-15',hora_ingreso:'08:00',hora_salida:'16:00'}});
  const ficha=(await request(`/personal/${empleadoId}`)).data;
  assert.equal(ficha.progresoHoras.horasRealizadas,16);assert.equal(ficha.progresoHoras.horasCompletadas,true);
  log('horas, tardanzas, corrección sin duplicados e histórico del horario');
  const perfil=(await request('/mi-panel',{rol:'colaborador'})).data;
  assert.equal(perfil.empleado.observaciones_rrhh,undefined);
  assert.equal(JSON.stringify(perfil).includes('NOTA INTERNA'),false);
  assert.equal(perfil.progresoHoras.horasCompletadas,true);
  log('progreso completo y privacidad de notas internas');
  const datosDoc={empleado_id:empleadoId,empresa_id:ids.empresaId,area_id:ids.areaId,cargo_id:ids.cargoId,codigo:'aceptacion',fecha:'2026-09-19',horas:16};
  for(const codigo of ['aceptacion','constancia_practicas','culminacion']){
    const pdf=await request('/documentos/generar/pdf',{body:{...datosDoc,codigo},binary:true});assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);
  }
  const vista=await request('/documentos/generar/vista-previa',{body:datosDoc});assert.ok(JSON.stringify(vista).includes('Persona María'));
  const pdf=await request('/documentos/generar/pdf',{body:datosDoc,binary:true});
  const catalogs=await request('/documentos/catalogos');
  const tipo=catalogs.tipos[0].id;
  const doc=(await request('/documentos',{body:{empleado_id:empleadoId,tipo_documento_id:tipo,nombre_archivo:'validacion.pdf',contenido_base64:pdf.toString('base64')},status:201}));
  const documentoId=doc.documento_id||doc.id||doc.data?.id;
  const propio=await request(`/documentos/mios/${documentoId}/descargar`,{rol:'colaborador',binary:true});assert.ok(propio.equals(pdf));
  log('tres documentos PDF, carga y descarga privada');
  const permiso=(await request('/asistencias/permisos',{body:{empleado_id:empleadoId,fecha_inicio:'2026-09-16',fecha_fin:'2026-09-16',hora_desde:'09:00',hora_hasta:'10:00',motivo:'Prueba con sustento',tipo_permiso:'Personal',sustento:{nombre:'sustento.pdf',base64:pdf.toString('base64')}},status:201})).id;
  await request(`/asistencias/permisos/${permiso}/estado`,{method:'PATCH',body:{estado:'Aprobado'},rol:'rrhh'});
  const sustento=await request(`/asistencias/permisos/${permiso}/sustento`,{rol:'colaborador',binary:true});assert.ok(sustento.equals(pdf));
  log('permisos, aprobación y archivo sustentatorio');
  const reporte=(await request(`/reportes/consolidado?fecha_inicio=2026-09-01&fecha_fin=2026-09-30&empresa_id=${ids.empresaId}&empleado_id=${empleadoId}&tipo_vinculo=practicante`)).data;
  assert.equal(reporte.detalles.length,1);assert.equal(Number(reporte.detalles[0].total_horas_laboradas),16);assert.equal(Number(reporte.detalles[0].horas_pendientes),0);assert.equal(Number(reporte.detalles[0].total_permisos),1);
  const dashboard=await request('/dashboard',{rol:'rrhh'});assert.ok(dashboard.practicantesCompletados.some(e=>Number(e.empleado_id)===empleadoId));
  log('reportes filtrados y seguimiento de RRHH');
  const audit=await request('/auditoria?tabla=asistencias');
  const cambio=audit.registros.find(a=>Number(a.registro_id)===Number(marcada.id)&&a.accion==='UPDATE');
  assert.ok(cambio?.datos_anteriores);assert.equal(cambio.datos_nuevos.registro.observacion,'Observación corregida');
  log('auditoría identifica entidad, registro y antes/después');
  await request(`/personal/${empleadoId}`,{method:'PUT',body:{...payload,estado:'suspendido'}});
  assert.ok((await request('/personal?estado=suspendido')).data.some(e=>Number(e.id)===empleadoId));
  await request(`/personal/${empleadoId}`,{method:'PUT',body:payload});
  const nuevaClave='Nueva-'+randomBytes(12).toString('hex');
  await request(`/administracion/usuarios/${cuenta}/clave`,{body:{password:nuevaClave}});
  await request('/auth/perfil',{rol:'colaborador',status:401});
  tokens.colaborador=(await request('/auth/login',{body:{email:correoPersona,password:nuevaClave},rol:'sinCuenta'})).token;
  log('consulta de suspendidos y revocación por cambio de contraseña');
  await fs.mkdir(path.resolve(__dirname,'../backups'),{recursive:true});
  await fs.writeFile(path.resolve(__dirname,'../backups/validacion-sesion.json'),JSON.stringify({baseUrl,tokens,empleadoId,...ids,documentoId,permisoId:permiso},null,2),{mode:0o600});
  await fs.writeFile(path.resolve(__dirname,'../backups/validacion-integracion.json'),JSON.stringify({fecha:new Date().toISOString(),base:process.env.DB_NAME,comprobaciones},null,2));
  console.log(`${comprobaciones.length} recorridos de integración correctos.`);
  if(servir){console.log(`Servidor de validación disponible en ${baseUrl}`);return;}
  await new Promise(resolve=>server.close(resolve));await pool.end();
}
main().catch(async error=>{console.error('FALLO INTEGRACIÓN:',error.message);if(server)await new Promise(resolve=>server.close(resolve));await pool.end();process.exitCode=1;});
