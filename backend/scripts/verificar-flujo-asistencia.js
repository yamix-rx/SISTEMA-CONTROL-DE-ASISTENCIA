'use strict';

// Prueba del flujo real con tablas temporales de una conexión MySQL aislada.
// No modifica registros del usuario. Requiere Chrome con CDP en el puerto 9224.
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { CDP } = require('./verificar-navegador');
const r = require('../services/asistenciaReglas');
const { ROLES } = require('../config/accessPolicy');

async function main() {
  const connection = await pool.getConnection();
  const day = r.hoy(), weekday = new Date(day + 'T12:00:00Z').getUTCDay() || 7;
  const dateOffset = offset => new Date(Date.parse(day + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0,10);
  const companyId = 2147483500, employeeId = index => 2147483600 + index;
  const employees = Array.from({ length: 10 }, (_,index) => ({
    id: employeeId(index+1), colaborador: `Persona Prueba ${index+1}`, numero_documento: String(index+1).padStart(8,'0'),
    empresa_id: companyId, empresa: 'Empresa de prueba', area_id: companyId, area: 'Área de prueba',
    cargo_id: companyId, cargo: 'Cargo de prueba', estado: index===8?'inactivo':'activo'
  }));
  const tables = ['empresas','areas','cargos','empleados','horarios','asistencias','permisos'];
  let now = day + ' 13:00:00', server, cdp, target;
  const errors = [];
  try {
    for (const table of tables) await connection.query(`CREATE TEMPORARY TABLE test_diaria_${table} LIKE ${table}`);
    await connection.query('INSERT INTO test_diaria_empresas (id,razon_social) VALUES (?,?)',[companyId,'Empresa de prueba']);
    await connection.query('INSERT INTO test_diaria_areas (id,nombre,empresa_id) VALUES (?,?,?)',[companyId,'Área de prueba',companyId]);
    await connection.query('INSERT INTO test_diaria_cargos (id,nombre,area_id) VALUES (?,?,?)',[companyId,'Cargo de prueba',companyId]);
    for (const [index,employee] of employees.entries()) {
      const number = index+1;
      await connection.query(`INSERT INTO test_diaria_empleados
        (id,numero_documento,nombres,apellidos,empresa_id,area_id,cargo_id,fecha_ingreso,estado)
        VALUES (?,?,?,?,?,?,?,?,?)`, [employee.id,employee.numero_documento,'Persona',`Prueba ${number}`,companyId,companyId,companyId,number===8?dateOffset(1):dateOffset(-3),employee.estado]);
      if (number!==2) await connection.query(`INSERT INTO test_diaria_horarios
        (empleado_id,dia_semana,hora_entrada,hora_salida,tolerancia_minutos,activo) VALUES (?,?,?,?,0,?)`,
      [employee.id,number===3?weekday%7+1:weekday,number===4?'22:00:00':'08:00:00',number===4?'06:00:00':'17:00:00',number!==10]);
    }
    for (const [number,from,to] of [[5,null,null],[6,'08:00:00','09:00:00']]) {
      await connection.query(`INSERT INTO test_diaria_permisos
        (empleado_id,fecha_inicio,fecha_fin,hora_desde,hora_hasta,motivo,estado) VALUES (?,?,?,?,?,'Prueba','Aprobado')`,
      [employeeId(number),day,day,from,to]);
    }
    for (const number of [7,10]) await connection.query(`INSERT INTO test_diaria_asistencias
      (empleado_id,fecha,estado,hora_programada_entrada,hora_programada_salida,tolerancia_minutos)
      VALUES (?,?,'vacaciones','08:00:00','17:00:00',0)`,[employeeId(number),day]);

    const query = (sql,params=[]) => {
      if (/FROM usuarios u/.test(sql)) return Promise.resolve([[{usuario_id:1,activo:1,rol_nombre:ROLES.RRHH}]]);
      if (/historial_cambios/.test(sql)) throw new Error('La prueba no debe escribir auditorías reales.');
      const isolated = tables.reduce((text,table)=>text.replace(new RegExp('\\b'+table+'\\b','g'),'test_diaria_'+table),sql);
      return connection.query(isolated.replaceAll('UTC_TIMESTAMP()',`TIMESTAMP('${now}')`),params);
    };
    const databasePath = require.resolve('../config/database');
    require.cache[databasePath].exports = { query, getConnection: async()=>({
      query, beginTransaction:()=>connection.beginTransaction(),commit:()=>connection.commit(),rollback:()=>connection.rollback(),release(){}
    }) };
    const auditPath = require.resolve('../middlewares/auditoriaMiddleware');
    require.cache[auditPath] = { id:auditPath,filename:auditPath,loaded:true,exports:(req,res,next)=>next() };
    const diaria = require('../services/asistenciaDiariaService');
    let rows = await diaria.listar({desde:day});
    assert.deepEqual(rows.map(x=>x.empleado_id).sort(),[1,4,5,6,7,10].map(employeeId).sort());
    assert.equal(rows.find(x=>x.empleado_id===employeeId(1)).estado,'pendiente');
    assert.equal(rows.find(x=>x.empleado_id===employeeId(5)).estado,'permiso');
    now = day + ' 22:00:00'; // 17:00, Perú: termina el turno diurno.
    rows = await diaria.listar({desde:day});
    assert.equal(rows.find(x=>x.empleado_id===employeeId(1)).estado,'falta');
    assert.equal(rows.find(x=>x.empleado_id===employeeId(4)).estado,'pendiente');
    assert.equal(rows.find(x=>x.empleado_id===employeeId(6)).estado,'falta');
    assert.equal(rows.find(x=>x.empleado_id===employeeId(7)).estado,'vacaciones');
    assert.deepEqual((await diaria.listar({desde:day,filtros:{estado:'falta'}})).map(x=>x.empleado_id).sort(),[employeeId(1),employeeId(6)]);
    now = dateOffset(1)+' 10:59:59'; // 05:59 del día siguiente: sigue pendiente el turno nocturno.
    assert.equal((await diaria.listar({desde:day})).find(x=>x.empleado_id===employeeId(4)).estado,'pendiente');
    now = dateOffset(1)+' 11:00:00';
    assert.equal((await diaria.listar({desde:day})).find(x=>x.empleado_id===employeeId(4)).estado,'falta');
    now = day+' 22:00:00';

    process.env.JWT_SECRET = 'solo-pruebas-de-flujo-asistencia-aislado';
    const app = express();
    app.get('/api/auth/perfil',(_,res)=>res.json({ok:true,usuario:{nombres:'Gestión de prueba',rol:ROLES.RRHH},acceso:{panel:'RecursosHumanos.html',modulos:['rrhh','asistencia'],permisos:[]}}));
    app.get('/api/personal/catalogos',(_,res)=>res.json({ok:true,data:{empresas:[{id:companyId,razon_social:'Empresa de prueba'}],areas:[{id:companyId,empresa_id:companyId,nombre:'Área de prueba'}],cargos:[{id:companyId,area_id:companyId,nombre:'Cargo de prueba'}]}}));
    app.get('/api/personal',(_,res)=>res.json({ok:true,data:employees}));
    app.use('/api/asistencias',require('../routes/asistenciaRoutes'));
    app.use('/api/reportes',require('../routes/reporteRoutes'));
    app.use(express.static(path.resolve(__dirname,'../../frontend')));
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base = 'http://127.0.0.1:'+server.address().port;
    const debugPort = Number(process.env.SBSS_CHROME_PORT||9224);
    target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
    cdp = await CDP.connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.exception?.description||event.exceptionDetails.text));
    const token = jwt.sign({usuario_id:1},process.env.JWT_SECRET,{expiresIn:'10m'});
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('sbss_token',${JSON.stringify(token)});const originalInterval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>originalInterval(fn,ms===15000?150:ms,...args);`});
    const wait = async expression=>{
      const until=Date.now()+15000;
      while(Date.now()<until){try{if(await cdp.evaluate(expression))return;}catch{}await new Promise(resolve=>setTimeout(resolve,60));}
      throw new Error('No se cumplió: '+expression);
    };
    now = day+' 13:00:00';
    await cdp.send('Page.navigate',{url:base+'/Registros.html'});
    await wait('document.querySelectorAll("#tbodyAsistencia tr").length===6');
    await wait('Array.from(document.querySelectorAll("#tbodyAsistencia tr")).some(row=>row.cells[2]?.textContent==="Persona Prueba 1"&&row.cells[10]?.textContent==="Pendiente")');
    now = day+' 22:00:00';
    await wait('Array.from(document.querySelectorAll("#tbodyAsistencia tr")).some(row=>row.cells[2]?.textContent==="Persona Prueba 1"&&row.cells[10]?.textContent==="Falta")');
    // Registrar desde la fila de un turno que figuraba como falta automática.
    await cdp.evaluate('Array.from(document.querySelectorAll("#tbodyAsistencia tr")).find(row=>row.cells[2]?.textContent==="Persona Prueba 1").querySelector("button").click()');
    assert.equal(await cdp.evaluate('document.getElementById("aEstado").value'),'presente');
    assert.equal(await cdp.evaluate('document.getElementById("aTrabajador").disabled'),true);
    await cdp.evaluate('document.getElementById("aIngreso").value="08:00";document.getElementById("aSalida").value="17:00";document.getElementById("formAsistencia").requestSubmit()');
    await wait('Array.from(document.querySelectorAll("#tbodyAsistencia tr")).some(row=>row.cells[2]?.textContent==="Persona Prueba 1"&&row.cells[10]?.textContent==="Presente")');
    // El botón general también admite una asistencia fuera de turno y la agrega al listado.
    await cdp.evaluate('document.getElementById("btnNuevaAsistencia").click();document.getElementById("aTrabajador").value='+JSON.stringify(String(employeeId(2)))+';document.getElementById("aIngreso").value="08:00";document.getElementById("aSalida").value="17:00";document.getElementById("formAsistencia").requestSubmit()');
    await wait('Array.from(document.querySelectorAll("#tbodyAsistencia tr")).some(row=>row.cells[2]?.textContent==="Persona Prueba 2"&&row.cells[10]?.textContent==="Presente")');
    rows = await diaria.listar({desde:day});
    assert.equal(rows.filter(x=>x.empleado_id===employeeId(1)).length,1);
    assert.equal(rows.filter(x=>x.empleado_id===employeeId(2)).length,1);
    const report = await (await fetch(base+'/api/reportes/consolidado?fecha_inicio='+day+'&fecha_fin='+day,{headers:{Authorization:'Bearer '+token}})).json();
    assert.equal(report.ok,true);assert.equal(report.data.kpis.total_faltas,1);
    const filtered = await (await fetch(base+'/api/reportes/consolidado?fecha_inicio='+day+'&fecha_fin='+day+'&estado=falta',{headers:{Authorization:'Bearer '+token}})).json();
    assert.deepEqual(filtered.data.detalles.map(x=>x.empleado_id),[employeeId(6)]);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({ok:true,checks:['Solo turnos del día y registros existentes','Pendiente antes del fin; falta al terminar','Turno nocturno termina al día siguiente','Permiso completo aprobado excluye falta; parcial no cubre el turno entero','Vacaciones y marcaciones reales prevalecen','Registrar desde la fila corrige la falta sin duplicar','Registrar desde el botón agrega la asistencia a la lista','Reportes y filtro de faltas coinciden'],database:'Tablas temporales; registros del usuario intactos'},null,2));
  } finally {
    if(target)await fetch(`http://127.0.0.1:${Number(process.env.SBSS_CHROME_PORT||9224)}/json/close/`+target.id).catch(()=>{});
    if(cdp)cdp.close();
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    connection.release();await pool.end();
  }
}

main().catch(error=>{console.error(error.stack);process.exitCode=1;});
