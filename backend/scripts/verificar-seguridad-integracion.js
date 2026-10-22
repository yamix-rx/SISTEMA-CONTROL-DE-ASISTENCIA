const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');
const { options } = require('./db-options');

async function main() {
  const info = JSON.parse(await fs.readFile(path.resolve(__dirname,'../backups/validacion-entrega.json'),'utf8'));
  const cfg = JSON.parse(await fs.readFile(path.resolve(__dirname,'../backups/validacion-sesion.json'),'utf8'));
  assert.match(info.baseValidacion,/^sbss_validacion_\d+$/);
  assert.equal(cfg.baseUrl,'http://127.0.0.1:3101');
  const connection = await mysql.createConnection(options(info.baseValidacion)), results = [];
  async function api(route, {method='GET',body,token=cfg.tokens.admin}={}) {
    const response = await fetch(cfg.baseUrl+'/api'+route,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return { status:response.status, body:await response.json() };
  }
  try {
    const [[before]] = await connection.query('SELECT observaciones_rrhh FROM empleados WHERE id=?',[cfg.empleadoId]);
    await connection.query(`CREATE TRIGGER sbss_prueba_auditoria BEFORE INSERT ON historial_cambios FOR EACH ROW
      BEGIN IF NEW.tabla_afectada='empleados' AND JSON_UNQUOTE(JSON_EXTRACT(NEW.datos_nuevos,'$.solicitud.observaciones_rrhh'))='PRUEBA_FALLO_AUDITORIA'
      THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fallo simulado exclusivamente para validacion'; END IF; END`);
    try {
      const response = await api('/personal/'+cfg.empleadoId+'/observaciones',{method:'PATCH',body:{observaciones_rrhh:'PRUEBA_FALLO_AUDITORIA'}});
      assert.equal(response.status,500);
      const [[after]] = await connection.query('SELECT observaciones_rrhh FROM empleados WHERE id=?',[cfg.empleadoId]);
      assert.equal(after.observaciones_rrhh,before.observaciones_rrhh);
      results.push('MySQL revierte la escritura cuando el INSERT real de auditoría falla');
    } finally { await connection.query('DROP TRIGGER sbss_prueba_auditoria'); }
    const stamp=Date.now(), email='seguridad-'+stamp+'@sbss.invalid', password=randomBytes(24).toString('hex');
    const person=await api('/personal',{method:'POST',body:{tipo_documento:'CE',numero_documento:String(stamp),nombres:'Sesion',apellidos:'Validacion',empresa_id:cfg.empresaId,area_id:cfg.areaId,cargo_id:cfg.cargoId,fecha_ingreso:'2026-01-01',tipo_vinculo:'trabajador'}});
    assert.equal(person.status,201);
    const catalogs=await api('/administracion/catalogos');
    const role=catalogs.body.data.roles.find(r=>r.nombre==='Trabajador/Practicante').id;
    assert.equal((await api('/administracion/usuarios',{method:'POST',body:{empleado_id:person.body.id,rol_id:role,email,password}})).status,201);
    const login=await api('/auth/login',{method:'POST',body:{email,password}});assert.equal(login.status,200);
    assert.equal((await api('/auth/logout',{method:'POST',token:login.body.token})).status,200);
    assert.equal((await api('/auth/perfil',{token:login.body.token})).status,401);
    results.push('El cierre de sesión revoca el token en la base real');
    const type=catalogs.body.data.tiposDocumento.find(t=>t.nombre.startsWith('Documento de prueba'))||catalogs.body.data.tiposDocumento[0];
    const [missing]=await connection.query("INSERT INTO documentos_empleado (empleado_id,tipo_documento_id,nombre_archivo,ruta_archivo,estado) VALUES (?,?,?,?,'validado')",[cfg.empleadoId,type.id,'archivo-de-validacion-ausente.pdf','referencia-antigua-de-validacion.pdf']);
    const documents=await api('/documentos?empleado_id='+cfg.empleadoId+'&limite=100');
    const row=documents.body.documentos.find(d=>Number(d.documento_id)===missing.insertId);
    assert.equal(row.archivo_disponible,false);assert.equal(Object.hasOwn(row,'ruta_archivo'),false);
    const dashboard=await api('/dashboard?empresa_id='+cfg.empresaId);
    assert.ok(dashboard.body.alertasDocumentos.some(d=>Number(d.empleado_id)===Number(cfg.empleadoId)&&d.documento_faltante.includes('archivo no disponible')));
    results.push('Los archivos ausentes se identifican en Documentos y alertas sin exponer rutas');
    await fs.writeFile(path.resolve(__dirname,'../backups/validacion-seguridad.json'),JSON.stringify({fecha:new Date().toISOString(),base:info.baseValidacion,results},null,2));
    console.log(`${results.length} comprobaciones de seguridad correctas con MySQL real.`);
  } finally { await connection.end(); }
}
if(require.main===module)main().catch(e=>{console.error('Verificación de seguridad fallida:',e.code||e.message);process.exitCode=1;});
module.exports={main};
