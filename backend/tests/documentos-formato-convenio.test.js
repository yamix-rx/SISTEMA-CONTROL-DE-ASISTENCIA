const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generarPdfFormal } = require('../services/documentoFormalPdfService');
const { leerPdf } = require('./helpers/pdf');
const { convenio } = require('./helpers/convenioFixtures');

const carreras = ['sistemas', 'industrial', 'administracion', 'marketing', 'audiovisual', 'periodismo', 'derecho', 'negocios'];

test('los ocho convenios UPN conservan todos los apartados, anexos y las firmas paralelas en A4', async () => {
  for (const carrera of carreras) {
    const documento = convenio(carrera);
    const { paginas, fuente } = leerPdf(await generarPdfFormal(documento));
    assert.ok(paginas.length >= 5 && paginas.length <= 9, carrera);
    const texto = paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' ');
    for (const apartado of ['PRIMERO:', 'NOVENO:', 'MODELO DE PLAN DE CAPACITACIÓN',
      'Competencias específicas', 'MONITOREO Y EVALUACIÓN', 'Este anexo contiene información fidedigna']) {
      assert.ok(texto.includes(apartado), `${carrera}: ${apartado}`);
    }
    assert.ok(texto.includes(documento.carrera), carrera);
    assert.ok(!texto.includes('{{') && !texto.includes('Página '));
    const duracion = paginas.flatMap(pagina => pagina.textos).find(item => item.texto === 'IV. DURACIÓN');
    assert.equal(duracion.x, 64, 'Duración inicia fuera del cuadro de competencias');
    assert.match(fuente, /\/BaseFont \/Helvetica/);
    assert.equal(paginas[0].imagenes.length, 0, 'Los convenios no llevan el membrete de las cartas');
    const contexto = paginas.find(pagina => pagina.textos.some(item => item.texto === 'V. CONTEXTO FORMATIVO'));
    assert.ok(contexto.textos.some(item => item.texto === 'EQUIPO PERSONAL'), 'La tabla breve de contexto queda con su título');
    for (const pagina of paginas) {
      assert.match(pagina.pagina, /\/MediaBox \[0 0 595.28 841.89\]/);
      assert.ok(pagina.textos.every(item => item.y >= 60 && item.y < 795), `${carrera}: texto dentro de los márgenes`);
    }
    const firmas = paginas.filter(pagina => pagina.textos.some(item => item.texto === '(Estudiante)'));
    assert.equal(firmas.length, 2, 'Convenio y plan tienen sus propias firmas');
    for (const pagina of firmas) {
      const estudiante = pagina.textos.find(item => item.texto === '(Estudiante)');
      const representante = pagina.textos.find(item => item.texto.includes('REPRESENTANTE DE'));
      const institucion = pagina.textos.find(item => item.texto.includes('CENTRO DE FORMACIÓN') && item.y > estudiante.y);
      assert.ok(representante.x > estudiante.x && Math.abs(representante.y - estudiante.y) < 60, 'Estudiante y empresa comparten una fila');
      assert.ok(institucion && institucion.y > estudiante.y, 'El centro de formación firma debajo');
    }
  }
});

test('la firma corporativa se mantiene sobre su representante sin ocultar sus datos', async () => {
  const documento = { ...convenio(), firma: 'sbss' };
  const { paginas } = leerPdf(await generarPdfFormal(documento));
  const firmadas = paginas.filter(pagina => pagina.imagenes.length);
  assert.equal(firmadas.length, 2);
  for (const pagina of firmadas) {
    const imagen = pagina.imagenes[0];
    const representante = pagina.textos.find(item => item.texto.includes('REPRESENTANTE DE'));
    assert.ok(imagen.x > 295 && imagen.y + imagen.alto < representante.y);
    assert.ok(pagina.textos.some(item => item.texto.includes('Contacto: 900')));
  }
  documento.firmante_empresa = 'OTRO REPRESENTANTE';
  const sinFirma = leerPdf(await generarPdfFormal(documento));
  assert.ok(sinFirma.paginas.every(pagina => pagina.imagenes.length === 0));
});

