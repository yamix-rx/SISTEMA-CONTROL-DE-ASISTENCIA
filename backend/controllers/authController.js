const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { buscarPorEmail, usuarioPublico } = require('../services/usuarioService');
const { obtenerAcceso } = require('../config/accessPolicy');
const { registrarAuditoria } = require('../services/auditoriaService');

exports.login = async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || !email.trim() || email.length > 120 || typeof password !== 'string' || !password || Buffer.byteLength(password,'utf8') > 72) {
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

    if (Boolean(usuario.debe_cambiar_clave)) {
      const token = jwt.sign({ usuario_id: usuario.usuario_id, sv: Number(usuario.sesion_version || 0), provisional: true },
        process.env.JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' });
      await registrarAuditoria({ usuario_id: usuario.usuario_id, tabla_afectada: 'sesiones',
        registro_id: usuario.usuario_id, accion: 'LOGIN',
        datos_nuevos: { email: usuario.email, cambio_clave_obligatorio: true }, ip_origen: req.ip });
      return res.json({ ok: true, requiere_cambio_clave: true, token,
        mensaje: 'Debes cambiar tu contraseña temporal para activar el acceso.' });
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

exports.logout = async (req, res) => {
  try {
    await require('../config/database').query('UPDATE usuarios SET sesion_version=sesion_version+1 WHERE id=?', [req.usuario.id]);
    res.locals.auditoria = { tabla: 'usuarios', registroId: req.usuario.id, accion: 'UPDATE', nuevos: { cierre_sesion: true } };
    return res.json({ ok: true, mensaje: 'Sesión cerrada. Se invalidaron los accesos anteriores de esta cuenta.' });
  } catch (error) {
    return res.status(503).json({ ok: false, mensaje: 'No se pudo cerrar la sesión. Vuelva a intentar.' });
  }
};


exports.cambiarClaveInicial = async (req,res) => {
  const actual = req.body?.password_actual;
  const nueva = req.body?.password_nueva;
  if (typeof actual !== 'string' || typeof nueva !== 'string'
      || nueva.length < 12 || Buffer.byteLength(nueva,'utf8') > 72 || actual === nueva) {
    return res.status(400).json({ ok:false, mensaje:'La nueva contraseña debe ser distinta, tener al menos 12 caracteres y máximo 72 bytes.' });
  }
  const pool = require('../config/database');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT password, debe_cambiar_clave FROM usuarios WHERE id=? FOR UPDATE', [req.usuario.id]);
    if (!rows.length || !rows[0].debe_cambiar_clave || !(await bcrypt.compare(actual,rows[0].password))) {
      await connection.rollback();
      return res.status(401).json({ok:false,mensaje:'La contraseña temporal no coincide o ya se utilizó.'});
    }
    await connection.query('UPDATE usuarios SET password=?, debe_cambiar_clave=FALSE, sesion_version=sesion_version+1 WHERE id=?',
      [await bcrypt.hash(nueva,12),req.usuario.id]);
    await connection.commit();
    return res.json({ok:true,mensaje:'Contraseña renovada. Inicia sesión nuevamente con tu clave nueva.'});
  } catch(error) {
    await connection.rollback().catch(()=>{});
    console.error('Error al cambiar contraseña inicial:',error.code||error.name);
    return res.status(500).json({ok:false,mensaje:'No se pudo actualizar la contraseña.'});
  } finally { connection.release(); }
};
