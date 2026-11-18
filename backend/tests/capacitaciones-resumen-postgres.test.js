const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sbss_test';

const statements = [];
const fakePool = {
  async query(sql) {
    statements.push(sql);
    if (sql.includes('SELECT estado, COUNT(*) AS cantidad')) {
      return [[{ estado: 'programada', cantidad: 2 }]];
    }
    if (sql.includes('SELECT COUNT(*) AS inscritos')) {
      return [[{ inscritos: 3, aprobados: 2, desaprobados: 1 }]];
    }
    return [[]];
  }
};

const databasePath = require.resolve('../config/database');
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakePool
};

const capacitaciones = require('../services/capacitacionService');

test('el resumen califica estado de participantes para evitar columna ambigua en PostgreSQL', async () => {
  const resumen = await capacitaciones.resumen();
  const sqlParticipantes = statements.find(sql => sql.includes('SELECT COUNT(*) AS inscritos'));

  assert.ok(sqlParticipantes, 'debe ejecutarse la consulta de participantes');
  assert.match(sqlParticipantes, /CASE WHEN cp\.estado = 'aprobado'/i);
  assert.match(sqlParticipantes, /CASE WHEN cp\.estado = 'desaprobado'/i);
  assert.doesNotMatch(sqlParticipantes, /CASE WHEN\s+estado\s*=/i);
  assert.equal(resumen.programada, 2);
  assert.equal(resumen.total, 2);
  assert.equal(resumen.participantes.aprobados, 2);
});
