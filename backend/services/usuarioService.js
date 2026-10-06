const pool = require('../config/database');

const SELECT_USUARIO = `
  SELECT u.id AS usuario_id, u.email, u.activo,
         r.nombre AS rol_nombre, e.id AS empleado_id,
         e.nombres, e.apellidos, e.foto_perfil, e.tipo_vinculo,
         emp.razon_social AS empresa_nombre
  FROM usuarios u
  INNER JOIN roles r ON u.rol_id = r.id
  INNER JOIN empleados e ON u.empleado_id = e.id
  INNER JOIN empresas emp ON e.empresa_id = emp.id
`;

async function buscarPorEmail(email) {
  const [rows] = await pool.query(
    SELECT_USUARIO.replace('u.email, u.activo', 'u.email, u.activo, u.password') + ' WHERE u.email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const [rows] = await pool.query(SELECT_USUARIO + ' WHERE u.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

function usuarioPublico(usuario) {
  return {
    id: usuario.usuario_id,
    empleado_id: usuario.empleado_id,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    rol: usuario.rol_nombre,
    tipo_vinculo: usuario.tipo_vinculo,
    empresa: usuario.empresa_nombre,
    foto_perfil: usuario.foto_perfil
  };
}

module.exports = { buscarPorEmail, buscarPorId, usuarioPublico };
