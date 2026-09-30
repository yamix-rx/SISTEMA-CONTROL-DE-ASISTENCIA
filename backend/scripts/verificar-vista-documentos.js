#!/usr/bin/env node
'use strict';
// Vista real en Chrome con servidor y datos aislados: no carga la base ni credenciales.
// Uso: node scripts/verificar-vista-documentos.js
// Opcionales: SBSS_CHROME_PATH, SBSS_CHROME_PORT (Chrome existente), SBSS_UI_OUTPUT.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const express = require('express');
const { CDP, onlyLocalNetwork } = require('./verificar-navegador');
const { generarPdf } = require('../services/documentoPdfService');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const empleado = { id: 42, nombres: 'Ana', apellidos: 'Prueba Visual', colaborador: 'Ana Prueba Visual', numero_documento: '99990001', tipo_vinculo: 'practicante_preprofesional', empresa_id: 1, empresa: 'SBSS OUTSOURCING S.A.C.', area_id: 2, area: 'Logística', cargo_id: 3, cargo: 'Practicante', carrera: 'Ingeniería Industrial', fecha_ingreso: '2026-06-01' };
const empresas = [{ id: 1, razon_social: empleado.empresa, ruc: '20604583871' }];
const documento = {
  codigo: 'aceptacion', estilo: 'formal', diseno: 'carta', logo: 'sbss', firma: 'sbss', empresa: empleado.empresa,
  titulo: 'CARTA DE ACEPTACIÓN PARA PROYECTO DE PASANTÍA', tipo_documento_nombre: 'Carta de aceptación',
  trabajador: empleado.colaborador, carrera: empleado.carrera, fecha: '2026-08-24', nombre_archivo: 'aceptacion-prueba-visual.pdf',
  revision_plantilla: 'revision-aislada-ui', modelo_nombre: 'Carta de aceptación · SBSS',
  cuerpo: '24 de agosto del 2026\n\nEstimado:\n\nDirector Académico de Prueba\nDirector Académico\nASUNTO: Aceptación para Proyecto de Pasantía\n\nDe mi consideración:\n\nPor medio de la presente me dirijo a usted para expresarle mi saludo cordial, y a la vez hacer de su conocimiento que nuestra empresa ha aceptado al siguiente estudiante:\n\n- Ana Prueba Visual - DNI: 99990001\n\nPara desarrollo del proyecto en la modalidad de pasantía antes mencionado por un periodo de tres meses o 320 horas y así complementar su formación académica, del curso de prácticas, el cual es obligatorio para el estudiante y en lo dispuesto en la Ley Sobre Modalidades Formativas Laborales (No 28518).\n\nLos datos para registro son los siguientes:\n- Ruc Empresa: 20604583871\n- Razón Social: SBSS OUTSOURCING S.A.C\n- Supervisor del practicante: Responsable de Prueba\n- Cel. Supervisor: 900 000 001\n- Área de desempeño: Área Logística\n\nAtentamente,\n\n________________________\nResponsable de Prueba\nGerencia General'
};
const fila = { clave: '42-1', documento_id: 101, empleado_id: 42, tipo_documento_id: 1, tipo_documento: 'Carta de aceptación', colaborador: empleado.colaborador, numero_documento: empleado.numero_documento, empresa: empleado.empresa, nombre_archivo: documento.nombre_archivo, estado: 'pendiente', fecha_subida: '2026-08-24', es_obligatorio: true };

