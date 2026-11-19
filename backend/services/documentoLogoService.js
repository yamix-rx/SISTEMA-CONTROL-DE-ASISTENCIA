const pool = require('../config/database');

const MAX_BYTES = 2 * 1024 * 1024;

function error(mensaje, status = 400) {
  return Object.assign(new Error(mensaje), { status });
}

function validar(body = {}) {
  const nombre = body.nombre;
  const mime_type = body.mime_type;
  const base64 = body.contenido_base64;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(nombre)) {
    throw error('El nombre del logo es obligatorio y admite hasta 100 caracteres.');
  }
  if (!['image/png', 'image/jpeg'].includes(mime_type)) {
    throw error('El logo debe ser una imagen PNG o JPG.');
  }
  if (typeof base64 !== 'string' || !base64.length || base64.length > Math.ceil(MAX_BYTES / 3) * 4 + 4
      || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw error('El archivo del logo no tiene un contenido base64 válido o supera los 2 MB.', 413);
  }
  const contenido = Buffer.from(base64, 'base64');
  if (!contenido.length || contenido.length > MAX_BYTES || contenido.toString('base64') !== base64) {
    throw error('El logo debe tener contenido y pesar como máximo 2 MB.', contenido.length ? 413 : 400);
  }
  const png = contenido.length >= 8 && contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = contenido.length >= 3 && contenido[0] === 255 && contenido[1] === 216 && contenido[2] === 255;
  if (!(mime_type === 'image/png' && png || mime_type === 'image/jpeg' && jpeg)) {
    throw error('El contenido del archivo no coincide con el formato de imagen seleccionado.');
  }
  return { nombre: nombre.trim(), mime_type, contenido };
}

async function listar() {
  const [rows] = await pool.query('SELECT id, nombre, mime_type, created_at FROM logos_documentos ORDER BY nombre, id');
  return rows.map(row => ({ id: Number(row.id), nombre: row.nombre, mime_type: row.mime_type, created_at: row.created_at }));
}

async function existe(id) {
  const [rows] = await pool.query('SELECT id FROM logos_documentos WHERE id = ? LIMIT 1', [id]);
  return rows.length > 0;
}

async function guardar(body) {
  const logo = validar(body);
  const [result] = await pool.query(
    'INSERT INTO logos_documentos (nombre, mime_type, contenido) VALUES (?, ?, ?)',
    [logo.nombre, logo.mime_type, logo.contenido]
  );
  return { id: Number(result.insertId), nombre: logo.nombre, mime_type: logo.mime_type };
}

async function obtener(id) {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw error('El logo seleccionado no es válido.');
  const [rows] = await pool.query(
    'SELECT id, nombre, mime_type, contenido FROM logos_documentos WHERE id = ? LIMIT 1', [numero]
  );
  if (!rows.length) throw error('El logo seleccionado ya no está disponible. Vuelve a elegirlo.', 404);
  return { ...rows[0], id: Number(rows[0].id), contenido: Buffer.from(rows[0].contenido) };
}

module.exports = { MAX_BYTES, validar, listar, existe, guardar, obtener };
