// PDF de texto con fuentes estándar, sin ejecutar HTML ni depender de un navegador.
// WinAnsi conserva los caracteres usados en documentos en español (tildes, ñ, ü).
const EXTRAS = new Map([[0x20ac,128],[0x201a,130],[0x192,131],[0x201e,132],[0x2026,133],[0x2020,134],[0x2021,135],[0x2c6,136],[0x2030,137],[0x160,138],[0x2039,139],[0x152,140],[0x17d,142],[0x2018,145],[0x2019,146],[0x201c,147],[0x201d,148],[0x2022,149],[0x2013,150],[0x2014,151],[0x2dc,152],[0x2122,153],[0x161,154],[0x203a,155],[0x153,156],[0x17e,158],[0x178,159]]);
function hexTexto(texto) {
  return Buffer.from([...String(texto).normalize('NFC')].map(char => {
    const code = char.codePointAt(0);
    return code <= 255 ? code : (EXTRAS.get(code) || 63);
  })).toString('hex');
}
function lineas(texto, maximo = 82) {
  const resultado = [];
  for (const parrafo of String(texto).replace(/\r\n?/g, '\n').split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let resto = palabra;
      if (linea && linea.length + resto.length + 1 > maximo) { resultado.push(linea); linea = ''; }
      while (resto.length > maximo) { resultado.push(resto.slice(0, maximo)); resto = resto.slice(maximo); }
      linea += (linea ? ' ' : '') + resto;
    }
    resultado.push(linea);
  }
  return resultado;
}
function generarPdf(documento) {
  const paginas = [[]];
  let y = 790;
  const poner = (texto, tamano = 11, negrita = false, salto = 17) => {
    if (y < 62) { paginas.push([]); y = 790; }
    paginas.at(-1).push(`BT /${negrita ? 'F2' : 'F1'} ${tamano} Tf 1 0 0 1 54 ${y} Tm <${hexTexto(texto)}> Tj ET`);
    y -= salto;
  };
  for (const linea of lineas(documento.empresa, 36)) poner(linea, 14, true, 21);
  y -= 22;
  for (const linea of lineas(documento.titulo, 39)) poner(linea, 13, true, 21);
  y -= 20;
  // Courier ofrece ancho fijo; 82 caracteres a 10 pt caben en A4 con margen de 54 pt.
  for (const linea of lineas(documento.cuerpo, 80)) poner(linea, 10, false, 16);
  const objetos = [null, '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const hijos = [];
  paginas.forEach((contenido, indice) => {
    const pageId = objetos.length;
    const contentId = pageId + 1;
    hijos.push(`${pageId} 0 R`);
    const pie = `BT /F1 8 Tf 1 0 0 1 54 32 Tm <${hexTexto(`SBSS · ${documento.fecha} · Página ${indice + 1} de ${paginas.length}`)}> Tj ET`;
    const stream = [...contenido, pie].join('\n');
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objetos.push(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  });
  objetos[2] = `<< /Type /Pages /Kids [${hijos.join(' ')}] /Count ${paginas.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objetos.length; id++) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}
module.exports = { generarPdf };
