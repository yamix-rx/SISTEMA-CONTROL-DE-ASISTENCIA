const path = require('node:path');
const PDFDocument = require('pdfkit');
const { dibujarLogoEnCaja } = require('./documentoLogoPdfService');

// Fondos extraídos de los modelos, sin textos ni firmas del ejemplo.
const FORMATOS = Object.freeze({
  // Coordenadas en puntos A4 del logo incrustado en cada fondo original.
  sbss: { titulo: 210, cuerpo: 292, margen: 85, derecha: 85, inferior: 125, firmaX: 355, fuente: 'Times-Roman',
    logoCaja: { x: 65, y: 34, width: 140, height: 60, horizontal: 'left', vertical: 'top' },
    logoParche: { x: 60, y: 29, width: 150, height: 68 } },
  nanas: { titulo: 122, cuerpo: 174, margen: 72, derecha: 54, inferior: 110, fuente: 'Times-Roman',
    logoCaja: { x: 430, y: 28, width: 125, height: 45, horizontal: 'right', vertical: 'top' },
    logoParche: { x: 425, y: 23, width: 135, height: 50 } },
  silsan: { titulo: 156, cuerpo: 215, margen: 85, derecha: 85, inferior: 135, fuente: 'Helvetica',
    logoCaja: { x: 23, y: 45, width: 235, height: 83, horizontal: 'left', vertical: 'top' },
    logoParche: { x: 18, y: 38, width: 250, height: 95 } },
  camara: { titulo: 176, cuerpo: 236, margen: 85, derecha: 85, inferior: 125, fuente: 'Helvetica',
    logoCaja: { x: 46, y: 46, width: 290, height: 90, horizontal: 'left', vertical: 'top' },
    logoParche: { x: 40, y: 38, width: 310, height: 100 } },
  ong: { titulo: 136, cuerpo: 180, margen: 94, derecha: 94, inferior: 40, horizontal: true, fuente: 'Times-Roman',
    logoCaja: { x: 710, y: 23, width: 100, height: 95, horizontal: 'right', vertical: 'top' },
    logoParche: { x: 700, y: 18, width: 115, height: 105 } }
});

