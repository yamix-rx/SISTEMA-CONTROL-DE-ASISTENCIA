const path = require('node:path');
const PDFDocument = require('pdfkit');

// Membretes extraídos de los modelos proporcionados por el usuario.
const MEMBRETES = Object.freeze({
  sbss: { ancho: 145, alto: 64 },
  nanas: { ancho: 595.28, alto: 52, banda: true },
  silsan: { ancho: 185, alto: 66 },
  ong: { ancho: 76, alto: 79 },
  camara: { ancho: 190, alto: 62 }
});

function generarPdfFormal(documento) {
  if (documento.diseno === 'carta' || ['aceptacion', 'constancia_practicas', 'culminacion', 'carta', 'horas', 'trabajo'].includes(documento.codigo)) {
    return require('./documentoCartaPdfService').generarPdfCarta(documento);
  }
  return new Promise((resolve, reject) => {
    const carta = documento.codigo === 'aceptacion';
    const regular = carta ? 'Times-Roman' : 'Helvetica';
    const bold = carta ? 'Times-Bold' : 'Helvetica-Bold';
    const size = carta ? 11.5 : 10;
    const margen = 54;
    const doc = new PDFDocument({
      size: 'A4', pdfVersion: '1.4', margins: { top: margen, bottom: 58, left: margen, right: margen },
      bufferPages: true, info: { Title: documento.titulo, Author: documento.empresa, Subject: documento.modelo_nombre || documento.titulo }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
      const ancho = doc.page.width - margen * 2;
      const bottom = () => doc.page.height - doc.page.margins.bottom;
      const espacio = alto => { if (doc.y + alto > bottom()) doc.addPage(); };
      const texto = (valor, options = {}) => {
        doc.font(options.bold ? bold : regular).fontSize(options.size || size).fillColor('#111111');
        const settings = { width: ancho, lineGap: carta ? 2 : 1.8, align: options.align || 'left', ...options };
        delete settings.bold;
        delete settings.size;
        const alto = doc.heightOfString(valor, settings);
        if (alto < bottom() - margen) espacio(alto);
        doc.text(valor, margen, doc.y, settings);
      };
      const membrete = Object.hasOwn(MEMBRETES, documento.logo || '') ? MEMBRETES[documento.logo] : null;
      if (carta && membrete) {
        doc.image(path.join(__dirname, '../assets/documentos', documento.logo + '.png'), membrete.banda ? 0 : margen,
          membrete.banda ? 0 : 30, { width: membrete.ancho, height: membrete.alto });
        doc.y = membrete.banda ? 82 : Math.max(110, 42 + membrete.alto);
      }
      texto(documento.titulo, { bold: true, size: carta ? 12 : 13, align: 'center' });
      doc.moveDown(carta ? 1.2 : 0.9);

      const tabla = filas => {
        const columnas = Math.max(...filas.map(fila => fila.length));
        const celda = ancho / columnas;
        const padding = 7;
        for (const [indice, fila] of filas.entries()) {
          doc.font(indice === 0 ? bold : regular).fontSize(9);
          const alto = Math.max(...fila.map(valor => doc.heightOfString(valor, { width: celda - padding * 2, lineGap: 1.5 }))) + padding * 2;
          // Los campos validados y las filas de los modelos caben en una página.
          // Si una plantilla editada contiene una fila extraordinariamente larga,
          // se imprime como párrafos para conservar todo su contenido.
          if (alto > bottom() - margen) {
            fila.forEach(valor => texto(valor));
            continue;
          }
          espacio(alto);
          const y = doc.y;
          for (let columna = 0; columna < columnas; columna++) {
            const x = margen + columna * celda;
            doc.save().lineWidth(0.5).strokeColor('#777777');
            if (indice === 0) doc.rect(x, y, celda, alto).fillAndStroke('#eeeeee', '#777777');
            else doc.rect(x, y, celda, alto).stroke();
            doc.restore();
            doc.font(indice === 0 ? bold : regular).fontSize(9).fillColor('#111111')
              .text(fila[columna] || '', x + padding, y + padding, { width: celda - padding * 2, lineGap: 1.5 });
          }
          doc.x = margen;
          doc.y = y + alto;
        }
        doc.moveDown(0.7);
      };

      const secciones = String(documento.cuerpo).replace(/\r\n?/g, '\n').split('\f');
      secciones.forEach((seccion, pagina) => {
        if (pagina > 0) doc.addPage();
        const lineas = seccion.trim().split('\n');
        let enFirma = false;
        for (let i = 0; i < lineas.length; i++) {
          const linea = lineas[i].trim();
          if (!linea) { enFirma = false; doc.moveDown(carta ? 0.6 : 0.45); continue; }
          if (linea.includes(' | ')) {
            const filas = [];
            while (i < lineas.length && lineas[i].includes(' | ')) filas.push(lineas[i++].split(' | ').map(x => x.trim()));
            i--;
            tabla(filas);
            continue;
          }
          const mayusculas = /[A-ZÁÉÍÓÚÑ]/.test(linea) && linea === linea.toUpperCase() && linea.length < 115;
          const encabezado = mayusculas || /^(?:[IVX]+\.|[A-D]\.)\s/.test(linea);
          const clausula = /^(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]TIMO|OCTAVO|NOVENO)\s*:/.test(linea);
          if (encabezado) espacio(50);
          const firma = /^[_…]{5}/.test(linea);
          if (firma && documento.firma && documento.firmante_empresa && lineas[i + 1]?.trim() === documento.firmante_empresa) {
            const archivoFirma = require('./documentoCartaPdfService').rutaFirma(documento.firma);
            if (archivoFirma) {
              const firmaImagen = doc.openImage(archivoFirma);
              const firmaAncho = Math.min(193, firmaImagen.width / 3);
              const firmaAlto = firmaAncho * firmaImagen.height / firmaImagen.width;
              espacio(firmaAlto + 20);
              doc.image(archivoFirma, margen + (ancho - firmaAncho) / 2, doc.y + 6, { width: firmaAncho, height: firmaAlto });
              doc.y += firmaAlto + 18;
              while (i + 1 < lineas.length && lineas[i + 1].trim()) i++;
              enFirma = false;
              continue;
            }
          }
          if (firma) { espacio(100); doc.moveDown(1.5); enFirma = true; }
          const fecha = carta && i === 0;
          const parrafo = linea.length > 150 && !encabezado && !/^[-•a-z0-9]+[).]?\s/.test(linea);
          if (clausula) {
            const limite = linea.indexOf(':') + 1;
            doc.font(regular).fontSize(size);
            espacio(doc.heightOfString(linea, { width: ancho, lineGap: 1.8 }) + 4);
            doc.font(bold).text(linea.slice(0, limite) + ' ', margen, doc.y, { width: ancho, lineGap: 1.8, continued: true });
            doc.font(regular).text(linea.slice(limite).trim(), { continued: false, align: 'justify', lineGap: 1.8 });
          } else {
            texto(linea, {
              bold: encabezado,
              size: encabezado ? size + 0.3 : size,
              align: fecha ? 'right' : enFirma ? 'center' : parrafo ? 'justify' : 'left'
            });
          }
          if (encabezado) doc.moveDown(0.3);
        }
      });
      const range = doc.bufferedPageRange();
      for (let n = range.start; n < range.start + range.count; n++) {
        doc.switchToPage(n);
        // El pie está fuera del margen del cuerpo: ampliar temporalmente el área
        // evita que PDFKit lo desplace a una página adicional.
        const margenInferior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font(regular).fontSize(8).fillColor('#666666').text(
          `Página ${n + 1} de ${range.count}`, margen, doc.page.height - 35,
          { width: ancho, align: 'center', lineBreak: false }
        );
        doc.page.margins.bottom = margenInferior;
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}

module.exports = { generarPdfFormal };
