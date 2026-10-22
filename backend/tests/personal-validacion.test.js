const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
let calls, events, failSecond, savedMeta;
const base = { tipo_documento: 'DNI', numero_documento: '12345678', nombres: 'Ana', apellidos: 'Prueba',
  empresa_id: 1, area_id: 2, cargo_id: 3, fecha_ingreso: '2026-01-01', tipo_vinculo: 'practicante profesional', horas_totales_asignadas: 320 };
const pool = {
  async query(sql, params) { calls.push({ sql, params }); return [[{ area_id: 2, cargo_id: 3, empresa_id: 1 }]]; },
  async getConnection() {
    let pending = savedMeta;
    return {
      async beginTransaction() { events.push('begin'); },
      async query(sql, params) {
        calls.push({ sql, params });
        if (/SELECT id, tipo_vinculo/.test(sql)) return [[{ id: 1, tipo_vinculo: 'practicante' }]];
        if (/SELECT e\.\*/.test(sql)) return [[{ id: 1, ...base, tipo_vinculo: 'practicante', fecha_vencimiento_convenio: null }]];
        if (/INSERT INTO practicante_detalles/.test(sql)) { pending = params[1]; return [{ affectedRows: 1 }]; }
        if (/UPDATE empleados SET horas_totales_asignadas/.test(sql) && failSecond) throw Object.assign(new Error('Fallo simulado'), { code: 'TEST_META' });
        return [{ affectedRows: 1 }];
      },
      async commit() { events.push('commit'); savedMeta = pending; },
      async rollback() { events.push('rollback'); },
      release() { events.push('release'); }
    };
  }
};
const dbPath = require.resolve('../config/database');require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const personal = require('../controllers/personalController');
const response = () => ({ statusCode: 200, locals: {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
beforeEach(() => { calls = []; events = []; failSecond = false; savedMeta = 320; });
test('DNI, correo y campos superiores al tamaño SQL se rechazan antes de consultar', async () => {
  for (const body of [{ numero_documento: 'ABC' }, { numero_documento: '123456789' }, { correo_personal: 'correo-invalido' },
    { correo_personal: 'a'.repeat(110) + '@example.invalid' }, { carrera: 'a'.repeat(101) }, { nombres: 'a'.repeat(101) },
    { horas_totales_asignadas: 1000000 }, { fecha_nacimiento: '2026-02-01' }]) {
    const res = response();await personal.crearColaborador({ body: { ...base, ...body } }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body)); assert.equal(calls.length, 0);
  }
});
test('la ficha antigua conserva el vínculo practicante al editar otros campos', async () => {
  const res = response();await personal.actualizarColaborador({ params: { id: '1' }, body: { ...base, tipo_vinculo: 'practicante' } }, res);
  assert.equal(res.statusCode, 200);assert.equal(res.locals.auditoria.nuevos.tipo_vinculo, 'practicante');
  assert.deepEqual(events, ['begin','commit','release']);
});
test('un fallo en la segunda escritura de meta revierte ambas tablas', async () => {
  failSecond = true;const res = response();
  await personal.actualizarHorasPracticas({ params: { id: '1' }, body: { horas_meta: 500 } }, res);
  assert.equal(res.statusCode, 500); assert.equal(savedMeta, 320);assert.deepEqual(events, ['begin','rollback','release']);
});
test('actualizar meta válida confirma ambas tablas y admite decimales', async () => {
  const res = response();await personal.actualizarHorasPracticas({ params: { id: '1' }, body: { horas_meta: 500.25 } }, res);
  assert.equal(res.statusCode, 200);assert.equal(savedMeta, 500.25);assert.deepEqual(events, ['begin','commit','release']);
});
