const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Datos controlados, sin abrir conexiones a MySQL.
let consultas, horas, falloDetalle, eventos;
const employee = { id: 7, nombres: 'Ana', apellidos: 'Prueba', tipo_vinculo: 'practicante profesional', horas_totales_asignadas: 320, observaciones_rrhh: 'Nota confidencial de RRHH' };
const pool = {
  async query(sql, params = []) {
    consultas.push({ sql, params });
    if (sql.includes('WHERE e.id = ?')) return [[{ ...employee }]];
    if (sql.includes('AS total_horas_reales')) return [[{ total_horas_reales: horas }]];
    if (sql.includes('FROM horarios WHERE empleado_id')) return [[{ dia_semana: 1, hora_entrada: '08:00', hora_salida: '17:00', tolerancia_minutos: 12 }]];
    if (sql.includes('FROM tipo_documentos td')) return [[{ documento_id: 91, tipo_documento: 'DNI', nombre_archivo: 'dni.pdf' }]];
    if (sql.includes('COALESCE(SUM(estado IN')) return [[{ total: 65, asistencias: 60, faltas: 5, tardanzas: 4, minutos_tardanza: 40, horas: 245 }]];
    if (sql.includes("LOWER(estado)='solicitado'")) return [[{ total: 45, solicitados: 12, aprobados: 33 }]];
    if (sql.includes('LIMIT 30 OFFSET')) return [[{ id: 1, fecha: '2026-09-18', horas_trabajadas: 8, estado: 'presente' }]];
    if (sql.includes('LIMIT 20 OFFSET')) return [[{ id: 4, fecha_inicio: '2026-09-01', fecha_fin: '2026-09-02', motivo: 'Salud', estado: 'Solicitado', archivo_sustento: 'archivo.pdf', archivo_sustento_nombre: 'certificado.pdf' }]];
    if (sql.startsWith('SELECT id FROM empleados')) return [[{ id: 7 }]];
    if (sql.includes('INNER JOIN cargos c ON c.id = ?')) return [[{ area_id: 1, empresa_id: 1, cargo_id: 1, cargo_area_id: 1 }]];
    if (sql.includes('HAVING horas_meta > 0')) return [[
      { empleado_id: 7, horas_meta: 320, horas_realizadas: 290, porcentaje_avance: 90.6 },
      { empleado_id: 8, horas_meta: 320, horas_realizadas: 320, porcentaje_avance: 100 },
      { empleado_id: 9, horas_meta: 320, horas_realizadas: 50, porcentaje_avance: 15.6 }
    ]];
    if (sql.includes('FROM contratos c')) return [[{ id: 10, empleado_id: 7, tipo_contrato: 'Prácticas profesionales', dias_restantes: 15 }]];
    if (sql.includes('HAVING COUNT(*)>=3')) return [[{ empleado_id: 7, tardanzas: 4, minutos: 40 }]];
    return [[]];
  },
  async getConnection() {
    return {
      async beginTransaction() { eventos.push('begin'); },
      async query(sql, params) {
        if (sql.includes('practicante_detalles') && falloDetalle) throw new Error('Fixture error');
        return pool.query(sql, params);
      },
      async commit() { eventos.push('commit'); },
      async rollback() { eventos.push('rollback'); },
      release() { eventos.push('release'); }
    };
  }
};
const dbPath = require.resolve('../config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const fichaService = require('../services/fichaService');
const personal = require('../controllers/personalController');
const miPanel = require('../controllers/miPanelController');
const dashboard = require('../controllers/dashboardController');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } });
beforeEach(() => { consultas = []; horas = 245; falloDetalle = false; eventos = []; });

test('la ficha calcula avance decimal, tolerancia real y culminación sólo con horas cumplidas', async () => {
  let ficha = await fichaService.obtenerFicha(7);
  assert.equal(ficha.progresoHoras.horasPendientes, 75);
  assert.equal(ficha.progresoHoras.porcentajeAvance, '76.6%');
  assert.equal(ficha.horarios[0].tolerancia_minutos, 12);
  const seleccion = consultas.find(q => q.sql.includes('WHERE e.id = ?')).sql;
  assert.match(seleccion, /CASE WHEN LOWER\(e.tipo_vinculo\) LIKE 'practicante%'\s+THEN COALESCE\(pd.horas_meta, e.horas_totales_asignadas, 0\)\s+ELSE COALESCE\(e.horas_totales_asignadas, 0\) END AS horas_totales_asignadas/);
  horas = 319.99; ficha = await fichaService.obtenerFicha(7);
  assert.equal(ficha.progresoHoras.horasCompletadas, false);
  assert.equal(ficha.progresoHoras.porcentajeAvance, '99.9%');
  horas = 328; ficha = await fichaService.obtenerFicha(7);
  assert.equal(ficha.progresoHoras.horasPendientes, 0);
  assert.equal(ficha.progresoHoras.estado, 'HORAS DE PRÁCTICAS COMPLETADAS');
  assert.equal(ficha.progresoHoras.porcentajeAvance, '100%');
});

