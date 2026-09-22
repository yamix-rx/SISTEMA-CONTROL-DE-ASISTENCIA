'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const cssnano = require('cssnano');
const { frontendRoot, contentFiles, contentDigest } = require('./asset-utils');

const vendorRoot = path.join(frontendRoot, 'vendor');
const packageJson = require('../package.json');
const lock = require('../package-lock.json');
const assets = [];
const packages = [];

function write(relative, bytes) {
  const target = path.join(vendorRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  const content = fs.readFileSync(target);
  assets.push({ file: relative.replaceAll('\\', '/'), bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') });
}

function register(name, homepage, licenseFile = 'LICENSE') {
  const directory = path.join(frontendRoot, 'node_modules', name);
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (metadata.version !== packageJson.devDependencies[name]) throw new Error(`Versión inesperada: ${name}. Ejecute npm ci.`);
  const licenseTarget = `licenses/${name.replace('@', '').replaceAll('/', '-')}-LICENSE.txt`;
  write(licenseTarget, fs.readFileSync(path.join(directory, licenseFile)));
  packages.push({ name, version: metadata.version, license: metadata.license, homepage, licenseFile: licenseTarget, integrity: lock.packages[`node_modules/${name}`]?.integrity });
  return directory;
}

function browserBundle(name, sourceFile, output, homepage, licenseFile) {
  const directory = register(name, homepage, licenseFile);
  // Los mapas no se distribuyen; no dejar solicitudes de depuración a archivos ausentes.
  const bundle = fs.readFileSync(path.join(directory, sourceFile), 'utf8').replace(/^\/\/[#@]\s*sourceMappingURL=.*$/gm, '').trimEnd();
  write(output, `${bundle}\n`);
}

function font(name, family, cssFile) {
  const directory = register(name, `https://fontsource.org/fonts/${family.toLowerCase()}`);
  const source = fs.readFileSync(path.join(directory, cssFile), 'utf8');
  const blocks = [...source.matchAll(/\/\* [^*]+ \*\/\s*@font-face\s*\{[^}]+\}/g)]
    .map(match => match[0]).filter(block => /-latin(?:-ext)?-[a-z]+-normal\.woff2/.test(block));
  if (blocks.length !== 2) throw new Error(`Subconjuntos latinos inesperados: ${name}`);
  for (const block of blocks) {
    const sourcePath = block.match(/url\(\.\/([^)]*)\)/)[1];
    write(`fonts/${sourcePath}`, fs.readFileSync(path.join(directory, sourcePath)));
  }
  // Conservar los nombres de familia que ya utiliza la interfaz.
  return blocks.join('\n\n').replaceAll(`${family} Variable`, family);
}

async function main() {
  register('tailwindcss', 'https://v3.tailwindcss.com/docs/installation');
  const config = require('../tailwind.config');
  // Rutas absolutas: mismo resultado desde frontend, backend o la raíz del proyecto.
  config.content = contentFiles().map(relative => path.join(frontendRoot, relative));
  const input = fs.readFileSync(path.join(frontendRoot, 'styles/tailwind.css'), 'utf8');
  const css = await postcss([tailwindcss(config), cssnano({ preset: 'default' })]).process(input, {
    from: path.join(frontendRoot, 'styles/tailwind.css'), map: false
  });
  write('tailwind/tailwind.min.css', `/*! SBSS: Tailwind CSS ${packageJson.devDependencies.tailwindcss}, MIT; generado con npm run build. */\n${css.css}\n`);
  browserBundle('lucide', 'dist/umd/lucide.min.js', 'lucide/lucide.min.js', 'https://lucide.dev/guide/lucide');
  browserBundle('jspdf', 'dist/jspdf.umd.min.js', 'jspdf/jspdf.umd.min.js', 'https://github.com/parallax/jsPDF');
  browserBundle('jspdf-autotable', 'dist/jspdf.plugin.autotable.min.js', 'jspdf-autotable/jspdf.plugin.autotable.min.js', 'https://github.com/simonbengtsson/jsPDF-AutoTable', 'LICENSE.txt');
  browserBundle('xlsx-js-style', 'dist/xlsx.bundle.js', 'xlsx-js-style/xlsx.bundle.js', 'https://github.com/gitbrent/xlsx-js-style');
  write('licenses/xlsx-js-style-bundle-LICENSE.txt', fs.readFileSync(path.join(frontendRoot, 'node_modules/xlsx-js-style/dist/LICENSE')));
  const fonts = [font('@fontsource-variable/inter', 'Inter', 'index.css'), font('@fontsource-variable/fraunces', 'Fraunces', 'standard.css')];
  write('fonts/fonts.css', `/* Fuentes locales Fontsource 5.3.0. Licencias SIL OFL en ../licenses/. */\n${fonts.join('\n\n')}\n`);
  const manifest = {
    format: 1,
    contentSha256: contentDigest(),
    tools: { node: '>=24', tailwindcss: packageJson.devDependencies.tailwindcss, postcss: packageJson.devDependencies.postcss, cssnano: packageJson.devDependencies.cssnano },
    transformation: 'UMD originales sin comentarios sourceMappingURL; CSS Tailwind compilado; Fontsource latin y latin-ext con nombres de familia Inter/Fraunces.',
    packages,
    assets: assets.sort((a, b) => a.file.localeCompare(b.file, 'en'))
  };
  fs.writeFileSync(path.join(vendorRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Recursos locales generados: ${assets.length} archivos, ${assets.reduce((total, asset) => total + asset.bytes, 0)} bytes.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
