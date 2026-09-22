const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { ROLES } = require('../config/accessPolicy');

process.env.JWT_SECRET = 'clave-aislada-solo-para-pruebas-de-generacion';
let guardadas;
let consultas;
const cuentas = new Map([
  [1, { usuario_id: 1, activo: 1, rol_nombre: ROLES.ADMIN, empleado_id: 101 }],
  [2, { usuario_id: 2, activo: 1, rol_nombre: ROLES.RRHH, empleado_id: 101 }],
  [3, { usuario_id: 3, activo: 1, rol_nombre: ROLES.COLABORADOR, empleado_id: 101 }]
]);
const empleado = {
  id: 101, nombres: 'María José', apellidos: 'Núñez Agüero', tipo_documento: 'DNI',
  numero_documento: '99999991', tipo_vinculo: 'practicante_preprofesional',
  fecha_ingreso: '2026-06-01', fecha_finalizacion: '2026-09-19', horas_meta: 320
};
const pool = { async query(sql, params = []) {
  consultas.push({ sql, params });
  if (/FROM usuarios u/.test(sql)) return [cuentas.has(params[0]) ? [cuentas.get(params[0])] : []];
  if (/INSERT INTO historial_cambios/.test(sql)) return [{ insertId: 1 }];
  if (/SELECT \*/.test(sql) && /plantillas_documentos/.test(sql)) return [[...guardadas.values()].filter(x => x.codigo === params[0])];
  if (/SELECT \*/.test(sql) && /documentos_empleado/.test(sql)) return [[]];
  if (/SELECT codigo, titulo, cuerpo_html FROM plantillas_documentos/.test(sql)) return [[...guardadas.values()]];
  if (/INSERT INTO plantillas_documentos/.test(sql)) {
    guardadas.set(params[0], { codigo: params[0], titulo: params[1], cuerpo_html: params[2] });
    return [{ affectedRows: 1, insertId: 1 }];
  }
  if (/FROM empleados e LEFT JOIN practicante_detalles/.test(sql)) return [params[0] === 101 ? [empleado] : []];
  if (/FROM empresas emp INNER JOIN areas/.test(sql)) return [params.join(',') === '10,20,30' ? [{ empresa: 'Organización SBSS', ruc: '20000000001', area: 'Administración', cargo: 'Asistente' }] : []];
  if (/FROM empresas ORDER BY/.test(sql)) return [[{ id: 10, razon_social: 'Organización SBSS' }]];
  if (/FROM areas ORDER BY/.test(sql)) return [[{ id: 20, nombre: 'Administración', empresa_id: 10 }]];
  if (/FROM cargos ORDER BY/.test(sql)) return [[{ id: 30, nombre: 'Asistente', area_id: 20 }]];
  throw new Error('Consulta no prevista: ' + sql);
} };
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: pool };
const app = express();
app.use('/api/documentos', require('../routes/documentoRoutes'));
const { generarPdf } = require('../services/documentoPdfService');
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/documentos`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { guardadas = new Map(); consultas = []; });
async function request(path, { usuario = 1, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (usuario) headers.Authorization = `Bearer ${jwt.sign({ usuario_id: usuario }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
  const response = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(buffer.toString()) : buffer };
}
function payload(extra = {}) {
  return { codigo: 'aceptacion', empleado_id: 101, empresa_id: 10, area_id: 20, cargo_id: 30, fecha: '2026-09-19', horas: 245.5, ...extra };
}
function textoPdf(buffer) {
  return [...buffer.toString('ascii').matchAll(/<([0-9a-f]+)> Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('\n');
}
function comprobarPdf(buffer) {
  const text = buffer.toString('ascii');
  assert.ok(text.startsWith('%PDF-1.4\n'));
  const xref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
  const entries = text.slice(xref).split('\n');
  const size = Number(entries[1].split(' ')[1]);
  for (let id = 1; id < size; id++) {
    const offset = Number(entries[id + 2].slice(0, 10));
    assert.ok(text.slice(offset).startsWith(`${id} 0 obj\n`));
  }
  for (const match of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = match.index + match[0].length;
    assert.equal(text.slice(start + Number(match[1]), start + Number(match[1]) + 10), '\nendstream');
  }
}

test('catálogos incluyen tres plantillas editables y estructura seleccionable, solo para gestión', async () => {
  for (const usuario of [1, 2]) {
    const response = await request('/generacion/catalogos', { usuario });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.plantillas.slice(0, 3).map(x => x.codigo), ['aceptacion', 'constancia_practicas', 'culminacion']);
    assert.ok(response.body.plantillas.some(x => x.codigo === 'trabajo'), 'Conserva los documentos existentes');
    assert.equal(response.body.areas[0].empresa_id, 10);
    assert.equal(response.body.cargos[0].area_id, 20);
    assert.ok(response.body.campos.includes('horas'));
  }
  for (const [method, path, body] of [['GET', '/generacion/catalogos'], ['PUT', '/plantillas/aceptacion', { titulo: 'Título', cuerpo: 'Texto' }], ['POST', '/generar/vista-previa', payload()], ['POST', '/generar/pdf', payload()]]) {
    assert.equal((await request(path, { method, body, usuario: 3 })).status, 403);
    assert.equal((await request(path, { method, body, usuario: null })).status, 401);
  }
  assert.equal(guardadas.size, 0);
});

test('genera aceptación, constancia y culminación con datos seleccionados y PDF real', async () => {
  for (const codigo of ['aceptacion', 'constancia_practicas', 'culminacion']) {
    const body = payload({ codigo });
    const preview = await request('/generar/vista-previa', { usuario: 2, method: 'POST', body });
    assert.equal(preview.status, 200);
    assert.match(preview.body.documento.cuerpo, /María José Núñez Agüero/);
    assert.match(preview.body.documento.cuerpo, /245[.,]5/);
    assert.match(preview.body.documento.cuerpo, /19 de se(?:p)?tiembre de 2026/);
    assert.ok(!preview.body.documento.cuerpo.includes('{{'));
    const result = await request('/generar/pdf', { usuario: 2, method: 'POST', body: { ...body, revision_plantilla: preview.body.documento.revision_plantilla } });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'application/pdf');
    assert.match(result.headers.get('content-disposition'), /^attachment;/);
    comprobarPdf(result.body);
    assert.match(textoPdf(result.body), /María José Núñez Agüero/);
    assert.match(textoPdf(result.body), /Administración/);
  }
});

