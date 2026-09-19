const pool = require('../config/database');

function sanitizar(valor) {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map(sanitizar);
  if (typeof valor === 'object') {
    const out = {};
    for (const [clave, dato] of Object.entries(valor)) {
      const sensible = /password|token|authorization|secret/i.test(clave);
      out[clave] = sensible ? '[OCULTO]' : sanitizar(dato);
    }
    return out;
  }
  return valor;
}

async function registrarAuditoria({
  usuario_id = null,
  tabla_afectada,
  registro_id = 0,
  accion,
  datos_anteriores = null,
  datos_nuevos = null,
  ip_origen = null
}) {
  try {
    await pool.query(
      `INSERT INTO historial_cambios
       (usuario_id, tabla_afectada, registro_id, accion, datos_anteriores, datos_nuevos, ip_origen)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario_id,
        String(tabla_afectada || 'sistema').slice(0, 60),
        Number.isInteger(Number(registro_id)) ? Number(registro_id) : 0,
        accion,
        datos_anteriores == null ? null : JSON.stringify(sanitizar(datos_anteriores)),
        datos_nuevos == null ? null : JSON.stringify(sanitizar(datos_nuevos)),
        ip_origen || null
      ]
    );
  } catch (error) {
    // La auditoría no debe interrumpir una operación funcional del sistema.
    console.error('Error registrando auditoría:', error.code || error.message);
  }
}

module.exports = { registrarAuditoria, sanitizar };
