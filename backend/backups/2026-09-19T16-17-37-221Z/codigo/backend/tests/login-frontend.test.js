'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/js/login.js'), 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const available = () => json({ ok: true, servicio: 'sbss-auth' });
const accepted = () => json({ ok: true, token: 'token-ficticio', usuario: { nombres: 'Prueba' }, acceso: { panel: 'MiPanel.html' }, redirectUrl: 'MiPanel.html' });

function page(href, request) {
  const elements = new Map(), calls = [], redirects = [], storage = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set(), listeners = new Map();
      elements.set(id, { value: '', textContent: '', hidden: false, disabled: true, type: id === 'password' ? 'password' : '',
        classes, listeners, classList: { add: item => classes.add(item), remove: item => classes.delete(item) },
        setAttribute(name, value) { this[name] = value; }, addEventListener(name, handler) { listeners.set(name, handler); } });
    }
    return elements.get(id);
  }
  element('email').value = 'prueba@example.test'; element('password').value = 'clave-ficticia-para-prueba';
  const context = vm.createContext({ URL, AbortSignal, document: { getElementById: element },
    location: { href, replace: value => redirects.push(value) },
    localStorage: { setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, init) => { calls.push({ url, ...init }); return request(new URL(url), init); }
  });
  vm.runInContext(source, context);
  return { element, calls, redirects, storage,
    async submit() { let prevented = false; await element('formLogin').listeners.get('submit')({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); },
    async click(id) { await element(id).listeners.get('click')(); }
  };
}

test('inicio sin biblioteca de iconos: contraseña visible, POST y panel válido', async () => {
  const p = page('http://localhost:3000/login.html', (url, options) => options.method === 'GET' ? available() : accepted());
  await turn(); assert.equal(p.element('camposLogin').disabled, false);
  await p.click('btnTogglePassword'); assert.equal(p.element('password').type, 'text');
  await p.click('btnTogglePassword'); assert.equal(p.element('password').type, 'password');
  await p.submit();
  assert.equal(p.calls.length, 2);
  assert.equal(p.calls[0].body, undefined); assert.equal(p.calls[0].method, 'GET');
  assert.equal(p.calls[1].url, 'http://localhost:3000/api/auth/login'); assert.equal(p.calls[1].method, 'POST');
  assert.equal(p.calls[1].redirect, 'error');
  assert.deepEqual(JSON.parse(p.calls[1].body), { email: 'prueba@example.test', password: 'clave-ficticia-para-prueba' });
  assert.equal(p.storage.get('sbss_token'), 'token-ficticio');
  assert.deepEqual(p.redirects, ['http://localhost:3000/MiPanel.html']);
});

test('el envío prematuro no transmite credenciales antes de verificar el servidor', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const p = page('http://localhost:3000/login.html', () => pending);
  await p.submit(); assert.equal(p.calls.length, 1); assert.equal(p.calls[0].body, undefined);
  assert.equal(p.element('camposLogin').disabled, true);
  release(available()); await turn(); assert.equal(p.element('camposLogin').disabled, false);
});

for (const [label, origin, destination] of [
  ['Live Server local', 'http://127.0.0.1:5500/frontend/login.html', 'http://127.0.0.1:3000/login.html'],
  ['Live Server en red', 'http://sbss.local:5500/frontend/login.html', 'http://sbss.local:3000/login.html'],
  ['archivo local', 'file:///C:/proyecto/frontend/login.html', 'http://localhost:3000/login.html']
]) test(label + ': verifica y abre el servidor correcto sin enviar contraseñas', async () => {
  const p = page(origin, url => url.port === '3000' ? available() : new Response('<html>Live Server</html>', { headers: { 'Content-Type': 'text/html' } }));
  await turn(); await p.submit();
  assert.deepEqual(p.redirects, [destination]);
  assert.equal(p.element('camposLogin').disabled, true);
  assert.ok(p.calls.every(call => call.method === 'GET' && call.body === undefined && !call.url.includes('clave-ficticia')));
  assert.ok(p.calls.every(call => call.credentials === 'omit'));
  assert.equal(p.storage.size, 0);
});

test('servidor apagado muestra enlace y permite volver a comprobar sin mandar claves', async () => {
  let online = false;
  const p = page('file:///C:/proyecto/login.html', () => { if (online) return available(); throw new TypeError('Failed to fetch'); });
  await turn(); await p.submit();
  assert.equal(p.element('camposLogin').disabled, true); assert.equal(p.element('btnReintentarConexion').hidden, false);
  assert.equal(p.element('enlaceServidor').href, 'http://localhost:3000/login.html');
  assert.match(p.element('mensajeConexion').textContent, /No se pudo conectar/);
  online = true; await p.click('btnReintentarConexion');
  assert.deepEqual(p.redirects, ['http://localhost:3000/login.html']);
  assert.ok(p.calls.every(call => call.method === 'GET' && call.body === undefined));
});

test('un backend en otro puerto conserva su origen verificado', async () => {
  const p = page('http://127.0.0.1:3101/login.html', (url, options) => options.method === 'GET' ? available() : accepted());
  await turn(); await p.submit();
  assert.ok(p.calls.every(call => new URL(call.url).port === '3101'));
  assert.deepEqual(p.redirects, ['http://127.0.0.1:3101/MiPanel.html']);
});

for (const [label, response, message] of [
  ['credenciales rechazadas', () => json({ ok: false, mensaje: 'Credenciales inválidas.' }, 401), /Credenciales inválidas/],
  ['error 500 JSON', () => json({ ok: false, mensaje: 'Error interno en el servidor.' }, 500), /Error interno/],
  ['respuesta HTML', () => new Response('<html>Error</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }), /respuesta inesperada/],
  ['JSON mal formado', () => new Response('{', { headers: { 'Content-Type': 'application/json' } }), /respuesta no válida/],
  ['panel ajeno', () => json({ ok: true, token: 'ficticio', usuario: {}, acceso: { panel: 'https://otro.example/' }, redirectUrl: 'https://otro.example/' }), /panel habilitado/]
]) test(label + ': error comprensible sin guardar sesión ni navegar', async () => {
  const p = page('http://localhost:3000/login.html', (url, options) => options.method === 'GET' ? available() : response());
  await turn(); await p.submit();
  assert.match(p.element('mensajeError').textContent, message);
  assert.equal(p.element('btnIngresar').disabled, false);
  assert.equal(p.element('btnIngresar').textContent, 'INGRESAR');
  assert.equal(p.storage.size, 0); assert.equal(p.redirects.length, 0);
  assert.equal(p.calls.filter(call => call.method === 'POST').length, 1);
});

test('HTML inicial impide envío nativo y ya no requiere scripts de CDN', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../frontend/login.html'), 'utf8');
  assert.match(html, /<form id="formLogin" method="post">/);
  assert.match(html, /<fieldset id="camposLogin" disabled>/);
  assert.doesNotMatch(html, /lucide|<script[^>]+src="https?:/);
  assert.match(html, /<script src="js\/login\.js"><\/script>/);
});
