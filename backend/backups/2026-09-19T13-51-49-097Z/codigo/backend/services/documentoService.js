const pool = require('../config/database');
const archivos = require('./documentoArchivoService');

const ESTADOS = ['sin_entregar', 'pendiente', 'validado', 'rechazado'];
const ESTADO_SQL = "CASE WHEN de.id IS NULL THEN 'sin_entregar' ELSE COALESCE(de.estado, 'pendiente') END";
const BASE_SQL = `
  FROM empleados e
  INNER JOIN empresas emp ON emp.id = e.empresa_id
  CROSS JOIN tipo_documentos td
  LEFT JOIN (
    SELECT empleado_id, tipo_documento_id, MAX(id) AS ultimo_id
    FROM documentos_empleado GROUP BY empleado_id, tipo_documento_id
  ) ult ON ult.empleado_id = e.id AND ult.tipo_documento_id = td.id
  LEFT JOIN documentos_empleado de ON de.id = ult.ultimo_id
`;

function errorSolicitud(mensaje, status = 400) { return Object.assign(new Error(mensaje), { status }); }

function idPositivo(valor, nombre = 'identificador') {
  if (typeof valor !== 'string' && typeof valor !== 'number') throw errorSolicitud(`El ${nombre} no es válido.`);
  if (!/^[1-9]\d*$/.test(String(valor)) || !Number.isSafeInteger(Number(valor))) throw errorSolicitud(`El ${nombre} no es válido.`);
  return Number(valor);
}

function construirFiltros(query) {
  const condiciones = ['(td.es_obligatorio = 1 OR de.id IS NOT NULL)'];
  const params = [];
  if (query.q !== undefined && query.q !== '') {
    if (typeof query.q !== 'string' || query.q.length > 150) throw errorSolicitud('La búsqueda admite un máximo de 150 caracteres.');
    const buscar = `%${query.q.trim()}%`;
    condiciones.push("(CONCAT(e.nombres, ' ', e.apellidos) LIKE ? OR e.numero_documento LIKE ?)");
    params.push(buscar, buscar);
  }
  for (const [nombre, campo] of [['empresa_id', 'e.empresa_id'], ['tipo_documento_id', 'td.id'], ['empleado_id', 'e.id']]) {
    if (query[nombre] !== undefined && query[nombre] !== '') {
      condiciones.push(`${campo} = ?`);
      params.push(idPositivo(query[nombre], nombre));
    }
  }
  const estado = query.estado || '';
  if (estado && !ESTADOS.includes(estado)) throw errorSolicitud('El estado seleccionado no es válido.');
  const pagina = query.pagina === undefined ? 1 : idPositivo(query.pagina, 'número de página');
  const limite = query.limite === undefined ? 5 : idPositivo(query.limite, 'límite de resultados');
  if (limite > 100 || pagina > 1000000) throw errorSolicitud('La paginación solicitada supera el límite permitido.');
  return { where: ' WHERE ' + condiciones.join(' AND '), params, estado, pagina, limite };
}

async function catalogos() {
  const [[empleados], [empresas], [tipos]] = await Promise.all([
    pool.query("SELECT e.id, CONCAT(e.nombres, ' ', e.apellidos) AS colaborador, e.numero_documento, e.empresa_id, emp.razon_social AS empresa FROM empleados e INNER JOIN empresas emp ON emp.id = e.empresa_id ORDER BY e.apellidos, e.nombres"),
    pool.query('SELECT id, razon_social FROM empresas ORDER BY razon_social'),
    pool.query('SELECT id, nombre, es_obligatorio FROM tipo_documentos ORDER BY es_obligatorio DESC, nombre')
  ]);
  return { empleados, empresas, tipos };
}

async function listar(query) {
  const filtros = construirFiltros(query);
  // El resumen usa los filtros de búsqueda pero siempre contiene los cuatro estados.
  const [conteos] = await pool.query(`SELECT ${ESTADO_SQL} AS estado, COUNT(*) AS cantidad ${BASE_SQL} ${filtros.where} GROUP BY ${ESTADO_SQL}`, filtros.params);
  const resumen = { sin_entregar: 0, pendiente: 0, validado: 0, rechazado: 0 };
  for (const row of conteos) if (ESTADOS.includes(row.estado)) resumen[row.estado] = Number(row.cantidad);
  const total = filtros.estado ? resumen[filtros.estado] : Object.values(resumen).reduce((a, b) => a + b, 0);
  const where = filtros.where + (filtros.estado ? ` AND ${ESTADO_SQL} = ?` : '');
  const params = [...filtros.params, ...(filtros.estado ? [filtros.estado] : []), filtros.limite, (filtros.pagina - 1) * filtros.limite];
  const [documentos] = await pool.query(`
    SELECT CONCAT(e.id, '-', td.id) AS clave, de.id AS documento_id,
      e.id AS empleado_id, CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
      e.numero_documento, e.empresa_id, emp.razon_social AS empresa,
      td.id AS tipo_documento_id, td.nombre AS tipo_documento, td.es_obligatorio,
      de.nombre_archivo, de.fecha_subida, ${ESTADO_SQL} AS estado,
      de.observacion, de.mime_type
    ${BASE_SQL} ${where}
    ORDER BY CASE WHEN de.id IS NULL THEN 0 WHEN de.estado = 'pendiente' THEN 1 WHEN de.estado = 'rechazado' THEN 2 ELSE 3 END,
      e.apellidos, e.nombres, e.id, td.nombre, td.id LIMIT ? OFFSET ?
  `, params);
  return { documentos, total, pagina: filtros.pagina, limite: filtros.limite, resumen };
}

