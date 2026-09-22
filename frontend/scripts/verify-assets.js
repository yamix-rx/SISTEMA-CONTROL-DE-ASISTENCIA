'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { frontendRoot, filesIn, contentDigest } = require('./asset-utils');

function verifyAssets({ manifestOnly = false } = {}) {
  const errors = [];
  const manifest = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'vendor/manifest.json'), 'utf8'));
  const dependencies = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8')).devDependencies;
  const lock = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package-lock.json'), 'utf8'));
  for (const entry of manifest.packages) {
    if (entry.version !== dependencies[entry.name] || entry.integrity !== lock.packages[`node_modules/${entry.name}`]?.integrity) errors.push(`Paquete cambiado: ${entry.name}. Reconstruir los recursos.`);
  }
  for (const entry of manifest.assets) {
    const target = path.resolve(frontendRoot, 'vendor', entry.file);
    if (!target.startsWith(path.join(frontendRoot, 'vendor') + path.sep) || !fs.existsSync(target)) { errors.push(`Falta recurso: ${entry.file}`); continue; }
    const bytes = fs.readFileSync(target);
    if (bytes.length !== entry.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) errors.push(`Integridad incorrecta: ${entry.file}`);
  }
  if (manifest.contentSha256 !== contentDigest()) errors.push('Las fuentes cambiaron: ejecutar npm run build antes de publicar.');

  function resource(reference, source) {
    if (/^(?:https?:)?\/\//i.test(reference)) { errors.push(`Recurso externo: ${source} → ${reference}`); return; }
    if (/^(?:data:|blob:|#)/i.test(reference)) return;
    const relative = reference.split(/[?#]/)[0];
    if (!relative) return;
    const resolved = relative.startsWith('/') ? path.resolve(frontendRoot, `.${relative}`) : path.resolve(frontendRoot, path.dirname(source), relative);
    if (!resolved.startsWith(frontendRoot + path.sep)) { errors.push(`Recurso fuera del frontend: ${source} → ${reference}`); return; }
    if (!fs.existsSync(resolved)) { errors.push(`Recurso ausente: ${source} → ${reference}`); return; }
    // Detectar errores de mayúsculas que Windows tolera pero Linux no.
    let cursor = frontendRoot;
    for (const part of path.relative(frontendRoot, resolved).split(path.sep)) {
      if (!fs.readdirSync(cursor).includes(part)) { errors.push(`Mayúsculas inconsistentes: ${source} → ${reference}`); break; }
      cursor = path.join(cursor, part);
    }
  }
  if (!manifestOnly) {
    for (const file of fs.readdirSync(frontendRoot).filter(name => name.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(frontendRoot, file), 'utf8');
      for (const match of html.matchAll(/<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi)) {
        const tag = match[0];
        const attribute = match[1].toLowerCase() === 'link' ? 'href' : 'src';
        const attributeMatch = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'));
        if (attributeMatch) resource(attributeMatch[1], file);
      }
      if (/cdn\.tailwindcss\.com|unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)) errors.push(`Referencia CDN pendiente: ${file}`);
    }
    for (const file of [...filesIn('css', '.css'), 'vendor/fonts/fonts.css']) {
      const css = fs.readFileSync(path.join(frontendRoot, file), 'utf8');
      for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)) resource(match[1], file);
      for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) resource(match[1], file);
    }
  }
  return { files: manifest.assets.length, errors };
}
if (require.main === module) {
  try {
    const result = verifyAssets({ manifestOnly: process.argv.includes('--manifest-only') });
    if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
    else console.log(`Verificación local correcta: ${result.files} recursos, integridad y compilación vigentes; sin solicitudes de red.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verifyAssets };
