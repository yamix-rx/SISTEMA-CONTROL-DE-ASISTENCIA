const { createHash } = require('node:crypto');

function crearLimitador({ limite = 15, ventanaMs = 15 * 60 * 1000, ahora = Date.now } = {}) {
  const intentos = new Map();
  return (req, res, next) => {
    const timestamp = ahora();
    // El mapa está acotado y no almacena contraseñas ni correos en claro.
    for (const [key, value] of intentos) if (value.hasta <= timestamp) intentos.delete(key);
    const ip = req.ip || req.socket?.remoteAddress || 'local';
    const cuenta = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const keys = [createHash('sha256').update('ip:' + ip).digest('hex'), createHash('sha256').update('cuenta:' + ip + ':' + cuenta).digest('hex')];
    const limits = [limite * 5, limite];
    for (let i = 0; i < keys.length; i++) {
      const record = intentos.get(keys[i]);
      if (record && record.cantidad >= limits[i]) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((record.hasta - timestamp) / 1000))));
        return res.status(429).json({ ok: false, mensaje: 'Demasiados intentos de acceso. Espere unos minutos y vuelva a intentar.' });
      }
    }
    if (intentos.size > 20000) return res.status(429).json({ ok: false, mensaje: 'Espere unos minutos antes de volver a intentar.' });
    for (const key of keys) {
      const record = intentos.get(key) || { cantidad: 0, hasta: timestamp + ventanaMs };
      record.cantidad++; intentos.set(key, record);
    }
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) for (const key of keys) {
        const record = intentos.get(key);
        if (record) record.cantidad = Math.max(0, record.cantidad - 1);
      }
    });
    return next();
  };
}
module.exports = { crearLimitador };
