const pool = require('../config/database');

const ESTADOS = new Set(['borrador', 'programada', 'en_curso', 'finalizada', 'cancelada']);
const MODALIDADES = new Set(['presencial', 'virtual', 'hibrida']);
const ESTADOS_PARTICIPANTE = new Set(['inscrito', 'en_curso', 'aprobado', 'desaprobado', 'no_asistio', 'cancelado']);

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

function hora(value, nombre) {
  if (value === null || value === undefined || value === '') return null;
  const limpio = String(value).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(limpio)) throw errorHttp(400, `${nombre} no es válida.`);
  return limpio.length === 5 ? `${limpio}:00` : limpio;
}

function decimal(value, nombre, { min = 0, max = Number.MAX_SAFE_INTEGER, requerido = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (requerido) throw errorHttp(400, `${nombre} es obligatorio.`);
    return null;
  }
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < min || numero > max) throw errorHttp(400, `${nombre} no es válido.`);
  return numero;
}

function booleano(value, defecto = false) {
  if (value === undefined || value === null || value === '') return defecto;
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
  if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  throw errorHttp(400, 'El valor obligatorio debe ser verdadero o falso.');
}

function normalizarPayload(body, base = {}) {
  const tiene = campo => Object.prototype.hasOwnProperty.call(body, campo);
  const data = {
    titulo: tiene('titulo') ? texto(body.titulo, 'El título', { requerido: true, max: 160 }) : base.titulo,
    categoria: tiene('categoria') ? texto(body.categoria, 'La categoría', { max: 100 }) : base.categoria,
    descripcion: tiene('descripcion') ? texto(body.descripcion, 'La descripción', { max: 5000 }) : base.descripcion,
    modalidad: tiene('modalidad') ? texto(body.modalidad, 'La modalidad', { requerido: true, max: 20 }) : (base.modalidad || 'presencial'),
    proveedor: tiene('proveedor') ? texto(body.proveedor, 'El proveedor', { max: 150 }) : base.proveedor,
    empresa_id: tiene('empresa_id') && body.empresa_id !== null && body.empresa_id !== ''
      ? enteroPositivo(body.empresa_id, 'La empresa')
      : (tiene('empresa_id') ? null : base.empresa_id),
    fecha_inicio: tiene('fecha_inicio') ? fecha(body.fecha_inicio, 'La fecha de inicio', true) : base.fecha_inicio,
    fecha_fin: tiene('fecha_fin') ? fecha(body.fecha_fin, 'La fecha de fin', true) : base.fecha_fin,
    hora_inicio: tiene('hora_inicio') ? hora(body.hora_inicio, 'La hora de inicio') : base.hora_inicio,
    hora_fin: tiene('hora_fin') ? hora(body.hora_fin, 'La hora de fin') : base.hora_fin,
    horas: tiene('horas') ? decimal(body.horas, 'Las horas', { min: 0.25, max: 10000, requerido: true }) : base.horas,
    lugar: tiene('lugar') ? texto(body.lugar, 'El lugar', { max: 255 }) : base.lugar,
    enlace: tiene('enlace') ? texto(body.enlace, 'El enlace', { max: 1000 }) : base.enlace,
    cupo: tiene('cupo') && body.cupo !== null && body.cupo !== '' ? enteroPositivo(body.cupo, 'El cupo') : (tiene('cupo') ? null : base.cupo),
    obligatorio: tiene('obligatorio') ? booleano(body.obligatorio) : Boolean(base.obligatorio),
    estado: tiene('estado') ? texto(body.estado, 'El estado', { requerido: true, max: 20 }) : (base.estado || 'borrador')
  };
  if (!data.titulo) throw errorHttp(400, 'El título es obligatorio.');
  if (!data.fecha_inicio || !data.fecha_fin) throw errorHttp(400, 'Las fechas de inicio y fin son obligatorias.');
  if (data.fecha_fin < data.fecha_inicio) throw errorHttp(400, 'La fecha de fin no puede ser anterior a la fecha de inicio.');
  data.modalidad = String(data.modalidad).toLowerCase();
  if (!MODALIDADES.has(data.modalidad)) throw errorHttp(400, 'Modalidad no permitida. Use presencial, virtual o hibrida.');
  data.estado = String(data.estado).toLowerCase();
  if (!ESTADOS.has(data.estado)) throw errorHttp(400, 'Estado de capacitación no permitido.');
  if (data.hora_inicio && data.hora_fin && data.fecha_inicio === data.fecha_fin && data.hora_fin <= data.hora_inicio) {
    throw errorHttp(400, 'La hora de fin debe ser posterior a la hora de inicio.');
  }
  return data;
}