test('el historial pagina independientemente asistencias y permisos y conserva totales completos', async () => {
  const result = await fichaService.obtenerHistorial(7, { asistencias_pagina: 2, permisos_pagina: 3 });
  assert.equal(result.paginacion.asistencias.total, 65);
  assert.equal(result.paginacion.asistencias.paginas, 3);
  assert.equal(result.paginacion.permisos.total, 45);
  assert.equal(result.resumenHistorial.permisosSolicitados, 12);
  assert.equal(result.permisos[0].fecha_inicio, '2026-09-01');
  assert.equal(result.permisos[0].archivo_sustento_nombre, 'certificado.pdf');
  assert.deepEqual(consultas.find(q => q.sql.includes('LIMIT 30')).params, [7, 30]);
  assert.deepEqual(consultas.find(q => q.sql.includes('LIMIT 20')).params, [7, 40]);
  const clamped = await fichaService.obtenerHistorial(7, { asistencias_pagina: 100 });
  assert.equal(clamped.paginacion.asistencias.pagina, 3);
});

test('la paginación rechaza valores inválidos antes de consultar historiales', async () => {
  for (const value of ['1 OR 1=1', -1, 0, 1.2, 100001]) {
    await assert.rejects(fichaService.obtenerHistorial(7, { asistencias_pagina: value }), error => error.status === 400);
  }
  assert.equal(consultas.length, 0);
});

test('mi-panel acota todas las consultas al usuario vigente y excluye observaciones de RRHH', async () => {
  const res = response();
  await miPanel.obtenerMiPanel({ usuario: { empleado_id: 7 }, query: { empleado_id: 99, id: 99, asistencias_pagina: '2' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.empleado.id, 7);
  assert.equal('observaciones_rrhh' in res.body.data.empleado, false);
  assert.ok(consultas.every(q => q.params[0] === 7));
  assert.equal(res.body.data.paginacion.asistencias.pagina, 2);
  const original = await fichaService.obtenerFicha(7);
  assert.equal(original.empleado.observaciones_rrhh, 'Nota confidencial de RRHH');
});

test('las notas del expediente se persisten con el ID y texto parametrizados', async () => {
  const res = response();
  await personal.actualizarObservaciones({ params: { id: '7' }, body: { observaciones_rrhh: "  Nota <script> y ' comillas  " } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(consultas.find(q => q.sql.startsWith('UPDATE empleados')).params, ["Nota <script> y ' comillas", 7]);
  const invalid = response();
  await personal.actualizarObservaciones({ params: { id: '7' }, body: { observaciones_rrhh: 'x'.repeat(10001) } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('los filtros de personal combinan organización/estado/búsqueda y todos incluye inactivos', async () => {
  await personal.listarColaboradores({ query: { empresa_id: '1', area_id: '2', cargo_id: '3', estado: 'todos', buscar: 'Ana' } }, response());
  const first = consultas[0];
  assert.ok(!first.sql.includes("WHERE e.estado = 'activo'"));
  assert.ok(!first.sql.includes('e.estado = ?'));
  assert.match(first.sql, /e.empresa_id = \?/);
  assert.match(first.sql, /e.area_id = \?/);
  assert.match(first.sql, /e.cargo_id = \?/);
  assert.match(first.sql, /emp.razon_social LIKE \?/);
  assert.deepEqual(first.params.slice(0, 3), ['1', '2', '3']);
  consultas = [];
  await personal.listarColaboradores({ query: { estado: 'suspendido' } }, response());
  assert.deepEqual(consultas[0].params, ['suspendido']);
});

test('dashboard separa próximos y completados, incluye alertas y respeta la empresa', async () => {
  const res = response();
  await dashboard.obtenerDatosDashboard({ query: { empresa_id: '2' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.practicantesProximos.map(p => p.empleado_id), [7]);
  assert.deepEqual(res.body.practicantesCompletados.map(p => p.empleado_id), [8]);
  assert.equal(res.body.seguimientoPracticas.length, 3);
  assert.equal(res.body.contratosPorVencer.length, 1);
  assert.equal(res.body.tardanzasAcumuladas.length, 1);
  for (const q of consultas.filter(q => /FROM contratos c|HAVING COUNT\(\*\)>=3|HAVING horas_meta/.test(q.sql))) assert.deepEqual(q.params, ['2']);
});

test('la actualización de ficha revierte todos los cambios si falla la meta de prácticas', async () => {
  falloDetalle = true;
  const res = response();
  await personal.actualizarColaborador({ params: { id: '7' }, body: { numero_documento: '12345678', nombres: 'Ana', apellidos: 'Prueba', empresa_id: 1, area_id: 1, cargo_id: 1, fecha_ingreso: '2026-09-01', tipo_vinculo: 'practicante profesional', estado: 'activo', horas_totales_asignadas: 320 } }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(eventos, ['begin', 'rollback', 'release']);
});

test('no acepta fechas inexistentes, finalización antes del ingreso ni metas negativas', async () => {
  const valid = { numero_documento: '12345678', nombres: 'Ana', apellidos: 'Prueba', empresa_id: 1, area_id: 1, cargo_id: 1, fecha_ingreso: '2026-09-01', tipo_vinculo: 'practicante profesional', estado: 'activo', horas_totales_asignadas: 320 };
  for (const change of [{ fecha_nacimiento: '2026-02-31' }, { fecha_finalizacion: '2026-08-30' }, { horas_totales_asignadas: -2 }]) {
    for (const operation of [personal.crearColaborador, personal.actualizarColaborador]) {
      const res = response(); await operation({ params: { id: '7' }, body: { ...valid, ...change } }, res);
      assert.equal(res.statusCode, 400);
    }
  }
  assert.equal(consultas.length, 0);
});
