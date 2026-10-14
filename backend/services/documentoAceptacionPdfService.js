const path = require('node:path');
const PDFDocument = require('pdfkit');
const { rutaFirma } = require('./documentoCartaPdfService');

// Coordenadas en puntos de los originales A4. Los anclajes son mínimos:
// los datos largos desplazan el contenido siguiente, nunca se superponen.
const FORMATOS = Object.freeze({
  sbss: { x: 65, y: 35, width: 145, left: 86.7, right: 76, tituloY: 104, fechaY: 138,
    anclas: { saludo: 173, destinatario: 202, consideracion: 276, introduccion: 305, estudiante: 363, duracion: 393, registro: 479, despedida: 597, firma: 622 }, firmaX: 284 },
  nanas: { x: 0, y: 0, banda: true, left: 85, right: 40, tituloY: 116, fechaY: 88,
    anclas: { saludo: 154, destinatario: 178, consideracion: 245, introduccion: 280, estudiante: 334, duracion: 373, registro: 456, despedida: 565, firma: 548 }, firmaX: 213, firmaLateral: true, pieY: 651 },
  silsan: { x: 18, y: 22, width: 210, left: 84.75, right: 76, tituloY: 101, tituloSize: 13, fechaY: 138,
    anclas: { saludo: 170, destinatario: 199, consideracion: 273, introduccion: 304, estudiante: 363, duracion: 407, registro: 495, despedida: 646, firma: 677 }, firmaX: 339, centrada: true },
  ong: { x: 20, y: 20, width: 105, left: 92.28, right: 98, tituloY: 99, tituloX: 160, tituloAncho: 350, tituloSize: 14, fechaY: 150,
    anclas: { saludo: 180, destinatario: 208, consideracion: 278, introduccion: 305, estudiante: 376, duracion: 404, registro: 489, despedida: 598, firma: 628 }, firmaX: 311, centrada: true },
  camara: { x: 34, y: 55, width: 182, left: 86.7, right: 76, tituloY: 131, fechaY: 165,
    anclas: { saludo: 187, destinatario: 216, consideracion: 291, introduccion: 322, estudiante: 383, duracion: 414, registro: 500, despedida: 605, firma: 625 }, firmaX: 225 }
});