async function catalogos() {
  const [empleados, empresas] = await Promise.all([
    pool.query(`
      SELECT e.id, e.numero_documento, CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
             e.empresa_id, emp.razon_social AS empresa, ar.nombre AS area, c.nombre AS cargo
      FROM empleados e
      INNER JOIN empresas emp ON emp.id = e.empresa_id
      INNER JOIN areas ar ON ar.id = e.area_id
      INNER JOIN cargos c ON c.id = e.cargo_id
      WHERE e.estado = 'activo'
      ORDER BY e.apellidos, e.nombres
    `).then(([rows]) => rows),
    pool.query(`SELECT id, razon_social FROM empresas WHERE estado = 'activo' ORDER BY razon_social`).then(([rows]) => rows)
  ]);
  return {
    empleados,
    empresas,
    modalidades: [...MODALIDADES],
    estados: [...ESTADOS],
    estados_participante: [...ESTADOS_PARTICIPANTE]
  };
}

async function listar(filtros = {}) {
  const where = ['1 = 1'];
  const params = [];
  if (filtros.empresa_id) {
    where.push('cap.empresa_id = ?');
    params.push(enteroPositivo(filtros.empresa_id, 'La empresa'));
  }
  if (filtros.estado) {
    const estado = String(filtros.estado).toLowerCase();
    if (!ESTADOS.has(estado)) throw errorHttp(400, 'Filtro de estado no permitido.');
    where.push('cap.estado = ?');
    params.push(estado);
  }
  if (filtros.modalidad) {
    const modalidad = String(filtros.modalidad).toLowerCase();
    if (!MODALIDADES.has(modalidad)) throw errorHttp(400, 'Filtro de modalidad no permitido.');
    where.push('cap.modalidad = ?');
    params.push(modalidad);
  }
  if (filtros.buscar) {
    const q = `%${String(filtros.buscar).trim().slice(0, 120)}%`;
    where.push('(cap.titulo LIKE ? OR cap.categoria LIKE ? OR cap.proveedor LIKE ?)');
    params.push(q, q, q);
  }
  if (filtros.desde) {
    where.push('cap.fecha_fin >= ?');
    params.push(fecha(filtros.desde, 'La fecha desde'));
  }
  if (filtros.hasta) {
    where.push('cap.fecha_inicio <= ?');
    params.push(fecha(filtros.hasta, 'La fecha hasta'));
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(100, Math.max(1, Number.parseInt(filtros.limite, 10) || 25));
  const offset = (pagina - 1) * limite;
  const from = `
    FROM capacitaciones cap
    LEFT JOIN empresas emp ON emp.id = cap.empresa_id
    LEFT JOIN capacitacion_participantes cp ON cp.capacitacion_id = cap.id
    WHERE ${where.join(' AND ')}
  `;

  const [rows] = await pool.query(`
    SELECT cap.id, cap.titulo, cap.categoria, cap.descripcion, cap.modalidad, cap.proveedor,
           cap.empresa_id, emp.razon_social AS empresa, cap.fecha_inicio, cap.fecha_fin,
           cap.hora_inicio, cap.hora_fin, cap.horas, cap.lugar, cap.enlace, cap.cupo,
           cap.obligatorio, cap.estado, cap.created_at, cap.updated_at,
           SUM(CASE WHEN cp.estado <> 'cancelado' THEN 1 ELSE 0 END) AS inscritos,
           SUM(CASE WHEN cp.estado = 'aprobado' THEN 1 ELSE 0 END) AS aprobados,
           SUM(CASE WHEN cp.estado = 'desaprobado' THEN 1 ELSE 0 END) AS desaprobados,
           SUM(CASE WHEN cp.estado = 'no_asistio' THEN 1 ELSE 0 END) AS no_asistieron
    ${from}
    GROUP BY cap.id
    ORDER BY cap.fecha_inicio DESC, cap.id DESC
    LIMIT ? OFFSET ?
  `, [...params, limite, offset]);

  const [[conteo]] = await pool.query(`
    SELECT COUNT(DISTINCT cap.id) AS total
    FROM capacitaciones cap
    LEFT JOIN empresas emp ON emp.id = cap.empresa_id
    WHERE ${where.join(' AND ')}
  `, params);

  return {
    data: rows.map(row => ({
      ...row,
      inscritos: Number(row.inscritos || 0), aprobados: Number(row.aprobados || 0),
      desaprobados: Number(row.desaprobados || 0), no_asistieron: Number(row.no_asistieron || 0)
    })),
    paginacion: { pagina, limite, total: Number(conteo.total), paginas: Math.max(1, Math.ceil(Number(conteo.total) / limite)) }
  };
}

async function resumen() {
  const [rows] = await pool.query(`SELECT estado, COUNT(*) AS cantidad FROM capacitaciones GROUP BY estado`);
  const [[participantes]] = await pool.query(`
    SELECT COUNT(*) AS inscritos,
           SUM(CASE WHEN estado = 'aprobado' THEN 1 ELSE 0 END) AS aprobados,
           SUM(CASE WHEN estado = 'desaprobado' THEN 1 ELSE 0 END) AS desaprobados
    FROM capacitacion_participantes
    WHERE estado <> 'cancelado'
  `);
  const data = { total: 0, borrador: 0, programada: 0, en_curso: 0, finalizada: 0, cancelada: 0 };
  for (const row of rows) {
    data[row.estado] = Number(row.cantidad);
    data.total += Number(row.cantidad);
  }
  data.participantes = {
    inscritos: Number(participantes.inscritos || 0),
    aprobados: Number(participantes.aprobados || 0),
    desaprobados: Number(participantes.desaprobados || 0)
  };
  return data;
}

async function obtenerPorId(id, connection = pool) {
  const capacitacionId = enteroPositivo(id, 'La capacitación');
  const [rows] = await connection.query(`
    SELECT cap.*, emp.razon_social AS empresa
    FROM capacitaciones cap
    LEFT JOIN empresas emp ON emp.id = cap.empresa_id
    WHERE cap.id = ? LIMIT 1
  `, [capacitacionId]);
  if (!rows.length) throw errorHttp(404, 'Capacitación no encontrada.');
  return rows[0];
}

async function detalle(id) {
  const cap = await obtenerPorId(id);
  const [participantes] = await pool.query(`
    SELECT cp.id, cp.empleado_id, CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
           e.numero_documento, emp.razon_social AS empresa, ar.nombre AS area, c.nombre AS cargo,
           cp.estado, cp.asistencia_porcentaje, cp.nota, cp.fecha_inscripcion, cp.fecha_completado,
           cp.observaciones, cp.certificado_documento_id, de.nombre_archivo AS certificado_nombre
    FROM capacitacion_participantes cp
    INNER JOIN empleados e ON e.id = cp.empleado_id
    INNER JOIN empresas emp ON emp.id = e.empresa_id
    INNER JOIN areas ar ON ar.id = e.area_id
    INNER JOIN cargos c ON c.id = e.cargo_id
    LEFT JOIN documentos_empleado de ON de.id = cp.certificado_documento_id
    WHERE cp.capacitacion_id = ?
    ORDER BY e.apellidos, e.nombres
  `, [cap.id]);
  return { ...cap, participantes };
}

async function validarEmpresa(connection, empresaId) {
  if (!empresaId) return;
  const [rows] = await connection.query(`SELECT id FROM empresas WHERE id = ? AND estado = 'activo' LIMIT 1`, [empresaId]);
  if (!rows.length) throw errorHttp(404, 'La empresa seleccionada no existe o está inactiva.');
}

async function crear(body, usuarioId) {
  const data = normalizarPayload(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await validarEmpresa(connection, data.empresa_id);
    const [result] = await connection.query(`
      INSERT INTO capacitaciones
        (titulo, categoria, descripcion, modalidad, proveedor, empresa_id, fecha_inicio, fecha_fin,
         hora_inicio, hora_fin, horas, lugar, enlace, cupo, obligatorio, estado,
         creado_por_usuario_id, actualizado_por_usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.titulo, data.categoria, data.descripcion, data.modalidad, data.proveedor, data.empresa_id,
      data.fecha_inicio, data.fecha_fin, data.hora_inicio, data.hora_fin, data.horas, data.lugar,
      data.enlace, data.cupo, data.obligatorio, data.estado, usuarioId, usuarioId
    ]);
    await connection.commit();
    return detalle(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function actualizar(id, body, usuarioId) {
  const capacitacionId = enteroPositivo(id, 'La capacitación');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const actual = await obtenerPorId(capacitacionId, connection);
    const data = normalizarPayload(body, actual);
    await validarEmpresa(connection, data.empresa_id);
    if (data.cupo) {
      const [[conteo]] = await connection.query(`
        SELECT COUNT(*) AS total FROM capacitacion_participantes
        WHERE capacitacion_id = ? AND estado <> 'cancelado'
      `, [capacitacionId]);
      if (Number(conteo.total) > data.cupo) throw errorHttp(409, 'El cupo no puede ser menor al número de participantes inscritos.');
    }
    await connection.query(`
      UPDATE capacitaciones SET
        titulo = ?, categoria = ?, descripcion = ?, modalidad = ?, proveedor = ?, empresa_id = ?,
        fecha_inicio = ?, fecha_fin = ?, hora_inicio = ?, hora_fin = ?, horas = ?, lugar = ?, enlace = ?,
        cupo = ?, obligatorio = ?, estado = ?, actualizado_por_usuario_id = ?
      WHERE id = ?
    `, [
      data.titulo, data.categoria, data.descripcion, data.modalidad, data.proveedor, data.empresa_id,
      data.fecha_inicio, data.fecha_fin, data.hora_inicio, data.hora_fin, data.horas, data.lugar,
      data.enlace, data.cupo, data.obligatorio, data.estado, usuarioId, capacitacionId
    ]);
    await connection.commit();
    return detalle(capacitacionId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cambiarEstado(id, estado, usuarioId) {
  const actual = await obtenerPorId(id);
  const nuevo = String(estado || '').toLowerCase();
  if (!ESTADOS.has(nuevo)) throw errorHttp(400, 'Estado de capacitación no permitido.');
  return actualizar(actual.id, { estado: nuevo }, usuarioId);
}

async function agregarParticipantes(id, body) {
  const capacitacionId = enteroPositivo(id, 'La capacitación');
  let ids = [];
  if (Array.isArray(body?.empleado_ids)) ids = body.empleado_ids;
  else if (body?.empleado_id !== undefined) ids = [body.empleado_id];
  ids = [...new Set(ids.map(value => enteroPositivo(value, 'El colaborador')))];
  if (!ids.length) throw errorHttp(400, 'Seleccione al menos un colaborador.');
  if (ids.length > 200) throw errorHttp(400, 'No puede registrar más de 200 participantes a la vez.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [capRows] = await connection.query('SELECT * FROM capacitaciones WHERE id = ? FOR UPDATE', [capacitacionId]);
    if (!capRows.length) throw errorHttp(404, 'Capacitación no encontrada.');
    const cap = capRows[0];
    if (['finalizada', 'cancelada'].includes(cap.estado)) throw errorHttp(409, 'No se pueden agregar participantes a una capacitación finalizada o cancelada.');

    const [empleados] = await connection.query(`
      SELECT id, empresa_id, estado FROM empleados WHERE id IN (?)
    `, [ids]);
    const encontrados = new Set(empleados.map(e => Number(e.id)));
    const faltantes = ids.filter(x => !encontrados.has(x));
    if (faltantes.length) throw errorHttp(404, `No se encontraron colaboradores: ${faltantes.join(', ')}.`);
    if (empleados.some(e => e.estado !== 'activo')) throw errorHttp(409, 'Todos los participantes deben estar activos.');
    if (cap.empresa_id && empleados.some(e => Number(e.empresa_id) !== Number(cap.empresa_id))) {
      throw errorHttp(409, 'La capacitación pertenece a una empresa específica y uno o más colaboradores son de otra empresa.');
    }

    const [existentes] = await connection.query(`
      SELECT empleado_id, estado FROM capacitacion_participantes
      WHERE capacitacion_id = ? AND empleado_id IN (?)
    `, [capacitacionId, ids]);
    const activos = new Set(existentes.filter(e => e.estado !== 'cancelado').map(e => Number(e.empleado_id)));
    const cancelados = new Set(existentes.filter(e => e.estado === 'cancelado').map(e => Number(e.empleado_id)));
    const nuevos = ids.filter(x => !activos.has(x));

    const [[conteo]] = await connection.query(`
      SELECT COUNT(*) AS total FROM capacitacion_participantes
      WHERE capacitacion_id = ? AND estado <> 'cancelado'
    `, [capacitacionId]);
    if (cap.cupo && Number(conteo.total) + nuevos.length > Number(cap.cupo)) {
      throw errorHttp(409, `El cupo máximo es ${cap.cupo}. Quedan ${Math.max(0, Number(cap.cupo) - Number(conteo.total))} vacantes.`);
    }

    for (const empleadoId of nuevos) {
      if (cancelados.has(empleadoId)) {
        await connection.query(`
          UPDATE capacitacion_participantes SET estado = 'inscrito', fecha_inscripcion = CURRENT_TIMESTAMP,
                 fecha_completado = NULL, asistencia_porcentaje = NULL, nota = NULL, observaciones = NULL
          WHERE capacitacion_id = ? AND empleado_id = ?
        `, [capacitacionId, empleadoId]);
      } else {
        await connection.query(`
          INSERT INTO capacitacion_participantes (capacitacion_id, empleado_id, estado)
          VALUES (?, ?, 'inscrito')
        `, [capacitacionId, empleadoId]);
      }
    }
    await connection.commit();
    return { agregados: nuevos.length, omitidos: ids.length - nuevos.length, participantes: (await detalle(capacitacionId)).participantes };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function actualizarParticipante(capacitacionIdRaw, empleadoIdRaw, body) {
  const capacitacionId = enteroPositivo(capacitacionIdRaw, 'La capacitación');
  const empleadoId = enteroPositivo(empleadoIdRaw, 'El colaborador');
  const [rows] = await pool.query(`
    SELECT * FROM capacitacion_participantes WHERE capacitacion_id = ? AND empleado_id = ? LIMIT 1
  `, [capacitacionId, empleadoId]);
  if (!rows.length) throw errorHttp(404, 'El colaborador no está registrado en esta capacitación.');
  const actual = rows[0];

  const estado = Object.prototype.hasOwnProperty.call(body, 'estado') ? String(body.estado || '').toLowerCase() : actual.estado;
  if (!ESTADOS_PARTICIPANTE.has(estado)) throw errorHttp(400, 'Estado del participante no permitido.');
  const asistencia = Object.prototype.hasOwnProperty.call(body, 'asistencia_porcentaje')
    ? decimal(body.asistencia_porcentaje, 'El porcentaje de asistencia', { min: 0, max: 100 })
    : actual.asistencia_porcentaje;
  const nota = Object.prototype.hasOwnProperty.call(body, 'nota')
    ? decimal(body.nota, 'La nota', { min: 0, max: 100 })
    : actual.nota;
  const observaciones = Object.prototype.hasOwnProperty.call(body, 'observaciones')
    ? texto(body.observaciones, 'Las observaciones', { max: 4000 })
    : actual.observaciones;
  const certificado = Object.prototype.hasOwnProperty.call(body, 'certificado_documento_id')
    ? (body.certificado_documento_id === null || body.certificado_documento_id === '' ? null : enteroPositivo(body.certificado_documento_id, 'El certificado'))
    : actual.certificado_documento_id;

  if (certificado) {
    const [docs] = await pool.query('SELECT id FROM documentos_empleado WHERE id = ? AND empleado_id = ? LIMIT 1', [certificado, empleadoId]);
    if (!docs.length) throw errorHttp(409, 'El certificado seleccionado no pertenece al colaborador.');
  }

  const completado = ['aprobado', 'desaprobado', 'no_asistio'].includes(estado);
  await pool.query(`
    UPDATE capacitacion_participantes
    SET estado = ?, asistencia_porcentaje = ?, nota = ?, observaciones = ?, certificado_documento_id = ?,
        fecha_completado = ${completado ? 'COALESCE(fecha_completado, CURRENT_TIMESTAMP)' : 'NULL'}
    WHERE capacitacion_id = ? AND empleado_id = ?
  `, [estado, asistencia, nota, observaciones, certificado, capacitacionId, empleadoId]);
  return (await detalle(capacitacionId)).participantes.find(p => Number(p.empleado_id) === empleadoId);
}

async function retirarParticipante(capacitacionId, empleadoId) {
  const capId = enteroPositivo(capacitacionId, 'La capacitación');
  const empId = enteroPositivo(empleadoId, 'El colaborador');
  const [result] = await pool.query(`
    UPDATE capacitacion_participantes
    SET estado = 'cancelado', fecha_completado = NULL
    WHERE capacitacion_id = ? AND empleado_id = ?
  `, [capId, empId]);
  if (!result.affectedRows) throw errorHttp(404, 'El participante no está registrado en esta capacitación.');
  return { retirado: true, capacitacion_id: capId, empleado_id: empId };
}

async function historialEmpleado(empleadoIdRaw) {
  const empleadoId = enteroPositivo(empleadoIdRaw, 'El colaborador');
  const [empleados] = await pool.query(`
    SELECT id, CONCAT(nombres, ' ', apellidos) AS colaborador, numero_documento
    FROM empleados WHERE id = ? LIMIT 1
  `, [empleadoId]);
  if (!empleados.length) throw errorHttp(404, 'Colaborador no encontrado.');
  const [rows] = await pool.query(`
    SELECT cap.id AS capacitacion_id, cap.titulo, cap.categoria, cap.modalidad, cap.fecha_inicio, cap.fecha_fin,
           cap.horas, cap.estado AS estado_capacitacion, cp.estado, cp.asistencia_porcentaje, cp.nota,
           cp.fecha_completado, cp.observaciones, cp.certificado_documento_id
    FROM capacitacion_participantes cp
    INNER JOIN capacitaciones cap ON cap.id = cp.capacitacion_id
    WHERE cp.empleado_id = ? AND cp.estado <> 'cancelado'
    ORDER BY cap.fecha_inicio DESC, cap.id DESC
  `, [empleadoId]);
  return { empleado: empleados[0], capacitaciones: rows };
}

async function eliminar(id) {
  const cap = await obtenerPorId(id);
  if (!['borrador', 'cancelada'].includes(cap.estado)) {
    throw errorHttp(409, 'Sólo se puede eliminar una capacitación en borrador o cancelada.');
  }
  const [[conteo]] = await pool.query(`
    SELECT COUNT(*) AS total FROM capacitacion_participantes
    WHERE capacitacion_id = ? AND estado <> 'cancelado'
  `, [cap.id]);
  if (Number(conteo.total) > 0) throw errorHttp(409, 'No se puede eliminar porque tiene participantes activos.');
  const [result] = await pool.query('DELETE FROM capacitaciones WHERE id = ?', [cap.id]);
  return { eliminado: result.affectedRows === 1, id: cap.id };
}

module.exports = {
  catalogos,
  listar,
  resumen,
  detalle,
  crear,
  actualizar,
  cambiarEstado,
  agregarParticipantes,
  actualizarParticipante,
  retirarParticipante,
  historialEmpleado,
  eliminar,
  _internals: { normalizarPayload }
};
