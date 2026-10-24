'use strict';

// Empaqueta únicamente los recursos web públicos. No publica archivos internos,
// .env, pruebas, dependencias de Node, manifiestos privados ni código backend.
const fs = require('node:fs');
const path = require('node:path');
const { frontendRoot } = require('./asset-utils');

function empaquetar() {
  const destino = path.join(frontendRoot, 'dist');
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });

  for (const directorio of ['assets', 'css', 'js', 'vendor']) {
    const origen = path.join(frontendRoot, directorio);
    if (!fs.existsSync(origen)) throw new Error(`Falta ${directorio}; ejecute npm run build`);
    fs.cpSync(origen, path.join(destino, directorio), { recursive: true });
  }

  const pantallas = fs.readdirSync(frontendRoot).filter(nombre => /^[\w-]+\.html$/i.test(nombre));
  if (!pantallas.includes('index.html') || !pantallas.includes('login.html')) {
    throw new Error('Faltan las pantallas principales del sistema.');
  }
  for (const archivo of [...pantallas, 'favicon.svg', 'favicon.ico']) {
    const origen = path.join(frontendRoot, archivo);
    if (fs.existsSync(origen)) fs.copyFileSync(origen, path.join(destino, archivo));
  }
  console.log(`Vercel: ${pantallas.length} pantallas y recursos públicos preparados en frontend/dist.`);
  return destino;
}

if (require.main === module) empaquetar();
module.exports = { empaquetar };
