const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const jwt = require('jsonwebtoken');
const express = require('express');
const { ROLES } = require('../config/accessPolicy');
const archivos = require('../services/documentoArchivoService');
const { migrar } = require('../scripts/migrar-documentos');
const { PARTES_DOCX, crearZip, crearDoc } = require('./helpers/wordFixtures');

// Pruebas HTTP con SQL simulado y archivos temporales reales. No conecta a MySQL.
process.env.JWT_SECRET = 'clave-aislada-para-pruebas-de-documentos';
const empleados = [
  { id: 101, colaborador: 'Persona Uno', numero_documento: '90000001', empresa_id: 10, empresa: 'Empresa A' },
  { id: 102, colaborador: 'Persona Dos', numero_documento: '90000002', empresa_id: 20, empresa: 'Empresa B' }
];
const tipos = [{ id: 1, nombre: 'DNI', es_obligatorio: 1 }, { id: 2, nombre: 'Constancia', es_obligatorio: 1 }, { id: 3, nombre: 'Opcional', es_obligatorio: 0 }];
let registros;
let consultas;
let insertFalla;
let esquemaFalla;
const creados = new Set();
const cuentas = new Map([
  [1, { usuario_id: 1, activo: 1, rol_nombre: ROLES.ADMIN, empleado_id: 102 }],
  [2, { usuario_id: 2, activo: 1, rol_nombre: ROLES.RRHH, empleado_id: 102 }],
  [3, { usuario_id: 3, activo: 1, rol_nombre: ROLES.COLABORADOR, empleado_id: 101 }]
]);

function filasPanel(sql, params) {
  let filas = empleados.flatMap(e => tipos.flatMap(td => {
    const de = registros.filter(d => d.empleado_id === e.id && d.tipo_documento_id === td.id).sort((a, b) => b.id - a.id)[0];
    if (!de && !td.es_obligatorio) return [];
    return [{ clave: `${e.id}-${td.id}`, documento_id: de?.id || null, empleado_id: e.id, colaborador: e.colaborador,
      numero_documento: e.numero_documento, empresa_id: e.empresa_id, empresa: e.empresa,
      tipo_documento_id: td.id, tipo_documento: td.nombre, es_obligatorio: td.es_obligatorio,
      nombre_archivo: de?.nombre_archivo || null, estado: de?.estado || 'sin_entregar', observacion: de?.observacion || null, mime_type: de?.mime_type || null }];
  }));
  let n = 0;
  if (sql.includes('LIKE ?')) {
    const q = params[n++].slice(1, -1).toLowerCase(); n++;
    filas = filas.filter(f => (f.colaborador + f.numero_documento).toLowerCase().includes(q));
  }
  for (const [campo, sqlCampo] of [['empresa_id', 'e.empresa_id'], ['tipo_documento_id', 'td.id'], ['empleado_id', 'e.id']]) {
    if (sql.includes(`${sqlCampo} = ?`)) { const valor = params[n++]; filas = filas.filter(f => f[campo] === valor); }
  }
  if (sql.includes('COUNT(*) AS cantidad')) return Object.entries(filas.reduce((a, f) => { a[f.estado] = (a[f.estado] || 0) + 1; return a; }, {})).map(([estado, cantidad]) => ({ estado, cantidad }));
  if (sql.includes("END = ?")) { const estado = params[n++]; filas = filas.filter(f => f.estado === estado); }
  return filas.slice(params[n + 1], params[n + 1] + params[n]);
}

