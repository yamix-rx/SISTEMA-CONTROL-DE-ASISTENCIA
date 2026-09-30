const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generarPdfCarta, rutaFirma } = require('../services/documentoCartaPdfService');
const { catalogoModelos } = require('../services/documentoModelosService');
const { leerPdf } = require('./helpers/pdf');

function carta(clave = 'sbss', adicionales = {}) {
  const modelo = catalogoModelos().find(item => item.id === `carta_aceptacion_${clave}`);
  const campos = {
    ...modelo.datos_predeterminados,
    empresa: modelo.nombre.split(' · ')[1], ruc: modelo.empresa_ruc,
    trabajador: 'María José Pérez García', documento: 'DNI 00000000',
    fecha: '24 de agosto de 2026', horas: '320', area: 'Logística',
    formacion_academica: 'Carrera: Administración.\nInstitución educativa: Universidad de Prueba.'
  };
  return { ...modelo, empresa: campos.empresa, firma: clave,
    cuerpo: modelo.cuerpo.replace(/\{\{(\w+)\}\}/g, (_, campo) => campos[campo] || ''),
    ...adicionales };
}

test('carta SBSS conserva el formato de una hoja Carta con membrete, fecha y firma', async () => {
  const { fuente, paginas } = leerPdf(await generarPdfCarta(carta()));
  assert.equal(paginas.length, 1, 'La carta completa y su firma deben caber en una hoja');
  assert.match(paginas[0].pagina, /\/MediaBox \[0 0 612 792\]/);
  assert.match(fuente, /\/BaseFont \/Times-Roman/);
  const { textos, imagenes } = paginas[0];
  assert.equal(imagenes.length, 2);
  const [logo, sello] = imagenes;
  assert.ok(logo.x < 80 && logo.y < 40 && logo.ancho >= 140, 'Logo visible arriba a la izquierda');
  assert.equal(logo.ancho / logo.alto, 480 / 210, 'El logo conserva su proporción');
  const titulo = textos.find(texto => texto.texto.startsWith('CARTA DE ACEPTACIÓN'));
  assert.equal(titulo.fuente, 'Times-Bold');
  assert.ok(titulo.y > logo.y + logo.alto && titulo.y < 130);
  const fecha = textos.find(texto => texto.texto.includes('24 de agosto'));
  assert.equal(fecha.fuente, 'Times-Italic');
  assert.ok(fecha.x > 350, 'Fecha alineada a la derecha');
  const asunto = textos.find(texto => texto.texto.startsWith('ASUNTO:'));
  assert.equal(asunto.fuente, 'Times-Bold');
  const destinatario = textos.find(texto => texto.texto.startsWith('Director Académico'));
  assert.ok(asunto.y - destinatario.y < 18, 'Asunto seguido del destinatario, sin hueco extra');
  const despedida = textos.find(texto => texto.texto === 'Atentamente,');
  assert.ok(sello.y > despedida.y && sello.y + sello.alto < 747);
  assert.ok(sello.x + sello.ancho / 2 > 340, 'Firma ligeramente a la derecha');
  assert.ok(textos.some(texto => texto.texto.includes('Universidad de Prueba')));
  assert.ok(!textos.some(texto => texto.texto.startsWith('Página')));
});

test('los cinco modelos conservan sus logos sin deformación y su firma en una hoja', async () => {
  for (const clave of ['sbss', 'nanas', 'silsan', 'ong', 'camara']) {
    const { paginas } = leerPdf(await generarPdfCarta(carta(clave)));
    assert.equal(paginas.length, 1, `Carta completa de ${clave}`);
    const [logo, sello] = paginas[0].imagenes;
    assert.ok(logo && sello, `Logo y firma de ${clave}`);
    const png = fs.readFileSync(path.join(__dirname, '../assets/documentos', `${clave}.png`));
    assert.ok(Math.abs(logo.ancho / logo.alto - png.readUInt32BE(16) / png.readUInt32BE(20)) < 0.00001);
    assert.ok(logo.y + logo.alto < 100, `Membrete dentro de la cabecera de ${clave}`);
    assert.ok(sello.y + sello.alto <= 747, `Firma dentro de la hoja de ${clave}`);
    if (clave === 'nanas') {
      assert.equal(logo.x, 0);
      assert.equal(logo.ancho, 612, 'Conserva la banda de Nanas y Amas');
      assert.ok(paginas[0].textos.some(texto => texto.texto.includes('908')),
        'Conserva los datos de contacto después de la firma');
    }
  }
});

test('un texto extenso se pagina sin perder contenido y mantiene despedida y firma juntas', async () => {
  const parrafo = 'Contenido de prueba para una carta extensa, con información adicional del estudiante y de las actividades realizadas en la empresa. ';
  const cuerpo = `24 de agosto de 2026\n\n${parrafo.repeat(70)}\n\nMARCADOR FINAL\n\nAtentamente,\n\n_______________________________\nResponsable`;
  const { paginas } = leerPdf(await generarPdfCarta(carta('sbss', { cuerpo })));
  assert.ok(paginas.length > 1);
  const ultima = paginas.at(-1);
  assert.ok(ultima.textos.some(texto => texto.texto === 'MARCADOR FINAL'));
  assert.ok(ultima.textos.some(texto => texto.texto === 'Atentamente,'));
  assert.equal(ultima.imagenes.length, 1, 'La firma está con la despedida');
  for (const pagina of paginas) {
    assert.ok(pagina.textos.every(texto => texto.y > 0 && texto.y < 780), 'Texto dentro de la hoja');
    assert.ok(pagina.textos.some(texto => texto.texto.startsWith('Página ')), 'Numera cartas de varias hojas');
  }
});

test('sin firma corporativa conserva el nombre y el espacio para firma manual', async () => {
  const { paginas } = leerPdf(await generarPdfCarta(carta('sbss', { firma: null })));
  assert.equal(paginas.length, 1);
  assert.equal(paginas[0].imagenes.length, 1);
  assert.ok(paginas[0].textos.some(texto => texto.texto.startsWith('________')));
  assert.ok(paginas[0].textos.some(texto => texto.texto === 'Sofía Beatriz Silva Santisteban'));
  assert.equal(rutaFirma('../sbss'), null);
  assert.equal(rutaFirma('constructor'), null);
});
