'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { patronBusqueda } = require('../services/busquedaTexto');
const { filtrosPersonal } = require('../services/asistenciaReglas');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('normaliza el término de búsqueda sin importar cómo se escriba', () => {
  assert.equal(patronBusqueda('  SaNtIaGo DaViD  '), '%santiago david%');
});

test('asistencia, tardanzas, permisos, horarios y reportes buscan sin distinguir mayúsculas', () => {
  const filtro = filtrosPersonal({ buscar: 'MiChAeL' });
  assert.ok(filtro.where.includes('LOWER(COALESCE(e.nombres'));
  assert.ok(filtro.where.includes('LOWER(COALESCE(e.apellidos'));
  assert.deepEqual(filtro.params, ['%michael%', '%michael%', '%michael%']);
});

test('los buscadores del backend normalizan columnas y texto', () => {
  const personal = read('backend/controllers/personalController.js');
  const auditoria = read('backend/controllers/auditoriaController.js');
  const capacitaciones = read('backend/services/capacitacionService.js');
  const contratos = read('backend/services/contratoService.js');
  const documentos = read('backend/services/documentoService.js');

  assert.ok(personal.includes('LOWER(CONCAT(COALESCE(e.nombres'));
  assert.ok(personal.includes('patronBusqueda(buscar)'));
  assert.ok(auditoria.includes('LOWER(COALESCE(u.email'));
  assert.ok(auditoria.includes('patronBusqueda(usuario_id)'));
  assert.ok(capacitaciones.includes('LOWER(COALESCE(cap.titulo'));
  assert.ok(capacitaciones.includes('patronBusqueda(String(filtros.buscar)'));
  assert.ok(contratos.includes('LOWER(COALESCE(c.codigo'));
  assert.ok(contratos.includes('patronBusqueda(String(filtros.buscar)'));
  assert.ok(documentos.includes('LOWER(CONCAT(COALESCE(e.nombres'));
  assert.ok(documentos.includes('patronBusqueda(query.q)'));
});

test('los buscadores locales de usuarios, empresas y dashboard comparan ambos lados en minúsculas', () => {
  const administracion = read('frontend/js/administracion.js');
  const empresas = read('frontend/empresas.html');
  const dashboard = read('frontend/Dashboard.html');

  assert.ok(administracion.includes('.toLowerCase().includes(q)'));
  assert.ok(empresas.includes("String(x.razon_social || '').toLowerCase().includes(q)"));
  assert.ok(dashboard.includes("String(c.colaborador || '').toLowerCase().includes(q)"));
  assert.ok(dashboard.includes("String(d.documento_faltante || '').toLowerCase().includes(q)"));
});