async function subir(body) {
  const empleadoId = idPositivo(body.empleado_id, 'colaborador');
  const tipoId = idPositivo(body.tipo_documento_id, 'tipo de documento');
  const archivo = archivos.validarArchivo(body.nombre_archivo, body.contenido_base64);
  const [[empleados], [tipos]] = await Promise.all([
    pool.query('SELECT id FROM empleados WHERE id = ? LIMIT 1', [empleadoId]),
    pool.query('SELECT id FROM tipo_documentos WHERE id = ? LIMIT 1', [tipoId])
  ]);
  if (!empleados.length || !tipos.length) throw errorSolicitud('El colaborador o el tipo de documento ya no existe.', 404);
  const nombrePrivado = await archivos.guardarArchivo(archivo);
  try {
    const [result] = await pool.query(`INSERT INTO documentos_empleado
      (empleado_id, tipo_documento_id, nombre_archivo, ruta_archivo, estado, fecha_subida, mime_type)
      VALUES (?, ?, ?, ?, 'pendiente', CURRENT_TIMESTAMP, ?)`,
    [empleadoId, tipoId, archivo.nombre_archivo, nombrePrivado, archivo.mime_type]);
    return { documento_id: result.insertId, mensaje: 'Documento cargado. Queda pendiente de revisión.' };
  } catch (error) {
    await archivos.eliminarArchivo(nombrePrivado).catch(limpieza => console.error('No se pudo retirar una carga fallida:', limpieza.code || limpieza.name));
    throw error;
  }
}

async function obtenerPorId(id, empleadoId = null) {
  const params = [idPositivo(id)];
  const propia = empleadoId == null ? '' : ' AND empleado_id = ?';
  if (empleadoId != null) params.push(idPositivo(empleadoId, 'colaborador'));
  const [rows] = await pool.query(`SELECT id, nombre_archivo, ruta_archivo, mime_type FROM documentos_empleado WHERE id = ?${propia} LIMIT 1`, params);
  if (!rows.length) throw errorSolicitud('El documento solicitado no existe.', 404);
  return rows[0];
}

async function revisar(id, body, usuarioId) {
  const documentoId = idPositivo(id);
  const reviewerId = idPositivo(usuarioId, 'usuario revisor');
  if (!['validado', 'rechazado'].includes(body.estado)) throw errorSolicitud('Seleccione Validado u Observado para la revisión.');
  if (body.observacion !== undefined && typeof body.observacion !== 'string') throw errorSolicitud('La observación debe ser un texto.');
  const observacion = (body.observacion || '').trim();
  if (observacion.length > 2000) throw errorSolicitud('La observación admite un máximo de 2000 caracteres.');
  if (body.estado === 'rechazado' && !observacion) throw errorSolicitud('Indique el motivo de la observación para que se pueda corregir.');
  // La revisión sólo modifica la versión vigente en el momento de actualizar.
  // GROUP BY materializa la derivada y permite consultar la misma tabla en MySQL.
  const [result] = await pool.query(`UPDATE documentos_empleado de
    INNER JOIN (
      SELECT empleado_id, tipo_documento_id, MAX(id) AS ultimo_id
      FROM documentos_empleado GROUP BY empleado_id, tipo_documento_id
    ) ultima ON ultima.ultimo_id = de.id
    SET de.estado = ?, de.observacion = ?, de.revisado_por = ?, de.fecha_revision = CURRENT_TIMESTAMP
    WHERE de.id = ?`,
    [body.estado, observacion || null, reviewerId, documentoId]);
  if (!result.affectedRows) {
    const [existentes] = await pool.query('SELECT id FROM documentos_empleado WHERE id = ? LIMIT 1', [documentoId]);
    if (!existentes.length) throw errorSolicitud('El documento solicitado no existe.', 404);
    throw errorSolicitud('Se cargó una versión más reciente. Actualice el panel y revise el nuevo archivo.', 409);
  }
  return { mensaje: body.estado === 'validado' ? 'Documento validado.' : 'Documento observado. Se guardó el motivo de corrección.' };
}

module.exports = { catalogos, listar, subir, obtenerPorId, revisar, construirFiltros, idPositivo };
