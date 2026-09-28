const path = require('node:path');
const fs = require('node:fs');
const PDFDocument = require('pdfkit');

const MARCAS = Object.freeze({
  sbss: { x: 58, y: 25, width: 145, height: 64 },
  nanas: { x: 0, y: 0, width: 595.28, height: 52 },
  silsan: { x: 22, y: 24, width: 185, height: 66 },
  ong: { x: 20, y: 25, width: 80, height: 83 },
  camara: { x: 22, y: 25, width: 190, height: 62 }
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
      size: 'A4', pdfVersion: '1.4', margins: { top: margen, bottom: 45, left: margen, right: 54 },
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
        doc.image(path.join(__dirname, '../assets/documentos', `${documento.logo}.png`), marca.x, marca.y,
          { width: marca.width, height: marca.height });
        doc.y = documento.logo === 'nanas' ? 87 : 101;
      } else {
        doc.font(negrita).fontSize(14).text(documento.empresa, margen, 35, { width: ancho, align: 'left' });
        doc.y = Math.max(101, doc.y + 20);
      }
      doc.font(negrita).fontSize(12).text(documento.titulo, documento.logo === 'ong' ? 112 : margen,
        doc.y, { width: documento.logo === 'ong' ? doc.page.width - 166 : ancho, align: 'center', lineGap: 1.5 });
      doc.y += 22;
      const opciones = { width: ancho, lineGap: 1.2 };
      let firmaImpresa = false;
      const bloques = String(documento.cuerpo).replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n+/);
      for (const [indice, bloqueOriginal] of bloques.entries()) {
        const secciones = bloqueOriginal.split('\f');
        for (const [seccion, original] of secciones.entries()) {
          if (seccion) doc.addPage();
          const bloque = original.trim();
          if (!bloque) continue;
          const fecha = indice === 0 && /\b\d{1,2}\s+de\s+\S+\s+(?:de|del)\s+\d{4}\b/i.test(bloque);
          const firma = /^(?:[_…]{5,}|Firma del responsable)/i.test(bloque);
          const archivoFirma = firma ? rutaFirma(documento.firma) : null;
          if (archivoFirma && !firmaImpresa) {
            const image = doc.openImage(archivoFirma);
            const anchoFirma = Math.min(193, image.width / 3);
            const altoFirma = anchoFirma * image.height / image.width;
            espacio(altoFirma + 18);
            doc.image(archivoFirma, margen + (ancho - anchoFirma) / 2, doc.y + 2,
              { fit: [anchoFirma, altoFirma], align: 'center', valign: 'center' });
            doc.y += altoFirma + 16;
            firmaImpresa = true;
            continue;
          }
          const asunto = /^ASUNTO\s*:/i.test(bloque);
          const lineas = bloque.split('\n');
          const registro = /^(?:Los datos|Datos para registro|Datos del|[-•]|(?:RUC|Razón social|Carrera|Área|Supervisor|Fecha de))\b/i.test(bloque);
          const estudiante = /(?:DNI|C\.E\.|CE|PASAPORTE)[: ]/i.test(bloque) && bloque.length < 260;
          const align = fecha ? 'right' : firma ? 'center' : (lineas.length === 1 && bloque.length > 150 && !registro && !estudiante) ? 'justify' : 'left';
          doc.font(fecha ? cursiva : regular).fontSize(tamano).fillColor('#000000');
          const height = doc.heightOfString(bloque, { ...opciones, align });
          if (height < doc.page.height - 117) espacio(height + (firma ? 18 : 0));
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
          const despedida = /^Atentamente[,.]?$/i.test(bloque);
          doc.y += fecha ? 17 : asunto ? 24 : introduccion ? 26 : estudiante ? 19 : saludo ? 17 : despedida ? 4 : 17;
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
