const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/accessPolicy');

// Datos aislados: ninguna consulta llega a MySQL, y las claves son fixtures.
process.env.JWT_SECRET = 'secreto-aislado-pruebas-administracion';
const roles = new Map([[1, ROLES.ADMIN], [2, ROLES.RRHH], [3, ROLES.COLABORADOR], [4, 'Perfil desconocido']]);
const copy = row => row ? { ...row } : row;
let usuarios;
let logs;
let sqlCalls;
let transacciones;
let asistencia;
let area;
let cargo;
let enUso;
const pool = {
  async query(sql, params = []) {
    sqlCalls.push({ sql, params });
    if (/INSERT INTO historial_cambios/.test(sql)) {
      logs.push({ usuario_id: params[0], tabla: params[1], id: params[2], accion: params[3],
        anterior: params[4] == null ? null : JSON.parse(params[4]), nuevos: params[5] == null ? null : JSON.parse(params[5]) });
      return [{ insertId: logs.length }];
    }
    if (/SELECT u.id AS usuario_id/.test(sql)) {
      const u = usuarios.get(params[0]);
      return [u ? [{ ...u, usuario_id: u.id, rol_nombre: roles.get(u.rol_id) }] : []];
    }
    if (/SELECT \* FROM `usuarios` WHERE id/.test(sql)) return [usuarios.has(params[0]) ? [copy(usuarios.get(params[0]))] : []];
    if (/SELECT \* FROM `areas` WHERE id/.test(sql)) return [area.id === params[0] ? [copy(area)] : []];
    if (/SELECT \* FROM `cargos` WHERE id/.test(sql)) return [cargo.id === params[0] ? [copy(cargo)] : []];
    if (/SELECT \* FROM asistencias WHERE empleado_id/.test(sql)) return [asistencia && asistencia.empleado_id === params[0] && asistencia.fecha === params[1] ? [copy(asistencia)] : []];
    if (/SELECT u.id, u.empleado_id, u.rol_id, u.email, u.activo/.test(sql)) {
      return [[...usuarios.values()].map(u => ({ id: u.id, empleado_id: u.empleado_id, rol_id: u.rol_id, email: u.email, activo: u.activo, colaborador: `Persona ${u.id}`, rol: roles.get(u.rol_id) }))];
    }
    if (/WHERE u.activo=1 AND r.nombre=/.test(sql)) return [[...usuarios.values()].filter(u => u.activo === 1 && roles.get(u.rol_id) === params[0]).map(u => ({ id: u.id }))];
    if (/SELECT id, rol_id, activo FROM usuarios WHERE id/.test(sql)) return [usuarios.has(params[0]) ? [copy(usuarios.get(params[0]))] : []];
    if (/SELECT id, nombre FROM roles WHERE id/.test(sql)) return [roles.has(params[0]) ? [{ id: params[0], nombre: roles.get(params[0]) }] : []];
    if (/SELECT id FROM empleados WHERE id/.test(sql)) return [params[0] >= 101 && params[0] <= 110 ? [{ id: params[0] }] : []];
    if (/INSERT INTO usuarios/.test(sql)) {
      if ([...usuarios.values()].some(u => u.email === params[2] || u.empleado_id === params[0])) throw Object.assign(new Error('Duplicado'), { code: 'ER_DUP_ENTRY' });
      const id = Math.max(...usuarios.keys()) + 1;
      usuarios.set(id, { id, empleado_id: params[0], rol_id: params[1], email: params[2], password: params[3], activo: 1, sesion_version: 0 });
      return [{ insertId: id }];
    }
    if (/UPDATE usuarios SET email=/.test(sql)) {
      const u = usuarios.get(params[3]);
      Object.assign(u, { email: params[0], rol_id: params[1], activo: params[2], sesion_version: u.sesion_version + 1 });
      return [{ affectedRows: 1 }];
    }
    if (/UPDATE usuarios SET password=/.test(sql)) {
      const u = usuarios.get(params[1]);
      if (!u) return [{ affectedRows: 0 }];
      Object.assign(u, { password: params[0], sesion_version: u.sesion_version + 1 });
      return [{ affectedRows: 1 }];
    }
    if (/SELECT id FROM empresas WHERE id/.test(sql)) return [[{ id: params[0] }]];
    if (/SELECT id,empresa_id FROM areas WHERE id/.test(sql)) return [params[0] === area.id ? [copy(area)] : []];
    if (/SELECT id FROM empleados WHERE area_id/.test(sql) || /SELECT id FROM empleados WHERE cargo_id/.test(sql)) return [enUso ? [{ id: 101 }] : []];
    if (/SELECT id FROM areas WHERE id/.test(sql)) return [params[0] > 0 ? [{ id: params[0] }] : []];
    if (/SELECT id,area_id FROM cargos WHERE id/.test(sql)) return [params[0] === cargo.id ? [copy(cargo)] : []];
    if (/UPDATE areas SET nombre=/.test(sql)) { Object.assign(area, { nombre: params[0], empresa_id: params[1] }); return [{ affectedRows: 1 }]; }
    if (/UPDATE cargos SET nombre=/.test(sql)) { Object.assign(cargo, { nombre: params[0], area_id: params[1] }); return [{ affectedRows: 1 }]; }
    throw new Error('Consulta no prevista: ' + sql);
  },
  async getConnection() {
    let snapshot;
    return {
      query: this.query.bind(this),
      async beginTransaction() { transacciones.inicios++; snapshot = new Map([...usuarios].map(([k, v]) => [k, copy(v)])); },
      async commit() { transacciones.confirmaciones++; },
      async rollback() { transacciones.reversiones++; usuarios = snapshot; },
      release() { transacciones.liberaciones++; }
    };
  }
};
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: pool };
const servicio = require('../services/administracionService');
const { sanitizar } = require('../services/auditoriaService');
const auditar = require('../middlewares/auditoriaMiddleware');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const app = express();
app.use(express.json());
app.use('/api/administracion', require('../routes/administracionRoutes'));
app.get('/api/session', verificarToken, (req, res) => res.json({ ok: true, usuario: req.usuario }));
const asistenciaRouter = express.Router();
asistenciaRouter.use(verificarToken, auditar, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
asistenciaRouter.post('/marcar', (req, res) => {
  asistencia = { ...asistencia, id: 401, empleado_id: req.body.empleado_id, fecha: req.body.fecha, hora_ingreso: req.body.hora_ingreso };
  res.json({ ok: true });
});
app.use('/api/asistencias', asistenciaRouter);
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
  usuarios = new Map([1, 2, 3].map(id => [id, { id, empleado_id: 100 + id, rol_id: id, email: `persona${id}@fixture.invalid`, password: 'hash-fixture-anterior', activo: 1, sesion_version: 0 }]));
  logs = []; sqlCalls = []; asistencia = null;
  transacciones = { inicios: 0, confirmaciones: 0, reversiones: 0, liberaciones: 0 };
  area = { id: 20, nombre: 'Área inicial', empresa_id: 10 };
  cargo = { id: 30, nombre: 'Cargo inicial', area_id: 20 };
  enUso = false;
});
async function request(path, { usuario = 1, sv = 0, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (usuario) headers.Authorization = `Bearer ${jwt.sign({ usuario_id: usuario, sv }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
  const result = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: result.status, body: await result.json() };
}

test('valida correo normalizado y contraseñas completas dentro del límite bcrypt', () => {
  assert.equal(servicio.correo(' Persona@Ejemplo.com '), 'persona@ejemplo.com');
  for (const email of [null, '', 'sin-arroba', 'x@y', 'x y@z.com']) assert.throws(() => servicio.correo(email), /correo válido/);
  assert.equal(servicio.validarClave('clave-válida-123'), 'clave-válida-123');
  assert.equal(servicio.validarClave('ñ'.repeat(36)), 'ñ'.repeat(36));
  for (const clave of [null, 'corta', 'a'.repeat(73), 'ñ'.repeat(37)]) assert.throws(() => servicio.validarClave(clave), /contraseña/);
});

test('auditoría oculta claves, hashes, tokens y archivos anidados conservando fecha y metadatos', () => {
  const original = { password: 'hash-secreto', detalle: [{ contraseña: 'clave-secreta', access_token: 'token-secreto', contenido_base64: 'archivo-secreto', nombre_archivo: 'dni.pdf' }], fecha: new Date('2026-09-19T12:30:00Z') };
  const seguro = sanitizar(original);
  assert.equal(seguro.password, '[OCULTO]');
  assert.equal(seguro.detalle[0].contraseña, '[OCULTO]');
  assert.equal(seguro.detalle[0].access_token, '[OCULTO]');
  assert.equal(seguro.detalle[0].contenido_base64, '[OCULTO]');
  assert.equal(seguro.detalle[0].nombre_archivo, 'dni.pdf');
  assert.equal(seguro.fecha, '2026-09-19T12:30:00.000Z');
  assert.equal(original.password, 'hash-secreto');
});

test('solo administrador gestiona cuentas y una escritura rechazada queda como DENEGADO', async () => {
  for (const usuario of [2, 3]) {
    assert.equal((await request('/api/administracion/usuarios', { usuario })).status, 403);
    const result = await request('/api/administracion/usuarios/3', { usuario, method: 'PUT', body: { email: 'cambio@fixture.invalid', rol_id: 1, activo: 1 } });
    assert.equal(result.status, 403);
    assert.equal(logs.at(-1).accion, 'DENEGADO');
    assert.equal(logs.at(-1).tabla, 'usuarios');
    assert.equal(usuarios.get(3).rol_id, 3);
  }
  assert.equal((await request('/api/administracion/usuarios', { usuario: null })).status, 401);
  assert.ok(!sqlCalls.some(q => /^UPDATE usuarios/.test(q.sql)));
});

test('crear cuenta almacena bcrypt y audita ID real sin exponer contraseña ni hash', async () => {
  const password = 'Password-fixture-123';
  const response = await request('/api/administracion/usuarios', { method: 'POST', body: { empleado_id: 104, rol_id: 3, email: ' NUEVA@FIXTURE.INVALID ', password } });
  assert.equal(response.status, 201);
  const creada = usuarios.get(response.body.id);
  assert.equal(creada.email, 'nueva@fixture.invalid');
  assert.notEqual(creada.password, password);
  assert.ok(await bcrypt.compare(password, creada.password));
  const audit = logs.at(-1);
  assert.equal(audit.accion, 'INSERT');
  assert.equal(audit.id, creada.id);
  assert.equal(audit.tabla, 'usuarios');
  assert.equal(audit.nuevos.solicitud.password, '[OCULTO]');
  assert.equal(audit.nuevos.registro.password, '[OCULTO]');
  const list = await request('/api/administracion/usuarios');
  assert.ok(list.body.data.every(u => !Object.hasOwn(u, 'password')));
  assert.ok(!JSON.stringify(audit).includes(creada.password));
});

test('rechaza cuentas con rol desconocido o colaborador inexistente sin insertarlas', async () => {
  for (const body of [{ empleado_id: 104, rol_id: 4 }, { empleado_id: 999, rol_id: 3 }]) {
    const result = await request('/api/administracion/usuarios', { method: 'POST', body: { ...body, email: 'invalido@fixture.invalid', password: 'Password-fixture-123' } });
    assert.equal(result.status, 400);
    assert.equal(logs.at(-1).accion, 'ERROR');
  }
  assert.equal(usuarios.size, 3);
});

test('cambio de perfil registra antes/después y revoca el token anterior', async () => {
  const result = await request('/api/administracion/usuarios/3', { method: 'PUT', body: { email: 'persona3@fixture.invalid', rol_id: 2, activo: 1 } });
  assert.equal(result.status, 200);
  assert.equal(usuarios.get(3).sesion_version, 1);
  const audit = logs.at(-1);
  assert.equal(audit.accion, 'UPDATE');
  assert.equal(audit.anterior.rol_id, 3);
  assert.equal(audit.nuevos.registro.rol_id, 2);
  assert.equal(audit.anterior.password, '[OCULTO]');
  assert.equal((await request('/api/session', { usuario: 3 })).status, 401);
  assert.equal((await request('/api/session', { usuario: 3, sv: 1 })).status, 200);
  assert.deepEqual(transacciones, { inicios: 1, confirmaciones: 1, reversiones: 0, liberaciones: 1 });
});

test('impide perder el acceso administrador propio y conservar cero administradores', async () => {
  for (const body of [{ email: 'persona1@fixture.invalid', rol_id: 3, activo: 1 }, { email: 'persona1@fixture.invalid', rol_id: 1, activo: 0 }]) {
    assert.equal((await request('/api/administracion/usuarios/1', { method: 'PUT', body })).status, 400);
    assert.equal(usuarios.get(1).rol_id, 1);
    assert.equal(usuarios.get(1).activo, 1);
  }
  await assert.rejects(servicio.actualizarUsuario(1, { email: 'persona1@fixture.invalid', rol_id: 3, activo: 1 }, 999), /administrador activo/);
  assert.equal(transacciones.confirmaciones, 0);
  assert.equal(transacciones.reversiones, 3);
  assert.equal(transacciones.liberaciones, 3);
});

test('restablecer contraseña audita UPDATE, oculta ambas claves y revoca sesión', async () => {
  const result = await request('/api/administracion/usuarios/3/clave', { method: 'POST', body: { password: 'Nueva-fixture-456' } });
  assert.equal(result.status, 200);
  assert.ok(await bcrypt.compare('Nueva-fixture-456', usuarios.get(3).password));
  assert.equal(logs.at(-1).accion, 'UPDATE');
  assert.equal(logs.at(-1).id, 3);
  assert.equal(logs.at(-1).anterior.password, '[OCULTO]');
  assert.equal(logs.at(-1).nuevos.registro.password, '[OCULTO]');
  assert.equal((await request('/api/session', { usuario: 3 })).status, 401);
});

test('auditoría de marcar distingue inserción de actualización y conserva horas anteriores', async () => {
  const body = { empleado_id: 101, fecha: '2026-09-19', hora_ingreso: '08:00:00', contenido_base64: 'archivo-secreto' };
  assert.equal((await request('/api/asistencias/marcar', { usuario: 2, method: 'POST', body })).status, 200);
  assert.equal(logs.at(-1).accion, 'INSERT');
  assert.equal(logs.at(-1).id, 401);
  assert.equal(logs.at(-1).tabla, 'asistencias');
  assert.equal(logs.at(-1).nuevos.solicitud.contenido_base64, '[OCULTO]');
  assert.equal((await request('/api/asistencias/marcar', { usuario: 2, method: 'POST', body: { ...body, hora_ingreso: '08:17:00' } })).status, 200);
  assert.equal(logs.at(-1).accion, 'UPDATE');
  assert.equal(logs.at(-1).anterior.hora_ingreso, '08:00:00');
  assert.equal(logs.at(-1).nuevos.registro.hora_ingreso, '08:17:00');
});

test('no permite trasladar áreas o cargos usados por personal a otra organización', async () => {
  enUso = true;
  assert.equal((await request('/api/administracion/areas/20', { method: 'PUT', body: { nombre: 'Área cambiada', empresa_id: 11 } })).status, 400);
  assert.equal(area.empresa_id, 10);
  assert.equal((await request('/api/administracion/cargos/30', { method: 'PUT', body: { nombre: 'Cargo cambiado', area_id: 21 } })).status, 400);
  assert.equal(cargo.area_id, 20);
  assert.equal((await request('/api/administracion/areas/20', { method: 'PUT', body: { nombre: 'Área renombrada', empresa_id: 10 } })).status, 200);
  assert.equal(area.nombre, 'Área renombrada');
});
