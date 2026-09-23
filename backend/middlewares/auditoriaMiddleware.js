const { registrarAuditoria, sanitizar } = require('../services/auditoriaService');
const pool = require('../config/database');
const { ROLES } = require('../config/accessPolicy');

const MODULOS = [
  ['/administracion/usuarios', 'usuarios'], ['/administracion/areas', 'areas'],
  ['/administracion/cargos', 'cargos'], ['/documentos/plantillas', 'plantillas_documentos'],
  ['/asistencias/permisos', 'permisos'], ['/personal', 'empleados'],
  ['/asistencias', 'asistencias'], ['/empresas', 'empresas'], ['/horarios', 'horarios'],
  ['/documentos', 'documentos_empleado'], ['/contratos', 'contratos'], ['/capacitaciones', 'capacitaciones']
];
const TABLAS = new Set(MODULOS.map(([, tabla]) => tabla));
const idValido = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;

async function leerRegistro(tabla, id) {
  if (!TABLAS.has(tabla) || !id) return null;
  const [rows] = await pool.query(`SELECT * FROM \`${tabla}\` WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

module.exports = async function auditoriaMiddleware(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const ruta = `${req.baseUrl}${req.path}`.replace(/^\/api(?=\/)/, '');
  if (ruta.startsWith('/documentos/generar/')) return next();
  const tabla = MODULOS.find(([prefijo]) => ruta === prefijo || ruta.startsWith(`${prefijo}/`))?.[1];
  if (!tabla) return next();
  let registroId = idValido(req.path.split('/').find(p => /^\d+$/.test(p))) || idValido(req.body?.id);
  let anterior = null;
  let operacion = req.method === 'DELETE' ? 'DELETE' : req.method === 'POST' && !registroId ? 'INSERT' : 'UPDATE';
  const endpoint = `${req.baseUrl}${req.path}`;
  try {
    const soloAdministrador = ['usuarios', 'areas', 'cargos', 'empresas'].includes(tabla);
    if (req.usuario && (!soloAdministrador || req.usuario.rol === ROLES.ADMIN)) {
      if (ruta === '/asistencias/marcar' && req.body?.empleado_id && req.body?.fecha) {
        const [rows] = await pool.query('SELECT * FROM asistencias WHERE empleado_id = ? AND fecha = ? LIMIT 1', [req.body.empleado_id, req.body.fecha]);
        anterior = rows[0] || null;
        registroId = idValido(anterior?.id);
        operacion = anterior ? 'UPDATE' : 'INSERT';
      } else if (ruta === '/horarios/asignar' && req.body?.empleado_id) {
        const [rows] = await pool.query('SELECT * FROM horarios WHERE empleado_id = ? ORDER BY dia_semana', [req.body.empleado_id]);
        anterior = rows;
        operacion = rows.length ? 'UPDATE' : 'INSERT';
      } else if (tabla === 'plantillas_documentos') {
        const [rows] = await pool.query('SELECT * FROM plantillas_documentos WHERE codigo = ? LIMIT 1', [req.path.split('/').pop()]);
        anterior = rows[0] || null;
        registroId = idValido(anterior?.id);
        operacion = anterior ? 'UPDATE' : 'INSERT';
      } else if (registroId) anterior = await leerRegistro(tabla, registroId);
    }
  } catch (error) {
    return next(error);
  }

  let respuesta;
  let guardado = false;
  async function guardar() {
    if (guardado) return;
    guardado = true;
    const contexto = res.locals.auditoria || {};
    const tablaFinal = TABLAS.has(contexto.tabla) ? contexto.tabla : tabla;
    const exito = res.statusCode >= 200 && res.statusCode < 300;
    if (exito && contexto.persistida === true) return;
    let id = idValido(contexto.registroId) || registroId || idValido(respuesta?.id) || idValido(respuesta?.data?.id);
    let despues = null;
    if (exito) {
      try {
        if (ruta === '/asistencias/marcar') {
          const [rows] = await pool.query('SELECT * FROM asistencias WHERE empleado_id = ? AND fecha = ? LIMIT 1', [req.body.empleado_id, req.body.fecha]);
          despues = rows[0] || null;
          id = idValido(despues?.id) || id;
        } else if (ruta === '/horarios/asignar') {
          const [rows] = await pool.query('SELECT * FROM horarios WHERE empleado_id = ? ORDER BY dia_semana', [req.body.empleado_id]);
          despues = rows;
        } else if (contexto.accion !== 'DELETE' && req.method !== 'DELETE') despues = await leerRegistro(tablaFinal, id);
      } catch (error) {
        console.error('No se pudo leer el estado posterior de auditoría:', error.code || error.name);
      }
    }
    const accion = exito ? (['INSERT', 'UPDATE', 'DELETE'].includes(contexto.accion) ? contexto.accion : operacion)
      : [401, 403].includes(res.statusCode) ? 'DENEGADO' : 'ERROR';
    await registrarAuditoria({
      usuario_id: req.usuario?.id || req.usuario?.usuario_id || null,
      tabla_afectada: tablaFinal, registro_id: id, accion,
      datos_anteriores: Object.hasOwn(contexto, 'anterior') ? contexto.anterior : anterior,
      datos_nuevos: {
        endpoint, metodo: req.method, resultado_http: res.statusCode,
        solicitud: sanitizar(req.body || {}),
        registro: Object.hasOwn(contexto, 'nuevos') ? contexto.nuevos : despues
      }, ip_origen: req.ip
    });
  }
  const json = res.json.bind(res);
  res.json = function (body) {
    respuesta = body;
    guardar().then(() => json(body)).catch(next);
    return res;
  };
  res.once('finish', () => { guardar().catch(error => console.error('Auditoría:', error.code || error.name)); });
  next();
};