const pool = {
  async query(sql, params = []) {
    consultas.push({ sql, params });
    if (/FROM usuarios u/.test(sql)) return [cuentas.has(params[0]) ? [cuentas.get(params[0])] : []];
    if (/INSERT INTO documentos_empleado/.test(sql)) {
      creados.add(params[3]);
      if (insertFalla) throw Object.assign(new Error('Fixture insert failure'), { code: 'TEST_INSERT_FAILURE' });
      const id = Math.max(0, ...registros.map(r => r.id)) + 1;
      registros.push({ id, empleado_id: params[0], tipo_documento_id: params[1], nombre_archivo: params[2], ruta_archivo: params[3], mime_type: params[4], estado: 'pendiente' });
      return [{ insertId: id }];
    }
    if (/UPDATE documentos_empleado/.test(sql)) {
      const candidato = registros.find(r => r.id === params[3]);
      const d = candidato && !registros.some(r => r.empleado_id === candidato.empleado_id && r.tipo_documento_id === candidato.tipo_documento_id && r.id > candidato.id) ? candidato : undefined;
      if (d) Object.assign(d, { estado: params[0], observacion: params[1], revisado_por: params[2], fecha_revision: new Date() });
      return [{ affectedRows: d ? 1 : 0 }];
    }
    if (/CROSS JOIN tipo_documentos/.test(sql)) {
      if (esquemaFalla && /de.observacion/.test(sql)) throw Object.assign(new Error('Fixture missing column'), { code: 'ER_BAD_FIELD_ERROR' });
      return [filasPanel(sql, params)];
    }
    if (/FROM documentos_empleado WHERE id/.test(sql)) return [registros.filter(d => d.id === params[0])];
    if (/SELECT id FROM empleados/.test(sql)) return [empleados.filter(e => e.id === params[0])];
    if (/SELECT id FROM tipo_documentos/.test(sql)) return [tipos.filter(t => t.id === params[0])];
    if (/FROM empleados e/.test(sql)) return [empleados];
    if (/FROM empresas ORDER/.test(sql)) return [[{ id: 10, razon_social: 'Empresa A' }, { id: 20, razon_social: 'Empresa B' }]];
    if (/FROM tipo_documentos ORDER/.test(sql)) return [tipos];
    throw new Error('Consulta no prevista en la prueba de Documentos');
  }
};
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: pool };
const app = express();
app.use('/api/documentos', require('../routes/documentoRoutes'));
let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/documentos`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  consultas = []; insertFalla = false; esquemaFalla = false;
  registros = [
    { id: 1, empleado_id: 101, tipo_documento_id: 1, nombre_archivo: 'anterior.pdf', estado: 'validado' },
    { id: 2, empleado_id: 101, tipo_documento_id: 1, nombre_archivo: 'actual.pdf', estado: 'rechazado', observacion: 'Archivo borroso' },
    { id: 3, empleado_id: 102, tipo_documento_id: 1, nombre_archivo: 'dni.pdf', estado: 'pendiente' },
    { id: 4, empleado_id: 102, tipo_documento_id: 2, nombre_archivo: 'constancia.pdf', estado: 'validado' },
    { id: 5, empleado_id: 102, tipo_documento_id: 3, nombre_archivo: 'opcional.pdf', estado: 'validado' }
  ];
});
afterEach(async () => {
  for (const nombre of creados) await archivos.eliminarArchivo(nombre);
  creados.clear();
});

async function request(ruta = '', { usuario = 1, method = 'GET', body, raw, claims, authorization } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (usuario) headers.Authorization = `Bearer ${jwt.sign({ usuario_id: usuario, ...claims }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(base + ruta, { method, headers, ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}) });
  const buffer = Buffer.from(await response.arrayBuffer());
  const data = (response.headers.get('content-type') || '').includes('application/json') ? JSON.parse(buffer.toString()) : buffer;
  return { status: response.status, headers: response.headers, body: data };
}
function carga(extra = {}) {
  return { empleado_id: 101, tipo_documento_id: 1, nombre_archivo: 'Identificación.pdf', contenido_base64: Buffer.from('%PDF-1.4\nDocumento de prueba\n%%EOF').toString('base64'), ...extra };
}

test('Documentos exige sesión válida y rechaza colaboradores en todas las operaciones', async () => {
  for (const [method, ruta] of [['GET', ''], ['GET', '/catalogos'], ['POST', ''], ['GET', '/1/archivo'], ['GET', '/1/descargar'], ['PATCH', '/1/revision']]) {
    const options = { method, ...(method !== 'GET' ? { body: {} } : {}) };
    assert.equal((await request(ruta, { ...options, usuario: null })).status, 401);
    assert.equal((await request(ruta, { ...options, usuario: 3, claims: { rol: ROLES.ADMIN } })).status, 403);
  }
  assert.ok(consultas.every(q => /FROM usuarios u/.test(q.sql)));
  assert.equal((await request('', { authorization: 'Bearer alterado' })).status, 401);
});

test('Admin y RRHH obtienen catálogos reales y nunca rutas de almacenamiento', async () => {
  for (const usuario of [1, 2]) {
    const result = await request('/catalogos', { usuario });
    assert.equal(result.status, 200);
    assert.equal(result.body.empleados.length, 2);
    assert.equal(result.body.tipos.length, 3);
    assert.equal(result.body.empresas.length, 2);
  }
  const listado = await request('?limite=100');
  assert.equal(listado.body.total, 5);
  assert.deepEqual(listado.body.resumen, { sin_entregar: 1, pendiente: 1, validado: 2, rechazado: 1 });
  assert.equal(listado.body.documentos.find(d => d.clave === '101-1').documento_id, 2);
  assert.equal(listado.body.documentos.find(d => d.clave === '101-2').estado, 'sin_entregar');
  assert.equal(listado.body.documentos.find(d => d.clave === '101-3'), undefined);
  assert.ok(listado.body.documentos.every(d => d.ruta_archivo === undefined));
  const sql = consultas.find(q => /de.observacion/.test(q.sql)).sql;
  assert.match(sql, /MAX\(id\) AS ultimo_id/);
  assert.match(sql, /td.es_obligatorio = 1 OR de.id IS NOT NULL/);
});

