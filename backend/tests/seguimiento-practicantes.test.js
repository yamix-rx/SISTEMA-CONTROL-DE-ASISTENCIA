'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filtrarSeguimientoPracticas } = require('../services/seguimientoPracticas');

test('muestra sólo practicantes desde el 80 % y quienes completaron su meta', () => {
  const rows = [
    { empleado_id: 1, horas_meta: 100, horas_realizadas: 79.99 },
    { empleado_id: 2, horas_meta: 100, horas_realizadas: 80 },
    { empleado_id: 3, horas_meta: 100, horas_realizadas: 99.99 },
    { empleado_id: 4, horas_meta: 100, horas_realizadas: 100 },
    { empleado_id: 5, horas_meta: 100, horas_realizadas: 125 },
    { empleado_id: 6, horas_meta: 320, horas_realizadas: 255.99 },
    { empleado_id: 7, horas_meta: 320, horas_realizadas: 256 }
  ];
  assert.deepEqual(
    filtrarSeguimientoPracticas(rows).map(row => row.empleado_id),
    [2, 3, 4, 5, 7]
  );
});

test('no incluye metas nulas, cero, negativas ni valores no numéricos', () => {
  const rows = [
    { empleado_id: 1, horas_meta: 0, horas_realizadas: 50 },
    { empleado_id: 2, horas_meta: -100, horas_realizadas: 90 },
    { empleado_id: 3, horas_meta: null, horas_realizadas: 50 },
    { empleado_id: 4, horas_meta: 100, horas_realizadas: null },
    { empleado_id: 5, horas_meta: 'no disponible', horas_realizadas: 100 }
  ];
  assert.deepEqual(filtrarSeguimientoPracticas(rows), []);
  assert.deepEqual(filtrarSeguimientoPracticas(null), []);
});
