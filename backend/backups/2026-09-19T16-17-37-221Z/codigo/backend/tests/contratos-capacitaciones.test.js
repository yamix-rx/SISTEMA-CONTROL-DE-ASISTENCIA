const test = require('node:test');
const assert = require('node:assert/strict');

// Estas pruebas validan las reglas de negocio sin necesitar una base MySQL activa.
const fakePool = {
  query: async () => [[]],
  getConnection: async () => ({
    query: async () => [[]], beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {}
  })
};
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: fakePool };

const contrato = require('../services/contratoService')._internals;
const capacitacion = require('../services/capacitacionService')._internals;

test('contrato acepta un registro vigente correcto y normaliza la moneda', () => {
  const data = contrato.normalizarPayload({
    empleado_id: 3,
    tipo_contrato: 'Prácticas preprofesionales',
    fecha_inicio: '2026-09-01',
    fecha_fin: '2026-12-31',
    remuneracion: 1200,
    moneda: 'pen',
    horas_semanales: 30,
    estado: 'vigente'
  });
  assert.equal(data.empleado_id, 3);
  assert.equal(data.moneda, 'PEN');
  assert.equal(data.estado, 'vigente');
});

test('contrato rechaza fechas invertidas', () => {
  assert.throws(() => contrato.normalizarPayload({
    empleado_id: 3,
    tipo_contrato: 'Plazo fijo',
    fecha_inicio: '2026-12-01',
    fecha_fin: '2026-11-01'
  }), /fecha de fin/i);
});

test('contrato rechaza estados no permitidos', () => {
  assert.throws(() => contrato.normalizarPayload({
    empleado_id: 3,
    tipo_contrato: 'Plazo fijo',
    fecha_inicio: '2026-09-01',
    estado: 'eliminado'
  }), /Estado de contrato/i);
});

test('contrato limita horas semanales', () => {
  assert.throws(() => contrato.normalizarPayload({
    empleado_id: 3,
    tipo_contrato: 'Plazo fijo',
    fecha_inicio: '2026-09-01',
    horas_semanales: 200
  }), /horas semanales/i);
});

test('capacitación acepta modalidad virtual y valores de programación', () => {
  const data = capacitacion.normalizarPayload({
    titulo: 'Seguridad de la información',
    modalidad: 'virtual',
    fecha_inicio: '2026-09-20',
    fecha_fin: '2026-09-20',
    hora_inicio: '09:00',
    hora_fin: '12:00',
    horas: 3,
    cupo: 30,
    obligatorio: true,
    estado: 'programada'
  });
  assert.equal(data.modalidad, 'virtual');
  assert.equal(data.hora_inicio, '09:00:00');
  assert.equal(data.obligatorio, true);
});

test('capacitación rechaza una modalidad desconocida', () => {
  assert.throws(() => capacitacion.normalizarPayload({
    titulo: 'Curso', modalidad: 'remota', fecha_inicio: '2026-09-20', fecha_fin: '2026-09-20', horas: 2
  }), /Modalidad no permitida/i);
});

test('capacitación rechaza fin anterior al inicio', () => {
  assert.throws(() => capacitacion.normalizarPayload({
    titulo: 'Curso', modalidad: 'presencial', fecha_inicio: '2026-09-21', fecha_fin: '2026-09-20', horas: 2
  }), /fecha de fin/i);
});

test('capacitación rechaza porcentaje de cupo no entero o inválido', () => {
  assert.throws(() => capacitacion.normalizarPayload({
    titulo: 'Curso', modalidad: 'presencial', fecha_inicio: '2026-09-20', fecha_fin: '2026-09-20', horas: 2, cupo: 0
  }), /cupo/i);
});
