const jwt = require('jsonwebtoken');
const { buscarPorId } = require('../services/usuarioService');
const { registrarAuditoria, sanitizar } = require('../services/auditoriaService');
const pool = require('../config/database');

const MODULO_TABLA = [
  ['/personal', 'empleados'],
  ['/asistencias/permisos', 'permisos'],
  ['/asistencias', 'asistencias'],
  ['/empresas', 'empresas'],
  ['/horarios', 'horarios'],
  ['/documentos', 'documentos_empleado'],
  ['/contratos', 'contratos'],
  ['/capacitaciones', 'capacitaciones'],
  ['/reportes', 'reportes']
];

function tablaDesdeRuta(pathname) {
  const match = MODULO_TABLA.find(([prefijo]) => pathname.startsWith(prefijo));
  return match ? match[1] : 'sistema';
}

function obtenerRegistroId(req) {
  const partes = req.path.split('/').filter(Boolean);
  const id = partes.find(p => /^\d+$/.test(p));
  return id ? Number(id) : 0;
}

async function obtenerAnterior(tabla, id) {
  if (!id || !/^[a-z_]+$/.test(tabla) || tabla === 'reportes' || tabla === 'sistema') return null;
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${tabla}\` WHERE id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  } catch (_) {
    return null;
  }
}

module.exports = async function auditoriaMiddleware(req, res, next) {
  const metodosAuditables = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (!metodosAuditables.has(req.method)) return next();

  let usuario = req.usuario;
  if (!usuario) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    if (match) {
      try {
        const decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (Number.isInteger(decoded.usuario_id)) usuario = await buscarPorId(decoded.usuario_id);
      } catch (_) {}
    }
  }

  const tabla = tablaDesdeRuta(req.baseUrl + req.path);
  const registroId = obtenerRegistroId(req);
  const anterior = ['PUT', 'PATCH', 'DELETE'].includes(req.method)
    ? await obtenerAnterior(tabla, registroId) : null;

  const datosSolicitud = {
    endpoint: `${req.baseUrl}${req.path}`,
    metodo: req.method,
    parametros: req.params || {},
    consulta: req.query || {},
    datos: sanitizar(req.body || {})
  };

  let finalizado = false;
  const guardar = async () => {
    if (finalizado) return;
    finalizado = true;
    const accion = req.method === 'POST' ? 'INSERT' : req.method === 'DELETE' ? 'DELETE' : 'UPDATE';
    const nuevos = {
      ...datosSolicitud,
      resultado_http: res.statusCode
    };
    await registrarAuditoria({
      usuario_id: usuario?.usuario_id || usuario?.id || null,
      tabla_afectada: tabla,
      registro_id: registroId,
      accion,
      datos_anteriores: anterior,
      datos_nuevos: nuevos,
      ip_origen: req.ip
    });
  };

  res.once('finish', guardar);
  return next();
};
