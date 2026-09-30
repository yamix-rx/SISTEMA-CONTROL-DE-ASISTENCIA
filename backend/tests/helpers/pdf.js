const { inflateSync } = require('node:zlib');

function textoMostrado(bloque) {
  let texto = '';
  for (const operador of bloque.matchAll(/\[([\s\S]*?)\]\s*TJ|<([a-f\d]+)>\s*Tj/gi)) {
    if (operador[2]) {
      texto += Buffer.from(operador[2], 'hex').toString('latin1');
      continue;
    }
    for (const parte of operador[1].matchAll(/<([a-f\d]+)>|(-?\d+(?:\.\d+)?)/gi)) {
      if (parte[1]) texto += Buffer.from(parte[1], 'hex').toString('latin1');
      // PDFKit justifica sustituyendo el espacio por un desplazamiento TJ.
      // Los pequeños ajustes de kerning dentro de palabras no son espacios.
      else if (Number(parte[2]) <= -200) texto += ' ';
    }
  }
  return texto.replace(/[ \t]+/g, ' ');
}

// Inspecciona los PDFs que emiten los dos servicios locales (PDFKit y legacy),
// incluidos los streams comprimidos y las posiciones de las imágenes.
function leerPdf(pdf) {
  const fuente = pdf.toString('latin1');
  const objetos = new Map([...fuente.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)]
    .map(match => [Number(match[1]), match[2]]));
  const fuentes = new Map();
  for (const [id, objeto] of objetos) {
    const nombre = /\/BaseFont \/([^\s/<>]+)/.exec(objeto)?.[1];
    if (nombre) fuentes.set(id, nombre);
  }
  const paginas = [...objetos.values()].filter(objeto => /\/Type \/Page\b/.test(objeto)).map(pagina => {
    const contenido = objetos.get(Number(/\/Contents (\d+) 0 R/.exec(pagina)[1]));
    const longitud = Number(/\/Length (\d+)/.exec(contenido)[1]);
    const bytes = Buffer.from(contenido.slice(contenido.indexOf('stream\n') + 7), 'latin1').subarray(0, longitud);
    const stream = (/\/FlateDecode/.test(contenido) ? inflateSync(bytes) : bytes).toString('latin1');
    const alto = Number(/\/MediaBox\s*\[0 0 [\d.]+ ([\d.]+)\]/.exec(pagina)[1]);
    const recursos = objetos.get(Number(/\/Resources (\d+) 0 R/.exec(pagina)?.[1])) || pagina;
    const fuentesPagina = new Map([...recursos.matchAll(/\/(F\d+) (\d+) 0 R/g)]
      .map(match => [match[1], fuentes.get(Number(match[2]))]));
    const textos = [...stream.matchAll(/BT\s([\s\S]*?)\sET/g)].map(match => {
      const posicion = /1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/.exec(match[1]);
      const font = /\/(F\d+) ([\d.]+) Tf/.exec(match[1]);
      return { x: Number(posicion[1]), y: alto - Number(posicion[2]), fuente: fuentesPagina.get(font[1]),
        tamano: Number(font[2]), texto: textoMostrado(match[1]) };
    });
    const imagenes = [...stream.matchAll(/([\d.]+) 0 0 -([\d.]+) ([\d.-]+) ([\d.-]+) cm\n\/(I\d+) Do/g)]
      .map(match => ({ ancho: Number(match[1]), alto: Number(match[2]), x: Number(match[3]), y: Number(match[4]) - Number(match[2]) }));
    return { pagina, textos, imagenes };
  });
  return { fuente, paginas };
}

function textoPdf(pdf) {
  return leerPdf(pdf).paginas.flatMap(pagina => pagina.textos.map(texto => texto.texto)).join('\n');
}

module.exports = { leerPdf, textoPdf };
