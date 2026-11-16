'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Horarios.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/horarios.js'), 'utf8');

test('el formulario permite seleccionar los siete días y usar selecciones rápidas', () => {
  assert.equal((html.match(/name="modalDias"/g) || []).length, 7);
  assert.match(html, /id="btnDiasLaborables"/);
  assert.match(html, /id="btnTodosDias"/);
  assert.match(html, /id="btnLimpiarDias"/);
  assert.match(html, /Se guardará el mismo horario para todos los días seleccionados/);
  assert.doesNotMatch(html, /id="modalDia"/);
});

test('el formulario envía todos los días seleccionados en una sola operación', () => {
  assert.match(js, /function selectedDays\(\)/);
  assert.match(js, /dias,\s*hora_entrada:/);
  assert.match(js, /Selecciona al menos un día de la semana/);
  assert.match(js, /setDays\(\[1,2,3,4,5\]\)/);
  assert.match(js, /setDays\(\[1,2,3,4,5,6,7\]\)/);
});

test('al editar un turno existente se conserva un solo día y no se cambia accidentalmente', () => {
  assert.match(js, /setDays\(\[s\.dia_semana\]\);setDaysLocked\(true\)/);
  assert.match(js, /input\.disabled=locked/);
});
