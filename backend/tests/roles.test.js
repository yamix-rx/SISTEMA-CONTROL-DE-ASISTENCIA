const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Fixtures aislados: estas pruebas nunca abren una conexión a MySQL ni cambian cuentas.
process.env.JWT_SECRET = 'clave-solo-para-pruebas-locales-de-roles';
process.env.JWT_EXPIRES_IN = '1h';
const password = 'Password-de-prueba-123';
const passwordHash = bcrypt.hashSync(password, 4);
let cuentas;
let consultas;
let failDatabase = false;

const fichaFixtures = new Map([
  [101, { id: 101, nombres: 'Persona', apellidos: 'Uno', tipo_vinculo: 'practicante_preprofesional', horas_totales_asignadas: 100, puesto: 'Auxiliar de formación', fecha_vencimiento_convenio: '2026-10-01', observaciones_rrhh: 'Nota reservada de RRHH' }],
  [202, { id: 202, nombres: 'Persona', apellidos: 'Dos', tipo_vinculo: 'trabajador', horas_totales_asignadas: 0 }]
]);

const mockPool = {
  async query(sql, params = []) {
    consultas.push({ sql, params });
    if (failDatabase) throw Object.assign(new Error('Fixture DB unavailable'), { code: 'TEST_DB_UNAVAILABLE' });
    if (/FROM usuarios u/.test(sql)) {
      const found = /WHERE u.email/.test(sql)
        ? [...cuentas.values()].find(c => c.email === params[0])
        : cuentas.get(params[0]);
      return [found ? [{ ...found }] : []];
    }
    if (/FROM empleados e/.test(sql) && /WHERE e.id = \?/.test(sql)) {
      return [fichaFixtures.has(Number(params[0])) ? [{ ...fichaFixtures.get(Number(params[0])) }] : []];
    }
    if (/AS total_horas_reales/.test(sql)) return [[{ total_horas_reales: params[0] === 101 ? '25.50' : '999.00' }]];
    if (/FROM horarios WHERE empleado_id/.test(sql)) {
      return [[{ dia_semana: 1, hora_entrada: params[0] === 101 ? '08:00:00' : '14:00:00', hora_salida: '17:00:00', tolerancia_minutos: 0 }]];
    }
    if (/FROM tipo_documentos td/.test(sql)) return [[{ tipo_documento: 'DNI', nombre_archivo: `propio-${params[0]}.pdf`, estado_documento: 'entregado' }]];
    if (/LIMIT 30/.test(sql)) return [[{ fecha: '2026-09-10', hora_ingreso: params[0] === 101 ? '08:00:00' : '14:00:00', estado: 'presente' }]];
    if (/LIMIT 20/.test(sql)) return [[{ fecha: '2026-09-09', tipo_permiso: 'Personal', motivo: `permiso-${params[0]}`, estado: 'aprobado' }]];
    if (/INSERT INTO empresas/.test(sql)) return [{ insertId: 50 }];
    return [[]];
  }
};

const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: mockPool };
const app = require('../server');
const { ROLES } = require('../config/accessPolicy');
const { obtenerFicha } = require('../services/fichaService');
let server;
let baseUrl;

before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});
beforeEach(() => {
  consultas = [];
  failDatabase = false;
  cuentas = new Map([
    [1, { usuario_id: 1, empleado_id: 202, email: 'admin@fixture.invalid', password: passwordHash, activo: 1, rol_nombre: ROLES.ADMIN }],
    [2, { usuario_id: 2, empleado_id: 202, email: 'rrhh@fixture.invalid', password: passwordHash, activo: 1, rol_nombre: ROLES.RRHH }],
    [3, { usuario_id: 3, empleado_id: 101, email: 'persona@fixture.invalid', password: passwordHash, activo: 1, rol_nombre: ROLES.COLABORADOR }]
  ]);
});

