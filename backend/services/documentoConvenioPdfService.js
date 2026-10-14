const PDFDocument = require('pdfkit');
const { rutaFirma } = require('./documentoCartaPdfService');

// Composición de los ocho modelos UPN: A4, Arial equivalente, títulos
// subrayados, cuadros blancos y firmas de estudiante/empresa en paralelo.
// El contenido procede de la plantilla completada, incluidas las ediciones.
function generarPdfConvenio(documento) {
  return new Promise((resolve, reject) => {
    const margen = 64;
    const doc = new PDFDocument({
      size: 'A4', pdfVersion: '1.4',
      margins: { top: 64, bottom: 48, left: margen, right: margen },
      info: { Title: documento.titulo, Author: documento.empresa, Subject: documento.modelo_nombre || documento.titulo }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    try {
      const ancho = doc.page.width - margen * 2;
      const limite = () => doc.page.height - doc.page.margins.bottom;
      const nuevaPagina = () => { doc.addPage(); doc.x = margen; };
      const espacio = alto => { if (doc.y + alto > limite()) nuevaPagina(); };
      let plan = documento.codigo === 'plan_capacitacion';
      let datosGenerales = !plan;
      const estilo = (bold = false, size = 10) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('black');
      const medir = (valor, { width = ancho, bold = false, size = 10, ...opciones } = {}) => {
        estilo(bold, size);
        return doc.heightOfString(valor, { width, lineGap: 1.5, ...opciones });
      };
      const texto = (valor, { x = margen, width = ancho, bold = false, size = 10, after = 0, mantener = 0, ...opciones } = {}) => {
        const alto = medir(valor, { width, bold, size, ...opciones });
        // PDFKit pagina los párrafos extraordinariamente largos sin recortarlos.
        if (alto <= limite() - doc.page.margins.top) espacio(alto + mantener);
        estilo(bold, size).text(valor, x, doc.y, { width, lineGap: 1.5, ...opciones });
        doc.x = margen;
        doc.y += after;
      };
      const titulo = valor => texto(valor, { bold: true, size: 11.5, align: 'center', underline: true, after: 18, mantener: 55 });

      function tabla(filas, { cabecera = false, proporcion = 0.53, enfasisIzquierda = false } = {}) {
        const columnas = Math.max(...filas.map(fila => fila.length));
        const comoParrafos = () => {
          filas.forEach((fila, indice) => texto(fila.join('\n'), { bold: cabecera && indice === 0, after: 10 }));
        };
        // Una plantilla editada puede añadir columnas. Por encima de seis,
        // el flujo de párrafos conserva su orden sin crear celdas ilegibles.
        if (columnas > 6) { comoParrafos(); return; }
        const anchos = columnas === 2 ? [ancho * proporcion, ancho * (1 - proporcion)]
          : Array(columnas).fill(ancho / columnas);
        const padding = 4;
        const altura = (fila, bold = false) => Math.max(...anchos.map((width, n) => medir(fila[n] || '', {
          width: width - padding * 2, bold: bold || (enfasisIzquierda && n === 0), size: 10
        }))) + padding * 2;
        const dibujar = (fila, bold = false) => {
          const y = doc.y;
          const alto = altura(fila, bold);
          let x = margen;
          anchos.forEach((width, n) => {
            doc.save().lineWidth(0.6).strokeColor('black').rect(x, y, width, alto).stroke().restore();
            estilo(bold || (enfasisIzquierda && n === 0), 10)
              .text(fila[n] || '', x + padding, y + padding, { width: width - padding * 2, lineGap: 1.5 });
            x += width;
          });
          doc.x = margen;
          doc.y = y + alto;
        };
        // La cabecera repetida debe dejar espacio real para una fila. Si una
        // edición la hace mayor que la hoja, también se conserva como texto.
        if (cabecera && altura(filas[0], true) > limite() - doc.page.margins.top - 44) {
          comoParrafos(); return;
        }
        const inicio = cabecera ? 1 : 0;
        const altoTotal = filas.reduce((suma, fila, indice) => suma + altura(fila, cabecera && indice === 0), 0);
        if (altoTotal <= 280) espacio(altoTotal);
        if (cabecera) {
          espacio(altura(filas[0], true) + (filas[1] ? Math.min(altura(filas[1]), 140) : 0));
          dibujar(filas[0], true);
        }
        for (let i = inicio; i < filas.length; i++) {
          let pendiente = [...filas[i]];
          // Filas habituales pasan completas a la siguiente página; las muy
          // extensas se dividen en fragmentos de celdas, sin perder su contenido.
          while (pendiente.some(Boolean)) {
            const alto = altura(pendiente);
            const altoCabecera = cabecera ? altura(filas[0], true) : 0;
            const maximo = limite() - doc.page.margins.top - altoCabecera;
            if (doc.y + Math.min(alto, 44) > limite() || (alto <= maximo && doc.y + alto > limite())) {
              nuevaPagina();
              if (cabecera) dibujar(filas[0], true);
            }
            if (doc.y + alto <= limite()) { dibujar(pendiente); break; }
            const disponible = limite() - doc.y - padding * 2 - 1;
            const fragmento = pendiente.map((valor, n) => {
              if (!valor) return '';
              let inferior = 0, superior = valor.length;
              while (inferior < superior) {
                const medio = Math.ceil((inferior + superior) / 2);
                if (medir(valor.slice(0, medio), { width: anchos[n] - padding * 2,
                  bold: enfasisIzquierda && n === 0, size: 10 }) <= disponible) inferior = medio;
                else superior = medio - 1;
              }
              let corte = inferior;
              if (corte < valor.length && corte > 0) {
                const palabra = valor.lastIndexOf(' ', corte);
                if (palabra > 0) corte = palabra;
              }
              return valor.slice(0, corte);
            });
            if (!fragmento.some(Boolean)) { nuevaPagina(); if (cabecera) dibujar(filas[0], true); continue; }
            dibujar(fragmento);
            pendiente = pendiente.map((valor, n) => valor.slice(fragmento[n].length).trimStart());
            if (pendiente.some(Boolean)) { nuevaPagina(); if (cabecera) dibujar(filas[0], true); }
          }
        }
        doc.y += 9;
      }

      function firmas(grupos) {
        const separacion = 24;
        const columna = (ancho - separacion) / 2;
        const archivo = documento.firma && documento.firmante_empresa
          && grupos[1]?.includes(documento.firmante_empresa) && rutaFirma(documento.firma);
        const imagen = archivo ? doc.openImage(archivo) : null;
        const imagenAncho = imagen ? Math.min(143, columna) : 0;
        const imagenAlto = imagen ? Math.min(70, imagenAncho * imagen.height / imagen.width) : 0;
        const alturas = grupos.map(grupo => medir(grupo.join('\n'), { width: columna, bold: true, size: 9.5 }));
        const zonaFirma = 75;
        const alturaPrimera = Math.max(alturas[0] || 0, alturas[1] || 0);
        const total = zonaFirma + alturaPrimera + (grupos[2] ? 65 + alturas[2] : 0) + 10;
        // Los nombres normales forman dos columnas. Un bloque personalizado
        // mayor que una hoja fluye verticalmente para no superponer ni perder
        // textos al paginar las firmas.
        if (total > limite() - doc.page.margins.top) {
          grupos.forEach((grupo, indice) => {
            if (indice === 1 && imagen) {
              espacio(imagenAlto + 20);
              doc.image(archivo, margen, doc.y, { fit: [imagenAncho, imagenAlto] });
              doc.y += imagenAlto + 8;
            } else texto('_______________________________', { after: 10 });
            texto(grupo.join('\n'), { bold: true, size: 9.5, after: 25 });
          });
          return;
        }
        espacio(total);
        const y = doc.y;
        grupos.slice(0, 2).forEach((grupo, n) => {
          const x = margen + n * (columna + separacion);
          if (n === 1 && imagen) {
            doc.image(archivo, x + (columna - imagenAncho) / 2, y + zonaFirma - imagenAlto - 8,
              { fit: [imagenAncho, imagenAlto], align: 'center' });
          } else {
            doc.save().lineWidth(0.7).dash(1, { space: 2 }).moveTo(x + 7, y + zonaFirma - 8)
              .lineTo(x + columna - 7, y + zonaFirma - 8).stroke().restore();
          }
          estilo(true, 9.5).text(grupo.join('\n'), x, y + zonaFirma, { width: columna, align: 'center', lineGap: 1.5 });
        });
        if (grupos[2]) {
          const yInstitucion = y + zonaFirma + alturaPrimera + 65;
          doc.save().lineWidth(0.7).dash(1, { space: 2 }).moveTo(margen + 7, yInstitucion - 8)
            .lineTo(margen + columna - 7, yInstitucion - 8).stroke().restore();
          estilo(true, 9.5).text(grupos[2].join('\n'), margen, yInstitucion, { width: columna, align: 'center', lineGap: 1.5 });
        }
        doc.x = margen;
        doc.y = y + total;
      }

      titulo(documento.titulo);
      const secciones = String(documento.cuerpo || '').replace(/\r\n?/g, '\n').split('\f');
      secciones.forEach((seccion, pagina) => {
        if (pagina && seccion.trim()) nuevaPagina();
        const lineas = seccion.trim().split('\n');
        for (let i = 0; i < lineas.length; i++) {
          const linea = lineas[i].trim();
          if (!linea) { doc.y += 8; continue; }
          if (/^MODELO DE PLAN DE CAPACITACI[ÓO]N$/.test(linea)) {
            plan = true; datosGenerales = false; titulo(linea); continue;
          }
          if (/^[_….]{5}/.test(linea)) {
            const grupos = [];
            let j = i;
            while (j < lineas.length && grupos.length < 3 && /^[_….]{5}/.test(lineas[j].trim())) {
              const grupo = [];
              j++;
              while (j < lineas.length && lineas[j].trim() && !/^[_….]{5}/.test(lineas[j].trim())) grupo.push(lineas[j++].trim());
              grupos.push(grupo);
              while (j < lineas.length && !lineas[j].trim()) j++;
            }
            firmas(grupos); i = j - 1; continue;
          }
          if (linea.includes(' | ')) {
            const filas = [];
            while (i < lineas.length && lineas[i].trim()) {
              if (lineas[i].includes(' | ')) filas.push(lineas[i].split(' | ').map(x => x.trim()));
              else if (/^(?:[IVX]+\.|\d\.\d(?:\.\d)?\.|[_….]{5})/.test(lineas[i].trim())) break;
              else filas.at(-1)[filas.at(-1).length - 1] += '\n' + lineas[i].trim();
              i++;
            }
            i--;
            tabla(filas, { cabecera: /^(?:Competencias|Elemento)/i.test(filas[0][0]),
              proporcion: /^Competencias específicas/i.test(filas[0][0]) ? 0.59 : 0.53,
              enfasisIzquierda: filas[0][0] === 'INFRAESTRUCTURA Y AMBIENTE' });
            continue;
          }
          const casilla = /^\[([ Xx])\]\s+(.+)$/.exec(linea);
          if (casilla) {
            const alto = Math.max(19, medir(casilla[2], { width: ancho - 38, bold: casilla[1] !== ' ' }) + 2);
            if (alto + 8 > limite() - doc.page.margins.top) {
              texto(linea, { bold: casilla[1] !== ' ', after: 8 }); continue;
            }
            espacio(alto + 8);
            const y = doc.y;
            doc.save().lineWidth(0.6).rect(margen + 3, y, 18, 18).stroke().restore();
            if (casilla[1] !== ' ') estilo(true, 10).text('X', margen + 3, y + 3, { width: 18, align: 'center' });
            doc.y = y;
            texto(casilla[2], { x: margen + 38, width: ancho - 38, bold: casilla[1] !== ' ' });
            doc.y = y + alto + 8;
            continue;
          }
          if (linea === 'Área o departamento' && /^\d+\./.test(lineas[i + 1]?.trim())) {
            tabla([[linea], [lineas[++i].trim()]], { cabecera: true }); continue;
          }
          if (/^CL[ÁA]USULAS DEL CONVENIO/.test(linea)) datosGenerales = false;
          const tituloSeccion = /^(?:[IVX]+\.|[A-D]\.)\s/.test(linea)
            || /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ /()]+:?$/.test(linea);
          if (tituloSeccion) {
            let mantener = /MAPA DE RECORRIDO/.test(linea) ? 95 : 38;
            if (lineas[i + 1]?.includes(' | ')) {
              let altoTabla = 0;
              for (let j = i + 1; j < lineas.length && lineas[j].includes(' | '); j++) {
                const [izquierda, derecha] = lineas[j].split(' | ');
                altoTabla += Math.max(medir(izquierda, { width: ancho * 0.53 - 8, bold: true }),
                  medir(derecha, { width: ancho * 0.47 - 8 })) + 8;
              }
              mantener = altoTabla <= 280 ? altoTabla + 6 : 70;
            }
            texto(linea, { bold: true, underline: !/^[A-D]\./.test(linea), after: 6, mantener });
            continue;
          }
          // En la ficha del plan, el valor va debajo de su etiqueta, como en
          // los originales; la tabla inferior conserva los días y horas.
          const campoPlan = plan && /^(?:[123]\.|1\.[123]\.)\s[^:]+:\s.+/.test(linea);
          if (campoPlan) {
            const corte = linea.indexOf(':');
            const valor = linea.slice(corte + 1).trim();
            texto(linea.slice(0, corte), { mantener: medir(valor, { width: ancho - 23, size: 11 }), after: 5 });
            texto(valor, { x: margen + 23, width: ancho - 23, size: 11, bold: /^1\.[123]\./.test(linea), after: 6 });
            continue;
          }
          const encabezado = /^(?:3\.\d(?:\.\d)?\.|Denominación del Plan)/.test(linea);
          const clausula = /^(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PT?IMO|OCTAVO|NOVENO)\s*:/.test(linea);
          const campoCondicion = !plan && /^(?:Plazo de duración|Horario de la pasantía|Área a desempeñar pasantía):/.test(linea);
          if (clausula || campoCondicion) {
            const corte = linea.indexOf(':') + 1;
            const size = campoCondicion ? 11 : 10;
            espacio(medir(linea, { size }) + (/se obliga a:/.test(linea) ? 38 : 0));
            estilo(true, size).text(linea.slice(0, corte) + ' ', margen, doc.y, { width: ancho, lineGap: 1.5, continued: true });
            estilo(false, size).text(linea.slice(corte).trim(), { continued: false, align: 'justify', lineGap: 1.5 });
            doc.x = margen; if (campoCondicion) doc.y += 8;
            continue;
          }
          const lista = /^(?:\d\)|[a-z]\)|[-•])\s/.test(linea);
          const previoFirma = /^(?:Suscrito en|Este anexo contiene)/.test(linea);
          const size = datosGenerales && /^(?:Razón social|RUC|Domicilio|Actividad económica|Representante|Doc\. de identidad(?: del representante)?|Nombre|Fecha de nacimiento|Carrera):/i.test(linea) ? 11 : 10;
          texto(linea, { size, bold: encabezado, align: linea.length > 150 && !encabezado ? 'justify' : 'left',
            x: lista ? margen + 18 : margen, width: lista ? ancho - 18 : ancho,
            after: lista ? 3 : datosGenerales && size === 11 ? 8 : encabezado ? 5 : 0,
            mantener: previoFirma ? 240 : encabezado ? 38 : 0 });
        }
      });
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}

module.exports = { generarPdfConvenio };
