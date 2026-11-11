'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'RecursosHumanos.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/recursos-humanos.js'), 'utf8');

test('el seguimiento anuncia y muestra sólo practicantes desde el 80 % o completados', () => {
  assert.match(html, /Se muestran practicantes desde el 80 % de avance y aquellos que ya completaron su meta/);
  assert.match(js, /realizadas >= meta \|\| realizadas >= meta \* 0\.8/);
  assert.match(js, /No hay practicantes que hayan alcanzado el 80 % de su meta o la hayan completado/);
});
