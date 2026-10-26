const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generarPdf } = require('../services/documentoPdfService');
const { leerPdf } = require('./helpers/pdf');
const { certificado } = require('./helpers/certificadoFixtures');

test('los cinco certificados conservan fondo y sello propios; ONG se emite en A4 horizontal', async () => {
  for (const marca of ['sbss', 'ong', 'nanas', 'silsan', 'camara']) {
    const { paginas } = leerPdf(await generarPdf(certificado(marca)));
    assert.equal(paginas.length, 1, marca);
    const pagina = paginas[0];
    assert.match(pagina.pagina, marca === 'ong' ? /\/MediaBox \[0 0 841.89 595.28\]/ : /\/MediaBox \[0 0 595.28 841.89\]/);
    assert.equal(pagina.imagenes.length, 2, 'Fondo y sello independientes');
    assert.equal(pagina.imagenes[0].x, 0);
    assert.equal(pagina.imagenes[0].y, 0);
    const texto = pagina.textos.map(item => item.texto).join(' ');
    assert.match(texto, /Ana María Prueba Visual/);
    assert.match(texto, /DNI 99990001/);
    assert.match(texto, /320 horas/);
    assert.match(texto, /3 de noviembre de 2026/);
    assert.doesNotMatch(texto, /\{\{|ORUE CADILLO|GASTAÑADUI|70970096|78459944|73912967/);
    const despedida = pagina.textos.find(item => item.texto === 'Atentamente,');
    const sello = pagina.imagenes[1];
    assert.ok(sello.y > despedida.y && sello.y + sello.alto < (marca === 'ong' ? 560 : 760));
  }
});

test('un responsable distinto conserva su nombre y el espacio de firma manual', async () => {
  const documento = certificado();
  documento.cuerpo = documento.cuerpo.replace(documento.supervisor, 'Responsable Nuevo');
  documento.firma = null;
  documento.firmante_empresa = 'Responsable Nuevo';
  const { paginas } = leerPdf(await generarPdf(documento));
  assert.equal(paginas.flatMap(pagina => pagina.imagenes).length, 1);
  assert.match(paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' '), /Responsable Nuevo/);
});

test('actividades extensas continúan sobre el membrete, sin perder texto ni separar la despedida del sello', async () => {
  const documento = certificado('ong');
  const actividad = '- ACTIVIDAD DE PRUEBA con información del desempeño y labores realizadas.\n';
  documento.cuerpo = documento.cuerpo.replace(/- Brindar[\s\S]*?\n\nSe le expide/, actividad.repeat(120) + 'FIN ACTIVIDADES\n\nSe le expide');
  const { paginas } = leerPdf(await generarPdf(documento));
  assert.ok(paginas.length > 2);
  const texto = paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' ');
  assert.equal((texto.match(/ACTIVIDAD DE PRUEBA/g) || []).length, 120);
  assert.match(texto, /FIN ACTIVIDADES/);
  assert.equal(paginas.at(-1).imagenes.length, 2);
  assert.ok(paginas.at(-1).textos.some(item => item.texto === 'Atentamente,'));
  for (const pagina of paginas) assert.ok(pagina.textos.every(item => item.y >= 130 && item.y < 560));
});

test('las ediciones de plantilla y las notas después del firmante se conservan', async () => {
  const documento = certificado('nanas', { titulo: 'CERTIFICADO PERSONALIZADO' });
  documento.cuerpo += '\nNOTA PERSONALIZADA DE RRHH';
  const { paginas } = leerPdf(await generarPdf(documento));
  const texto = paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' ');
  assert.match(texto, /CERTIFICADO PERSONALIZADO/);
  assert.match(texto, /NOTA PERSONALIZADA DE RRHH/);
});
