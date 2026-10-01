const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Controladores reales y una conexión transaccional simulada: nunca se abre MySQL.
let consultas, eventos, anterior, fallarDetalle;
const base = { numero_documento: '12345678', nombres: 'Ana', apellidos: 'Prueba', empresa_id: 1, area_id: 2, cargo_id: 3,
  fecha_ingreso: '2026-09-01', fecha_finalizacion: '2026-12-31', tipo_vinculo: 'practicante profesional', estado: 'activo', horas_totales_asignadas: 320 };
const pool = {
  async query(sql, params = []) {
    consultas.push({ sql, params });
    if (sql.includes('FOR UPDATE')) return [[{ id: 7, ...base, ...anterior }]];
    if (sql.includes('INNER JOIN cargos c ON c.id = ?')) return [[{ area_id: 2, empresa_id: 1, cargo_id: 3 }]];
    if (/INSERT INTO empleados/.test(sql)) return [{ insertId: 7 }];
    if (/INSERT INTO practicante_detalles/.test(sql) && fallarDetalle) throw Object.assign(new Error('Detalle no guardado'), { code: 'FIXTURE' });
    if (/FROM practicante_detalles pd/.test(sql)) return [[{ empleado_id: 7, colaborador: 'Ana Prueba', puesto: 'Analista en formación', fecha_vencimiento_convenio: '2026-09-30', dias_restantes: 11 }]];
    return [[]];
  },
  async getConnection() {
    return { query: pool.query, beginTransaction: async () => eventos.push('begin'), commit: async () => eventos.push('commit'),
      rollback: async () => eventos.push('rollback'), release: () => eventos.push('release') };
  }
};
const dbPath = require.resolve('../config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const personal = require('../controllers/personalController');
const dashboard = require('../controllers/dashboardController');
const contratos = require('../services/contratoService');
const response = () => ({ locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (cambios = {}) => ({ params: { id: '7' }, body: { ...base, ...cambios } });
beforeEach(() => {
  consultas = []; eventos = []; fallarDetalle = false;
  anterior = { puesto: 'Analista anterior', fecha_vencimiento_convenio: '2026-10-15' };
});

test('el alta guarda puesto separado del cargo y convenio distinto a la finalización; ambos quedan en auditoría', async () => {
  const res = response();
  await personal.crearColaborador(request({ puesto: '  Analista en formación  ', fecha_vencimiento_convenio: '2026-09-30' }), res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(eventos, ['begin', 'commit', 'release']);
  const empleado = consultas.find(q => /INSERT INTO empleados/.test(q.sql));
  assert.equal((empleado.sql.match(/\?/g) || []).length, empleado.params.length);
  assert.equal(empleado.params[12], 3);
  assert.equal(empleado.params.at(-1), 'Analista en formación');
  assert.deepEqual(consultas.find(q => /INSERT INTO practicante_detalles/.test(q.sql)).params, [7, 320, '2026-09-30']);
  assert.equal(res.locals.auditoria.registroId, 7);
  assert.equal(res.locals.auditoria.nuevos.fecha_vencimiento_convenio, '2026-09-30');
  assert.equal(res.locals.auditoria.nuevos.fecha_finalizacion, '2026-12-31');
});

test('el alta sin convenio conserva null aunque haya finalización, y admite fecha igual al ingreso', async () => {
  for (const fecha of [undefined, null, '', base.fecha_ingreso]) {
    consultas = [];
    const res = response();
    await personal.crearColaborador(request({ fecha_vencimiento_convenio: fecha }), res);
    assert.equal(res.statusCode, 201);
    assert.equal(consultas.find(q => /INSERT INTO practicante_detalles/.test(q.sql)).params[2], fecha || null);
    assert.equal(consultas.find(q => /INSERT INTO empleados/.test(q.sql)).params.at(-1), null);
  }
});

test('rechaza convenio inválido, anterior al ingreso o puesto inválido sin hacer escrituras', async () => {
  for (const cambios of [
    { fecha_vencimiento_convenio: '2026-02-30' }, { fecha_vencimiento_convenio: '2026-08-31' },
    { fecha_vencimiento_convenio: '2026-09-30T12:00:00Z' }, { fecha_vencimiento_convenio: 20260930 },
    { fecha_vencimiento_convenio: false }, { puesto: 'x'.repeat(151) }, { puesto: 12 }, { puesto: {} },
    { tipo_vinculo: 'trabajador', fecha_vencimiento_convenio: '2026-10-15' }
  ]) {
    for (const operation of [personal.crearColaborador, personal.actualizarColaborador]) {
      const res = response(); await operation(request(cambios), res);
      assert.equal(res.statusCode, 400, JSON.stringify(cambios));
    }
  }
  assert.equal(consultas.length, 0);
  assert.equal(eventos.length, 0);
});

test('actualizar campos ajenos conserva puesto y vencimiento omitidos, incluyendo antes/después de auditoría', async () => {
  const res = response(); await personal.actualizarColaborador(request({ telefono: '999888777' }), res);
  assert.equal(res.statusCode, 200);
  const empleado = consultas.find(q => /^UPDATE empleados/.test(q.sql));
  assert.equal((empleado.sql.match(/\?/g) || []).length, empleado.params.length);
  assert.deepEqual(empleado.params.slice(-2), ['Analista anterior', 7]);
  assert.deepEqual(consultas.find(q => /INSERT INTO practicante_detalles/.test(q.sql)).params, [7, 320, '2026-10-15']);
  assert.equal(res.locals.auditoria.anterior.fecha_vencimiento_convenio, '2026-10-15');
  assert.equal(res.locals.auditoria.nuevos.fecha_vencimiento_convenio, '2026-10-15');
});

test('edición permite modificar y borrar explícitamente puesto/convenio, sin cambiar cargo', async () => {
  for (const [puesto, fecha, esperadoPuesto] of [['Nuevo puesto', '2026-11-01', 'Nuevo puesto'], ['', null, null], [null, '', null]]) {
    consultas = [];
    const res = response(); await personal.actualizarColaborador(request({ puesto, fecha_vencimiento_convenio: fecha }), res);
    assert.equal(res.statusCode, 200);
    const empleado = consultas.find(q => /^UPDATE empleados/.test(q.sql));
    assert.equal(empleado.params[12], 3);
    assert.equal(empleado.params.at(-2), esperadoPuesto);
    assert.equal(consultas.find(q => /INSERT INTO practicante_detalles/.test(q.sql)).params[2], fecha || null);
  }
});

test('cambiar a trabajador conserva el historial de prácticas y nunca borra el convenio omitido', async () => {
  const res = response(); await personal.actualizarColaborador(request({ tipo_vinculo: 'trabajador' }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(!consultas.some(q => /(?:INSERT INTO|UPDATE|DELETE FROM) practicante_detalles/.test(q.sql)));
  assert.equal(res.locals.auditoria.nuevos.fecha_vencimiento_convenio, '2026-10-15');
});

test('cambiar ingreso más allá del convenio conservado se rechaza y revierte antes de escribir', async () => {
  const res = response(); await personal.actualizarColaborador(request({ fecha_ingreso: '2026-11-01' }), res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(eventos, ['begin', 'rollback', 'release']);
  assert.ok(!consultas.some(q => /^UPDATE empleados/.test(q.sql)));
});

test('un fallo al guardar convenio revierte también la edición del puesto', async () => {
  fallarDetalle = true;
  const res = response(); await personal.actualizarColaborador(request({ puesto: 'Cambio', fecha_vencimiento_convenio: '2026-11-01' }), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(eventos, ['begin', 'rollback', 'release']);
  assert.ok(consultas.some(q => /^UPDATE empleados/.test(q.sql)));
  assert.equal(res.locals.auditoria, undefined);
});

test('alertas de convenio existen sin contratos y filtran practicantes activos, empresa y ventana inclusiva de 0 a 30 días', async () => {
  const res = response(); await dashboard.obtenerDatosDashboard({ query: { empresa_id: '2' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.contratosPorVencer, []);
  assert.equal(res.body.conveniosPorVencer.length, 1);
  assert.equal(res.body.conveniosPorVencer[0].dias_restantes, 11);
  const query = consultas.find(q => /FROM practicante_detalles pd/.test(q.sql));
  assert.match(query.sql, /e.estado='activo'/);
  assert.match(query.sql, /LOWER\(e.tipo_vinculo\) LIKE 'practicante%'/);
  assert.match(query.sql, /pd.fecha_vencimiento_convenio BETWEEN CURDATE\(\) AND DATE_ADD\(CURDATE\(\), INTERVAL 30 DAY\)/);
  assert.match(query.sql, /e.empresa_id = \?/);
  assert.ok(!/contratos|fecha_finalizacion/.test(query.sql));
  assert.deepEqual(query.params, ['2']);
});

test('listado filtra ambos tipos de practicante y permite buscar puesto sin interpolar el texto', async () => {
  const buscar = "Analista' OR 1=1 --";
  const res = response(); await personal.listarColaboradores({ query: { tipo_vinculo: ' Practicante ', buscar } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(consultas[0].sql, /LOWER\(e.tipo_vinculo\) LIKE 'practicante%'/);
  assert.match(consultas[0].sql, /e.puesto LIKE \?/);
  assert.ok(!consultas[0].sql.includes(buscar));
  assert.ok(consultas[0].params.every(p => p === `%${buscar}%`));
  const invalid = response(); await personal.listarColaboradores({ query: { tipo_vinculo: 'desconocido' } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('catálogo y validación admiten Convenio de prácticas y conservan todos los tipos anteriores', async () => {
  const anteriores = ['Indeterminado', 'Plazo fijo', 'Prácticas preprofesionales', 'Prácticas profesionales', 'Locación de servicios', 'Adenda'];
  const catalogos = await contratos.catalogos();
  for (const tipo_contrato of [...anteriores, 'Convenio de prácticas']) {
    assert.ok(catalogos.tipos_contrato.includes(tipo_contrato));
    assert.equal(contratos._internals.normalizarPayload({ empleado_id: 7, fecha_inicio: '2026-09-01', tipo_contrato }).tipo_contrato, tipo_contrato);
  }
  assert.throws(() => contratos._internals.normalizarPayload({ empleado_id: 7, fecha_inicio: '2026-09-01', tipo_contrato: 'Desconocido' }), error => error.status === 400);
  const previo = { empleado_id: 7, fecha_inicio: '2026-09-01', tipo_contrato: 'Tipo histórico' };
  assert.equal(contratos._internals.normalizarPayload({ observaciones: 'Conservar historial' }, previo).tipo_contrato, 'Tipo histórico');
});
