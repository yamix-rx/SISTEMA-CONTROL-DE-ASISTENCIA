const jwt = require('jsonwebtoken');
const { buscarPorId, usuarioPublico } = require('../services/usuarioService');
const { obtenerAcceso } = require('../config/accessPolicy');

exports.verificarToken = async (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!match) {
    return res.status(401).json({ ok: false, mensaje: 'Token de acceso no proporcionado.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!Number.isInteger(decoded.usuario_id) || decoded.usuario_id <= 0) throw new Error('Identidad inválida');
  } catch {
    return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado.' });
  }

  try {
    const usuario = await buscarPorId(decoded.usuario_id);
    if (!usuario || Number(usuario.activo) !== 1) {
      return res.status(401).json({ ok: false, mensaje: 'La sesión ya no está activa. Inicie sesión nuevamente.' });
    }
    const acceso = obtenerAcceso(usuario.rol_nombre);
    if (!acceso) {
      return res.status(403).json({ ok: false, mensaje: 'Su rol no tiene acceso habilitado. Contacte al administrador.' });
    }
    req.usuario = usuarioPublico(usuario);
    req.acceso = acceso;
    return next();
  } catch (error) {
    console.error('Error al verificar sesión:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo verificar la sesión.' });
  }
};

exports.autorizarRoles = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
    return res.status(403).json({ ok: false, mensaje: 'No cuenta con permisos suficientes para acceder a este recurso.' });
  }
  return next();
};