function token(id, claims = {}) {
  return jwt.sign({ usuario_id: id, ...claims }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function request(path, { id, authorization, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (id) headers.Authorization = `Bearer ${token(id)}`;
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(baseUrl + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}

test('login devuelve el panel y los permisos de cada uno de los tres roles', async () => {
  for (const [id, panel] of [[1, 'Dashboard.html'], [2, 'RecursosHumanos.html'], [3, 'MiPanel.html']]) {
    const result = await request('/api/auth/login', { method: 'POST', body: { email: cuentas.get(id).email, password } });
    assert.equal(result.status, 200);
    assert.equal(result.body.redirectUrl, panel);
    assert.equal(result.body.acceso.panel, panel);
    assert.equal(result.body.usuario.rol, cuentas.get(id).rol_nombre);
    assert.equal(result.body.usuario.password, undefined);
    assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).usuario_id, id);
    assert.equal(result.body.acceso.permisos.includes('empresas:gestionar'), id === 1);
    const perfil = await request('/api/auth/perfil', { authorization: `Bearer ${result.body.token}` });
    assert.deepEqual(perfil.body.usuario, result.body.usuario);
    assert.deepEqual(perfil.body.acceso, result.body.acceso);
  }
});

test('login rechaza roles desconocidos, cuentas inactivas y contraseñas incorrectas', async () => {
  cuentas.get(1).rol_nombre = 'Administrador';
  cuentas.get(2).activo = 0;
  for (const id of [1, 2]) {
    const result = await request('/api/auth/login', { method: 'POST', body: { email: cuentas.get(id).email, password } });
    assert.equal(result.status, 403);
    assert.equal(result.body.token, undefined);
    assert.equal(result.body.redirectUrl, undefined);
  }
  const incorrecto = await request('/api/auth/login', { method: 'POST', body: { email: cuentas.get(3).email, password: 'incorrecta' } });
  assert.equal(incorrecto.status, 401);
});

test('el perfil refleja cambios de rol y empleado aunque el JWT conserve datos antiguos', async () => {
  const authorization = `Bearer ${token(1, { rol: ROLES.ADMIN, empleado_id: 999 })}`;
  cuentas.get(1).rol_nombre = ROLES.COLABORADOR;
  cuentas.get(1).empleado_id = 101;
  const perfil = await request('/api/auth/perfil', { authorization });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.body.usuario.empleado_id, 101);
  assert.equal(perfil.body.acceso.panel, 'MiPanel.html');
  assert.equal((await request('/api/personal', { authorization })).status, 403);
});

test('una sesión deja de servir al desactivar, borrar o cambiar a un rol desconocido', async () => {
  cuentas.get(1).activo = 0;
  cuentas.delete(2);
  cuentas.get(3).rol_nombre = 'toString';
  assert.equal((await request('/api/auth/perfil', { id: 1 })).status, 401);
  assert.equal((await request('/api/auth/perfil', { id: 2 })).status, 401);
  assert.equal((await request('/api/auth/perfil', { id: 3 })).status, 403);
});

test('JWT ausentes, alterados y expirados se rechazan antes de consultar datos', async () => {
  const expired = jwt.sign({ usuario_id: 1 }, process.env.JWT_SECRET, { expiresIn: -1 });
  for (const authorization of [undefined, 'Bearer alterado', `Bearer ${expired}`, 'Basic abc']) {
    assert.equal((await request('/api/auth/perfil', { authorization })).status, 401);
  }
  assert.equal(consultas.length, 0);
});

test('el trabajador no puede leer ni escribir APIs administrativas, aunque falsifique el rol del token', async () => {
  const authorization = `Bearer ${token(3, { rol: ROLES.ADMIN, empleado_id: 202 })}`;
  const routes = [
    ['GET', '/api/dashboard'], ['GET', '/api/personal'], ['GET', '/api/personal/202'],
    ['GET', '/api/horarios'], ['GET', '/api/asistencias'], ['GET', '/api/asistencias/tardanzas'],
    ['GET', '/api/asistencias/permisos'], ['GET', '/api/reportes/consolidado'], ['GET', '/api/empresas'],
    ['POST', '/api/asistencias/marcar'], ['POST', '/api/horarios/asignar'], ['DELETE', '/api/horarios/1'],
    ['POST', '/api/empresas'], ['PATCH', '/api/empresas/1/estado']
  ];
  for (const [method, path] of routes) {
    assert.equal((await request(path, { authorization, method, ...(method !== 'GET' ? { body: {} } : {}) })).status, 403, `${method} ${path}`);
  }
  assert.equal(consultas.length, routes.length);
  assert.ok(consultas.every(q => /FROM usuarios u/.test(q.sql)), 'No deben ejecutarse consultas de gestión');
});

test('administrador y RRHH pueden consultar gestión; sólo administrador puede escribir empresas', async () => {
  for (const id of [1, 2]) {
    for (const path of ['/api/dashboard', '/api/personal', '/api/horarios', '/api/asistencias', '/api/asistencias/tardanzas', '/api/asistencias/permisos', '/api/reportes/consolidado', '/api/empresas']) {
      assert.equal((await request(path, { id })).status, 200, `${id} ${path}`);
    }
  }
  consultas = [];
  assert.equal((await request('/api/empresas', { id: 2, method: 'POST', body: { razon_social: 'Fixture', ruc: '00000000001' } })).status, 403);
  assert.equal((await request('/api/empresas/1/estado', { id: 2, method: 'PATCH', body: { estado: 'inactivo' } })).status, 403);
  assert.ok(consultas.every(q => /FROM usuarios u|INSERT INTO historial_cambios/.test(q.sql)), 'Solo deben autenticarse y auditarse los intentos denegados');
  assert.equal(consultas.filter(q => /INSERT INTO historial_cambios/.test(q.sql) && q.params[3] === 'DENEGADO').length, 2);
  assert.equal((await request('/api/empresas', { id: 1, method: 'POST', body: { razon_social: 'Fixture', ruc: '00000000001' } })).status, 201);
});

test('mi-panel devuelve únicamente el empleado de la sesión e ignora IDs ajenos', async () => {
  const result = await request('/api/mi-panel?empleado_id=202&id=202', { authorization: `Bearer ${token(3, { empleado_id: 202, rol: ROLES.ADMIN })}` });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.empleado.id, 101);
  assert.equal(result.body.data.empleado.puesto, 'Auxiliar de formación');
  assert.equal(result.body.data.empleado.fecha_vencimiento_convenio, '2026-10-01');
  assert.ok(consultas.some(q => /e.puesto/.test(q.sql) && /pd.fecha_vencimiento_convenio/.test(q.sql)));
  assert.equal(result.body.data.progresoHoras.esPracticante, true);
  assert.equal(result.body.data.progresoHoras.horasRealizadas, 25.5);
  assert.equal(result.body.data.progresoHoras.horasPendientes, 74.5);
  assert.equal(result.body.data.legajoDigital[0].nombre_archivo, 'propio-101.pdf');
  assert.equal(result.body.data.asistencias[0].hora_ingreso, '08:00:00');
  assert.equal(result.body.data.permisos[0].motivo, 'permiso-101');
  const propias = consultas.filter(q => !/FROM usuarios u/.test(q.sql));
  assert.equal(propias.length, 8);
  for (const consulta of propias) assert.equal(consulta.params[0], 101);
  assert.equal(result.body.data.empleado.observaciones_rrhh, undefined);
  assert.equal(result.body.data.paginacion.asistencias.pagina, 1);
  assert.equal(result.body.data.paginacion.permisos.pagina, 1);
  assert.ok(propias.some(q => /LIMIT 30/.test(q.sql)));
  assert.ok(propias.some(q => /LIMIT 20/.test(q.sql)));
});

