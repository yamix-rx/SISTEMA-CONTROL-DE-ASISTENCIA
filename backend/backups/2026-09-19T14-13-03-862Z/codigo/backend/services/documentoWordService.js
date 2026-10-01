const { inflateRawSync } = require('node:zlib');

// Identifica Word sin abrir documentos ni extraer archivos al disco.
// CFB: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/05060311-bfce-4b12-874d-71fd4ce63aea
function esDoc(contenido) {
  if (contenido.length < 512 || !contenido.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) return false;
  const version = contenido.readUInt16LE(26);
  const exponente = contenido.readUInt16LE(30);
  if (contenido.readUInt16LE(28) !== 0xfffe || !(version === 3 && exponente === 9 || version === 4 && exponente === 12)) return false;
  const tamSector = 2 ** exponente;
  if (contenido.length % tamSector !== 0) return false;
  const sectores = contenido.length / tamSector - 1;
  const cantidadFat = contenido.readUInt32LE(44);
  // Con el límite de carga de 5 MiB, las ubicaciones FAT caben en la cabecera.
  if (!cantidadFat || cantidadFat > 109) return false;
  const fat = [];
  for (let i = 0; i < cantidadFat; i++) {
    const sector = contenido.readUInt32LE(76 + i * 4);
    if (sector >= sectores) return false;
    fat.push((sector + 1) * tamSector);
  }
  let sector = contenido.readUInt32LE(48);
  const visitados = new Set();
  let tieneWord = false;
  while (sector !== 0xfffffffe) {
    if (sector >= sectores || visitados.has(sector)) return false;
    visitados.add(sector);
    const inicio = (sector + 1) * tamSector;
    for (let entrada = inicio; entrada < inicio + tamSector; entrada += 128) {
      const longitud = contenido.readUInt16LE(entrada + 64);
      if (contenido[entrada + 66] !== 2 || longitud !== 26) continue;
      if (contenido.subarray(entrada, entrada + 26).toString('utf16le') === 'WordDocument\0' && contenido.readUInt32LE(entrada + 120) > 0) tieneWord = true;
    }
    const paginaFat = fat[Math.floor(sector / (tamSector / 4))];
    if (paginaFat === undefined) return false;
    sector = contenido.readUInt32LE(paginaFat + sector % (tamSector / 4) * 4);
  }
  return tieneWord;
}

// ZIP: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
// Se usa el directorio central: Word puede escribir tamaños en descriptores posteriores.
function esDocx(contenido) {
  if (contenido.length < 22 || contenido.readUInt32LE(0) !== 0x04034b50) return false;
  let fin = -1;
  for (let i = contenido.length - 22; i >= Math.max(0, contenido.length - 22 - 65535); i--) {
    if (contenido.readUInt32LE(i) === 0x06054b50 && i + 22 + contenido.readUInt16LE(i + 20) === contenido.length) {
      fin = i;
      break;
    }
  }
  if (fin < 0 || contenido.readUInt16LE(fin + 4) || contenido.readUInt16LE(fin + 6)) return false;
  const cantidad = contenido.readUInt16LE(fin + 10);
  const inicio = contenido.readUInt32LE(fin + 16);
  if (cantidad < 3 || contenido.readUInt16LE(fin + 8) !== cantidad || inicio + contenido.readUInt32LE(fin + 12) !== fin) return false;
  const entradas = new Map();
  let posicion = inicio;
  for (let i = 0; i < cantidad; i++) {
    if (posicion + 46 > fin || contenido.readUInt32LE(posicion) !== 0x02014b50) return false;
    const flags = contenido.readUInt16LE(posicion + 8);
    const metodo = contenido.readUInt16LE(posicion + 10);
    const comprimido = contenido.readUInt32LE(posicion + 20);
    const longitud = contenido.readUInt16LE(posicion + 28);
    const siguiente = posicion + 46 + longitud + contenido.readUInt16LE(posicion + 30) + contenido.readUInt16LE(posicion + 32);
    const local = contenido.readUInt32LE(posicion + 42);
    if (siguiente > fin || flags & 1 || ![0, 8].includes(metodo) || contenido.readUInt16LE(posicion + 34) !== 0 || local + 30 > inicio) return false;
    const nombreBytes = contenido.subarray(posicion + 46, posicion + 46 + longitud);
    const nombre = nombreBytes.toString('utf8');
    if (entradas.has(nombre) || contenido.readUInt32LE(local) !== 0x04034b50 || contenido.readUInt16LE(local + 6) !== flags || contenido.readUInt16LE(local + 8) !== metodo) return false;
    const longitudLocal = contenido.readUInt16LE(local + 26);
    const datos = local + 30 + longitudLocal + contenido.readUInt16LE(local + 28);
    if (datos + comprimido > inicio || !nombreBytes.equals(contenido.subarray(local + 30, local + 30 + longitudLocal))) return false;
    entradas.set(nombre, { datos, comprimido, original: contenido.readUInt32LE(posicion + 24), metodo });
    posicion = siguiente;
  }
  if (posicion !== fin || !entradas.has('_rels/.rels') || !entradas.get('word/document.xml')?.original) return false;
  const tipos = entradas.get('[Content_Types].xml');
  const limiteXml = 1024 * 1024;
  if (!tipos || !tipos.original || tipos.original > limiteXml) return false;
  try {
    const datos = contenido.subarray(tipos.datos, tipos.datos + tipos.comprimido);
    const xml = tipos.metodo === 8 ? inflateRawSync(datos, { maxOutputLength: limiteXml }) : datos;
    if (xml.length !== tipos.original) return false;
    const texto = xml.toString(xml[0] === 0xff && xml[1] === 0xfe ? 'utf16le' : 'utf8');
    const definiciones = texto.match(/<(?:[\w.-]+:)?Override\b[^>]*>/g) || [];
    return definiciones.some(definicion => /\bPartName\s*=\s*(["'])\/word\/document\.xml\1/.test(definicion)
      && /\bContentType\s*=\s*(["'])application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml\1/.test(definicion));
  } catch {
    return false;
  }
}

module.exports = { esDoc, esDocx };
