// Recorridos de los cambios contra la base aislada del verificador de integración.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { CDP, onlyLocalNetwork } = require('./verificar-navegador');
const pause = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const config = JSON.parse(await fs.readFile(path.resolve(__dirname,'../backups/validacion-sesion.json'),'utf8'));
  if (!config.baseUrl.startsWith('http://127.0.0.1:3101')) throw new Error('Usar únicamente el servidor aislado de validación.');
  const target = await (await fetch('http://127.0.0.1:9224/json/new?about:blank',{method:'PUT'})).json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl), errors = [], results = [];
  const output = path.resolve(__dirname,'../backups/validacion-correcciones'); await fs.mkdir(output,{recursive:true});
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  const external = await onlyLocalNetwork(cdp,new URL(config.baseUrl).origin);
  cdp.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.text));
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin===${JSON.stringify(new URL(config.baseUrl).origin)})localStorage.setItem('sbss_token',${JSON.stringify(config.tokens.admin)});`});
  const evaluate = expression => cdp.evaluate(expression);
  async function wait(expression) {
    const until=Date.now()+18000;
    while(Date.now()<until){try{if(await evaluate(expression))return;}catch{}await pause(100);}
    throw new Error('No se alcanzó: '+expression);
  }
  async function navigate(file) { await cdp.send('Page.navigate',{url:config.baseUrl+'/'+file}); await wait('!!window.SBSSSession?.current'); }
  async function screenshot(file) { const data=await cdp.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,file),Buffer.from(data.data,'base64')); }
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:960,deviceScaleFactor:1,mobile:true});
    await navigate('Administracion.html'); await wait('!document.getElementById("documentTypeFields").disabled');
    const suffix=Date.now().toString(), documentName='Documento de prueba '+suffix, permissionName='Permiso de prueba '+suffix, renamed='Permiso editado '+suffix;
    await evaluate(`document.getElementById('documentTypeName').value=${JSON.stringify(documentName)};document.getElementById('documentTypeDescription').value='Prueba de configuración';document.getElementById('documentTypeForm').requestSubmit();`);
    await wait(`document.getElementById('documentTypesBody').textContent.includes(${JSON.stringify(documentName)})`);
    await evaluate(`Array.from(document.querySelectorAll('#documentTypesBody tr')).find(r=>r.textContent.includes(${JSON.stringify(documentName)})).querySelector('button').click()`);
    assert.equal(await evaluate('document.getElementById("documentTypeDescription").value'),'Prueba de configuración');
    await evaluate(`document.getElementById('documentTypeRequired').value='1';document.getElementById('documentTypeForm').requestSubmit()`);
    await wait(`Array.from(document.querySelectorAll('#documentTypesBody tr')).find(r=>r.textContent.includes(${JSON.stringify(documentName)}))?.textContent.includes('Obligatoria')`);
    results.push('Crear y editar tipo de documento desde el formulario móvil');
    await evaluate(`document.getElementById('permissionTypeName').value=${JSON.stringify(permissionName)};document.getElementById('permissionTypeForm').requestSubmit()`);
    await wait(`document.getElementById('permissionTypesBody').textContent.includes(${JSON.stringify(permissionName)})`);
    await evaluate(`Array.from(document.querySelectorAll('#permissionTypesBody tr')).find(r=>r.textContent.includes(${JSON.stringify(permissionName)})).querySelector('button').click();document.getElementById('permissionTypeName').value=${JSON.stringify(renamed)};document.getElementById('permissionTypeForm').requestSubmit()`);
    await wait(`document.getElementById('permissionTypesBody').textContent.includes(${JSON.stringify(renamed)})`);
    await screenshot('configuracion-movil.png'); results.push('Crear y editar tipo de permiso desde el formulario móvil');
    await navigate('Registros.html?vista=permisos');
    await wait(`Array.from(document.getElementById('pTipo')?.options||[]).some(o=>o.value===${JSON.stringify(renamed)})`);
    await evaluate(`document.getElementById('btnNuevoPermiso').click();document.getElementById('pTrabajador').value=${JSON.stringify(String(config.empleadoId))};document.getElementById('pTipo').value=${JSON.stringify(renamed)};document.getElementById('pMotivo').value='Recorrido de configuración ${suffix}';document.getElementById('formPermiso').requestSubmit()`);
    await wait(`document.getElementById('tbodyPermisos').textContent.includes('Recorrido de configuración ${suffix}')`);
    results.push('El tipo configurado aparece en Permisos y permite registrar un permiso real');
    await navigate('FichaIndividual.html?empleado_id='+config.empleadoId);
    await wait('!document.getElementById("expediente").hidden');
    await evaluate('document.getElementById("btnEditarPersonal").click()');
    assert.equal(await evaluate('document.getElementById("pCorreo").maxLength'),120);
    assert.equal(await evaluate('document.getElementById("pCarrera").maxLength'),100);
    await evaluate('document.getElementById("pTipoDocumento").value="DNI";document.getElementById("pTipoDocumento").dispatchEvent(new Event("change"));document.getElementById("pDocumento").value="ABC"');
    assert.equal(await evaluate('document.getElementById("pDocumento").checkValidity()'),false);
    await evaluate('document.getElementById("btnCancelarModal").click()');
    results.push('El formulario aplica los límites de MySQL y rechaza un DNI inválido');
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify({fecha:new Date().toISOString(),results,errores:errors,solicitudesExternas:external},null,2));
    console.log(`${results.length} recorridos nuevos correctos con navegador, API y MySQL reales.`);
  } catch(error) {
    await screenshot('fallo.png').catch(()=>{});
    await fs.writeFile(path.join(output,'fallo.json'),JSON.stringify({mensaje:error.message,errors,results},null,2));
    throw error;
  } finally { cdp.close();await fetch('http://127.0.0.1:9224/json/close/'+target.id).catch(()=>{}); }
}
if(require.main===module)main().catch(e=>{console.error('Falló la verificación de correcciones:',e.message);process.exitCode=1;});
module.exports={main};