test('el resumen conserva los estados al aplicar filtro de estado y respeta colaborador, empresa y búsqueda', async () => {
  const result = await request('?empleado_id=101&empresa_id=10&q=90000001&estado=rechazado&limite=5');
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.documentos[0].estado, 'rechazado');
  assert.deepEqual(result.body.resumen, { sin_entregar: 1, pendiente: 0, validado: 0, rechazado: 1 });
  assert.equal((await request('?empleado_id=101&estado=validado')).body.documentos.length, 0);
  for (const query of ['?pagina=0', '?limite=101', '?empleado_id=1%20OR%201=1', '?estado=entregado', '?q=' + 'a'.repeat(151)]) {
    assert.equal((await request(query)).status, 400);
  }
});

test('subir crea una versión pendiente y conserva la anterior; descarga autorizada usa MIME real', async () => {
  const subida = await request('', { usuario: 2, method: 'POST', body: carga() });
  assert.equal(subida.status, 201);
  const documento = registros.find(r => r.id === subida.body.documento_id);
  assert.equal(registros.filter(r => r.empleado_id === 101 && r.tipo_documento_id === 1).length, 3);
  assert.equal(documento.estado, 'pendiente');
  assert.match(documento.ruta_archivo, /^[a-f0-9-]+\.pdf$/);
  assert.equal(subida.body.ruta_archivo, undefined);
  documento.mime_type = 'text/html';
  const vista = await request(`/${documento.id}/archivo`, { usuario: 2 });
  assert.equal(vista.status, 200);
  assert.equal(vista.headers.get('content-type'), 'application/pdf');
  assert.match(vista.headers.get('content-disposition'), /^inline;/);
  assert.equal(vista.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(vista.body.equals(Buffer.from(carga().contenido_base64, 'base64')));
  const descarga = await request(`/${documento.id}/descargar`);
  assert.match(descarga.headers.get('content-disposition'), /^attachment;/);
  assert.match(descarga.headers.get('content-disposition'), /filename\*=UTF-8''Identificaci%C3%B3n.pdf/);
});

test('Word DOC y DOCX conservan formato, bytes y versiones en carga, vista y descarga', async () => {
  const anteriores = registros.filter(r => r.empleado_id === 101 && r.tipo_documento_id === 1).map(r => ({ ...r }));
  const ejemplos = [
    { nombre: 'Convenio de prácticas.DOCX', contenido: crearZip(), extension: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { nombre: 'Convenio sin compresión.docx', contenido: crearZip(PARTES_DOCX, { comprimir: false }), extension: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { nombre: 'Convenio anterior.doc', contenido: crearDoc(), extension: '.doc', mime: 'application/msword' }
  ];
  for (const [indice, ejemplo] of ejemplos.entries()) {
    const subida = await request('', { usuario: 2, method: 'POST', body: carga({ nombre_archivo: ejemplo.nombre, contenido_base64: ejemplo.contenido.toString('base64') }) });
    assert.equal(subida.status, 201, `${ejemplo.nombre}: ${JSON.stringify(subida.body)}`);
    const documento = registros.find(r => r.id === subida.body.documento_id);
    assert.equal(documento.nombre_archivo, ejemplo.nombre);
    assert.equal(documento.estado, 'pendiente');
    assert.equal(documento.mime_type, ejemplo.mime);
    assert.ok(documento.ruta_archivo.endsWith(ejemplo.extension));
    assert.equal(subida.body.ruta_archivo, undefined);
    assert.equal(registros.filter(r => r.empleado_id === 101 && r.tipo_documento_id === 1).length, anteriores.length + indice + 1);
    assert.deepEqual(registros.filter(r => anteriores.some(anterior => anterior.id === r.id)), anteriores);
    const listado = await request('?empleado_id=101');
    const vigente = listado.body.documentos.find(d => d.clave === '101-1');
    assert.equal(vigente.documento_id, documento.id);
    assert.equal(vigente.estado, 'pendiente');
    documento.mime_type = 'text/html';
    for (const [ruta, disposicion] of [['archivo', 'inline'], ['descargar', 'attachment']]) {
      const result = await request(`/${documento.id}/${ruta}`, { usuario: 2 });
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('content-type'), ejemplo.mime);
      assert.ok(result.headers.get('content-disposition').startsWith(disposicion + ';'));
      assert.ok(result.headers.get('content-disposition').includes(`filename*=UTF-8''${encodeURIComponent(ejemplo.nombre)}`));
      assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(result.body, ejemplo.contenido);
    }
  }
});

test('rechaza documentos Word renombrados, contenedores ajenos y archivos truncados antes de insertar', async () => {
  const docx = crearZip();
  const doc = crearDoc();
  const casos = [
    ['pdf.docx', Buffer.from('%PDF-1.4\nDocumento\n%%EOF')],
    ['zip.docx', crearZip([['notas.txt', 'Archivo ZIP ajeno a Word']])],
    ['macros-renombradas.docx', crearZip(PARTES_DOCX.map(([nombre, contenido]) => [nombre, nombre === '[Content_Types].xml' ? contenido.replace('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml', 'application/vnd.ms-word.document.macroEnabled.main+xml') : contenido]))],
    ['sin-documento.docx', crearZip(PARTES_DOCX.filter(([nombre]) => nombre !== 'word/document.xml'))],
    ['sin-tipos.docx', crearZip(PARTES_DOCX.filter(([nombre]) => nombre !== '[Content_Types].xml'))],
    ['sin-relaciones.docx', crearZip(PARTES_DOCX.filter(([nombre]) => nombre !== '_rels/.rels'))],
    ['truncado.docx', docx.subarray(0, docx.length - 8)],
    ['solo-firma.docx', Buffer.from('504b0304', 'hex')],
    ['excel.doc', crearDoc('Workbook')],
    ['truncado.doc', doc.subarray(0, 600)],
    ['solo-firma.doc', doc.subarray(0, 8)],
    ['doc-renombrado.docx', doc],
    ['docx-renombrado.doc', docx]
  ];
  for (const [nombre, contenido] of casos) {
    const result = await request('', { method: 'POST', body: carga({ nombre_archivo: nombre, contenido_base64: contenido.toString('base64') }) });
    assert.equal(result.status, 400, `${nombre}: ${JSON.stringify(result.body)}`);
  }
  assert.equal(registros.length, 5);
  assert.equal(creados.size, 0);
  assert.ok(consultas.every(q => !/INSERT INTO documentos_empleado/.test(q.sql)));
});

test('rechaza extensión falsa, base64 inválido, nombres con rutas y tamaños superiores a 5 MB', async () => {
  const invalidos = [carga({ nombre_archivo: '../dni.pdf' }), carga({ nombre_archivo: 'dni\\a.pdf' }), carga({ nombre_archivo: 'dni.html' }), carga({ nombre_archivo: 'dni.png' }), carga({ contenido_base64: 'esto no es base64' }), carga({ contenido_base64: '' }), carga({ empleado_id: 999 })];
  for (const body of invalidos) assert.ok([400, 404].includes((await request('', { method: 'POST', body })).status));
  const limite = Buffer.alloc(archivos.MAX_BYTES, 65); limite.write('%PDF-');
  assert.equal(archivos.validarArchivo('limite.pdf', limite.toString('base64')).contenido.length, archivos.MAX_BYTES);
  const demasiado = Buffer.alloc(archivos.MAX_BYTES + 1, 65); demasiado.write('%PDF-');
  assert.equal((await request('', { method: 'POST', body: carga({ contenido_base64: demasiado.toString('base64') }) })).status, 413);
  assert.equal(registros.length, 5);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  assert.equal(archivos.validarArchivo('imagen.PNG', png.toString('base64')).mime_type, 'image/png');
  assert.equal(archivos.validarArchivo('imagen.jpeg', Buffer.from([255, 216, 255, 224]).toString('base64')).mime_type, 'image/jpeg');
});

test('fallo al insertar elimina el archivo de carga; esquema ausente da instrucción concreta', async () => {
  insertFalla = true;
  assert.equal((await request('', { method: 'POST', body: carga() })).status, 500);
  for (const nombre of creados) await assert.rejects(fs.stat(archivos.resolverRutaPrivada(nombre)), { code: 'ENOENT' });
  esquemaFalla = true;
  const result = await request('');
  assert.equal(result.status, 503);
  assert.match(result.body.mensaje, /npm run migrar:documentos/);
});

test('rutas antiguas, traversal y archivos inexistentes no exponen contenido del servidor', async () => {
  for (const ruta of ['../config/database.js', '/etc/passwd', 'C:\\Windows\\win.ini', 'uploads/documentos/archivo.pdf', '00000000-0000-4000-8000-000000000000.pdf']) {
    registros[0].ruta_archivo = ruta;
    assert.equal((await request('/1/archivo')).status, 404);
  }
  assert.equal((await request('/999/archivo')).status, 404);
  assert.equal((await request('/NaN/archivo')).status, 400);
  const header = archivos.disposicionArchivo('algo\r\nX-Test: inyectado.pdf');
  assert.equal(/[\r\n]/.test(header), false);
});

test('revisión exige motivo para observado y guarda el usuario autenticado', async () => {
  assert.equal((await request('/2/revision', { method: 'PATCH', body: { estado: 'rechazado', observacion: '   ' } })).status, 400);
  assert.equal((await request('/2/revision', { method: 'PATCH', body: { estado: 'sin_entregar' } })).status, 400);
  assert.equal((await request('/2/revision', { method: 'PATCH', body: { estado: 'rechazado', observacion: 'x'.repeat(2001) } })).status, 400);
  const observado = await request('/2/revision', { usuario: 2, method: 'PATCH', body: { estado: 'rechazado', observacion: ' Adjuntar documento completo ', revisado_por: 999 } });
  assert.equal(observado.status, 200);
  assert.equal(registros[1].revisado_por, 2);
  assert.equal(registros[1].observacion, 'Adjuntar documento completo');
  assert.ok(registros[1].fecha_revision);
  assert.equal((await request('/2/revision', { method: 'PATCH', body: { estado: 'validado' } })).status, 200);
  assert.equal(registros[1].estado, 'validado');
  assert.equal((await request('/999/revision', { method: 'PATCH', body: { estado: 'validado' } })).status, 404);
});

test('el parser devuelve JSON claro y se ejecuta después de autenticar', async () => {
  assert.equal((await request('', { method: 'POST', raw: '{ inválido' })).status, 400);
  assert.equal((await request('', { usuario: null, method: 'POST', raw: '{ inválido' })).status, 401);
});

test('una revisión desactualizada devuelve 409 y no cambia una versión anterior', async () => {
  const result = await request('/1/revision', { method: 'PATCH', body: { estado: 'rechazado', observacion: 'Revisión de una vista antigua' } });
  assert.equal(result.status, 409);
  assert.match(result.body.mensaje, /versión más reciente/);
  assert.equal(registros[0].estado, 'validado');
  assert.equal(registros[1].estado, 'rechazado');
  const consulta = consultas.find(q => /UPDATE documentos_empleado/.test(q.sql));
  assert.match(consulta.sql, /MAX\(id\) AS ultimo_id/);
  assert.match(consulta.sql, /ultima.ultimo_id = de.id/);
});

test('migración es idempotente, acepta nombre antiguo y valida tablas antes de alterar', async () => {
  const columnas = {
    empleados: ['id', 'nombres', 'apellidos', 'numero_documento', 'empresa_id'], empresas: ['id', 'razon_social'], usuarios: ['id'],
    tipo_documentos: ['id', 'nombre', 'es_obligatorio'],
    documentos_empleado: ['id', 'empleado_id', 'tipo_documento_id', 'nombre_archivo', 'estado', 'fecha_subida', 'ruta_almacenamiento']
  };
  const cambios = []; let indice = false;
  const mock = { async query(sql) {
    if (/SELECT DATABASE/.test(sql)) return [[{ base_actual: 'fixture' }]];
    if (/information_schema.COLUMNS/.test(sql)) return [Object.entries(columnas).flatMap(([tabla, cols]) => cols.map(columna => ({ tabla, columna })))];
    if (/information_schema.STATISTICS/.test(sql)) return [indice ? [{ INDEX_NAME: 'idx_documento_version' }] : []];
    cambios.push(sql);
    if (/CHANGE COLUMN/.test(sql)) columnas.documentos_empleado[columnas.documentos_empleado.indexOf('ruta_almacenamiento')] = 'ruta_archivo';
    if (/ADD COLUMN/.test(sql)) columnas.documentos_empleado.push(/ADD COLUMN (\w+)/.exec(sql)[1]);
    if (/ADD INDEX/.test(sql)) indice = true;
    return [{}];
  } };
  await migrar(mock, () => {});
  assert.equal(cambios.length, 6);
  await migrar(mock, () => {});
  assert.equal(cambios.length, 6);
  assert.ok(cambios.every(sql => /^ALTER TABLE/.test(sql)));
  delete columnas.usuarios;
  await assert.rejects(migrar(mock, () => {}), /No existe la tabla usuarios/);
  assert.equal(cambios.length, 6);
});
