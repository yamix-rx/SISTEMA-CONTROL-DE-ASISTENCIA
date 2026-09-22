const pool = require('../config/database');

const ESTADOS = new Set(['borrador', 'vigente', 'finalizado', 'cancelado']);
const ESTADOS_FILTRO = new Set([...ESTADOS, 'por_vencer', 'vencido']);
const TIPOS_CONTRATO = [
  'Indeterminado',
  'Plazo fijo',
  'Prácticas preprofesionales',
  'Prácticas profesionales',
  'Convenio de prácticas',
  'Locación de servicios',
  'Adenda'
];

const ESTADO_VIGENCIA_SQL = `
  CASE
    WHEN c.estado = 'borrador' THEN 'borrador'
    WHEN c.estado = 'cancelado' THEN 'cancelado'
    WHEN c.estado = 'finalizado' THEN 'finalizado'
    WHEN c.fecha_fin IS NOT NULL AND c.fecha_fin < CURDATE() THEN 'vencido'
    WHEN c.fecha_fin IS NOT NULL AND c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'por_vencer'
    ELSE 'vigente'
  END
`;

function errorHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function enteroPositivo(value, nombre) {
  const numero = Number(value);
  if (!Number.isInteger(numero) || numero <= 0) throw errorHttp(400, `${nombre} no es válido.`);
  return numero;
}

function texto(value, nombre, { requerido = false, max = 255 } = {}) {
  if (value === null || value === undefined) {
    if (requerido) throw errorHttp(400, `${nombre} es obligatorio.`);
    return null;
  }
  const limpio = String(value).trim();
  if (!limpio) {
    if (requerido) throw errorHttp(400, `${nombre} es obligatorio.`);
    return null;
  }
  if (limpio.length > max) throw errorHttp(400, `${nombre} supera ${max} caracteres.`);
  return limpio;
}

function fecha(value, nombre, requerido = false) {
  if (value === null || value === undefined || value === '') {
    if (requerido) throw errorHttp(400, `${nombre} es obligatoria.`);
    return null;
  }
  const limpio = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio) || Number.isNaN(Date.parse(`${limpio}T00:00:00Z`))) {
    throw errorHttp(400, `${nombre} debe tener formato YYYY-MM-DD.`);
  }
  return limpio;
}

function decimal(value, nombre, { min = 0, max = Number.MAX_SAFE_INTEGER, requerido = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (requerido) throw errorHttp(400, `${nombre} es obligatorio.`);
    return null;
  }
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < min || numero > max) {
    throw errorHttp(400, `${nombre} no es válido.`);
  }
  return numero;
}

function normalizarPayload(body, base = {}) {
  const tiene = campo => Object.prototype.hasOwnProperty.call(body, campo);
  const data = {
    empleado_id: tiene('empleado_id') ? enteroPositivo(body.empleado_id, 'El colaborador') : base.empleado_id,
    codigo: tiene('codigo') ? texto(body.codigo, 'El código', { max: 40 }) : base.codigo,
    tipo_contrato: tiene('tipo_contrato') ? texto(body.tipo_contrato, 'El tipo de contrato', { requerido: true, max: 80 }) : base.tipo_contrato,
    modalidad: tiene('modalidad') ? texto(body.modalidad, 'La modalidad', { max: 80 }) : base.modalidad,
    fecha_inicio: tiene('fecha_inicio') ? fecha(body.fecha_inicio, 'La fecha de inicio', true) : base.fecha_inicio,
    fecha_fin: tiene('fecha_fin') ? fecha(body.fecha_fin, 'La fecha de fin') : base.fecha_fin,
    remuneracion: tiene('remuneracion') ? decimal(body.remuneracion, 'La remuneración', { min: 0, max: 99999999.99 }) : base.remuneracion,
    moneda: tiene('moneda') ? texto(body.moneda, 'La moneda', { max: 3 }) : (base.moneda || 'PEN'),
    horas_semanales: tiene('horas_semanales') ? decimal(body.horas_semanales, 'Las horas semanales', { min: 0.01, max: 168 }) : base.horas_semanales,
    estado: tiene('estado') ? texto(body.estado, 'El estado', { requerido: true, max: 20 }) : (base.estado || 'borrador'),
    observaciones: tiene('observaciones') ? texto(body.observaciones, 'Las observaciones', { max: 4000 }) : base.observaciones,
    documento_empleado_id: tiene('documento_empleado_id') && body.documento_empleado_id !== null && body.documento_empleado_id !== ''
      ? enteroPositivo(body.documento_empleado_id, 'El documento asociado')
      : (tiene('documento_empleado_id') ? null : base.documento_empleado_id)
  };

  if (!data.empleado_id) throw errorHttp(400, 'El colaborador es obligatorio.');
  if (!data.tipo_contrato) throw errorHttp(400, 'El tipo de contrato es obligatorio.');
  // Los registros históricos pueden conservar su tipo anterior; los nuevos tipos deben pertenecer al catálogo.
  if (!TIPOS_CONTRATO.includes(data.tipo_contrato) && data.tipo_contrato !== base.tipo_contrato) {
    throw errorHttp(400, 'Tipo de contrato no permitido.');
  }
  if (!data.fecha_inicio) throw errorHttp(400, 'La fecha de inicio es obligatoria.');
  if (data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
    throw errorHttp(400, 'La fecha de fin no puede ser anterior a la fecha de inicio.');
  }
  data.moneda = String(data.moneda || 'PEN').toUpperCase();
  if (!/^[A-Z]{3}$/.test(data.moneda)) throw errorHttp(400, 'La moneda debe tener un código de 3 letras, por ejemplo PEN.');
  data.estado = String(data.estado).toLowerCase();
  if (!ESTADOS.has(data.estado)) throw errorHttp(400, 'Estado de contrato no permitido.');
  return data;
}

