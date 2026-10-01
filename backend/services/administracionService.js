const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { ROLES } = require('../config/accessPolicy');

const error = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });
function id(value, campo = 'Identificador') {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw error(`${campo} no válido.`);
  return n;
}
function nombre(value, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw error(`Ingrese un nombre de hasta ${max} caracteres.`);
  return value.trim();
}
function correo(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (text.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw error('Ingrese un correo válido.');
  return text;
}
function validarClave(value) {
  if (typeof value !== 'string' || value.length < 10 || Buffer.byteLength(value, 'utf8') > 72) {
    throw error('La contraseña debe tener al menos 10 caracteres y no superar 72 bytes.');
  }
  return value;
}
const activos = new Set([true, false, 0, 1, '0', '1']);
function activo(value) {
  if (!activos.has(value)) throw error('Estado de cuenta no válido.');
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

async function catalogos() {
  const [[roles], [empleados], [empresas], [areas], [cargos]] = await Promise.all([
    pool.query('SELECT id, nombre FROM roles ORDER BY id'),
    pool.query(`SELECT e.id, CONCAT(e.nombres, ' ', e.apellidos) AS nombre, e.numero_documento,
      e.estado, u.id AS usuario_id FROM empleados e LEFT JOIN usuarios u ON u.empleado_id=e.id ORDER BY e.apellidos, e.nombres`),
    pool.query('SELECT id, razon_social, estado FROM empresas ORDER BY razon_social'),
    pool.query('SELECT a.id, a.nombre, a.empresa_id, e.razon_social AS empresa FROM areas a JOIN empresas e ON e.id=a.empresa_id ORDER BY e.razon_social, a.nombre'),
    pool.query('SELECT c.id, c.nombre, c.area_id, a.nombre AS area, a.empresa_id FROM cargos c JOIN areas a ON a.id=c.area_id ORDER BY a.nombre, c.nombre')
  ]);
  return { roles: roles.filter(r => Object.values(ROLES).includes(r.nombre)), empleados, empresas, areas, cargos };
}
async function listarUsuarios() {
  const [rows] = await pool.query(`SELECT u.id, u.empleado_id, u.rol_id, u.email, u.activo,
    CONCAT(e.nombres,' ',e.apellidos) AS colaborador, r.nombre AS rol
    FROM usuarios u JOIN empleados e ON e.id=u.empleado_id JOIN roles r ON r.id=u.rol_id ORDER BY e.apellidos,e.nombres`);
  return rows;
}
async function validarRol(connection, rolId) {
  const [rows] = await connection.query('SELECT id, nombre FROM roles WHERE id = ?', [rolId]);
  if (!rows.length || !Object.values(ROLES).includes(rows[0].nombre)) throw error('Seleccione uno de los tres perfiles del sistema.');
  return rows[0];
}
async function crearUsuario(body) {
  const empleado = id(body.empleado_id, 'Colaborador');
  const rol = id(body.rol_id, 'Perfil');
  const email = correo(body.email);
  const password = await bcrypt.hash(validarClave(body.password), 12);
  await validarRol(pool, rol);
  const [personas] = await pool.query('SELECT id FROM empleados WHERE id = ?', [empleado]);
  if (!personas.length) throw error('El colaborador no existe.');
  const [result] = await pool.query('INSERT INTO usuarios (empleado_id,rol_id,email,password,activo) VALUES (?,?,?,?,1)', [empleado, rol, email, password]);
  return result.insertId;
}
async function actualizarUsuario(usuarioId, body, actorId) {
  const usuario = id(usuarioId);
  const rol = id(body.rol_id, 'Perfil');
  const email = correo(body.email);
  const habilitado = activo(body.activo);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Serializa cambios de administradores para impedir eliminar el último acceso.
    const [admins] = await connection.query(`SELECT u.id FROM usuarios u JOIN roles r ON r.id=u.rol_id
      WHERE u.activo=1 AND r.nombre=? ORDER BY u.id FOR UPDATE`, [ROLES.ADMIN]);
    const [rows] = await connection.query('SELECT id, rol_id, activo FROM usuarios WHERE id = ? FOR UPDATE', [usuario]);
    if (!rows.length) throw error('La cuenta no existe.', 404);
    const perfil = await validarRol(connection, rol);
    const pierdeAdmin = !habilitado || perfil.nombre !== ROLES.ADMIN;
    if (usuario === Number(actorId) && pierdeAdmin) throw error('No puede desactivar ni quitar el perfil administrador a su propia cuenta.');
    if (pierdeAdmin && admins.some(a => a.id === usuario) && admins.length <= 1) throw error('Debe conservar al menos un administrador activo.');
    await connection.query('UPDATE usuarios SET email=?, rol_id=?, activo=?, sesion_version=sesion_version+1 WHERE id=?', [email, rol, habilitado, usuario]);
    await connection.commit();
  } catch (e) { await connection.rollback(); throw e; }
  finally { connection.release(); }
  return usuario;
}
async function restablecerClave(usuarioId, password) {
  const usuario = id(usuarioId);
  const hash = await bcrypt.hash(validarClave(password), 12);
  const [result] = await pool.query('UPDATE usuarios SET password=?, sesion_version=sesion_version+1 WHERE id=?', [hash, usuario]);
  if (!result.affectedRows) throw error('La cuenta no existe.', 404);
  return usuario;
}
async function guardarArea(areaId, body) {
  const area = areaId ? id(areaId) : null;
  const empresa = id(body.empresa_id, 'Empresa');
  const text = nombre(body.nombre);
  const [empresas] = await pool.query('SELECT id FROM empresas WHERE id = ?', [empresa]);
  if (!empresas.length) throw error('La empresa no existe.');
  if (area) {
    const [rows] = await pool.query('SELECT id,empresa_id FROM areas WHERE id=?', [area]);
    if (!rows.length) throw error('El área no existe.', 404);
    if (Number(rows[0].empresa_id) !== empresa) {
      const [uso] = await pool.query('SELECT id FROM empleados WHERE area_id=? LIMIT 1', [area]);
      if (uso.length) throw error('Esta área tiene personal. Cree otra área para la nueva empresa.');
    }
    await pool.query('UPDATE areas SET nombre=?,empresa_id=? WHERE id=?', [text, empresa, area]);
    return area;
  }
  const [result] = await pool.query('INSERT INTO areas (nombre,empresa_id) VALUES (?,?)', [text, empresa]);
  return result.insertId;
}
async function guardarCargo(cargoId, body) {
  const cargo = cargoId ? id(cargoId) : null;
  const area = id(body.area_id, 'Área');
  const text = nombre(body.nombre);
  const [areas] = await pool.query('SELECT id FROM areas WHERE id = ?', [area]);
  if (!areas.length) throw error('El área no existe.');
  if (cargo) {
    const [rows] = await pool.query('SELECT id,area_id FROM cargos WHERE id=?', [cargo]);
    if (!rows.length) throw error('El cargo no existe.', 404);
    if (Number(rows[0].area_id) !== area) {
      const [uso] = await pool.query('SELECT id FROM empleados WHERE cargo_id=? LIMIT 1', [cargo]);
      if (uso.length) throw error('Este cargo tiene personal. Cree otro cargo para la nueva área.');
    }
    await pool.query('UPDATE cargos SET nombre=?,area_id=? WHERE id=?', [text, area, cargo]);
    return cargo;
  }
  const [result] = await pool.query('INSERT INTO cargos (nombre,area_id) VALUES (?,?)', [text, area]);
  return result.insertId;
}
module.exports = { catalogos, listarUsuarios, crearUsuario, actualizarUsuario, restablecerClave, guardarArea, guardarCargo, validarClave, correo };