test('guardar una plantilla persiste y cambia futuros documentos; rechaza placeholders y HTML', async () => {
  const body = { titulo: 'Constancia de {{empresa}}', cuerpo: 'Para {{trabajador}}. Horas: {{horas}}. Cargo: {{cargo}}.\nFecha: {{fecha}}.' };
  assert.equal((await request('/plantillas/constancia_practicas', { usuario: 2, method: 'PUT', body })).status, 200);
  assert.equal(guardadas.get('constancia_practicas').cuerpo_html, body.cuerpo);
  const result = await request('/generar/vista-previa', { method: 'POST', body: payload({ codigo: 'constancia_practicas' }) });
  assert.equal(result.body.documento.titulo, 'Constancia de Organización SBSS');
  assert.match(result.body.documento.cuerpo, /^Para María José Núñez Agüero/);
  assert.equal((await request('/generacion/catalogos')).body.plantillas.find(x => x.codigo === 'constancia_practicas').cuerpo, body.cuerpo);
  for (const cuerpo of ['{{password}}', '{{trabajador', '{{constructor}}', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>']) {
    assert.equal((await request('/plantillas/aceptacion', { method: 'PUT', body: { titulo: 'Documento', cuerpo } })).status, 400);
  }
  assert.equal((await request('/plantillas/otro', { method: 'PUT', body })).status, 400);
});

test('validación impide fechas inexistentes, horas inválidas y cruces de empresa/área/cargo', async () => {
  for (const cambio of [{ fecha: '2026-02-30' }, { horas: -1 }, { horas: '' }, { horas: 'NaN' }, { empleado_id: '101 OR 1=1' }, { empresa_id: 11 }, { area_id: 31 }, { cargo_id: 21 }, { codigo: 'toString' }]) {
    assert.equal((await request('/generar/vista-previa', { method: 'POST', body: payload(cambio) })).status, 400);
  }
  assert.equal((await request('/generar/vista-previa', { method: 'POST', body: payload({ empleado_id: 999 }) })).status, 404);
});

test('plantilla modificada después de vista previa exige regenerar antes de descargar', async () => {
  const preview = await request('/generar/vista-previa', { method: 'POST', body: payload() });
  await request('/plantillas/aceptacion', { method: 'PUT', body: { titulo: 'Nueva aceptación', cuerpo: 'Aceptamos a {{trabajador}}.' } });
  assert.equal((await request('/generar/pdf', { method: 'POST', body: payload({ revision_plantilla: preview.body.documento.revision_plantilla }) })).status, 409);
});

test('PDF pagina textos extensos y conserva tildes, paréntesis y barras sin alterar su estructura', () => {
  const cuerpo = ('Prácticas de María Núñez (Área jurídica) \\ 320 horas.\n').repeat(150) + 'W'.repeat(200);
  const pdf = generarPdf({ empresa: 'SBSS', titulo: 'CONSTANCIA', fecha: '2026-09-19', cuerpo });
  comprobarPdf(pdf);
  assert.ok(Number(/\/Count (\d+)/.exec(pdf.toString('ascii'))[1]) >= 4);
  assert.match(textoPdf(pdf), /Prácticas de María Núñez \(Área jurídica\) \\ 320 horas/);
  assert.match(textoPdf(pdf), /Página 1 de/);
  const streams = [...pdf.toString('ascii').matchAll(/1 0 0 1 54 (\d+) Tm/g)].map(match => Number(match[1]));
  assert.ok(streams.every(y => y >= 32 && y <= 790));
});