async function empleadoExiste(connection, empleadoId) {
  const [rows] = await connection.query('SELECT id, estado FROM empleados WHERE id = ? LIMIT 1', [empleadoId]);
  if (!rows.length) throw errorHttp(404, 'El colaborador no existe.');
  return rows[0];
}

async function validarDocumento(connection, documentoId, empleadoId) {
  if (!documentoId) return;
  const [rows] = await connection.query(
    'SELECT id FROM documentos_empleado WHERE id = ? AND empleado_id = ? LIMIT 1',
    [documentoId, empleadoId]
  );
  if (!rows.length) throw errorHttp(409, 'El documento asociado no pertenece al colaborador seleccionado.');
}

async function validarSolapamiento(connection, data, excluirId = null) {
  if (data.estado !== 'vigente') return;
  const params = [data.empleado_id, data.fecha_fin, data.fecha_inicio];
  let excluir = '';
  if (excluirId) {
    excluir = ' AND id <> ?';
    params.push(excluirId);
  }
  const [rows] = await connection.query(`
    SELECT id, codigo, fecha_inicio, fecha_fin
    FROM contratos
    WHERE empleado_id = ?
      AND estado = 'vigente'
      AND fecha_inicio <= COALESCE(?, '9999-12-31')
      AND (fecha_fin IS NULL OR fecha_fin >= ?)
      ${excluir}
    LIMIT 1
  `, params);
  if (rows.length) {
    throw errorHttp(409, `El colaborador ya tiene un contrato vigente que se cruza con estas fechas (${rows[0].codigo || `#${rows[0].id}`}).`);
  }
}

async function catalogos() {
  const [empleados, empresas] = await Promise.all([
    pool.query(`
      SELECT e.id, e.numero_documento, CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
             e.tipo_vinculo, e.empresa_id, emp.razon_social AS empresa, c.nombre AS cargo
      FROM empleados e
      INNER JOIN empresas emp ON emp.id = e.empresa_id
      INNER JOIN cargos c ON c.id = e.cargo_id
      WHERE e.estado = 'activo'
      ORDER BY e.apellidos, e.nombres
    `).then(([rows]) => rows),
    pool.query(`SELECT id, razon_social FROM empresas WHERE estado = 'activo' ORDER BY razon_social`).then(([rows]) => rows)
  ]);
  return {
    empleados,
    empresas,
    tipos_contrato: TIPOS_CONTRATO,
    estados: ['borrador', 'vigente', 'por_vencer', 'vencido', 'finalizado', 'cancelado']
  };
}

async function listar(filtros = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (filtros.empresa_id) {
    where.push('e.empresa_id = ?');
    params.push(enteroPositivo(filtros.empresa_id, 'La empresa'));
  }
  if (filtros.empleado_id) {
    where.push('c.empleado_id = ?');
    params.push(enteroPositivo(filtros.empleado_id, 'El colaborador'));
  }
  if (filtros.tipo_contrato) {
    const tipo = texto(filtros.tipo_contrato, 'El tipo de contrato', { max: 80 });
    if (!TIPOS_CONTRATO.includes(tipo)) throw errorHttp(400, 'Filtro de tipo de contrato no permitido.');
    where.push('c.tipo_contrato = ?');
    params.push(tipo);
  }
  if (filtros.buscar) {
    const q = `%${String(filtros.buscar).trim().slice(0, 100)}%`;
    where.push(`(c.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ? OR e.numero_documento LIKE ? OR c.tipo_contrato LIKE ?)`);
    params.push(q, q, q, q, q);
  }
  if (filtros.estado) {
    const estado = String(filtros.estado).toLowerCase();
    if (!ESTADOS_FILTRO.has(estado)) throw errorHttp(400, 'Filtro de estado no permitido.');
    where.push(`(${ESTADO_VIGENCIA_SQL}) = ?`);
    params.push(estado);
  }
  if (filtros.vence_en_dias !== undefined && filtros.vence_en_dias !== '') {
    const dias = Number(filtros.vence_en_dias);
    if (!Number.isInteger(dias) || dias < 0 || dias > 3650) throw errorHttp(400, 'vence_en_dias no es válido.');
    where.push(`c.estado = 'vigente' AND c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)`);
    params.push(dias);
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(100, Math.max(1, Number.parseInt(filtros.limite, 10) || 25));
  const offset = (pagina - 1) * limite;

  const baseFrom = `
    FROM contratos c
    INNER JOIN empleados e ON e.id = c.empleado_id
    INNER JOIN empresas emp ON emp.id = e.empresa_id
    INNER JOIN areas ar ON ar.id = e.area_id
    INNER JOIN cargos ca ON ca.id = e.cargo_id
    LEFT JOIN documentos_empleado de ON de.id = c.documento_empleado_id
    WHERE ${where.join(' AND ')}
  `;

  const [rows] = await pool.query(`
    SELECT c.id, c.codigo, c.empleado_id,
           CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
           e.numero_documento, e.tipo_vinculo, emp.razon_social AS empresa,
           ar.nombre AS area, ca.nombre AS cargo,
           c.tipo_contrato, c.modalidad, c.fecha_inicio, c.fecha_fin,
           c.remuneracion, c.moneda, c.horas_semanales, c.estado,
           ${ESTADO_VIGENCIA_SQL} AS estado_vigencia,
           c.observaciones, c.documento_empleado_id, de.nombre_archivo AS documento_nombre,
           c.created_at, c.updated_at
    ${baseFrom}
    ORDER BY c.fecha_inicio DESC, c.id DESC
    LIMIT ? OFFSET ?
  `, [...params, limite, offset]);

  const [[conteo]] = await pool.query(`SELECT COUNT(*) AS total ${baseFrom}`, params);
  return {
    data: rows,
    paginacion: { pagina, limite, total: Number(conteo.total), paginas: Math.max(1, Math.ceil(Number(conteo.total) / limite)) }
  };
}

async function resumen() {
  const [rows] = await pool.query(`
    SELECT estado_vigencia, COUNT(*) AS cantidad
    FROM (
      SELECT ${ESTADO_VIGENCIA_SQL} AS estado_vigencia
      FROM contratos c
    ) x
    GROUP BY estado_vigencia
  `);
  const data = { total: 0, borrador: 0, vigente: 0, por_vencer: 0, vencido: 0, finalizado: 0, cancelado: 0 };
  for (const row of rows) {
    data[row.estado_vigencia] = Number(row.cantidad);
    data.total += Number(row.cantidad);
  }
  return data;
}

async function obtenerPorId(id, connection = pool) {
  const contratoId = enteroPositivo(id, 'El contrato');
  const [rows] = await connection.query(`
    SELECT c.*, ${ESTADO_VIGENCIA_SQL} AS estado_vigencia,
           CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
           e.numero_documento, e.tipo_vinculo, e.empresa_id,
           emp.razon_social AS empresa, ar.nombre AS area, ca.nombre AS cargo,
           de.nombre_archivo AS documento_nombre
    FROM contratos c
    INNER JOIN empleados e ON e.id = c.empleado_id
    INNER JOIN empresas emp ON emp.id = e.empresa_id
    INNER JOIN areas ar ON ar.id = e.area_id
    INNER JOIN cargos ca ON ca.id = e.cargo_id
    LEFT JOIN documentos_empleado de ON de.id = c.documento_empleado_id
    WHERE c.id = ? LIMIT 1
  `, [contratoId]);
  if (!rows.length) throw errorHttp(404, 'Contrato no encontrado.');
  return rows[0];
}

async function crear(body, usuarioId) {
  const data = normalizarPayload(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await empleadoExiste(connection, data.empleado_id);
    await validarDocumento(connection, data.documento_empleado_id, data.empleado_id);
    await validarSolapamiento(connection, data);
    const [result] = await connection.query(`
      INSERT INTO contratos
        (empleado_id, codigo, tipo_contrato, modalidad, fecha_inicio, fecha_fin, remuneracion, moneda,
         horas_semanales, estado, observaciones, documento_empleado_id, creado_por_usuario_id, actualizado_por_usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.empleado_id, data.codigo, data.tipo_contrato, data.modalidad, data.fecha_inicio, data.fecha_fin,
      data.remuneracion, data.moneda, data.horas_semanales, data.estado, data.observaciones,
      data.documento_empleado_id, usuarioId, usuarioId
    ]);
    const codigo = data.codigo || `CTR-${data.fecha_inicio.slice(0, 4)}-${String(result.insertId).padStart(5, '0')}`;
    if (!data.codigo) await connection.query('UPDATE contratos SET codigo = ? WHERE id = ?', [codigo, result.insertId]);
    await connection.commit();
    return obtenerPorId(result.insertId);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw errorHttp(409, 'Ya existe un contrato con ese código.');
    throw error;
  } finally {
    connection.release();
  }
}

async function actualizar(id, body, usuarioId) {
  const contratoId = enteroPositivo(id, 'El contrato');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const actual = await obtenerPorId(contratoId, connection);
    const data = normalizarPayload(body, actual);
    await empleadoExiste(connection, data.empleado_id);
    await validarDocumento(connection, data.documento_empleado_id, data.empleado_id);
    await validarSolapamiento(connection, data, contratoId);
    await connection.query(`
      UPDATE contratos SET
        empleado_id = ?, codigo = ?, tipo_contrato = ?, modalidad = ?, fecha_inicio = ?, fecha_fin = ?,
        remuneracion = ?, moneda = ?, horas_semanales = ?, estado = ?, observaciones = ?,
        documento_empleado_id = ?, actualizado_por_usuario_id = ?
      WHERE id = ?
    `, [
      data.empleado_id, data.codigo, data.tipo_contrato, data.modalidad, data.fecha_inicio, data.fecha_fin,
      data.remuneracion, data.moneda, data.horas_semanales, data.estado, data.observaciones,
      data.documento_empleado_id, usuarioId, contratoId
    ]);
    await connection.commit();
    return obtenerPorId(contratoId);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw errorHttp(409, 'Ya existe un contrato con ese código.');
    throw error;
  } finally {
    connection.release();
  }
}

async function cambiarEstado(id, estado, usuarioId) {
  const contrato = await obtenerPorId(id);
  const nuevo = String(estado || '').toLowerCase();
  if (!ESTADOS.has(nuevo)) throw errorHttp(400, 'Estado de contrato no permitido.');
  return actualizar(contrato.id, { estado: nuevo }, usuarioId);
}

async function eliminar(id) {
  const contrato = await obtenerPorId(id);
  if (contrato.estado === 'vigente') {
    throw errorHttp(409, 'Un contrato vigente no puede eliminarse. Finalícelo o cancélelo para conservar el historial.');
  }
  const [result] = await pool.query('DELETE FROM contratos WHERE id = ?', [contrato.id]);
  return { eliminado: result.affectedRows === 1, id: contrato.id };
}

module.exports = {
  catalogos,
  listar,
  resumen,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  _internals: { normalizarPayload, ESTADO_VIGENCIA_SQL }
};
