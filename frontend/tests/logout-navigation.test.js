'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function makeBrowser(logoutStatus = 200) {
  const store = new Map([
    ['sbss_token', 'token-fixture'],
    ['sbss_usuario', '{}'],
    ['sbss_acceso', '{}']
  ]);
  const sessionStore = new Map();
  const clicks = [];
  const navigations = [];
  let logoutRequests = 0;
  const localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key)
  };
  const sessionStorage = {
    getItem: key => sessionStore.get(key) ?? null,
    setItem: (key, value) => sessionStore.set(key, value),
    removeItem: key => sessionStore.delete(key)
  };
  const document = {
    readyState: 'complete',
    documentElement: { classList: { add() {}, remove() {} } },
    head: { appendChild() {} },
    createElement() { return { setAttribute() {} }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener(type, fn, capture) {
      if (type === 'click') clicks.push({ fn, capture });
    }
  };
  const location = {
    href: 'https://sbss.test/Dashboard.html',
    pathname: '/Dashboard.html',
    replace(url) { navigations.push(url); }
  };
  const fetch = async (url, options) => {
    if (String(url).endsWith('/auth/perfil')) {
      return { ok: true, status: 200, json: async () => ({
        ok: true,
        usuario: { id: 1, nombres: 'Ejemplo', apellidos: 'Prueba', rol: 'Administrador General' },
        acceso: { panel: 'Dashboard.html', modulos: ['dashboard'], permisos: [] }
      }) };
    }
    if (String(url).endsWith('/auth/logout')) {
      logoutRequests++;
      return { ok: logoutStatus === 200, status: logoutStatus };
    }
    throw new Error('Petición inesperada: ' + url);
  };
  const ctx = vm.createContext({
    window: null, document, location, localStorage, sessionStorage,
    fetch, URL, Headers, Request, AbortSignal,
    console: { warn() {} }
  });
  ctx.window = ctx;
  ctx.addEventListener = () => {};
  vm.runInContext(source('js/session.js'), ctx, { filename: 'js/session.js' });
  return {
    ctx, clicks, store, sessionStore, navigations,
    get logoutRequests() { return logoutRequests; }
  };
}

test('el botón superior y el lateral delegan en un cierre de sesión único', async () => {
  const b = makeBrowser();
  await b.ctx.SBSSSession.ready;
  assert.equal(b.clicks.length, 1);
  assert.equal(b.clicks[0].capture, true);
  for (const selector of ['#btnCerrarSesion', '[data-logout]']) {
    const element = { disabled: false, setAttribute() {} };
    const event = {
      target: { closest: pattern => pattern.includes(selector) ? element : null },
      preventDefault() {}, stopPropagation() {}
    };
    b.clicks[0].fn(event);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.logoutRequests, 1);
  assert.equal(b.store.has('sbss_token'), false);
  assert.equal(b.store.has('sbss_usuario'), false);
  assert.equal(b.store.has('sbss_acceso'), false);
  assert.deepEqual(b.navigations, ['https://sbss.test/login.html']);
  assert.equal(b.sessionStore.has('sbss_logout_warning'), false);
});

test('si el servidor devuelve error, el navegador sale y avisa que la revocación no fue confirmada', async () => {
  const b = makeBrowser(503);
  await b.ctx.SBSSSession.ready;
  const revoked = await b.ctx.SBSSSession.logout();
  assert.equal(revoked, false);
  assert.equal(b.logoutRequests, 1);
  assert.equal(b.store.has('sbss_token'), false);
  assert.deepEqual(b.navigations, ['https://sbss.test/login.html']);
  assert.match(b.sessionStore.get('sbss_logout_warning'), /no se pudo confirmar/);
});

test('el menú compartido y el panel personal incluyen un botón de cierre sin duplicar la lógica', () => {
  assert.match(source('js/navigation.js'), /data-logout/);
  assert.match(source('js/navigation.js'), /sidebar\.replaceChildren\(heading, nav, footer\)/);
  assert.match(source('MiPanel.html'), /class="sidebar-logout" type="button" data-logout/);
  assert.match(source('js/session.js'), /closest\?\.\('#btnCerrarSesion, #logoutButton, \[data-logout\]'\)/);
  assert.doesNotMatch(source('js/mi-panel.js'), /element\('logoutButton'\)\.addEventListener\('click'/);
});
