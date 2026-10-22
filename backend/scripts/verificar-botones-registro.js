const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { CDP, onlyLocalNetwork } = require('./verificar-navegador');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const config = JSON.parse(await fs.readFile(path.resolve(__dirname,'../backups/validacion-botones-sesion.json'),'utf8'));
  assert.match(config.baseValidacion, /^sbss_validacion_\d+$/);
  assert.equal(config.baseUrl,'http://127.0.0.1:3101');
  async function api(route, body) {
    const response=await fetch(config.baseUrl+'/api'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.tokens.admin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();assert.ok(response.ok,route+': '+result.mensaje);return result;
  }
  const stamp=Date.now().toString(), name='Prueba Botones '+stamp;
  const employee=(await api('/personal',{tipo_documento:'CE',numero_documento:stamp,nombres:'Prueba',apellidos:'Botones '+stamp,
    empresa_id:config.empresaId,area_id:config.areaId,cargo_id:config.cargoId,fecha_ingreso:'2026-01-01',tipo_vinculo:'trabajador'})).id;
  const date=require('../services/asistenciaReglas').hoy(),day=new Date(date+'T12:00:00Z').getUTCDay()||7;
  const target=await(await fetch('http://127.0.0.1:9224/json/new?about:blank',{method:'PUT'})).json();
  const cdp=await CDP.connect(target.webSocketDebuggerUrl),errors=[],results=[];
  const output=path.resolve(__dirname,'../backups/validacion-botones');await fs.mkdir(output,{recursive:true});
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Network.enable');
  const external=await onlyLocalNetwork(cdp,new URL(config.baseUrl).origin);
  cdp.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
  cdp.on('Network.responseReceived',e=>{if(e.response.status>=400)errors.push('HTTP '+e.response.status);});
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:'if(location.origin==='+JSON.stringify(new URL(config.baseUrl).origin)+')localStorage.setItem("sbss_token",'+JSON.stringify(config.tokens.admin)+');'});
  const evaluate=expression=>cdp.evaluate(expression);
  async function wait(expression) {
    const until=Date.now()+15000;
    while(Date.now()<until){try{if(await evaluate(expression))return;}catch{}await pause(75);}
    throw new Error('No se alcanzó: '+expression);
  }
  async function click(selector) {
    const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Botón ausente');e.scrollIntoView({behavior:'instant',block:'center',inline:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Botón invisible');const x=r.left+r.width/2,y=r.top+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw Error('El control está cubierto por otro elemento');return {x,y};})()`);
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  const visible=id=>`(()=>{const e=document.getElementById(${JSON.stringify(id)});return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;})()`;
  async function navigate(page,ready) { await cdp.send('Page.navigate',{url:config.baseUrl+'/'+page});await wait(ready); }
  async function capture(file) { const shot=await cdp.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,file),Buffer.from(shot.data,'base64')); }
  async function bounds(selector) {
    const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {width:r.width,top:r.top,bottom:r.bottom,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth};})()`);
    assert.ok(box.width>0&&box.width<=box.viewport&&box.scrollWidth<=box.clientWidth+2&&box.documentWidth<=box.viewport+2&&box.top>=0&&box.bottom<=960,JSON.stringify(box));
  }
  try {
    for(const width of [1440,768,390]) {
      await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width===390});
      await navigate('Horarios.html','document.getElementById("filtroTrabajador")?.options.length>1');
      await click('#btnAbrirModal');await wait(visible('modalHorario'));await bounds('#modalHorario > div');
      assert.equal(await evaluate(visible('btnEliminar')),false);await capture('Horario-'+width+'.png');
      await click('#btnCancelar');assert.equal(await evaluate(visible('modalHorario')),false);
      results.push({width,accion:'Abrir y cancelar horario con clic real',ok:true});
      await navigate('Registros.html','document.getElementById("fTrabajador")?.options.length>1');
      await click('#btnNuevaAsistencia');await wait(visible('modalAsistencia'));await bounds('#formAsistencia');
      assert.equal(await evaluate(visible('aProgramacionHistorica')),false);await capture('Asistencia-'+width+'.png');
      await click('#modalAsistencia button[data-close]');assert.equal(await evaluate(visible('modalAsistencia')),false);
      await click('#btnNuevoPermiso');await wait(visible('modalPermiso'));await bounds('#formPermiso');
      await click('#modalPermiso button[data-close]');assert.equal(await evaluate(visible('modalPermiso')),false);
      results.push({width,accion:'Abrir y cancelar asistencia y permiso con clic real',ok:true});
    }
    await navigate('Horarios.html','document.getElementById("filtroTrabajador")?.options.length>1');await click('#btnAbrirModal');await wait(visible('modalHorario'));
    await evaluate(`document.getElementById('empleadoSelect').value=${JSON.stringify(String(employee))};document.getElementById('empleadoSelect').dispatchEvent(new Event('change'));document.getElementById('modalDia').value=${JSON.stringify(String(day))};document.getElementById('modalEntrada').value='08:00';document.getElementById('modalSalida').value='17:00';`);
    await click('#btnSubmitForm');await wait('document.getElementById("modalHorario").hidden');await wait(visible('toast'));
    const schedules=(await api('/horarios?empleado_id='+employee)).data;assert.equal(schedules.length,1);assert.equal(schedules[0].malla_horarios.length,1);assert.equal(schedules[0].malla_horarios[0].hora_entrada,'08:00:00');
    await evaluate(`document.getElementById('filtroTrabajador').value=${JSON.stringify(String(employee))};document.getElementById('filtroTrabajador').dispatchEvent(new Event('change'))`);
    await wait(`document.querySelector('#scheduleBody .person-chip')?.textContent===${JSON.stringify(name)}`);await click('#scheduleBody .person-chip');await wait(visible('modalHorario'));assert.equal(await evaluate(visible('btnEliminar')),true);await click('#btnCancelar');
    results.push({accion:'Guardar horario real, consultar MySQL y abrir edición',ok:true});
    await navigate('Registros.html','document.getElementById("fTrabajador")?.options.length>1');await click('#btnNuevaAsistencia');await wait(visible('modalAsistencia'));
    await evaluate(`document.getElementById('aTrabajador').value=${JSON.stringify(String(employee))};document.getElementById('aFecha').value=${JSON.stringify(date)};document.getElementById('aIngreso').value='08:17';document.getElementById('aSalida').value='16:17';document.getElementById('aObs').value='Prueba de botones';`);
    await click('#btnGuardarAsist');await wait('document.getElementById("modalAsistencia").hidden');await wait(visible('toast'));
    const attendance=(await api('/asistencias?fecha='+date+'&empleado_id='+employee)).data;assert.equal(attendance.length,1);assert.equal(attendance[0].estado,'tardanza');assert.equal(Number(attendance[0].minutos_tardanza),17);assert.equal(Number(attendance[0].horas_trabajadas),8);
    await wait(`document.getElementById('tbodyAsistencia').textContent.includes(${JSON.stringify(name)})`);
    results.push({accion:'Guardar asistencia real y verificar 8 horas y 17 minutos de tardanza',ok:true});
    await evaluate(`document.getElementById('fFecha').value=${JSON.stringify(config.legacyFecha)};document.getElementById('fTrabajador').value=${JSON.stringify(String(config.legacyEmpleadoId))};document.getElementById('fTrabajador').dispatchEvent(new Event('change'))`);
    await wait('document.querySelectorAll("#tbodyAsistencia tr").length===1&&!!document.querySelector("#tbodyAsistencia button")');await click('#tbodyAsistencia button');await wait(visible('modalAsistencia'));await wait(visible('aProgramacionHistorica'));
    assert.equal(await evaluate(visible('aDetalleHistorico')),false);await click('#aConfirmarHistorico');await wait(visible('aDetalleHistorico'));await bounds('#formAsistencia');await capture('Historico-390.png');await click('#modalAsistencia button[data-close]');
    results.push({accion:'Mostrar programación histórica y sus campos al confirmar, sin modificarla',ok:true});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify({fecha:new Date().toISOString(),base:config.baseValidacion,results,errors,external},null,2));
    console.log(`${results.length} recorridos correctos con clics reales, formularios visibles y registros en la base aislada.`);
  } catch(error) { await capture('fallo.png').catch(()=>{});await fs.writeFile(path.join(output,'fallo.json'),JSON.stringify({error:error.message,results,errors},null,2));throw error; }
  finally { cdp.close();await fetch('http://127.0.0.1:9224/json/close/'+target.id).catch(()=>{}); }
}
if(require.main===module)main().catch(e=>{console.error('Falló la verificación de botones:',e.message);process.exitCode=1;});
module.exports={main};