function generarPdfCertificado(documento) {
  return new Promise((resolve, reject) => {
    const marca = Object.hasOwn(FORMATOS, documento.logo || '') ? documento.logo : null;
    const formato = FORMATOS[marca] || { titulo: 85, cuerpo: 160, margen: 72, derecha: 72, inferior: 60, fuente: 'Times-Roman' };
    const negrita = 'Times-Bold';
    const doc = new PDFDocument({
      size: 'A4', layout: formato.horizontal ? 'landscape' : 'portrait', pdfVersion: '1.4',
      margins: { top: formato.cuerpo, bottom: formato.inferior, left: formato.margen, right: formato.derecha },
      info: { Title: documento.titulo, Author: documento.empresa, Subject: documento.modelo_nombre || documento.titulo }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
      const ancho = doc.page.width - formato.margen - formato.derecha;
      const limite = () => doc.page.height - formato.inferior;
      const opciones = { width: ancho, lineGap: formato.fuente === 'Helvetica' ? 0.5 : formato.horizontal ? 2 : 3 };
      const bloques = String(documento.cuerpo).replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
      const lema = documento.lema_anual || '';
      if (lema && bloques[0] === lema) bloques.shift();
      // Mantiene el tamaño habitual y reduce ligeramente sólo cuando una hoja
      // puede contener el documento completo. Los textos extensos se paginan.
      let tamano = 12;
      const archivoFirma = marca && documento.firma === marca ? path.join(__dirname, '../assets/documentos/certificados', `firma-${marca}.png`) : null;
      const imagenFirma = archivoFirma ? doc.openImage(archivoFirma) : null;
      const anchoSello = Math.min(formato.horizontal ? 145 : 175, ancho);
      const altoSello = imagenFirma ? anchoSello * imagenFirma.height / imagenFirma.width : 0;
      const estimar = size => {
        doc.font(formato.fuente).fontSize(size);
        return bloques.reduce((alto, bloque, indice) => {
          if (/^Atentamente[,.]?$/i.test(bloque) && /^_{5}/.test(bloques[indice + 1] || '')) return alto;
          if (/^_{5}/.test(bloque)) return alto + 40 + altoSello + doc.heightOfString(bloque.split('\n').slice(imagenFirma ? 2 : 0).join('\n'), opciones);
          return alto + bloque.split('\n').reduce((suma, linea) => suma + doc.heightOfString(linea, opciones) + (/^[-•]\s/.test(linea) ? 4 : 0), 0) + 12;
        }, 0);
      };
      while (tamano > 10 && estimar(tamano) + 40 > limite() - formato.cuerpo) tamano -= 0.5;

      const cabecera = () => {
        const y = doc.y;
        let tituloY = formato.titulo;
        if (marca) doc.image(path.join(__dirname, '../assets/documentos/certificados', `${marca}.png`), 0, 0, { width: doc.page.width, height: doc.page.height });
        if (documento.logo_personalizado) {
          const cajaLogo = formato.logoCaja || { x: (doc.page.width - 190) / 2, y: 12, width: 190, height: 54, horizontal: 'center', vertical: 'center' };
          // Sólo se cubre el logo original, no la cabecera completa del certificado.
          const parcheLogo = formato.logoParche || cajaLogo;
          doc.save().rect(parcheLogo.x, parcheLogo.y, parcheLogo.width, parcheLogo.height).fill('#ffffff').restore();
          dibujarLogoEnCaja(doc, documento.logo_personalizado, cajaLogo, {
            horizontal: cajaLogo.horizontal || 'center',
            vertical: cajaLogo.vertical || 'center'
          });
        }
        if (lema) {
          const lemaY = formato.titulo - 45;
          doc.font(formato.fuente).fontSize(10).fillColor('#111111')
            .text(lema, formato.margen, lemaY, { width: ancho, align: 'center' });
          tituloY = Math.max(tituloY, doc.y + 12);
        }
        const titulo = formato.horizontal ? documento.titulo : documento.titulo.replace(/ PRE-PROFESIONALES$/, '\nPRE-PROFESIONALES');
        doc.font(negrita).fontSize(formato.horizontal ? 23 : 22).fillColor('#000000');
        const altoTitulo = doc.heightOfString(titulo, { width: ancho, align: 'center' });
        doc.text(titulo, formato.margen, tituloY, { width: ancho, align: 'center' });
        doc.page.margins.top = Math.max(formato.cuerpo, tituloY + altoTitulo + 22);
        doc.x = formato.margen;
        doc.y = Math.max(y, doc.page.margins.top);
        doc.font(formato.fuente).fontSize(tamano);
      };
      doc.on('pageAdded', cabecera);
      cabecera();
      const espacio = alto => { if (doc.y + alto > limite() && alto <= limite() - doc.page.margins.top) doc.addPage(); };
      const firma = bloque => {
        const lineas = bloque.split('\n');
        const nombre = lineas[1]?.trim();
        const usarSello = marca && documento.firma === marca && nombre === documento.firmante_empresa;
        const notas = lineas.slice(usarSello ? 2 : 0).join('\n');
        const archivo = usarSello ? path.join(__dirname, '../assets/documentos/certificados', `firma-${marca}.png`) : null;
        let altoFirma = 0, anchoFirma = 0;
        if (archivo) {
          const imagen = doc.openImage(archivo);
          anchoFirma = Math.min(formato.horizontal ? 145 : 175, ancho);
          altoFirma = anchoFirma * imagen.height / imagen.width;
        }
        doc.font(formato.fuente).fontSize(tamano);
        const altoNotas = notas ? doc.heightOfString(notas, opciones) : 0;
        espacio(doc.heightOfString('Atentamente,', opciones) + 24 + altoFirma + altoNotas);
        doc.text('Atentamente,', formato.margen, doc.y, { ...opciones, align: 'center' });
        doc.y += 16;
        if (archivo) {
          const x = Math.min(formato.firmaX ?? formato.margen + (ancho - anchoFirma) / 2, doc.page.width - formato.derecha - anchoFirma);
          doc.image(archivo, x, doc.y, { width: anchoFirma, height: altoFirma });
          doc.y += altoFirma + 8;
        }
        if (notas) doc.font(formato.fuente).fontSize(tamano).text(notas, formato.margen, doc.y, { ...opciones, align: 'center' });
      };
      for (let indice = 0; indice < bloques.length; indice++) {
        const bloque = bloques[indice].trim();
        if (!bloque) continue;
        if (/^Atentamente[,.]?$/i.test(bloque) && /^_{5}/.test(bloques[indice + 1]?.trim() || '')) continue;
        if (/^_{5}/.test(bloque)) { firma(bloque); continue; }
        const partes = bloque.split('\f');
        partes.forEach((parte, pagina) => {
          if (pagina) doc.addPage();
          const lineas = parte.split('\n');
          for (const linea of lineas) {
            if (!linea.trim()) continue;
            doc.font(formato.fuente).fontSize(tamano).fillColor('#000000');
            const intro = /^Se (?:le otorga a|hace constar que):$/i.test(linea.trim());
            const fecha = /\d{1,2} de [a-záéíóú]+ de \d{4}$/i.test(linea.trim()) && linea.length < 150;
            const lista = /^[-•]\s/.test(linea);
            const settings = { ...opciones, align: intro ? 'center' : fecha ? (['sbss', 'ong'].includes(marca) ? 'right' : 'left') : lista ? 'left' : 'justify' };
            const alto = doc.heightOfString(linea, settings);
            espacio(alto + 8);
            doc.text(linea, formato.margen, doc.y, settings);
            if (lista) doc.y += 4;
          }
          doc.y += 12;
        });
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}

module.exports = { generarPdfCertificado };