function generarPdfAceptacion(documento) {
  return new Promise((resolve, reject) => {
    const formato = FORMATOS[documento.logo];
    const margen = formato.left;
    const doc = new PDFDocument({
      size: 'A4', pdfVersion: '1.4', margins: { top: 60, bottom: 45, left: margen, right: formato.right },
      bufferPages: true, info: { Title: documento.titulo, Author: documento.empresa, Subject: documento.modelo_nombre || documento.titulo }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      const ancho = doc.page.width - margen - formato.right;
      const nanas = documento.logo === 'nanas';
      const regular = nanas ? 'Helvetica' : 'Times-Roman';
      const negrita = nanas ? 'Helvetica-Bold' : 'Times-Bold';
      const cursiva = nanas ? regular : 'Times-Italic';
      const tamano = nanas ? 11 : 12;
      const opciones = { width: ancho, lineGap: nanas ? 2 : 1.5 };
      let primeraPagina = true;
      doc.on('pageAdded', () => { primeraPagina = false; });
      const espacio = height => { if (doc.y + height > doc.page.height - 45) doc.addPage(); };
      const anclar = tipo => {
        if (primeraPagina && formato.anclas[tipo]) doc.y = Math.max(doc.y, formato.anclas[tipo]);
      };
      const bloques = String(documento.cuerpo).replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n+/);
      const esFecha = bloque => !bloque.includes('\n') && /\b\d{1,2}\s+de\s+\S+\s+(?:de|del)\s+\d{4}\b/i.test(bloque);
      const fechaCabecera = esFecha(bloques[0] || '') ? bloques.shift() : null;
      // Nanas sitúa la institución debajo del título y la fecha por encima.
      const institucion = nanas && /^(?:UNIVERSIDAD|INSTITUTO|CENTRO DE FORMACIÓN|UPN\b)/i.test(bloques[0] || '')
        ? bloques.shift() : null;
      const fecha = y => {
        if (fechaCabecera) doc.font(cursiva).fontSize(tamano).text(fechaCabecera, margen, y, { ...opciones, align: 'right' });
      };
      doc.image(path.join(__dirname, '../assets/documentos', `${documento.logo}.png`), formato.x, formato.y,
        { width: formato.banda ? doc.page.width : formato.width });
      let tituloY = formato.tituloY;
      if (nanas && fechaCabecera) {
        fecha(formato.fechaY);
        tituloY = Math.max(tituloY, doc.y + 10);
      }
      const titulo = documento.logo === 'ong' && documento.titulo === 'CARTA DE ACEPTACIÓN PARA PROYECTO DE PASANTÍA'
        ? 'CARTA DE ACEPTACIÓN PARA PROYECTO\nDE PASANTÍA' : documento.titulo;
      doc.font(negrita).fontSize(formato.tituloSize || 12).text(titulo, formato.tituloX || 54, tituloY,
        { width: formato.tituloAncho || doc.page.width - 108, align: 'center', lineGap: 1.5 });
      if (institucion) doc.font(negrita).fontSize(11).text(institucion, 54, doc.y + 2,
        { width: doc.page.width - 108, align: 'center' });
      if (!nanas) fecha(Math.max(doc.y + 18, formato.fechaY));
      doc.y += nanas ? 14 : 18;

      const archivoSello = rutaFirma(documento.firma);
      const imagenSello = archivoSello ? doc.openImage(archivoSello) : null;
      const anchoFirma = imagenSello ? Math.min(193, imagenSello.width / 3) : 0;
      const altoFirma = imagenSello ? anchoFirma * imagenSello.height / imagenSello.width : 0;
      const esFirma = bloque => /^(?:[_…]{5,}|Firma del responsable)/i.test(bloque);
      const normalizarNombre = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const puedeFirmar = bloque => archivoSello && esFirma(bloque) && (!documento.firmante_empresa
        || normalizarNombre(bloque.split('\n')[1]) === normalizarNombre(documento.firmante_empresa));
      const notasFirma = bloque => bloque.split('\n').slice(2).join('\n').trim();
      let firmaImpresa = false;
      let firmaEncontrada = false;
      let finContenido = doc.y;
      let firmaLateralY = null;
      for (const [indice, bloqueOriginal] of bloques.entries()) {
        for (const [seccion, original] of bloqueOriginal.split('\f').entries()) {
          if (seccion) doc.addPage();
          const bloque = original.trim();
          if (!bloque) continue;
          const firma = esFirma(bloque);
          const pie = nanas && firmaEncontrada && !firma;
          const asunto = /^ASUNTO\s*:/i.test(bloque);
          const saludo = /^Estimad[oa]/i.test(bloque);
          const destinatario = /^Estimad[oa]/i.test(bloques[indice - 1] || '') && !saludo;
          const consideracion = /^De mi consideración/i.test(bloque);
          const introduccion = /^Por medio de la presente/i.test(bloque);
          const estudiante = /(?:[—–]| -)\s*(?:DNI|C\.E\.|CE|PASAPORTE)[: ]/i.test(bloque) && bloque.length < 400;
          const duracion = /^Para desarrollo del proyecto/i.test(bloque);
          const registro = /^(?:Los datos\b|Datos para registro\b|Datos del\b|[-•]|(?:RUC|Razón social|Carrera|Área|Supervisor|Fecha de)\b)/i.test(bloque);
          const despedida = /^Atentamente[,.]?$/i.test(bloque);
          const tipo = firma ? 'firma' : saludo ? 'saludo' : destinatario ? 'destinatario' : consideracion ? 'consideracion'
            : introduccion ? 'introduccion' : estudiante ? 'estudiante' : duracion ? 'duracion' : registro ? 'registro' : despedida ? 'despedida' : null;
          anclar(tipo);
          if (firma) firmaEncontrada = true;
          if (firma && puedeFirmar(bloque) && !firmaImpresa) {
            if (firmaLateralY !== null) doc.y = firmaLateralY;
            const notas = notasFirma(bloque);
            doc.font(regular).fontSize(tamano);
            const altoNotas = notas ? doc.heightOfString(notas, { ...opciones, align: 'center' }) + 10 : 0;
            espacio(altoFirma + altoNotas + 16);
            doc.image(archivoSello, formato.firmaX, doc.y, { width: anchoFirma, height: altoFirma });
            doc.y += altoFirma + (formato.firmaLateral ? 2 : 12);
            if (notas) {
              doc.text(notas, margen, doc.y + 8, { ...opciones, align: 'center' });
              doc.y += 10;
            }
            firmaImpresa = true;
            continue;
          }
          const siguiente = (bloques[indice + 1] || '').trim();
          const align = firma || (despedida && formato.centrada) || (duracion && documento.logo === 'silsan') ? 'center'
            : (bloque.split('\n').length === 1 && bloque.length > 150 && !registro && !estudiante && !pie) ? 'justify' : 'left';
          doc.font(saludo && nanas || pie ? negrita : regular).fontSize(pie ? 10 : tamano).fillColor(pie ? '#f267a5' : '#000000');
          if (pie) {
            if (primeraPagina) doc.y = Math.max(doc.y, formato.pieY);
            for (const [n, linea] of bloque.split('\n').entries()) {
              const height = doc.heightOfString(linea, { width: ancho - 23, lineGap: 2 });
              espacio(height + 10);
              const y = doc.y;
              doc.save().strokeColor('#f267a5').lineWidth(1);
              if (n === 0) {
                doc.roundedRect(margen + 3, y + 1, 7, 12, 1.5).stroke();
                doc.moveTo(margen + 5, y + 11).lineTo(margen + 8, y + 11).stroke();
              } else if (n === 1) {
                doc.circle(margen + 7, y + 6, 8).stroke();
                doc.rect(margen + 1, y + 2, 12, 8).stroke();
                doc.moveTo(margen + 1, y + 2).lineTo(margen + 7, y + 7).lineTo(margen + 13, y + 2).stroke();
              } else {
                doc.circle(margen + 7, y + 4, 3).stroke();
                doc.moveTo(margen + 4, y + 7).lineTo(margen + 7, y + 13).lineTo(margen + 10, y + 7).stroke();
              }
              doc.restore();
              doc.text(linea, margen + 23, y, { width: ancho - 23, lineGap: 2 });
              doc.y += 10;
            }
            continue;
          }
          const height = doc.heightOfString(bloque, { ...opciones, align });
          const reservarFirma = despedida && !siguiente.includes('\f') && esFirma(siguiente);
          const espacioFirma = reservarFirma ? 16 + (puedeFirmar(siguiente) && !firmaImpresa ? altoFirma + 16 +
            (notasFirma(siguiente) ? doc.heightOfString(notasFirma(siguiente), { ...opciones, align: 'center' }) + 10 : 0)
            : doc.heightOfString(siguiente, { ...opciones, align: 'center' }) + 18) : 0;
          if (height < doc.page.height - 105) espacio(height + espacioFirma + (firma ? 18 : 0));
          if (despedida && reservarFirma && puedeFirmar(siguiente) && formato.firmaLateral) {
            // La despedida queda a la izquierda del sello, como en Nanas.
            // Si el bloque pasó de página, ambas partes comienzan en esa hoja.
            firmaLateralY = Math.max(doc.page.margins.top, doc.y - 16,
              primeraPagina ? finContenido + 8 : doc.y);
          } else if (!firma) firmaLateralY = null;
          if (firma) doc.y += 14;
          // También admite ASUNTO dentro de un bloque personalizado del destinatario.
          for (const linea of bloque.split('\n')) {
            if (/^ASUNTO\s*:/i.test(linea)) {
              const corte = linea.indexOf(':') + 1;
              doc.font(negrita).text(linea.slice(0, corte) + ' ', margen, doc.y, { ...opciones, continued: true });
              doc.font(regular).text(linea.slice(corte).trim(), { ...opciones, continued: false });
            } else doc.text(linea, margen, doc.y, { ...opciones, align });
          }
          finContenido = doc.y;
          const antesDelAsunto = /^ASUNTO\s*:/i.test(siguiente);
          doc.y += antesDelAsunto ? 0 : asunto ? 24 : introduccion ? 22 : estudiante ? 16 : saludo ? 14 : despedida ? 12 : 17;
        }
      }
      const range = doc.bufferedPageRange();
      if (range.count > 1) {
        for (let n = range.start; n < range.start + range.count; n++) {
          doc.switchToPage(n);
          const bottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.font(regular).fontSize(8).fillColor('#000000').text(`Página ${n + 1} de ${range.count}`, margen, doc.page.height - 25,
            { width: ancho, align: 'center', lineBreak: false });
          doc.page.margins.bottom = bottom;
        }
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}

module.exports = { generarPdfAceptacion };
