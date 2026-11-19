'use strict';

const { randomUUID } = require('node:crypto');
const path = require('node:path');
const pool = require('../config/database');
const storage = require('./storagePrivadoService');

const MAX_BYTES = 2 * 1024 * 1024;
const FORMATOS = Object.freeze({
  'image/png': { extension: '.png', firma: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  'image/jpeg': { extension: '.jpg', firma: Buffer.from([0xff, 0xd8, 0xff]) }
});

function error(mensaje, status = 400) {
  return Object.assign(new Error(mensaje), { status });
}

function nombreSeguro(valor, archivo) {
  const original = path.parse(path.basename(String(archivo.originalname || 'logo'))).name;
  const fuente = typeof valor === 'string' && valor.trim() ? valor : original;
  const nombre = fuente.normalize('NFC').replace(/[\\u0000-\\u001f\\u007f]/g, ' ')
    .replace(/[\\/\\\\]/g, '-').replace(/\\s+/g, ' ').trim().slice(0, 200);
  if (!nombre) throw error('Escribe un nombre para identificar el logo.');
  return nombre;
}

function validarArchivo(archivo) {
  if (!archivo || !Buffer.isBuffer(archivo.buffer) || !archivo.buffer.length) {
    throw error('Selecciona una imagen PNG o JPG.');
  }
  if (archivo.buffer.length > MAX_BYTES) throw error('El logo no puede superar los 2 MB.', 413);
  const formato = FORMATOS[archivo.mimetype];
  if (!formato || !archivo.buffer.subarray(0, formato.firma.length).equals(formato.firma)) {
    throw error('El contenido del archivo no coincide con una imagen PNG o JPG válida.');
  }
  return archivo.mimetype;
}

async function listar() {
  const [rows] = await pool.query(
    'SELECT id, nombre, mime_type, tamano_bytes, created_at FROM logos_documentos ORDER BY nombre ASC, id DESC'
  );
  return rows.map(row => ({
    id: Number(row.id), nombre: row.nombre, mime_type: row.mime_type,
    tamano_bytes: Number(row.tamano_bytes), created_at: row.created_at
  }));
}

async function guardar(archivo, nombre, usuarioId) {
  const mime = validarArchivo(archivo);
  const etiqueta = nombreSeguro(nombre, archivo);
  const ruta = randomUUID() + FORMATOS[mime].extension;
  await storage.subirObjeto(ruta, archivo.buffer, mime);
  try {
    const [insertado] = await pool.query(
      'INSERT INTO logos_documentos (nombre, ruta_archivo, mime_type, tamano_bytes, creado_por_usuario_id) VALUES (?, ?, ?, ?, ?)',
      [etiqueta, ruta, mime, archivo.buffer.length, Number(usuarioId) || null]
    );
    return {
      id: Number(insertado.insertId), nombre: etiqueta, mime_type: mime,
      tamano_bytes: archivo.buffer.length, created_at: new Date().toISOString()
    };
  } catch (cause) {
    await storage.eliminarObjeto(ruta).catch(() => {});
    throw cause;
  }
}

async function obtenerContenido(ruta) {
  if (typeof ruta !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:png|jpg)$/i.test(ruta)) {
    throw error('La referencia del logo no es válida.', 409);
  }
  const contenido = await storage.verificarContenido(ruta);
  if (!Buffer.isBuffer(contenido) || !contenido.length || contenido.length > MAX_BYTES) {
    throw error('El logo guardado no está disponible o supera el tamaño permitido.', 409);
  }
  return contenido;
}

module.exports = { MAX_BYTES, listar, guardar, obtenerContenido };
