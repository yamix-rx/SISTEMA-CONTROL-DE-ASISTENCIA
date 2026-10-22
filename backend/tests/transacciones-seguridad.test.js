const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const transactionPool = require('../config/transactionPool');
const { ROLES } = require('../config/accessPolicy');
let state, failAudit, connections;
const clone = value => structuredClone(value);
function queryState(data, sql, params = []) {
  if (/SELECT u.id AS usuario_id/.test(sql)) return [[{ usuario_id: 1, empleado_id: 1, activo: 1, rol_nombre: ROLES.ADMIN, sesion_version: data.version }]];
  if (/SELECT \* FROM `empleados`/.test(sql)) return [[{ id: 1, observaciones_rrhh: data.note }]];
  if (/SELECT \* FROM `usuarios`/.test(sql)) return [[{ id: 1, sesion_version: data.version }]];
  if (/UPDATE empleados/.test(sql)) { data.note = params[0]; return [{ affectedRows: 1 }]; }
  if (/UPDATE usuarios SET sesion_version/.test(sql)) { data.version++; return [{ affectedRows: 1 }]; }
  if (/INSERT INTO historial_cambios/.test(sql)) {
    if (failAudit) throw Object.assign(new Error('Auditoría no disponible'), { code: 'AUDIT_TEST' });
    data.logs.push(params); return [{ insertId: data.logs.length }];
  }
  throw new Error('Consulta no esperada: ' + sql);
}
const underlying = {
  async query(sql, params) { return queryState(state, sql, params); },
  async getConnection() {
    let local = clone(state); const events = []; connections.push(events);
    return {
      async beginTransaction() { events.push('begin'); },
      async query(sql, params) { return queryState(local, sql, params); },
      async commit() { events.push('commit'); state = clone(local); },
      async rollback() { events.push('rollback'); },
      release() { events.push('release'); }
    };
  }
};
const db = transactionPool(underlying), dbPath = require.resolve('../config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
process.env.JWT_SECRET = 'clave-aislada-para-pruebas-de-revocacion';
const audit = require('../middlewares/auditoriaMiddleware');
const app = express(); app.use(express.json());
app.use('/api/auth', require('../routes/authRoutes'));
app.use('/api/personal', (req, res, next) => { req.usuario = { id: 1, rol: ROLES.ADMIN }; next(); }, audit);
app.patch('/api/personal/:id/observaciones', async (req, res) => {
  // Reproduce un servicio que ya usa su propia transacción.
  const c = await db.getConnection();
  await c.beginTransaction(); await c.query('UPDATE empleados SET observaciones_rrhh=? WHERE id=?', [req.body.note, 1]);
  await c.commit(); c.release(); res.json({ ok: true });
});
app.use((error, req, res, next) => res.status(503).json({ ok: false }));
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); });
beforeEach(() => { state = { note: 'Original', version: 0, logs: [] }; failAudit = false; connections = []; });

test('la escritura y su auditoría se confirman juntas usando una sola conexión', async () => {
  const response = await fetch(base + '/api/personal/1/observaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'Corregido' }) });
  assert.equal(response.status, 200); assert.equal(state.note, 'Corregido'); assert.equal(state.logs.length, 1);
  assert.deepEqual(connections, [['begin', 'commit', 'release']]);
  assert.equal(JSON.parse(state.logs[0][4]).observaciones_rrhh, 'Original');
});
test('si falla auditoría se revierte el cambio y no se devuelve éxito', async () => {
  failAudit = true;
  const response = await fetch(base + '/api/personal/1/observaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'No debe persistir' }) });
  assert.equal(response.status, 503); assert.equal(state.note, 'Original'); assert.equal(state.logs.length, 0);
  assert.deepEqual(connections, [['begin', 'rollback', 'release']]);
});
test('cerrar sesión revoca el JWT anterior y registra la operación', async () => {
  const token = jwt.sign({ usuario_id: 1, sv: 0 }, process.env.JWT_SECRET);
  const headers = { Authorization: 'Bearer ' + token };
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers })).status, 200);
  assert.equal(state.version, 1); assert.equal(state.logs.length, 1);
  assert.equal((await fetch(base + '/api/auth/perfil', { headers })).status, 401);
});
test('fallo al auditar cierre de sesión conserva la sesión y devuelve error recuperable', async () => {
  failAudit = true;
  const token = jwt.sign({ usuario_id: 1, sv: 0 }, process.env.JWT_SECRET), headers = { Authorization: 'Bearer ' + token };
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers })).status, 503);
  assert.equal(state.version, 0); assert.equal((await fetch(base + '/api/auth/perfil', { headers })).status, 200);
});
test('limitador bloquea intentos repetidos y permite reintentar al vencer la ventana', () => {
  let now = 0, next = 0;
  const limiter = require('../middlewares/loginLimiter').crearLimitador({ limite: 2, ventanaMs: 1000, ahora: () => now });
  const res = () => ({ statusCode: 200, once() {}, set(key, value) { this[key] = value; }, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
  const req = { ip: '127.0.0.1', body: { email: 'test@example.invalid' } };
  limiter(req, res(), () => next++); limiter(req, res(), () => next++);
  const denied = res(); limiter(req, denied, () => next++);
  assert.equal(denied.statusCode, 429); assert.equal(next, 2); assert.equal(denied['Retry-After'], '1');
  now = 1001; limiter(req, res(), () => next++); assert.equal(next, 3);
});
test('el reporte mantiene 99,9 % hasta cumplir realmente la meta', () => {
  const { construirReporte } = require('../controllers/reporteController');
  const report = hours => construirReporte([{ empleado_id: 1, horas_meta: 320 }], [], [{ empleado_id: 1, horas_acumuladas: hours }], []).detalles[0];
  assert.equal(report(319.99).porcentaje_avance, 99.9); assert.equal(report(319.99).horas_pendientes, 0.01);
  assert.equal(report(320).porcentaje_avance, 100);
});
