'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../controllers/horarioController.js'), 'utf8');

const rules = {
  error(message) { return Object.assign(new Error(message), { status: 400 }); },
  entero(value, name, min = 1, max = 2147483647) {
    const number = Number(value);
    if (value === '' || value == null || !Number.isInteger(number) || number < min || number > max) throw this.error(name + ' no válido.');
    return number;
  },
  hora(value, name) {
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value)) throw this.error(name + ' no válida.');
    return value.slice(0, 5) + ':00';
  }
};

function controllerWithConnection(connection) {
  const context = {
    exports: {}, console,
    process: { env: { DATABASE_URL: 'postgresql://test.invalid/db' } },
    require(name) {
      if (name === '../config/database') return { getConnection: async () => connection };
      if (name === '../services/asistenciaReglas') return rules;
      throw new Error('Dependencia no esperada: ' + name);
    }
  };
  vm.runInNewContext(source, context);
  return context.exports;
}

function makeResponse() {
  return {
    code: 200, body: null, locals: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function makeConnection(existing = []) {
  const state = { queries: [], committed: false, rolledBack: false, released: false, nextId: 900 };
  const connection = {
    async beginTransaction() {},
    async query(sql, params) {
      state.queries.push({ sql, params });
      if (sql.includes('SELECT id FROM empleados')) return [[{ id: 7 }]];
      if (sql.includes('SELECT * FROM horarios WHERE empleado_id')) return [existing];
      if (sql.startsWith('INSERT INTO horarios')) return [{ insertId: state.nextId++ }];
      if (sql.startsWith('UPDATE horarios')) return [{ affectedRows: 1 }];
      throw new Error('Consulta inesperada: ' + sql);
    },
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; }
  };
  return { connection, state };
}

test('guarda varios días nuevos en una sola transacción', async () => {
  const { connection, state } = makeConnection();
  const res = makeResponse();
  await controllerWithConnection(connection).guardarHorarioSemanal({
    body: {
      empleado_id: 7, dias: [1, 2, 3, 4, 5], hora_entrada: '08:00',
      hora_salida: '17:00', tolerancia_minutos: 5, estado: 'asignado'
    }
  }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data.length, 5);
  assert.deepEqual(Array.from(res.body.data, row => row.dia_semana), [1, 2, 3, 4, 5]);
  assert.equal(state.queries.filter(query => query.sql.startsWith('INSERT INTO horarios')).length, 5);
  assert.match(state.queries[1].sql, /dia_semana = ANY\(CAST\(\? AS integer\[\]\)\)/);
  assert.equal(state.committed, true);
  assert.equal(state.rolledBack, false);
  assert.equal(state.released, true);
});

test('actualiza los días que ya tenían horario y crea los faltantes sin duplicarlos', async () => {
  const existing = [
    { id: 101, empleado_id: 7, dia_semana: 1 },
    { id: 103, empleado_id: 7, dia_semana: 3 }
  ];
  const { connection, state } = makeConnection(existing);
  const res = makeResponse();
  await controllerWithConnection(connection).guardarHorarioSemanal({
    body: {
      empleado_id: 7, dias: [1, 2, 3], hora_entrada: '09:00',
      hora_salida: '18:00', tolerancia_minutos: 0
    }
  }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(Array.from(res.body.data, row => row.id), [101, 900, 103]);
  assert.equal(state.queries.filter(query => query.sql.startsWith('UPDATE horarios')).length, 2);
  assert.equal(state.queries.filter(query => query.sql.startsWith('INSERT INTO horarios')).length, 1);
  assert.equal(state.committed, true);
});

test('rechaza una selección vacía sin abrir una transacción', async () => {
  let connections = 0;
  const res = makeResponse();
  const context = {
    exports: {}, console, process: { env: {} },
    require(name) {
      if (name === '../config/database') return { getConnection: async () => { connections++; throw new Error('No debía conectarse'); } };
      if (name === '../services/asistenciaReglas') return rules;
      throw new Error('Dependencia no esperada: ' + name);
    }
  };
  vm.runInNewContext(source, context);
  await context.exports.guardarHorarioSemanal({
    body: { empleado_id: 7, dias: [], hora_entrada: '08:00', hora_salida: '17:00' }
  }, res);
  assert.equal(res.code, 400);
  assert.equal(connections, 0);
});
