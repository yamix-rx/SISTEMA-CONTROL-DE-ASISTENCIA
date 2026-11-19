'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Fuerza el modo PostgreSQL sin abrir una conexión real.
process.env.DATABASE_URL = 'postgresql://test:test@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
const databasePath = require.resolve('../config/database');
const fakePool = { query: async () => [[]] };
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakePool
};

const { prepare } = require('../config/postgresPool');
const contrato = require('../services/contratoService')._internals;

test('la validación de solapamiento tipa la fecha opcional como DATE en PostgreSQL', async () => {
  for (const fechaFin of [null, '2026-12-31']) {
    let captured;
    const connection = {
      query: async (sql, params) => {
        captured = { sql, params };
        return [[]];
      }
    };

    await contrato.validarSolapamiento(connection, {
      estado: 'vigente',
      empleado_id: 42,
      fecha_fin: fechaFin,
      fecha_inicio: '2026-11-18'
    });

    assert.match(captured.sql, /fecha_inicio <= COALESCE\(CAST\(\? AS date\), DATE '9999-12-31'\)/);
    const sqlPostgres = prepare(captured.sql, captured.params);
    assert.match(sqlPostgres, /fecha_inicio <= COALESCE\(CAST\(\$2 AS date\), DATE '9999-12-31'\)/);
    assert.deepEqual(captured.params, [42, fechaFin, '2026-11-18']);
  }
});
