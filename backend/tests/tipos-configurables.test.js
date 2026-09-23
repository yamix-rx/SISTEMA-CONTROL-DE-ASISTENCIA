const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { ROLES } = require('../config/accessPolicy');

// Datos aislados: ninguna consulta llega a MySQL.
process.env.JWT_SECRET = 'secreto-aislado-pruebas-tipos';
const roles = new Map([[1, ROLES.ADMIN], [2, ROLES.RRHH]]);
const copy = row => row ? { ...row } : row;
let usuarios;
let logs;
let tiposDocumento;
let tiposPermiso;
const pool = {
  async query(sql, params = []) {
    if (/INSERT INTO historial_cambios/.test(sql)) {
      logs.push({ usuario_id: params[0], tabla: params[1], id: params[2], accion: params[3] });
      return [{ insertId: logs.length }];
    }
    if (/SELECT u.id AS usuario_id/.test(sql)) {
      const u = usuarios.get(params[0]);
      return [u ? [{ ...u, usuario_id: u.id, rol_nombre: roles.get(u.rol_id) }] : []];
    }
    if (/SELECT \* FROM `tipo_documentos` WHERE id/.test(sql)) return [tiposDocumento.has(params[0]) ? [copy(tiposDocumento.get(params[0]))] : []];
    if (/SELECT \* FROM `tipo_permisos` WHERE id/.test(sql)) return [tiposPermiso.has(params[0]) ? [copy(tiposPermiso.get(params[0]))] : []];
    if (/SELECT id FROM tipo_documentos WHERE id=/.test(sql)) return [tiposDocumento.has(params[0]) ? [{ id: params[0] }] : []];
    if (/SELECT id FROM tipo_permisos WHERE id=/.test(sql)) return [tiposPermiso.has(params[0]) ? [{ id: params[0] }] : []];
    // catalogos(): consultas de acompañamiento que no son el foco de esta prueba.
    if (/SELECT id, nombre FROM roles ORDER BY id/.test(sql)) return [[...roles].map(([id, nombre]) => ({ id, nombre }))];
    if (/CONCAT\(e\.nombres, ' ', e\.apellidos\) AS nombre, e\.numero_documento/.test(sql)) return [[]];
    if (/SELECT id, razon_social, estado FROM empresas ORDER BY razon_social/.test(sql)) return [[]];
    if (/SELECT a\.id, a\.nombre, a\.empresa_id, e\.razon_social AS empresa FROM areas/.test(sql)) return [[]];
    if (/SELECT c\.id, c\.nombre, c\.area_id, a\.nombre AS area, a\.empresa_id FROM cargos/.test(sql)) return [[]];
    if (/SELECT id, nombre, descripcion, es_obligatorio FROM tipo_documentos ORDER BY es_obligatorio DESC, nombre/.test(sql)) return [[...tiposDocumento.values()].sort((a, b) => b.es_obligatorio - a.es_obligatorio || a.nombre.localeCompare(b.nombre))];
    if (/SELECT id, nombre FROM tipo_permisos ORDER BY nombre/.test(sql)) return [[...tiposPermiso.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))];
    // guardarTipoDocumento
    if (/UPDATE tipo_documentos SET nombre=/.test(sql)) {
      const t = tiposDocumento.get(params[3]);
      if (!t) return [{ affectedRows: 0 }];
      Object.assign(t, { nombre: params[0], descripcion: params[1], es_obligatorio: params[2] });
      return [{ affectedRows: 1 }];
    }
    if (/INSERT INTO tipo_documentos \(nombre,descripcion,es_obligatorio\)/.test(sql)) {
      if ([...tiposDocumento.values()].some(t => t.nombre === params[0])) throw Object.assign(new Error('Duplicado'), { code: 'ER_DUP_ENTRY' });
      const id = Math.max(0, ...tiposDocumento.keys()) + 1;
      tiposDocumento.set(id, { id, nombre: params[0], descripcion: params[1], es_obligatorio: params[2] });
      return [{ insertId: id }];
    }
    // guardarTipoPermiso
    if (/UPDATE tipo_permisos SET nombre=/.test(sql)) {
      const t = tiposPermiso.get(params[1]);
      if (!t) return [{ affectedRows: 0 }];
      Object.assign(t, { nombre: params[0] });
      return [{ affectedRows: 1 }];
    }
    if (/INSERT INTO tipo_permisos \(nombre\)/.test(sql)) {
      if ([...tiposPermiso.values()].some(t => t.nombre === params[0])) throw Object.assign(new Error('Duplicado'), { code: 'ER_DUP_ENTRY' });
      const id = Math.max(0, ...tiposPermiso.keys()) + 1;
      tiposPermiso.set(id, { id, nombre: params[0] });
      return [{ insertId: id }];
    }
    throw new Error('Consulta no prevista: ' + sql);
  }
};
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: pool };
const servicio = require('../services/administracionService');
const app = express();
app.use(express.json());
app.use('/api/administracion', require('../routes/administracionRoutes'));
app.use((error, req, res, next) => res.status(500).json({ ok: false, mensaje: error.message }));
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  usuarios = new Map([
    [1, { id: 1, rol_id: 1, activo: 1, sesion_version: 0 }],
    [2, { id: 2, rol_id: 2, activo: 1, sesion_version: 0 }]
  ]);
  logs = [];
  tiposDocumento = new Map([[1, { id: 1, nombre: 'DNI', descripcion: null, es_obligatorio: 1 }]]);
  tiposPermiso = new Map([[1, { id: 1, nombre: 'Personal' }]]);
});
async function request(path, { usuario = 1, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (usuario) headers.Authorization = `Bearer ${jwt.sign({ usuario_id: usuario, sv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
  const result = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: result.status, body: await result.json() };
}

test('el catálogo de administración incluye tipos de documento y de permiso', async () => {
  const result = await request('/api/administracion/catalogos');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.tiposDocumento.map(t => t.nombre), ['DNI']);
  assert.deepEqual(result.body.data.tiposPermiso.map(t => t.nombre), ['Personal']);
});

test('RR. HH. no puede administrar tipos, solo el administrador general', async () => {
  const crear = await request('/api/administracion/tipos-documento', { usuario: 2, method: 'POST', body: { nombre: 'Certificado', es_obligatorio: 0 } });
  assert.equal(crear.status, 403);
  assert.equal(tiposDocumento.size, 1);
});

test('crea un tipo de documento obligatorio y lo audita como INSERT', async () => {
  const result = await request('/api/administracion/tipos-documento', { method: 'POST', body: { nombre: 'Certificado médico', descripcion: 'Vigencia anual', es_obligatorio: 1 } });
  assert.equal(result.status, 201);
  const creado = tiposDocumento.get(result.body.id);
  assert.equal(creado.nombre, 'Certificado médico');
  assert.equal(creado.es_obligatorio, 1);
  assert.equal(logs.at(-1).accion, 'INSERT');
  assert.equal(logs.at(-1).tabla, 'tipo_documentos');
});

test('edita un tipo de documento existente y lo audita como UPDATE', async () => {
  const result = await request('/api/administracion/tipos-documento/1', { method: 'PUT', body: { nombre: 'DNI vigente', descripcion: null, es_obligatorio: 1 } });
  assert.equal(result.status, 200);
  assert.equal(tiposDocumento.get(1).nombre, 'DNI vigente');
  assert.equal(logs.at(-1).accion, 'UPDATE');
});

test('rechaza un tipo de documento duplicado con 409', async () => {
  const result = await request('/api/administracion/tipos-documento', { method: 'POST', body: { nombre: 'DNI', es_obligatorio: 0 } });
  assert.equal(result.status, 409);
  assert.equal(tiposDocumento.size, 1);
});

test('rechaza un nombre vacío o un valor de obligatorio no válido', async () => {
  for (const body of [{ nombre: '  ', es_obligatorio: 0 }, { nombre: 'Otro', es_obligatorio: 'tal vez' }]) {
    const result = await request('/api/administracion/tipos-documento', { method: 'POST', body });
    assert.equal(result.status, 400);
  }
  assert.equal(tiposDocumento.size, 1);
});

test('crea y edita un tipo de permiso, y lo audita', async () => {
  const creado = await request('/api/administracion/tipos-permiso', { method: 'POST', body: { nombre: 'Maternidad' } });
  assert.equal(creado.status, 201);
  assert.equal(logs.at(-1).tabla, 'tipo_permisos');
  assert.equal(logs.at(-1).accion, 'INSERT');
  const editado = await request(`/api/administracion/tipos-permiso/${creado.body.id}`, { method: 'PUT', body: { nombre: 'Licencia por maternidad' } });
  assert.equal(editado.status, 200);
  assert.equal(tiposPermiso.get(creado.body.id).nombre, 'Licencia por maternidad');
  assert.equal(logs.at(-1).accion, 'UPDATE');
});

test('rechaza un tipo de permiso duplicado con 409', async () => {
  const result = await request('/api/administracion/tipos-permiso', { method: 'POST', body: { nombre: 'Personal' } });
  assert.equal(result.status, 409);
  assert.equal(tiposPermiso.size, 1);
});

test('el servicio expone las funciones de guardado como exports invocables', () => {
  assert.equal(typeof servicio.guardarTipoDocumento, 'function');
  assert.equal(typeof servicio.guardarTipoPermiso, 'function');
});