test('el plan individual conserva casillas, condiciones tabuladas y datos de varias líneas', async () => {
  const { paginas } = leerPdf(await generarPdfFormal(convenio('sistemas', 'plan_capacitacion', {
    horario: 'Lunes y miércoles: 08:00 a 13:00.\nMartes y jueves: 14:00 a 19:00.'
  })));
  const textos = paginas.flatMap(pagina => pagina.textos);
  assert.equal(textos.filter(item => item.texto === 'X').length, 1, 'Marca solamente el plan de pasantía');
  assert.ok(!textos.some(item => item.texto.startsWith('[ ]')));
  const subvencion = textos.find(item => item.texto.startsWith('Monto de la subvención'));
  const noAplica = textos.find(item => item.texto === 'No aplica.');
  assert.ok(noAplica.x > subvencion.x + 100 && Math.abs(noAplica.y - subvencion.y) < 1);
  assert.ok(textos.some(item => item.texto.includes('Martes y jueves')));
  assert.equal(textos.filter(item => item.texto === '(Estudiante)').length, 1);
});

test('las filas extensas continúan con su cabecera y sin recortar el contenido del plan', async () => {
  const documento = convenio('sistemas', 'plan_capacitacion');
  documento.cuerpo = 'Competencias específicas | Indicador de logro\n' +
    `INICIO ${'Actividad formativa extensa de prueba. '.repeat(180)} FIN DE LA COMPETENCIA | ${'Indicador de prueba. '.repeat(130)} FIN DEL INDICADOR`;
  const { paginas } = leerPdf(await generarPdfFormal(documento));
  assert.ok(paginas.length >= 3);
  const texto = paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' ').replace(/\s+/g, ' ');
  assert.match(texto, /FIN DE LA COMPETENCIA/);
  assert.match(texto, /FIN DEL INDICADOR/);
  assert.equal((texto.match(/Actividad/g) || []).length, 180);
  for (const pagina of paginas) {
    assert.ok(pagina.textos.some(item => item.texto === 'Competencias específicas'));
    assert.ok(pagina.textos.every(item => item.y >= 60 && item.y < 795));
  }
});

test('las tablas personalizadas conservan todas las columnas, incluidas filas de distinto ancho', async () => {
  const documento = convenio('sistemas', 'plan_capacitacion');
  documento.cuerpo = 'Primera | Segunda | MARCADOR TERCERA\nA | B | VALOR TERCERO\nC | D | E | VALOR CUARTO' +
    '\n\nUNO | DOS | TRES | CUATRO | CINCO | SEIS | SIETE\n1 | 2 | 3 | 4 | 5 | 6 | VALOR SÉPTIMO';
  const { paginas } = leerPdf(await generarPdfFormal(documento));
  const textos = paginas.flatMap(pagina => pagina.textos);
  const contenido = textos.map(item => item.texto).join(' ').replace(/\s+/g, ' ');
  for (const marcador of ['MARCADOR TERCERA', 'VALOR TERCERO', 'VALOR CUARTO', 'SIETE', 'VALOR SÉPTIMO']) {
    assert.ok(contenido.includes(marcador), marcador);
  }
});

test('cabeceras, casillas y firmas mayores que una hoja fluyen sin perder contenido ni posiciones', async () => {
  const documento = convenio('sistemas', 'plan_capacitacion');
  documento.cuerpo = `Competencias ${'CABECERA '.repeat(1100)} FIN CABECERA | OTRA COLUMNA\nFILA CONSERVADA | FIN TABLA` +
    `\n\n[X] ${'CASILLA '.repeat(1100)} FIN CASILLA` +
    `\n\n_______________________________\n${'ESTUDIANTE '.repeat(1100)} FIN ESTUDIANTE` +
    '\n\n_______________________________\nFIRMA EMPRESA' +
    '\n\n_______________________________\nFIRMA INSTITUCIÓN\n\nMARCADOR POSTERIOR';
  const { paginas } = leerPdf(await generarPdfFormal(documento));
  const texto = paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' ').replace(/\s+/g, ' ');
  for (const marcador of ['FIN CABECERA', 'OTRA COLUMNA', 'FILA CONSERVADA', 'FIN TABLA', 'FIN CASILLA',
    'FIN ESTUDIANTE', 'FIRMA EMPRESA', 'FIRMA INSTITUCIÓN', 'MARCADOR POSTERIOR']) assert.ok(texto.includes(marcador), marcador);
  assert.equal((texto.match(/CABECERA/g) || []).length, 1101);
  assert.equal((texto.match(/CASILLA/g) || []).length, 1101);
  assert.equal((texto.match(/ESTUDIANTE/g) || []).length, 1101);
  for (const pagina of paginas) assert.ok(pagina.textos.every(item => item.y >= 60 && item.y < 795));
});