async function main() {
  const output = process.env.SBSS_UI_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'sbss-vista-documentos-'));
  await fs.mkdir(output, { recursive: true });
  const pdf = await generarPdf(documento);
  await fs.writeFile(path.join(output, documento.nombre_archivo), pdf);
  const app = express(), calls = [], errors = [], results = [];
  app.use(express.json());
  app.use('/api', (req, res, next) => { calls.push({ path: req.path, method: req.method, body: req.body }); res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/auth/perfil', (_, res) => res.json({ ok: true, usuario: { nombres: 'Usuario', apellidos: 'Prueba Visual', rol: 'Recursos Humanos', email: 'ui@example.test' }, acceso: { panel: 'RecursosHumanos.html', modulos: ['rrhh', 'personal', 'documentos'], permisos: [] } }));
  app.get('/api/documentos/catalogos', (_, res) => res.json({ ok: true, empleados: [empleado], empresas, tipos: [{ id: 1, nombre: 'Carta de aceptación' }] }));
  app.get('/api/documentos', (_, res) => res.json({ ok: true, documentos: [fila], total: 1, pagina: 1, resumen: { pendiente: 1, sin_entregar: 0, validado: 0, rechazado: 0 } }));
  app.get('/api/personal/42', (_, res) => res.json({ ok: true, data: { empleado, progresoHoras: { horasMeta: 320, horasRealizadas: 80 } } }));
  app.get('/api/documentos/generacion/catalogos', (_, res) => res.json({ ok: true, empresas, areas: [{ id: 2, nombre: 'Logística', empresa_id: 1 }], cargos: [{ id: 3, nombre: 'Practicante', area_id: 2 }], plantillas: [{ codigo: 'aceptacion', titulo: documento.titulo, cuerpo: documento.cuerpo }], modelos: [], campos: [], campos_modelo: [] }));
  app.post('/api/documentos/generar/vista-previa', (_, res) => res.json({ ok: true, documento }));
  app.post('/api/documentos/generar/pdf', (req, res) => { assert.equal(req.body.revision_plantilla, documento.revision_plantilla); res.type('pdf').send(pdf); });
  app.get('/api/documentos/101/archivo', (_, res) => res.type('pdf').send(pdf));
  app.use('/api', (req, res) => { errors.push('API sin fixture: ' + req.method + ' ' + req.path); res.status(404).json({ ok: false }); });
  app.use(express.static(path.resolve(__dirname, '../../frontend')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let chrome, target, cdp;
  let debugPort = Number(process.env.SBSS_CHROME_PORT || 0);
  try {
    if (!debugPort) {
      const profile = path.join(output, 'chrome-profile');
      const executable = process.env.SBSS_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
      chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
      chrome.on('error', error => errors.push(error.message));
      const until = Date.now() + 20000;
      while (!debugPort && Date.now() < until) {
        try { debugPort = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {}
        if (!debugPort) await pause(100);
      }
      assert.ok(debugPort, 'Chrome no abrió CDP; inicia un Chrome aislado con --remote-debugging-port=9224 y usa SBSS_CHROME_PORT=9224.');
    }
    target = await (await fetch('http://127.0.0.1:' + debugPort + '/json/new?about:blank', { method: 'PUT' })).json();
    cdp = await CDP.connect(target.webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown', data => errors.push(data.exceptionDetails.exception?.description || data.exceptionDetails.text));
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    const external = await onlyLocalNetwork(cdp, base);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: '(' + function () {
      localStorage.setItem('sbss_token', 'fixture-ui-sin-credenciales-reales');
      localStorage.removeItem('sbss_usuario'); localStorage.removeItem('sbss_acceso');
      window.__downloads = []; window.__revoked = [];
      const nativeClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__downloads.push({ href: this.href, download: this.download }); return; } return nativeClick.call(this); };
      const nativeRevoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = url => { window.__revoked.push(url); nativeRevoke(url); };
    }.toString() + ')();' });
    async function wait(expression) {
      const until = Date.now() + 15000;
      while (Date.now() < until) { try { if (await cdp.evaluate(expression)) return; } catch {} await pause(75); }
      throw new Error('No alcanzado: ' + expression);
    }
    async function capture(name) { const data = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(output, name), Buffer.from(data.data, 'base64')); }
    async function click(id) { return cdp.evaluate('document.getElementById(' + JSON.stringify(id) + ').click()'); }
    async function generate() {
      await click('btnGenerar');
      await wait('document.getElementById("modalGenerar").open && !document.getElementById("generarEmpleado").disabled');
      await cdp.evaluate('document.getElementById("generarEmpleado").value="42";document.getElementById("generarEmpleado").dispatchEvent(new Event("change"))');
      await wait('document.getElementById("generarHoras").value==="320" && !document.getElementById("btnCrearVista").disabled');
      await cdp.evaluate('document.getElementById("generarFecha").value="2026-08-24";document.getElementById("formGenerar").requestSubmit()');
      await wait('document.getElementById("modalDocumentoGenerado").open && document.getElementById("generadoPdf").src.startsWith("blob:")');
      await pause(1400);
    }
    async function bounds(width) {
    const rects = await cdp.evaluate('(()=>{const d=document.getElementById("modalDocumentoGenerado"),p=document.getElementById("generadoPdf"),r=d.getBoundingClientRect();return {window:innerWidth,document:document.documentElement.scrollWidth,dialog:r.width,dialogScroll:d.scrollWidth,dialogClient:d.clientWidth,pdf:p.getBoundingClientRect().width,left:r.left,right:r.right,scrollTop:d.scrollTop,pdfTop:p.getBoundingClientRect().top};})()');
      assert.ok(rects.document <= width + 2 && rects.dialogScroll <= rects.dialogClient + 2 && rects.right <= width + 2 && rects.left >= -2, JSON.stringify(rects));
      return rects;
    }
    await cdp.send('Page.navigate', { url: base + '/Documentos.html' });
    await wait('document.querySelector("[data-action=ver]") && !document.getElementById("btnGenerar").disabled');
    await generate();
    for (const width of [1440, 768, 390]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width === 390 });
      await pause(600);
      const layout = await bounds(width);
      await capture('Vista-PDF-' + width + '.png');
      results.push({ action: 'Vista PDF sin desbordamiento horizontal', width, layout });
    }
    const src = await cdp.evaluate('document.getElementById("generadoPdf").src');
    const pdfCalls = () => calls.filter(call => call.path === '/documentos/generar/pdf').length;
    const originalCalls = pdfCalls();
    await click('btnPdfGenerado');
    const download = await cdp.evaluate('window.__downloads.at(-1)');
    assert.equal(download.href, src.split('#')[0]); assert.equal(download.download, documento.nombre_archivo); assert.equal(pdfCalls(), originalCalls);
    assert.equal(await cdp.evaluate('document.getElementById("abrirPdfExterno").href'), download.href);
    results.push({ action: 'Descarga y apertura externa reutilizan el PDF visible sin regenerarlo' });
    await click('btnAmpliarPdf');
    assert.match(await cdp.evaluate('document.getElementById("generadoPdf").src'), /view=FitH/);
    await click('btnAmpliarPdf');
    assert.match(await cdp.evaluate('document.getElementById("generadoPdf").src'), /view=Fit(?:&|$)/);
    await click('btnTextoGenerado');
    assert.equal(await cdp.evaluate('document.getElementById("documentoGenerado").hidden'), false);
    assert.equal(await cdp.evaluate('document.getElementById("btnAmpliarPdf").disabled'), true);
    await capture('Vista-texto-390.png');
    await click('btnTextoGenerado');
    results.push({ action: 'Ampliar, página completa y alternativa de texto operativos' });
    await pause(600);
    // Espía sobre la ventana del PDF: no abre un diálogo del sistema durante el smoke.
    await cdp.evaluate('window.__pdfPrintCalls=0;document.getElementById("generadoPdf").contentWindow.print=()=>{window.__pdfPrintCalls++}');
    await click('btnImprimirPdf');
    assert.equal(await cdp.evaluate('window.__pdfPrintCalls'), 1);
    await cdp.evaluate('document.getElementById("generadoPdf").contentWindow.print=()=>{throw new Error("Impresión no disponible en fixture")}');
    await click('btnImprimirPdf');
    assert.equal(await cdp.evaluate('document.getElementById("errorPdf").hidden'), false);
    assert.match(await cdp.evaluate('document.getElementById("errorPdf").textContent'), /otra pestaña/);
    results.push({ action: 'Imprimir llama a print de la ventana del PDF' });
    await click('btnVolverGenerar');
    assert.equal(await cdp.evaluate('document.getElementById("modalGenerar").open'), true);
    assert.equal(await cdp.evaluate('document.getElementById("generarEmpleado").value'), '42');
    assert.equal(await cdp.evaluate('document.getElementById("generarHoras").value'), '320');
    await wait('!document.getElementById("generadoPdf").hasAttribute("src")');
    assert.ok(await cdp.evaluate('window.__revoked.includes(' + JSON.stringify(download.href) + ')'));
    await cdp.evaluate('document.getElementById("modalGenerar").close()');
    await generate();
    const mobileStart = await bounds(390);
    assert.equal(mobileStart.scrollTop, 0, 'El visor debe abrir mostrando el inicio de la hoja en móvil.');
    assert.ok(mobileStart.pdfTop >= 0, 'La hoja debe comenzar dentro del viewport móvil.');
    await capture('Vista-apertura-movil-390.png');
    results.push({ action: 'Apertura inicial móvil muestra inicio de hoja; cerrar libera el Blob', layout: mobileStart });
    await cdp.evaluate('document.getElementById("modalDocumentoGenerado").close()');
    await wait('!document.getElementById("generadoPdf").hasAttribute("src")');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 960, deviceScaleFactor: 1, mobile: false });
    await cdp.evaluate('document.querySelector("[data-action=ver]").click()');
    await wait('!document.getElementById("btnAbrirVistaCompleta").hidden && !document.getElementById("btnAbrirVistaCompleta").disabled');
    await pause(600);
    await cdp.evaluate('document.getElementById("panelVista").scrollIntoView({block:"start",behavior:"instant"})');
    await capture('Panel-expediente-768.png');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 960, deviceScaleFactor: 1, mobile: true });
    await click('btnAbrirVistaCompleta');
    await wait('document.getElementById("modalDocumentoGenerado").open');
    assert.equal(await cdp.evaluate('document.getElementById("btnVolverGenerar").hidden'), true);
    assert.equal(await cdp.evaluate('document.getElementById("btnTextoGenerado").hidden'), true);
    await click('btnPdfGenerado');
    assert.equal(await cdp.evaluate('window.__downloads.at(-1).href'), await cdp.evaluate('document.getElementById("generadoPdf").src.split("#")[0]'));
    results.push({ action: 'Editar conserva datos y PDF del expediente abre en el mismo visor y descarga el mismo Blob' });
    await pause(600); await capture('Vista-expediente-390.png');
    assert.match(await cdp.evaluate('document.getElementById("estadoVistaPdf").textContent'), /otra pestaña|descárgalo/);
    assert.equal(await cdp.evaluate('document.getElementById("btnPdfGenerado").disabled'), false);
    assert.match(await cdp.evaluate('document.getElementById("abrirPdfExterno").href'), /^blob:/);
    results.push({ action: 'Alternativa permanente del visor conserva descarga y apertura externa disponibles' });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await fs.writeFile(path.join(output, 'resultados.json'), JSON.stringify({ at: new Date().toISOString(), fixture: 'API aislada; sin base ni credenciales', results, errors, external }, null, 2));
    console.log(JSON.stringify({ ok: true, checks: results.length, output }, null, 2));
  } catch (error) {
    if (cdp) {
      const image = await cdp.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (image) await fs.writeFile(path.join(output, 'fallo.png'), Buffer.from(image.data, 'base64'));
    }
    await fs.writeFile(path.join(output, 'fallo.json'), JSON.stringify({ results, error: error.message, errors, calls }, null, 2));
    console.error('Artefactos de fallo: ' + output); throw error;
  } finally {
    if (cdp) cdp.close();
    if (target) await fetch('http://127.0.0.1:' + debugPort + '/json/close/' + target.id).catch(() => {});
    if (chrome) chrome.kill();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
