const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_BYTES = 5 * 1024 * 1024;
const DIRECTORIO = path.resolve(__dirname, '../uploads/documentos');
const FORMATOS = Object.freeze({ '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' });
const ARCHIVO_PRIVADO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$/i;

function errorArchivo(mensaje, status = 400) {
  return Object.assign(new Error(mensaje), { status });
}

function validarArchivo(nombre, base64) {
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 200 || /[\\/\u0000-\u001f\u007f]/.test(nombre)) {
    throw errorArchivo('El nombre del archivo no es válido (máximo 200 caracteres, sin rutas).');
  }
  const extension = path.extname(nombre).toLowerCase();
  if (!FORMATOS[extension]) throw errorArchivo('Seleccione un archivo PDF, PNG, JPG o JPEG.');
  if (typeof base64 !== 'string' || !base64.length) throw errorArchivo('Debe adjuntar el contenido del archivo.');
  if (base64.length > Math.ceil(MAX_BYTES / 3) * 4) throw errorArchivo('El archivo supera el máximo de 5 MB.', 413);
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw errorArchivo('El contenido del archivo no tiene un formato base64 válido.');
  }
  const contenido = Buffer.from(base64, 'base64');
  if (!contenido.length || contenido.length > MAX_BYTES) throw errorArchivo('El archivo debe tener contenido y pesar como máximo 5 MB.', contenido.length ? 413 : 400);
  if (contenido.toString('base64') !== base64) throw errorArchivo('El contenido del archivo no tiene un formato base64 válido.');
  const esPDF = contenido.subarray(0, 5).toString('ascii') === '%PDF-';
  const esPNG = contenido.length >= 8 && contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const esJPEG = contenido.length >= 3 && contenido[0] === 255 && contenido[1] === 216 && contenido[2] === 255;
  if (!(extension === '.pdf' && esPDF || extension === '.png' && esPNG || ['.jpg', '.jpeg'].includes(extension) && esJPEG)) {
    throw errorArchivo('El contenido del archivo no coincide con su extensión.');
  }
  return { contenido, nombre_archivo: nombre.trim(), extension, mime_type: FORMATOS[extension] };
}

function resolverRutaPrivada(nombre) {
  if (typeof nombre !== 'string' || !ARCHIVO_PRIVADO.test(nombre) || path.basename(nombre) !== nombre) {
    throw errorArchivo('El archivo no está disponible. Vuelva a cargarlo desde Documentos.', 404);
  }
  return path.join(DIRECTORIO, nombre);
}

async function guardarArchivo(archivo) {
  await fs.mkdir(DIRECTORIO, { recursive: true, mode: 0o700 });
  const nombrePrivado = randomUUID() + archivo.extension;
  const ruta = resolverRutaPrivada(nombrePrivado);
  await fs.writeFile(ruta, archivo.contenido, { flag: 'wx', mode: 0o600 });
  return nombrePrivado;
}

async function eliminarArchivo(nombre) {
  await fs.unlink(resolverRutaPrivada(nombre)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}

async function obtenerArchivo(nombre) {
  const ruta = resolverRutaPrivada(nombre);
  try {
    // Rechazar enlaces simbólicos impide que una referencia salga de la carpeta privada.
    const [directorioReal, rutaReal, stat] = await Promise.all([fs.realpath(DIRECTORIO), fs.realpath(ruta), fs.lstat(ruta)]);
    if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(rutaReal) !== directorioReal) {
      throw errorArchivo('El archivo no está disponible.', 404);
    }
    return { ruta: rutaReal, mime_type: FORMATOS[path.extname(nombre).toLowerCase()] };
  } catch (error) {
    if (error.code === 'ENOENT') throw errorArchivo('El archivo no se encuentra almacenado. Vuelva a cargarlo desde Documentos.', 404);
    throw error;
  }
}

function disposicionArchivo(nombre, descargar = false) {
  const limpio = String(nombre || 'documento').replace(/[\r\n\u0000-\u001f\u007f\\/]/g, '_').slice(0, 200);
  const ascii = limpio.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(limpio).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${descargar ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

module.exports = { MAX_BYTES, validarArchivo, resolverRutaPrivada, guardarArchivo, eliminarArchivo, obtenerArchivo, disposicionArchivo };
