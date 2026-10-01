const path = require('node:path');
const fs = require('node:fs');
const PDFDocument = require('pdfkit');

// Las dimensiones de los sellos no son las del membrete. La altura del logo
// se obtiene de su imagen para conservar la proporción de cada empresa.
const MARCAS = Object.freeze({
  sbss: { x: 48, y: 24, width: 160 },
  nanas: { x: 0, y: 0, banda: true },
  silsan: { x: 48, y: 24, width: 185 },
  ong: { x: 54, y: 24, width: 68 },
  camara: { x: 48, y: 24, width: 190 }
});

function rutaFirma(clave) {
  if (!Object.hasOwn(MARCAS, clave || '')) return null;
  const archivo = path.join(__dirname, '../assets/documentos', `firma-${clave}.png`);
  return fs.existsSync(archivo) ? archivo : null;
}

function generarPdfCarta(documento) {
  return new Promise((resolve, reject) => {
    const margen = 72;
    const doc = new PDFDocument({
      size: 'LETTER', pdfVersion: '1.4', margins: { top: margen, bottom: 45, left: margen, right: 54 },
      bufferPages: true,
      info: { Title: documento.titulo, Author: documento.empresa, Subject: documento.modelo_nombre || documento.titulo }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      const ancho = doc.page.width - margen - 54;
      const regular = documento.logo === 'nanas' ? 'Helvetica' : 'Times-Roman';
      const negrita = documento.logo === 'nanas' ? 'Helvetica-Bold' : 'Times-Bold';
      const cursiva = documento.logo === 'nanas' ? 'Helvetica-Oblique' : 'Times-Italic';
      const tamano = documento.logo === 'nanas' ? 11 : 12;
      const espacio = height => { if (doc.y + height > doc.page.height - 45) doc.addPage(); };
      const marca = Object.hasOwn(MARCAS, documento.logo || '') ? MARCAS[documento.logo] : null;
      if (marca) {
        const archivoLogo = path.join(__dirname, '../assets/documentos', `${documento.logo}.png`);
        const imagenLogo = doc.openImage(archivoLogo);
        const anchoLogo = marca.banda ? doc.page.width : marca.width;
        const altoLogo = anchoLogo * imagenLogo.height / imagenLogo.width;
        doc.image(archivoLogo, marca.x, marca.y, { width: anchoLogo });
        doc.y = Math.max(marca.banda ? 82 : 96, marca.y + altoLogo + 10);
      } else {
        doc.font(negrita).fontSize(14).text(documento.empresa, margen, 35, { width: ancho, align: 'left' });
        doc.y = Math.max(101, doc.y + 20);
      }
      doc.font(negrita).fontSize(12).text(documento.titulo, 54,
        doc.y, { width: doc.page.width - 108, align: 'center', lineGap: 1.5 });
      doc.y += 20;
      const opciones = { width: ancho, lineGap: 1.2 };
      const archivoSello = rutaFirma(documento.firma);
      const imagenSello = archivoSello ? doc.openImage(archivoSello) : null;
      const anchoFirma = imagenSello ? Math.min(193, imagenSello.width / 3) : 0;
      const altoFirma = imagenSello ? anchoFirma * imagenSello.height / imagenSello.width : 0;
      const esFirma = bloque => /^(?:[_…]{5,}|Firma del responsable)/i.test(bloque);
      let firmaImpresa = false;
      const bloques = String(documento.cuerpo).replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n+/);
      for (const [indice, bloqueOriginal] of bloques.entries()) {
        const secciones = bloqueOriginal.split('\f');
        for (const [seccion, original] of secciones.entries()) {
          if (seccion) doc.addPage();
          const bloque = original.trim();
          if (!bloque) continue;
          const fecha = indice === 0 && !bloque.includes('\n') && /\b\d{1,2}\s+de\s+\S+\s+(?:de|del)\s+\d{4}\b/i.test(bloque);
          const firma = esFirma(bloque);
          if (firma && archivoSello && !firmaImpresa) {
            espacio(altoFirma + 18);
            doc.image(archivoSello, margen + ancho * 0.62 - anchoFirma / 2, doc.y + 2,
              { fit: [anchoFirma, altoFirma], align: 'center', valign: 'center' });
            doc.y += altoFirma + 16;
            firmaImpresa = true;
            continue;
          }
          const asunto = /^ASUNTO\s*:/i.test(bloque);
          const lineas = bloque.split('\n');
          const registro = /^(?:Los datos\b|Datos para registro\b|Datos del\b|[-•]|(?:RUC|Razón social|Carrera|Área|Supervisor|Fecha de)\b)/i.test(bloque);
          const estudiante = /(?:[—–]| -)\s*(?:DNI|C\.E\.|CE|PASAPORTE)[: ]/i.test(bloque) && bloque.length < 260;
          const align = fecha ? 'right' : firma ? 'center' : (lineas.length === 1 && bloque.length > 150 && !registro && !estudiante) ? 'justify' : 'left';
          doc.font(fecha ? cursiva : regular).fontSize(tamano).fillColor('#000000');
          const height = doc.heightOfString(bloque, { ...opciones, align });
          const despedida = /^Atentamente[,.]?$/i.test(bloque);
          const siguiente = (bloques[indice + 1] || '').trim();
          // La despedida acompaña a la firma cuando un texto editado necesita
          // otra página; no se reduce la letra ni se recorta el contenido.
          const reservarFirma = despedida && !siguiente.includes('\f') && esFirma(siguiente);
          const espacioFirma = reservarFirma ? 4 + (archivoSello && !firmaImpresa ? altoFirma + 18
            : doc.heightOfString(siguiente, { ...opciones, align: 'center' }) + 18) : 0;
          if (height < doc.page.height - 117) espacio(height + espacioFirma + (firma ? 18 : 0));
          if (firma) doc.y += 14;
          if (asunto) {
            const corte = bloque.indexOf(':') + 1;
            doc.font(negrita).text(bloque.slice(0, corte) + ' ', margen, doc.y, { ...opciones, continued: true });
            doc.font(regular).text(bloque.slice(corte).trim(), { ...opciones, continued: false });
          } else {
            doc.text(bloque, margen, doc.y, { ...opciones, align });
          }
          const saludo = /^De mi consideración/i.test(bloque);
          const introduccion = /^Por medio de la presente/i.test(bloque);
          const antesDelAsunto = /^ASUNTO\s*:/i.test(siguiente);
          doc.y += fecha ? 17 : antesDelAsunto ? 0 : asunto ? 24 : introduccion ? 22 : estudiante ? 17 : saludo ? 17 : despedida ? 4 : 17;
        }
      }
      // Las cartas originales son de una página y no tienen pie. Numerar solo
      // una plantilla extensa que haya necesitado más páginas.
      const range = doc.bufferedPageRange();
      if (range.count > 1) {
        for (let n = range.start; n < range.start + range.count; n++) {
          doc.switchToPage(n);
          const bottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.font(regular).fontSize(8).text(`Página ${n + 1} de ${range.count}`, margen, doc.page.height - 25,
            { width: ancho, align: 'center', lineBreak: false });
          doc.page.margins.bottom = bottom;
        }
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}

module.exports = { generarPdfCarta, rutaFirma };
