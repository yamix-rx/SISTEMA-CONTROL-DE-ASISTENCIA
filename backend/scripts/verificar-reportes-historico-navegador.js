#!/usr/bin/env node
'use strict';
// Verificación focalizada: exportaciones reales y formulario de registros antiguos.
// Usa únicamente la sesión y los datos del esquema aislado de validación.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { CDP, onlyLocalNetwork } = require('./verificar-navegador');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const config = JSON.parse(await fs.readFile(path.resolve(__dirname, '../backups/validacion-sesion.json'), 'utf8'));
  const offline = process.env.SBSS_OFFLINE === '1';
  const output = path.resolve(__dirname, '../backups/' + (offline ? 'validacion-offline' : 'validacion-visual') + '/reportes-historico-' + Date.now());
  const scope = process.env.SBSS_FOCUSED_SCOPE || 'todos';
  assert.ok(['todos', 'reportes', 'historico'].includes(scope), 'Alcance desconocido.');
  await fs.mkdir(output, { recursive: true });
  const target = await (await fetch('http://127.0.0.1:9224/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  const errors = [], http = [], downloads = new Map(), results = [];
  const redact = value => Object.values(config.tokens).reduce((text, token) => text.split(token).join('[TOKEN]'), String(value));
  cdp.on('Runtime.exceptionThrown', event => errors.push(redact(event.exceptionDetails.exception?.description || event.exceptionDetails.text)));
  cdp.on('Runtime.consoleAPICalled', event => { if (event.type === 'error') errors.push(redact(event.args.map(arg => arg.description || arg.value || '').join(' '))); });
  cdp.on('Network.responseReceived', event => { if (event.response.status >= 400) http.push({ status: event.response.status, url: redact(event.response.url) }); });
  cdp.on('Browser.downloadWillBegin', event => downloads.set(event.guid, { name: event.suggestedFilename }));
  cdp.on('Browser.downloadProgress', event => { const file = downloads.get(event.guid); if (file) Object.assign(file, { state: event.state, bytes: event.receivedBytes }); });
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  const external = offline ? await onlyLocalNetwork(cdp, new URL(config.baseUrl).origin) : [];
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output, eventsEnabled: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'if(location.origin===' + JSON.stringify(new URL(config.baseUrl).origin) + '){localStorage.removeItem("sbss_usuario");localStorage.removeItem("sbss_acceso");localStorage.setItem("sbss_token",' + JSON.stringify(config.tokens.rrhh) + ');}' });
  async function waitFor(expression) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) { try { if (await cdp.evaluate(expression)) return; } catch { /* Navegación en curso. */ } await pause(100); }
    throw new Error('No se alcanzó el estado esperado: ' + expression.slice(0, 180));
  }
  async function capture(filename) { const image = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(output, filename), Buffer.from(image.data, 'base64')); }
  async function downloaded(extension) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const file = Array.from(downloads.values()).find(item => item.name.endsWith(extension) && item.state === 'completed');
      if (file) return { ...file, content: await fs.readFile(path.join(output, file.name)) };
      await pause(100);
    }
    throw new Error('Descarga no completada: ' + extension);
  }
  try {
    if (scope !== 'historico') {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: config.baseUrl + '/Reportes.html?empleado_id=' + encodeURIComponent(config.empleadoId) });
    await waitFor('document.getElementById("fTrabajador")?.options.length>1 && !document.getElementById("btnFiltrar").disabled && !!window.XLSX && !!window.jspdf');
    assert.equal(Number(await cdp.evaluate('document.getElementById("fTrabajador").value')), Number(config.empleadoId));
    await cdp.evaluate('document.getElementById("fInicio").value="2026-09-01";document.getElementById("fFin").value="2026-09-30";document.getElementById("fInicio").dispatchEvent(new Event("change"));document.getElementById("btnFiltrar").click()');
    await waitFor('!document.getElementById("btnExportarExcel").disabled && !document.getElementById("btnFiltrar").disabled');
    assert.equal(await cdp.evaluate('document.getElementById("lblConteoResultados").textContent'), 'Mostrando 1 colaboradores');
    const employeeName = await cdp.evaluate('document.querySelector("#tbodyReportes tr td").textContent');
    await capture('Reportes-filtrado-1440.png');
    await cdp.evaluate('document.getElementById("btnExportarExcel").click()');
    const excel = await downloaded('.xlsx');
    assert.equal(excel.content.subarray(0, 4).toString('hex'), '504b0304');
    const workbook = await cdp.evaluate('(()=>{const workbook=XLSX.read(' + JSON.stringify(excel.content.toString('base64')) + ',{type:"base64"});return {sheets:workbook.SheetNames,summary:XLSX.utils.sheet_to_json(workbook.Sheets.RESUMEN,{header:1}),detail:XLSX.utils.sheet_to_json(workbook.Sheets.DETALLE,{header:1})};})()');
    assert.deepEqual(workbook.sheets, ['CONTROL ASISTENCIA', 'RESUMEN', 'DETALLE', 'CRITERIOS']);
    assert.equal(workbook.summary.length, 6);
    assert.equal(workbook.summary[1][1], '2026-09-01'); assert.equal(workbook.summary[1][3], '2026-09-30');
    assert.equal(workbook.summary[5][0], employeeName);
    assert.ok(workbook.detail.length > 1 && workbook.detail.slice(1).every(row => row[0] === employeeName));
    results.push({ action: 'Excel: filtro individual septiembre 2026', ok: true, file: excel.name, bytes: excel.content.length, signature: 'PK0304', sheets: workbook.sheets, employees: 1, attendanceRows: workbook.detail.length - 1 });
    await cdp.evaluate('document.getElementById("btnExportarPDF").click()');
    const pdf = await downloaded('.pdf');
    assert.equal(pdf.content.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.content.toString('latin1').includes('2026-09-01 al 2026-09-30'));
    assert.ok(pdf.content.length > 3000);
    results.push({ action: 'PDF: filtro individual septiembre 2026', ok: true, file: pdf.name, bytes: pdf.content.length, signature: '%PDF-', matchingPeriod: true });
    assert.equal(external.length, 0, 'Las exportaciones no deben depender de Internet.');
    await fs.writeFile(path.join(output, 'reportes-exportacion.json'), JSON.stringify({ checkedAt: new Date().toISOString(), internetBlocked: offline, externalRequests: external, results, javascript: errors, http }, null, 2));
    }

    if (scope !== 'reportes') {
    assert.ok(config.legacyEmpleadoId && config.legacyFecha, 'Se requiere la asistencia antigua del esquema de validación.');
    for (const width of [390, 768, 1440]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width === 390 });
      await cdp.send('Page.navigate', { url: config.baseUrl + '/Registros.html' });
      await waitFor('document.getElementById("fTrabajador")?.options.length>1 && document.querySelector("#tbodyAsistencia button")');
      await cdp.evaluate('document.getElementById("fFecha").value=' + JSON.stringify(config.legacyFecha) + ';document.getElementById("fTrabajador").value=' + JSON.stringify(String(config.legacyEmpleadoId)) + ';document.getElementById("fTrabajador").dispatchEvent(new Event("change"))');
      await waitFor('document.querySelectorAll("#tbodyAsistencia tr").length===1 && !!document.querySelector("#tbodyAsistencia button")');
      await cdp.evaluate('document.querySelector("#tbodyAsistencia button").click()');
      await waitFor('!document.getElementById("modalAsistencia").classList.contains("hidden") && !document.getElementById("aProgramacionHistorica").classList.contains("hidden")');
      const before = await cdp.evaluate('({checked:document.getElementById("aConfirmarHistorico").checked, values:["aOriginalEntrada","aOriginalSalida","aOriginalTolerancia","aOriginalMotivo"].map(id=>document.getElementById(id).value),disabled:document.getElementById("aOriginalEntrada").disabled})');
      assert.equal(before.checked, false); assert.equal(before.disabled, true); assert.ok(before.values.every(value => value === ''));
      await cdp.evaluate('document.getElementById("aConfirmarHistorico").click()');
      assert.equal(await cdp.evaluate('document.getElementById("aOriginalEntrada").disabled'), false);
      assert.equal(await cdp.evaluate('document.getElementById("aOriginalMotivo").required'), true);
      assert.equal(await cdp.evaluate('document.getElementById("formAsistencia").checkValidity()'), false);
      await cdp.evaluate('document.getElementById("aOriginalEntrada").value="08:00";document.getElementById("aOriginalSalida").value="17:00";document.getElementById("aOriginalTolerancia").value="5";document.getElementById("aOriginalMotivo").value="Prueba visual: horario original verificado, sin guardar cambios."');
      assert.equal(await cdp.evaluate('document.getElementById("formAsistencia").checkValidity()'), true);
      await capture('Registros-historico-' + width + '.png');
      const dimensions = await cdp.evaluate('(()=>{const f=document.getElementById("formAsistencia"),r=f.getBoundingClientRect();return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,formWidth:r.width,formScrollWidth:f.scrollWidth,formClientWidth:f.clientWidth,top:r.top,bottom:r.bottom,scrollHeight:f.scrollHeight,clientHeight:f.clientHeight,checkboxWidth:document.getElementById("aConfirmarHistorico").getBoundingClientRect().width};})()');
      assert.ok(dimensions.documentWidth <= width + 2 && dimensions.formScrollWidth <= dimensions.formClientWidth + 2, 'Desborde horizontal: ' + JSON.stringify(dimensions));
      assert.ok(dimensions.top >= 0 && dimensions.bottom <= 960, 'Formulario fuera de la vista: ' + JSON.stringify(dimensions));
      assert.ok(dimensions.checkboxWidth <= 24, 'Casilla sobredimensionada: ' + JSON.stringify(dimensions));
      await cdp.evaluate('document.getElementById("formAsistencia").scrollTop=document.getElementById("formAsistencia").scrollHeight');
      await capture('Registros-historico-final-' + width + '.png');
      await cdp.evaluate('document.querySelector("#modalAsistencia [data-close]").click()');
      results.push({ action: 'Programación histórica: activar, validar y cancelar', width, ok: true, emptyOriginalValues: true, dimensions });
    }
    }
    assert.deepEqual(errors, []); assert.deepEqual(http, []);
    await fs.writeFile(path.join(output, 'resultados.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results, javascript: errors, http }, null, 2));
    console.log(results.length + '/' + results.length + ' comprobaciones correctas. Evidencias: ' + output);
  } catch (error) {
    await capture('fallo.png').catch(() => {});
    await fs.writeFile(path.join(output, 'fallo.json'), JSON.stringify({ results, message: redact(error.message), javascript: errors, http }, null, 2));
    throw error;
  } finally { cdp.close(); await fetch('http://127.0.0.1:9224/json/close/' + target.id).catch(() => {}); }
})().catch(error => { console.error('Verificación fallida: ' + error.message); process.exitCode = 1; });
