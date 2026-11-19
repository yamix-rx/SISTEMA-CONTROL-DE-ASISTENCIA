const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../../frontend/Horarios.html'), 'utf8');

test('Horarios oculta solo la tarjeta Conexión en tiempo real y conserva las demás explicaciones', () => {
  assert.doesNotMatch(html, /CONEXIÓN EN TIEMPO REAL/i);
  assert.match(html, /FILTRO POR EMPRESA/i);
  assert.match(html, /FILTRO POR ÁREA/i);
  assert.match(html, /Personal programado/i);
  assert.match(html, /Áreas activas/i);
});
