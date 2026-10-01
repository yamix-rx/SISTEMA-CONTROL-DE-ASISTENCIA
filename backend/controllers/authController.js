const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { buscarPorEmail, usuarioPublico } = require('../services/usuarioService');
const { obtenerAcceso } = require('../config/accessPolicy');
const { registrarAuditoria } = require('../services/auditoriaService');

exports.login = async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Por favor, proporcione correo y contraseña.' });
  }

  try {
    const usuario = await buscarPorEmail(email.trim());
    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      await registrarAuditoria({
        usuario_id: usuario?.usuario_id || null,
        tabla_afectada: 'sesiones',
        registro_id: usuario?.usuario_id || 0,
        accion: 'LOGIN_FALLIDO',
        datos_nuevos: { email: email.trim(), motivo: 'Credenciales inválidas' },
        ip_origen: req.ip
      });
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas.' });
    }
    if (Number(usuario.activo) !== 1) {
      await registrarAuditoria({
        usuario_id: usuario.usuario_id,
        tabla_afectada: 'sesiones',
        registro_id: usuario.usuario_id,
        accion: 'LOGIN_FALLIDO',
        datos_nuevos: { email: email.trim(), motivo: 'Cuenta inactiva' },
        ip_origen: req.ip
      });
      return res.status(403).json({ ok: false, mensaje: 'La cuenta se encuentra inactiva. Contacte a Recursos Humanos.' });
    }

    const acceso = obtenerAcceso(usuario.rol_nombre);
    if (!acceso) {
      return res.status(403).json({ ok: false, mensaje: 'Su rol no tiene un panel habilitado. Contacte al administrador.' });
    }

    // El token identifica la cuenta. Rol y empleado se consultan en cada petición.
    const token = jwt.sign({ usuario_id: usuario.usuario_id, sv: Number(usuario.sesion_version || 0) }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: 'HS256'
    });

    await registrarAuditoria({
      usuario_id: usuario.usuario_id,
      tabla_afectada: 'sesiones',
      registro_id: usuario.usuario_id,
      accion: 'LOGIN',
      datos_nuevos: { email: usuario.email, rol: usuario.rol_nombre },
      ip_origen: req.ip
    });

    return res.status(200).json({
      ok: true,
      mensaje: 'Inicio de sesión exitoso',
      token,
      redirectUrl: acceso.panel,
      usuario: usuarioPublico(usuario),
      acceso
    });
  } catch (error) {
    console.error('Error en login:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'Error interno en el servidor.' });
  }
};

exports.perfil = (req, res) => res.json({ ok: true, usuario: req.usuario, acceso: req.acceso });
