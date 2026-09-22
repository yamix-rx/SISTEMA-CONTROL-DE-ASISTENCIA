#!/usr/bin/env node
'use strict';
// Smoke de sólo lectura contra un servidor de validación y Chrome con perfil aislado.
// Iniciar Chrome externamente si Windows no permite spawn desde Node:
// chrome.exe --headless --remote-debugging-port=9224 --user-data-dir=<TEMP>/sbss-chrome-test
const fs = require('node:fs/promises');
const path = require('node:path');
const configPath = path.resolve(process.argv[2] || path.join(__dirname, '../backups/validacion-sesion.json'));
const debugPort = Number(process.env.SBSS_CHROME_PORT || 9224);
const only = process.env.SBSS_BROWSER_PAGES ? new Set(process.env.SBSS_BROWSER_PAGES.split(',')) : null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url), client = new CDP(ws);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id) {
        const item = client.pending.get(data.id); if (!item) return;
        client.pending.delete(data.id); clearTimeout(item.timer);
        data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result);
      } else (client.listeners.get(data.method) || []).forEach(callback => callback(data.params));
    });
    return client;
  }
  on(event, callback) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(callback); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP agotó el tiempo: ' + method)); }, 25000);
      this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Error al evaluar la página.');
    return result.result.value;
  }
  close() { this.ws.close(); }
}

async function runSmoke() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const origin = new URL(baseUrl).origin;
  const output = path.resolve(__dirname, '../backups/validacion-visual');
  await fs.mkdir(output, { recursive: true });
  const target = await (await fetch('http://127.0.0.1:' + debugPort + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  let current = null, scriptId = null;
  const requests = new Map();
  const redact = value => {
    let text = String(value || '');
    for (const token of Object.values(config.tokens || {})) if (token) text = text.split(token).join('[TOKEN]');
    return text.slice(0, 1000);
  };
  cdp.on('Runtime.exceptionThrown', data => {
    if (current) current.javascript.push(redact(data.exceptionDetails?.exception?.description || data.exceptionDetails?.text));
  });
  cdp.on('Runtime.consoleAPICalled', data => {
    if (current && data.type === 'error') current.console.push(redact((data.args || []).map(arg => arg.description || arg.value || '').join(' ')));
  });
  cdp.on('Network.requestWillBeSent', data => { requests.set(data.requestId, data.request.url); });
  cdp.on('Network.responseReceived', data => {
    const response = data.response;
    if (current && response.status >= 400) current.http.push({ status: response.status, url: redact(response.url) });
  });
  cdp.on('Network.loadingFinished', data => requests.delete(data.requestId));
  cdp.on('Network.loadingFailed', data => {
    const url = requests.get(data.requestId); requests.delete(data.requestId);
    if (current && !data.canceled && url) current.network.push({ url: redact(url), error: data.errorText });
  });
  const matrix = [
    ['login.html', null],
    ['Dashboard.html', 'admin'], ['empresas.html', 'admin'], ['Auditoria.html', 'admin'], ['Administracion.html', 'admin'],
    ['RecursosHumanos.html', 'rrhh'], ['FichaIndividual.html', 'rrhh'], ['Documentos.html', 'rrhh'],
    ['Contratos.html', 'rrhh'], ['Capacitaciones.html', 'rrhh'], ['Horarios.html', 'rrhh'], ['Registros.html', 'rrhh'], ['Reportes.html', 'rrhh'],
    ['MiPanel.html', 'colaborador']
  ].filter(([file]) => !only || only.has(file));
  const results = [];
  try {
    for (const width of [1440, 768, 390]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width === 390 });
      for (const [file, role] of matrix) {
        if (scriptId) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
        const token = role ? config.tokens?.[role] : null;
        if (role && !token) throw new Error('Falta token del rol ' + role + ' en el archivo de configuración.');
        const setup = 'if(location.origin===' + JSON.stringify(origin) + '){localStorage.removeItem("sbss_usuario");localStorage.removeItem("sbss_acceso");' + (token ? 'localStorage.setItem("sbss_token",' + JSON.stringify(token) + ');' : 'localStorage.removeItem("sbss_token");') + '}';
        scriptId = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: setup })).identifier;
        requests.clear();
        current = { file, role: role || 'sin sesión', width, javascript: [], console: [], http: [], network: [], ready: false };
        const suffix = file === 'FichaIndividual.html' && config.empleadoId ? '?empleado_id=' + encodeURIComponent(config.empleadoId) : '';
        await cdp.send('Page.navigate', { url: baseUrl + '/' + file + suffix });
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline) {
          await sleep(200);
          try {
            const ready = await cdp.evaluate('document.readyState==="complete" && ' + (role ? '!!window.SBSSSession?.current && !document.documentElement.classList.contains("sbss-session-pending")' : 'true'));
            const busy = [...requests.values()].some(url => url.startsWith(origin) && url.includes('/api/'));
            if (ready && !busy) { await sleep(500); if (![...requests.values()].some(url => url.startsWith(origin) && url.includes('/api/'))) { current.ready = true; break; } }
          } catch { /* El contexto cambia durante la navegación. */ }
        }
        current.layout = await cdp.evaluate('(() => { const width=innerWidth; const out=[]; for(const e of document.querySelectorAll("main *")) { const r=e.getBoundingClientRect(); if(!r.width||!r.height||getComputedStyle(e).visibility==="hidden")continue; if(r.right<=width+12&&r.left>=-12)continue; let allowed=false; for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){if(["auto","scroll","hidden"].includes(getComputedStyle(p).overflowX)){allowed=true;break;}} if(!allowed)out.push({tag:e.tagName,id:e.id,className:String(e.className).slice(0,80),left:Math.round(r.left),right:Math.round(r.right)}); if(out.length===12)break; } return {pathname:location.pathname,title:document.title,viewport:width,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,overflow:out}; })()');
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const filename = file.replace(/\.html$/i, '') + '-' + width + '.png';
        await fs.writeFile(path.join(output, filename), Buffer.from(screenshot.data, 'base64'));
        current.screenshot = filename;
        current.ok = current.ready && !current.javascript.length && !current.console.length && !current.http.length && !current.network.length && !current.layout.overflow.length && current.layout.documentWidth <= width + 12 && current.layout.pathname.toLowerCase().endsWith('/' + file.toLowerCase());
        results.push(current);
        console.log((current.ok ? 'OK' : 'REVISAR') + ' ' + file + ' ' + width + 'px (' + current.role + ')');
        current = null;
      }
    }
  } finally {
    await fs.writeFile(path.join(output, 'resultados.json'), JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl, results }, null, 2));
    cdp.close();
    await fetch('http://127.0.0.1:' + debugPort + '/json/close/' + target.id).catch(() => {});
  }
  const failures = results.filter(result => !result.ok);
  console.log('Completado: ' + (results.length - failures.length) + '/' + results.length + ' vistas sin incidencias. Informe: ' + path.join(output, 'resultados.json'));
  if (failures.length) process.exitCode = 1;
}
if (require.main === module) runSmoke().catch(error => { console.error('No se pudo completar el smoke: ' + error.message); process.exitCode = 1; });
module.exports = { CDP, runSmoke };
