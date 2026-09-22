#!/usr/bin/env node
'use strict';
// Interacciones sin cambios en cuentas ni plantillas; emite PDFs con datos del esquema de validación.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { CDP } = require('./verificar-navegador');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const config = JSON.parse(await fs.readFile(path.resolve(__dirname, '../backups/validacion-sesion.json'), 'utf8'));
  const out = path.resolve(__dirname, '../backups/validacion-visual');
  const target = await (await fetch('http://127.0.0.1:9224/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  const errors = [], pdfResponses = [], results = [];
  cdp.on('Runtime.exceptionThrown', value => errors.push(value.exceptionDetails.text));
  cdp.on('Network.responseReceived', value => { if (value.response.url.endsWith('/api/documentos/generar/pdf')) pdfResponses.push({ status: value.response.status, mime: value.response.mimeType }); });
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 960, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'localStorage.setItem("sbss_token",' + JSON.stringify(config.tokens.admin) + ');' });
  async function waitFor(expression) {
    const deadline = Date.now() + 18000;
    while (Date.now() < deadline) {
      try { if (await cdp.evaluate(expression)) return; } catch { /* Navegación en curso. */ }
      await pause(100);
    }
    throw new Error('La interacción no alcanzó el estado esperado.');
  }
  async function capture(filename) { const image = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(out, filename), Buffer.from(image.data, 'base64')); }
  try {
    await cdp.send('Page.navigate', { url: config.baseUrl + '/Administracion.html' });
    await waitFor('document.getElementById("usersBody")?.querySelector("button") && !document.getElementById("userFields").disabled');
    await cdp.evaluate('document.querySelector("#usersBody button").click()');
    const account = await cdp.evaluate('({title:document.getElementById("userTitle").textContent,employee:!!document.getElementById("userEmployee").value,email:!!document.getElementById("userEmail").value,role:!!document.getElementById("userRole").value,passwordHidden:document.getElementById("newPasswordField").hidden,width:document.getElementById("userForm").getBoundingClientRect().width})');
    assert.equal(account.title, 'Editar cuenta'); assert.ok(account.employee && account.email && account.role && account.passwordHidden); assert.ok(account.width < 390);
    await capture('Administracion-editar-390.png');
    await cdp.evaluate('document.getElementById("cancelUser").click()');
    assert.equal(await cdp.evaluate('document.getElementById("userTitle").textContent'), 'Crear cuenta');
    await cdp.evaluate('document.querySelector("#usersBody tr button:nth-child(2)").click()');
    assert.equal(await cdp.evaluate('document.getElementById("passwordDialog").open'), true);
    await cdp.evaluate('document.getElementById("closePassword").click()');
    results.push({ action: 'Cuenta: editar, limpiar y abrir/cancelar restablecimiento', ok: true });

    await cdp.send('Page.navigate', { url: config.baseUrl + '/Documentos.html?empleado_id=' + encodeURIComponent(config.empleadoId) });
    await waitFor('document.getElementById("btnPlantillas") && !!window.SBSSSession?.current && document.getElementById("generarEmpleado").options.length>1');
    await cdp.evaluate('document.getElementById("btnPlantillas").click()');
    await waitFor('document.getElementById("modalPlantillas").open && document.getElementById("plantillaCuerpo").value.length>0 && !document.getElementById("btnGuardarPlantilla").disabled');
    assert.equal(await cdp.evaluate('document.getElementById("plantillaTitulo").value.length>0'), true);
    const bodyLength = await cdp.evaluate('document.getElementById("plantillaCuerpo").value.length');
    await cdp.evaluate('document.getElementById("plantillaCuerpo").setSelectionRange(0,0); document.querySelector("#plantillaCampos button").click()');
    assert.ok(await cdp.evaluate('document.getElementById("plantillaCuerpo").value.length') > bodyLength);
    await capture('Documentos-editor-390.png');
    await cdp.evaluate('document.getElementById("modalPlantillas").close()');
    results.push({ action: 'Editor: cargar plantilla e insertar campo sin guardar', ok: true });

    for (const code of ['aceptacion', 'constancia_practicas', 'culminacion']) {
      await cdp.evaluate('document.querySelector("[data-plantilla=' + code + ']").click()');
      await waitFor('document.getElementById("modalGenerar").open && document.getElementById("generarCargo").value && !document.getElementById("btnCrearVista").disabled');
      const fields = await cdp.evaluate('({employee:document.getElementById("generarEmpleado").value,company:document.getElementById("generarEmpresa").value,area:document.getElementById("generarArea").value,position:document.getElementById("generarCargo").value,date:document.getElementById("generarFecha").value,hours:document.getElementById("generarHoras").value})');
      assert.equal(Number(fields.employee), Number(config.empleadoId)); assert.ok(fields.company && fields.area && fields.position && fields.date && fields.hours);
      await cdp.evaluate('document.getElementById("btnCrearVista").click()');
      await waitFor('document.getElementById("modalDocumentoGenerado").open');
      assert.equal(await cdp.evaluate('document.getElementById("generadoCuerpo").textContent.length>80'), true);
      await capture('Documentos-' + code + '-390.png');
      await cdp.evaluate('document.getElementById("btnPdfGenerado").click()');
      await waitFor('!document.getElementById("btnPdfGenerado").disabled');
      assert.equal(await cdp.evaluate('document.getElementById("errorPdf").hidden'), true);
      await cdp.evaluate('document.getElementById("modalDocumentoGenerado").close()');
      results.push({ action: 'Vista previa y PDF ' + code, ok: true });
    }
    await pause(700);
    assert.equal(pdfResponses.length, 3); assert.ok(pdfResponses.every(item => item.status === 200 && item.mime === 'application/pdf'));
    assert.equal(errors.length, 0);
    await fs.writeFile(path.join(out, 'interacciones.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results, pdfResponses, javascript: errors }, null, 2));
    console.log('5/5 interacciones correctas; 3 PDF recibidos con HTTP200/application-pdf. Sin cambios en cuentas ni plantillas.');
  } finally {
    cdp.close(); await fetch('http://127.0.0.1:9224/json/close/' + target.id).catch(() => {});
  }
})().catch(error => { console.error('Interacción fallida: ' + error.message); process.exitCode = 1; });
