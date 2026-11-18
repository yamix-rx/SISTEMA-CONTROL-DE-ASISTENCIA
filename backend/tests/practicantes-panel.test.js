'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

let calls;
const pool = {
  async query(sql, params) {
    calls.push({ sql, params });
    if (/COUNT\(\*\)::int AS total FROM practicantes/.test(sql) && !/FILTER/.test(sql)) return [[{ total: 23 }]];
    if (/FILTER/.test(sql)) return [[{ total: 55, activos: 55, completados: 1, por_completar: 2, convenios_por_vencer: 3 }]];
    return [[{ empleado_id: 1, practicante: 'Ana Prueba' }]];
  }
};
const dbPath = require.resolve('../config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const controller = require('../controllers/practicanteController');
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
beforeEach(() => { calls = []; });

test('lista practicantes desde la vista con paginación acotada', async () => {
  const res = response();
  await controller.listar({ query: { pagina: '2', limite: '500' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.paginacion.limite, 50);
  assert.equal(res.body.paginacion.pagina, 2);
  assert.equal(res.body.paginacion.paginas, 1);
  assert.match(calls[1].sql, /FROM practicantes/);
  assert.deepEqual(calls[1].params.slice(-2), [50, 50]);
});

test('los filtros viajan como parámetros y nunca se concatenan al SQL', async () => {
  const res = response();
  const buscar = "'; DROP TABLE empleados; --";
  await controller.listar({ query: { buscar, empresa_id: '3', estado: 'activo', avance: 'completado', convenio: 'por_vencer' } }, res);
  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(calls[1].sql, /DROP TABLE/);
  assert.ok(calls[1].params.includes(3));
  assert.ok(calls[1].params.includes('activo'));
  assert.equal(calls[1].params.filter(p => p === `%${buscar.toLowerCase()}%`).length, 6);
});

test('rechaza filtros no válidos con 400 sin consultar la base', async () => {
  for (const query of [{ empresa_id: 'abc' }, { estado: 'x' }, { avance: 'x' }, { convenio: 'x' }]) {
    const res = response();
    await controller.listar({ query }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(query));
  }
  assert.equal(calls.length, 0);
});

test('el resumen devuelve los cuatro indicadores del panel', async () => {
  const res = response();
  await controller.resumen({ query: { empresa_id: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body.data).sort(), ['activos', 'completados', 'convenios_por_vencer', 'por_completar', 'total']);
});

test('la ruta es de solo lectura y exige rol Administrador o RRHH', () => {
  const source = readFileSync(path.join(__dirname, '../routes/practicanteRoutes.js'), 'utf8');
  assert.match(source, /autorizarRoles\(ROLES\.ADMIN, ROLES\.RRHH\)/);
  assert.doesNotMatch(source, /router\.(post|put|patch|delete)\(/);
  assert.match(readFileSync(path.join(__dirname, '../server.js'), 'utf8'), /app\.use\('\/api\/practicantes', practicanteRoutes\)/);
});

test('el panel está en el menú lateral, protegido por el módulo personal y con la vista migrada', () => {
  const frontend = path.join(__dirname, '../../frontend');
  const nav = readFileSync(path.join(frontend, 'js/navigation.js'), 'utf8');
  assert.match(nav, /label: 'Listado Practicantes', href: 'Practicantes\.html'[^}]*module: 'personal'/);
  assert.match(readFileSync(path.join(frontend, 'js/session.js'), 'utf8'), /'practicantes\.html': 'personal'/);
  const html = readFileSync(path.join(frontend, 'Practicantes.html'), 'utf8');
  for (const pattern of [/js\/session\.js/, /css\/session\.css/, /js\/navigation\.js/, /js\/sidebar\.js/, /id="sidebarMenu"/, /id="btnAbrirSidebar"/]) assert.match(html, pattern);
  const migration = readFileSync(path.join(__dirname, '../../supabase/migrations/20261114_vista_practicantes.sql'), 'utf8');
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /REVOKE ALL ON public\.practicantes FROM anon, authenticated/);
});
