'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Usuarios muestra todos los perfiles y no filtra la tabla a administradores', () => {
  const js = source('js/administracion.js');
  const html = source('Administracion.html');
  assert.match(js, /const listado=users\.filter\(u=>/);
  assert.doesNotMatch(js, /const administradores=users\.filter/);
  assert.match(js, /usersCount/);
  assert.match(html, /Usuarios del sistema/);
  assert.match(html, /Buscar usuario/);
  assert.match(html, /Nombre, correo o perfil/);
});

test('la eliminación usa DELETE, requiere confirmación y conserva el expediente del colaborador', () => {
  const js = source('js/administracion.js');
  const html = source('Administracion.html');
  assert.match(js, /window\.confirm\(/);
  assert.match(js, /method: 'DELETE'/);
  assert.match(js, /No puedes eliminar la cuenta con la que has iniciado sesión/);
  assert.match(html, /Se conservar[aá]n la ficha del colaborador, sus asistencias, documentos/);
});
