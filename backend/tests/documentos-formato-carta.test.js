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

test('carta SBSS conserva el formato A4 del original con membrete, fecha y firma', async () => {
  const { fuente, paginas } = leerPdf(await generarPdfCarta(carta()));
  assert.equal(paginas.length, 1, 'La carta completa y su firma deben caber en una hoja');
  assert.match(paginas[0].pagina, /\/MediaBox \[0 0 595\.28 841\.89\]/);
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
  assert.ok(!textos.some(texto => texto.texto.includes('Universidad de Prueba')), 'No agrega líneas ajenas al modelo de carta');
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
    assert.ok(logo.y + logo.alto < 145, `Membrete dentro de la cabecera de ${clave}`);
    assert.ok(sello.y + sello.alto <= 797, `Firma dentro de la hoja de ${clave}`);
    if (clave === 'nanas') {
      assert.equal(logo.x, 0);
      assert.equal(logo.ancho, 595.28, 'Conserva la banda de Nanas y Amas');
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
    assert.ok(pagina.textos.every(texto => texto.y > 0 && texto.y < 830), 'Texto dentro de la hoja A4');
    assert.ok(pagina.textos.some(texto => texto.texto.startsWith('Página ')), 'Numera cartas de varias hojas');
  }
});

test('Nanas coloca fecha antes del título, institución debajo y contacto después de la firma', async () => {
  const { paginas } = leerPdf(await generarPdfCarta(carta('nanas')));
  const { textos, imagenes } = paginas[0];
  const fecha = textos.find(t => t.texto.includes('24 de agosto'));
  const titulo = textos.find(t => t.texto.startsWith('CARTA DE ACEPTACIÓN'));
  const institucion = textos.find(t => t.texto === 'UNIVERSIDAD PRIVADA DEL NORTE');
  const saludo = textos.find(t => t.texto.startsWith('Estimado'));
  assert.ok(fecha.y < titulo.y && titulo.y < institucion.y && institucion.y < saludo.y);
  assert.equal(institucion.fuente, 'Helvetica-Bold');
  const correo = textos.find(t => t.texto.includes('seleccion@gruposbss.com'));
  assert.ok(correo.y > imagenes[1].y + imagenes[1].alto && correo.y < 797);
});

test('Nanas desplaza el título cuando una ciudad larga hace que la fecha ocupe tres líneas', async () => {
  const documento = carta('nanas');
  documento.cuerpo = documento.cuerpo.replace(/^Trujillo,/, 'W'.repeat(120) + ',');
  const { paginas } = leerPdf(await generarPdfCarta(documento));
  const textos = paginas[0].textos;
  const ultimaFecha = textos.find(t => t.texto.includes('24 de agosto'));
  const titulo = textos.find(t => t.texto.startsWith('CARTA DE ACEPTACIÓN'));
  const institucion = textos.find(t => t.texto === 'UNIVERSIDAD PRIVADA DEL NORTE');
  assert.ok(ultimaFecha.y > 120, 'La fecha larga utiliza tres líneas');
  assert.ok(titulo.y - ultimaFecha.y >= 12, 'La última línea de la fecha no se superpone al título');
  assert.ok(institucion.y > titulo.y, 'La institución acompaña al título desplazado');
});

test('el sello conserva las notas personalizadas que siguen al nombre en el mismo bloque de firma', async () => {
  const nombre = 'Responsable de Prueba';
  const cuerpo = `24 de agosto de 2026\n\nAtentamente,\n\n_______________________________\n${nombre}\nMARCADOR NOTA PERSONALIZADA`;
  const { paginas } = leerPdf(await generarPdfCarta(carta('sbss', { cuerpo, firmante_empresa: nombre })));
  const textos = paginas.flatMap(pagina => pagina.textos);
  const imagenes = paginas.flatMap(pagina => pagina.imagenes);
  assert.equal(imagenes.length, 2, 'Conserva membrete y sello del firmante coincidente');
  assert.ok(textos.some(t => t.texto === 'MARCADOR NOTA PERSONALIZADA'), 'La nota no desaparece al sustituir la línea de firma');
});

test('una firma personalizada de otra persona conserva su nombre sin usar el sello corporativo', async () => {
  const cuerpo = '24 de agosto de 2026\n\nAtentamente,\n\n_______________________________\nOtra Persona de Prueba\nMARCADOR FIRMA MANUAL';
  const { paginas } = leerPdf(await generarPdfCarta(carta('sbss', { cuerpo, firmante_empresa: 'Responsable Autorizado' })));
  assert.equal(paginas.flatMap(pagina => pagina.imagenes).length, 1, 'Solo imprime el membrete');
  const textos = paginas.flatMap(pagina => pagina.textos);
  assert.ok(textos.some(t => t.texto.startsWith('________')));
  assert.ok(textos.some(t => t.texto === 'Otra Persona de Prueba'));
  assert.ok(textos.some(t => t.texto === 'MARCADOR FIRMA MANUAL'));
});

test('ONG conserva el título a la derecha del membrete y la despedida centrada', async () => {
  const { paginas } = leerPdf(await generarPdfCarta(carta('ong')));
  const { textos, imagenes } = paginas[0];
  const titulo = textos.find(t => t.texto.startsWith('CARTA DE ACEPTACIÓN'));
  assert.ok(titulo.x > imagenes[0].x + imagenes[0].ancho);
  assert.ok(titulo.y < imagenes[0].y + imagenes[0].alto);
  const despedida = textos.find(t => t.texto === 'Atentamente,');
  assert.ok(despedida.x > 250);
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
