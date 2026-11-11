'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const controllerSource = readFileSync(resolve(__dirname, '../controllers/empresaController.js'), 'utf8');
const routeSource = readFileSync(resolve(__dirname, '../routes/empresaRoutes.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../frontend/empresas.html'), 'utf8');

function controllerWithPool(pool) {
  const context = {
    exports: {}, Buffer, console,
    process: { env: {} },
    require(moduleName) {
      if (moduleName === '../config/database') return pool;
      if (moduleName === 'node:crypto') return require('node:crypto');
      throw new Error('Dependencia no esperada: ' + moduleName);
    }
  };
  vm.runInNewContext(controllerSource, context);
  return context.exports;
}

function response() {
  return {
    code: 200, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('rechaza identificadores inválidos sin consultar la base de datos', async () => {
  let calls = 0;
  const res = response();
  await controllerWithPool({ query: async () => { calls++; return [[]]; } })
    .eliminarEmpresa({ params: { id: 'abc' } }, res);
  assert.equal(res.code, 400);
  assert.equal(calls, 0);
});

test('no elimina una empresa que tiene personal vinculado', async () => {
  const statements = [];
  const pool = {
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('SELECT id, razon_social')) return [[{ id: 3, razon_social: 'Empresa de prueba' }]];
      if (sql.includes('COUNT(*) AS total')) return [[{ total: '2' }]];
      throw new Error('No debía intentar borrar la empresa');
    }
  };
  const res = response();
  await controllerWithPool(pool).eliminarEmpresa({ params: { id: '3' } }, res);
  assert.equal(res.code, 409);
  assert.equal(res.body.codigo, 'EMPRESA_CON_PERSONAL');
  assert.equal(res.body.total_personal, 2);
  assert.equal(statements.length, 2);
});

test('elimina de la base de datos una empresa sin personal vinculado', async () => {
  const statements = [];
  const pool = {
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('SELECT id, razon_social')) return [[{ id: 5, razon_social: 'Empresa vacía' }]];
      if (sql.includes('COUNT(*) AS total')) return [[{ total: '0' }]];
      if (sql.startsWith('DELETE FROM empresas')) return [{ affectedRows: 1 }];
      throw new Error('Consulta inesperada');
    }
  };
  const res = response();
  await controllerWithPool(pool).eliminarEmpresa({ params: { id: '5' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.match(statements[2].sql, /DELETE FROM empresas WHERE id = \?/);
  assert.deepEqual(statements[2].params, [5]);
});

test('mantiene el historial si la base de datos detecta documentos u otras referencias', async () => {
  const pool = {
    query: async sql => {
      if (sql.includes('SELECT id, razon_social')) return [[{ id: 6, razon_social: 'Empresa histórica' }]];
      if (sql.includes('COUNT(*) AS total')) return [[{ total: '0' }]];
      if (sql.startsWith('DELETE FROM empresas')) throw Object.assign(new Error('foreign key'), { code: '23503' });
      throw new Error('Consulta inesperada');
    }
  };
  const res = response();
  await controllerWithPool(pool).eliminarEmpresa({ params: { id: '6' } }, res);
  assert.equal(res.code, 409);
  assert.equal(res.body.codigo, 'EMPRESA_CON_HISTORIAL');
});

test('solo el administrador puede llamar al endpoint DELETE de empresas', () => {
  assert.match(routeSource, /router\.delete\('\/:id', autorizarRoles\(ROLES\.ADMIN\), empresaController\.eliminarEmpresa\)/);
});

test('la pantalla incluye el botón, confirmación y petición DELETE a la API', () => {
  assert.match(html, /class="[^"]*deleteEmp/);
  assert.match(html, /window\.confirm\(/);
  assert.match(html, /method:\s*'DELETE'/);
  assert.ok(html.includes("fetch('/api/empresas/' + id"));
  assert.match(html, /total_personal_vinculado/);
});
