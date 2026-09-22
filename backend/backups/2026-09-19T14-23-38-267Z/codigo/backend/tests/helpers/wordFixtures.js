const { deflateRawSync } = require('node:zlib');

// Fixtures estructurados sin dependencias, archivos personales ni conexión a SQL.
const PARTES_DOCX = [
  ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
  ['word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Documento de prueba</w:t></w:r></w:p><w:sectPr/></w:body></w:document>']
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crearZip(partes = PARTES_DOCX, { comprimir = true } = {}) {
  const locales = [];
  const directorio = [];
  let offset = 0;
  for (const [ruta, texto] of partes) {
    const nombre = Buffer.from(ruta);
    const contenido = Buffer.from(texto);
    const datos = comprimir ? deflateRawSync(contenido) : contenido;
    const crc = crc32(contenido);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(contenido.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(comprimir ? 8 : 0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(contenido.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(offset, 42);
    locales.push(local, nombre, datos);
    directorio.push(central, nombre);
    offset += local.length + nombre.length + datos.length;
  }
  const central = Buffer.concat(directorio);
  const final = Buffer.alloc(22);
  final.writeUInt32LE(0x06054b50);
  final.writeUInt16LE(partes.length, 8);
  final.writeUInt16LE(partes.length, 10);
  final.writeUInt32LE(central.length, 12);
  final.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, central, final]);
}

function crearDoc(nombreStream = 'WordDocument') {
  // CFB v3: cabecera, directorio, FAT y un stream de ocho sectores de 512 bytes.
  const archivo = Buffer.alloc(11 * 512);
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(archivo);
  archivo.writeUInt16LE(0x003e, 24);
  archivo.writeUInt16LE(3, 26);
  archivo.writeUInt16LE(0xfffe, 28);
  archivo.writeUInt16LE(9, 30);
  archivo.writeUInt16LE(6, 32);
  archivo.writeUInt32LE(1, 44);
  archivo.writeUInt32LE(0, 48);
  archivo.writeUInt32LE(4096, 56);
  archivo.writeUInt32LE(0xfffffffe, 60);
  archivo.writeUInt32LE(0xfffffffe, 68);
  archivo.fill(0xff, 76, 512);
  archivo.writeUInt32LE(1, 76);
  function entrada(offset, nombre, tipo, primerSector, tamano, hijo = 0xffffffff) {
    const texto = Buffer.from(nombre + '\0', 'utf16le');
    texto.copy(archivo, offset);
    archivo.writeUInt16LE(texto.length, offset + 64);
    archivo[offset + 66] = tipo;
    archivo[offset + 67] = 1;
    archivo.writeUInt32LE(0xffffffff, offset + 68);
    archivo.writeUInt32LE(0xffffffff, offset + 72);
    archivo.writeUInt32LE(hijo, offset + 76);
    archivo.writeUInt32LE(primerSector, offset + 116);
    archivo.writeBigUInt64LE(BigInt(tamano), offset + 120);
  }
  entrada(512, 'Root Entry', 5, 0xfffffffe, 0, 1);
  entrada(640, nombreStream, 2, 2, 4096);
  archivo.fill(0xff, 1024, 1536);
  archivo.writeUInt32LE(0xfffffffe, 1024);
  archivo.writeUInt32LE(0xfffffffd, 1028);
  for (let sector = 2; sector <= 9; sector++) archivo.writeUInt32LE(sector === 9 ? 0xfffffffe : sector + 1, 1024 + sector * 4);
  archivo.writeUInt16LE(0xa5ec, 1536); // FibBase.wIdent de Word 97–2003.
  archivo.writeUInt16LE(0x00c1, 1538);
  return archivo;
}

module.exports = { PARTES_DOCX, crearZip, crearDoc };
