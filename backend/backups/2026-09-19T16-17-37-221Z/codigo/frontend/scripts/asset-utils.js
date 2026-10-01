'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const frontendRoot = path.resolve(__dirname, '..');
function filesIn(directory, extension) {
  const full = path.join(frontendRoot, directory);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(directory.replaceAll('\\', '/'), entry.name);
    return entry.isDirectory() ? filesIn(relative, extension) : entry.name.endsWith(extension) ? [relative] : [];
  }).sort();
}
function contentFiles() {
  return [...fs.readdirSync(frontendRoot).filter(name => name.endsWith('.html')), ...filesIn('js', '.js')].sort();
}
function contentDigest() {
  const digest = crypto.createHash('sha256');
  for (const file of [...contentFiles(), 'tailwind.config.js', 'styles/tailwind.css', 'package.json', 'package-lock.json', 'scripts/build-assets.js', 'scripts/asset-utils.js']) {
    digest.update(file); digest.update('\0');
    // Git puede convertir finales de línea al cambiar de Windows a Linux.
    digest.update(fs.readFileSync(path.join(frontendRoot, file), 'utf8').replaceAll('\r\n', '\n'));
    digest.update('\0');
  }
  return digest.digest('hex');
}
module.exports = { frontendRoot, filesIn, contentFiles, contentDigest };
