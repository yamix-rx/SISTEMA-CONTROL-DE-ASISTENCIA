'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const controllerSource = readFileSync(resolve(__dirname, '../controllers/empresaController.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../frontend/empresas.html'), 'utf8');
function controllerWithPool(pool) {
  const context = { exports: {}, Buffer, console, process: { env: { DATABASE_URL: 'postgresql://test' } },
    require(moduleName) {
      if (moduleName === '../config/database') return pool;
      if (moduleName === 'node:crypto') return require('node:crypto');
      throw new Error('Dependencia no esperada: ' + moduleName);
    } };
  vm.runInNewContext(controllerSource, context);
  return context.exports;
}
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test('La consulta de empresas obtiene teléfono y correo reales, no valores NULL artificiales', async () => {
  let sql = '';
  const pool = { query: async text => { sql = text; return [[{ id: 1, razon_social: 'SBSS', telefono: '+51 999 888 777',
    email_contacto: 'contacto@sbss.example', total_empleados: 0 }]]; } };
  const res = response();
  await controllerWithPool(pool).listarEmpresas({}, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data[0].telefono, '+51 999 888 777');
  assert.equal(res.body.data[0].email_contacto, 'contacto@sbss.example');
  assert.match(sql, /e\.telefono,/);
  assert.match(sql, /e\.email_contacto,/);
  assert.doesNotMatch(sql, /NULL AS telefono|NULL AS email_contacto/);
});
test('Al crear empresa se guardan ambos contactos opcionales y se normaliza el email', async () => {
  let sql = '', params = [];
  const pool = { query: async (text, values) => { sql = text; params = values; return [{ insertId: 22 }]; } };
  const res = response();
  await controllerWithPool(pool).guardarEmpresa({ body: { razon_social: '  Empresa de prueba  ', ruc: '20123456789',
    direccion: 'Av. Lima', telefono: ' +51 987 654 321 ', email_contacto: ' Contacto@EMPRESA.COM ', estado: 'activo' } }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.id, 22);
  assert.match(sql, /INSERT INTO empresas \(razon_social, ruc, direccion, telefono, email_contacto, estado\)/);
  assert.equal(params[3], '+51 987 654 321');
  assert.equal(params[4], 'contacto@empresa.com');
});
test('Una empresa puede guardarse sin correo ni teléfono', async () => {
  let values = [];
  const pool = { query: async (sql, params) => { values = params; return [{ insertId: 14 }]; } };
  const res = response();
  await controllerWithPool(pool).guardarEmpresa({ body: { razon_social: 'Empresa sin contacto' } }, res);
  assert.equal(res.code, 201);
  assert.equal(values[3], null);
  assert.equal(values[4], null);
});
test('Editar una empresa actualiza el contacto sin eliminar otros campos', async () => {
  let sql = '', values = [];
  const pool = { query: async (text, params) => { sql = text; values = params; return [{ affectedRows: 1 }]; } };
  const res = response();
  await controllerWithPool(pool).guardarEmpresa({ body: {
    id: 2, razon_social: 'Empresa editada', telefono: '(01) 555-6677', email_contacto: 'soporte@empresa.com' } }, res);
  assert.equal(res.code, 200);
  assert.match(sql, /telefono = \?, email_contacto = \?/);
  assert.equal(values[3], '(01) 555-6677');
  assert.equal(values[4], 'soporte@empresa.com');
});
for (const invalid of [
  { telefono: 'texto-malicioso' },
  { telefono: '123' },
  { email_contacto: 'sin-arroba' },
  { email_contacto: 'a'.repeat(121) + '@b.com' },
  { email_contacto: 100 }
]) test('Se rechaza información de contacto inválida: ' + JSON.stringify(invalid).slice(0,45), async () => {
  let calls = 0;
  const res = response();
  await controllerWithPool({ query: async () => { calls++; return []; } }).guardarEmpresa({
    body: { razon_social: 'Empresa', ...invalid } }, res);
  assert.equal(res.code, 400);
  assert.equal(calls, 0);
});
test('Formulario habilita contactos opcionales y no muestra No disponible', () => {
  assert.match(html, /id="mTelefono" type="tel"[^>]*maxlength="20"/);
  assert.match(html, /id="mEmail" type="email"[^>]*maxlength="120"/);
  assert.doesNotMatch(html, /id="m(?:Email|Telefono)"[^>]*disabled/);
  assert.match(html, /telefono:\s*document.getElementById\('mTelefono'\)/);
  assert.match(html, /email_contacto:\s*document.getElementById\('mEmail'\)/);
  assert.match(html, /escapeHtml\(e\.telefono\)/);
  assert.match(html, /escapeHtml\(e\.email_contacto\)/);
});
