'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { frontendRoot } = require('../scripts/asset-utils');
const { verifyAssets } = require('../scripts/verify-assets');

function vendor(file) { return fs.readFileSync(path.join(frontendRoot, 'vendor', file), 'utf8'); }
function browserContext() {
  const context = vm.createContext({
    console, atob, btoa, TextEncoder, TextDecoder, Blob, ArrayBuffer,
    Uint8Array, Uint16Array, Int32Array, Uint32Array, setTimeout, clearTimeout,
    navigator: { userAgent: 'SBSS: prueba local sin red' },
    document: { createElement: () => ({ style: {}, getContext: () => ({}) }) }
  });
  context.window = context;
  context.self = context;
  return context;
}
function load(context, file) { vm.runInContext(vendor(file), context, { filename: file }); }

test('los recursos distribuidos y las fuentes de Tailwind conservan su integridad', () => {
  assert.deepEqual(verifyAssets({ manifestOnly: true }).errors, []);
});

test('las páginas y hojas de estilo resuelven sus recursos sin CDN', () => {
  assert.deepEqual(verifyAssets().errors, []);
});

test('jsPDF y AutoTable locales conservan la API del reporte y paginan sin perder filas', () => {
  const context = browserContext();
  load(context, 'jspdf/jspdf.umd.min.js');
  load(context, 'jspdf-autotable/jspdf.plugin.autotable.min.js');
  const doc = new context.jspdf.jsPDF('l', 'mm', 'a3');
  const rows = Array.from({ length: 180 }, (_, index) => [`María Muñoz ${index + 1}`, 'Operaciones', 120]);
  doc.text('Asistencia y prácticas', 12, 15);
  doc.autoTable({ startY: 25, head: [['Colaborador', 'Área', 'Horas']], body: rows, styles: { fontSize: 10 } });
  const pdf = Buffer.from(doc.output('arraybuffer'));
  assert.equal(doc.lastAutoTable.body.length, rows.length);
  assert.ok(doc.getNumberOfPages() > 1);
  assert.match(pdf.toString('latin1'), /^%PDF-/);
  assert.ok(pdf.includes(Buffer.from('María Muñoz 180', 'latin1')));
  assert.match(pdf.toString('latin1'), /%%EOF/);
});

test('XLSX local exporta texto, estilos, combinaciones y más de 24 horas', () => {
  const context = browserContext();
  load(context, 'xlsx-js-style/xlsx.bundle.js');
  const xlsx = context.XLSX;
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([['CONTROL', ''], ['Colaborador', 'Horas'], ['María Muñoz', 120 / 24]]);
  sheet.A2.s = { font: { bold: true }, fill: { fgColor: { rgb: '075D91' } } };
  sheet.B3.z = '[h]:mm';
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  xlsx.utils.book_append_sheet(workbook, sheet, 'ASISTENCIA');
  const bytes = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' });
  assert.equal(Buffer.from(bytes).subarray(0, 2).toString(), 'PK');
  // Se examina exclusivamente el archivo generado por la propia prueba.
  const zip = xlsx.CFB.read(new Uint8Array(bytes), { type: 'buffer' });
  const xml = name => Buffer.from(xlsx.CFB.find(zip, name).content).toString('utf8');
  assert.match(xml('/xl/styles.xml'), /formatCode="\[h\]:mm"/);
  assert.match(xml('/xl/styles.xml'), /fgColor rgb="FF075D91"/);
  assert.match(xml('/xl/worksheets/sheet1.xml'), /María Muñoz/);
  assert.match(xml('/xl/worksheets/sheet1.xml'), /<v>5<\/v>/);
  assert.match(xml('/xl/worksheets/sheet1.xml'), /mergeCell ref="A1:B1"/);
});

test('Lucide local convierte todos los iconos utilizados por las páginas en SVG', () => {
  const context = browserContext();
  load(context, 'lucide/lucide.min.js');
  const names = new Set();
  for (const file of fs.readdirSync(frontendRoot).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(frontendRoot, file), 'utf8');
    for (const match of html.matchAll(/data-lucide=["']([^"']+)["']/g)) names.add(match[1]);
  }
  assert.ok(names.size > 10);
  const replacements = [];
  const placeholders = [...names].map(name => ({
    attributes: [{ name: 'data-lucide', value: name }],
    getAttribute: () => name,
    parentNode: { replaceChild: svg => replacements.push(svg) }
  }));
  context.document.querySelectorAll = selector => selector === '[data-lucide]' ? placeholders : [];
  context.document.createElementNS = (_namespace, tag) => ({
    tag, attributes: {}, children: [],
    setAttribute(key, value) { this.attributes[key] = value; },
    appendChild(child) { this.children.push(child); }
  });
  context.lucide.createIcons();
  assert.equal(replacements.length, names.size);
  assert.ok(replacements.every(icon => icon.tag === 'svg' && icon.children.length && icon.attributes['aria-hidden'] === 'true'));
});

test('las fuentes locales contienen WOFF2 y cobertura de caracteres latinos', () => {
  const css = vendor('fonts/fonts.css');
  assert.match(css, /font-family: 'Inter'/);
  assert.match(css, /font-family: 'Fraunces'/);
  assert.match(css, /U\+0000-00FF/);
  assert.match(css, /U\+0100-02BA/);
  const files = [...css.matchAll(/url\(\.\/([^)]*)\)/g)].map(match => match[1]);
  assert.equal(files.length, 4);
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(frontendRoot, 'vendor/fonts', file));
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
  }
});

test('Tailwind compilado incluye estados ocultos, valores arbitrarios y reglas adaptables', () => {
  const css = vendor('tailwind/tailwind.min.css');
  assert.match(css, /\.hidden\{display:none\}/);
  assert.ok(css.includes('.text-\\[10px\\]'));
  assert.ok(css.includes('.z-\\[100\\]'));
  assert.match(css, /@media\s*\(min-width:768px\)/);
});
