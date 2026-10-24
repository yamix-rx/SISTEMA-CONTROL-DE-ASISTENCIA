'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { empaquetar } = require('../scripts/build-vercel');
const { frontendRoot } = require('../scripts/asset-utils');

test('Vercel publica pantallas y recursos sin exponer fuentes de configuración ni backend', () => {
  const destino = empaquetar();
  for (const archivo of ['index.html', 'login.html', 'js/session.js', 'js/login.js', 'vendor/manifest.json']) {
    assert.ok(fs.existsSync(path.join(destino, archivo)), `Falta ${archivo}`);
  }
  for (const archivo of ['package.json', 'package-lock.json', '.env', 'vercel.json', 'scripts', 'tests', '../backend/server.js']) {
    assert.ok(!fs.existsSync(path.join(destino, archivo)), `No debe publicarse ${archivo}`);
  }
  assert.ok(destino.startsWith(frontendRoot + path.sep));
});