test('mi-panel se reserva al rol trabajador y no admite una identidad sin empleado', async () => {
  for (const id of [1, 2]) assert.equal((await request('/api/mi-panel', { id })).status, 403);
  cuentas.get(3).empleado_id = null;
  assert.equal((await request('/api/mi-panel', { id: 3 })).status, 403);
});

test('puesto y convenio mantienen la escritura reservada a administrador/RRHH y se validan en el servidor', async () => {
  const body = { numero_documento: '12345678', nombres: 'Ana', apellidos: 'Prueba', empresa_id: 1, area_id: 1, cargo_id: 1,
    fecha_ingreso: '2026-09-01', tipo_vinculo: 'practicante profesional', puesto: 'Nuevo puesto', fecha_vencimiento_convenio: '2026-02-30' };
  for (const [method, path] of [['POST', '/api/personal'], ['PUT', '/api/personal/101']]) {
    assert.equal((await request(path, { id: 3, method, body })).status, 403);
    for (const id of [1, 2]) {
      const result = await request(path, { id, method, body });
      assert.equal(result.status, 400);
      assert.match(result.body.mensaje, /vencimiento del convenio/);
    }
  }
  assert.ok(!consultas.some(q => /UPDATE empleados SET|INSERT INTO empleados|INSERT INTO practicante_detalles/.test(q.sql)));
});

test('ambos tipos de practicante muestran progreso y un trabajador sin meta no aparece completado', async () => {
  const original = fichaFixtures.get(101).tipo_vinculo;
  try {
    fichaFixtures.get(101).tipo_vinculo = 'practicante_profesional';
    assert.equal((await obtenerFicha(101)).progresoHoras.esPracticante, true);
    const trabajador = await obtenerFicha(202);
    assert.equal(trabajador.progresoHoras.esPracticante, false);
    assert.equal(trabajador.progresoHoras.porcentajeAvance, '0%');
  } finally {
    fichaFixtures.get(101).tipo_vinculo = original;
  }
});

test('si la base de datos no puede verificar la cuenta, no se autoriza usando el JWT', async () => {
  failDatabase = true;
  const result = await request('/api/personal', { id: 1 });
  assert.equal(result.status, 500);
  assert.equal(result.body.ok, false);
  assert.equal(consultas.length, 1);
});
