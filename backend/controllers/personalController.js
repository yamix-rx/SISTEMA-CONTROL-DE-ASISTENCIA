const pool = require('../config/database');

// 1. Listar colaboradores para el buscador o selector
exports.listarColaboradores = async (req, res) => {
  const { empresa_id, area_id, cargo_id, estado, buscar, tipo_vinculo } = req.query;

  try {
    let query = `
      SELECT 
        e.id,
        e.empresa_id, e.area_id, e.cargo_id, e.puesto,
        DATE_FORMAT(pd.fecha_vencimiento_convenio, '%Y-%m-%d') AS fecha_vencimiento_convenio,
        CONCAT(e.nombres, ' ', e.apellidos) AS colaborador,
        e.numero_documento,
        e.tipo_vinculo,
        emp.razon_social AS empresa,
        ar.nombre AS area,
        c.nombre AS cargo,
        e.estado
      FROM empleados e
      INNER JOIN empresas emp ON e.empresa_id = emp.id
      INNER JOIN areas ar ON e.area_id = ar.id
      INNER JOIN cargos c ON e.cargo_id = c.id
      LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id
      WHERE 1 = 1
    `;
    const params = [];

    if (empresa_id) {
      query += ` AND e.empresa_id = ?`;
      params.push(empresa_id);
    }
    for (const [campo, valor] of [['area_id', area_id], ['cargo_id', cargo_id], ['estado', estado]]) {
      if (valor && !(campo === 'estado' && valor === 'todos')) { query += ` AND e.${campo} = ?`; params.push(valor); }
    }
    if (tipo_vinculo) {
      const vinculo = String(tipo_vinculo).trim().toLowerCase();
      if (vinculo === 'practicante') query += ` AND LOWER(e.tipo_vinculo) LIKE 'practicante%'`;
      else if (VINCULOS_VALIDOS.has(vinculo)) { query += ` AND LOWER(e.tipo_vinculo) = ?`; params.push(vinculo); }
      else return res.status(400).json({ ok: false, mensaje: 'Tipo de vínculo no válido.' });
    }
    if (buscar) {
      query += ` AND (CONCAT(e.nombres, ' ', e.apellidos) LIKE ? OR e.numero_documento LIKE ? OR emp.razon_social LIKE ? OR ar.nombre LIKE ? OR c.nombre LIKE ? OR e.puesto LIKE ?)`;
      params.push(...Array(6).fill(`%${buscar}%`));
    }

    query += ` ORDER BY e.apellidos ASC`;

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar colaboradores:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar colaboradores.' });
  }
};

// 2. Obtener el expediente del colaborador desde el servicio compartido.
exports.obtenerCatalogos = async (req, res) => {
  try {
    const [[empresas], [areas], [cargos]] = await Promise.all([
      pool.query(`SELECT id, razon_social, estado FROM empresas ORDER BY razon_social`),
      pool.query(`SELECT id, nombre, empresa_id FROM areas ORDER BY nombre`),
      pool.query(`SELECT id, nombre, area_id FROM cargos ORDER BY nombre`)
    ]);
    return res.status(200).json({ ok: true, data: { empresas, areas, cargos } });
  } catch (error) {
    console.error('Error al obtener catálogos de personal:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar catálogos.' });
  }
};

exports.obtenerFichaColaborador = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ ok: false, mensaje: 'Colaborador no válido.' });
    const { obtenerFicha, obtenerHistorial } = require('../services/fichaService');
    const ficha = await obtenerFicha(id);
    if (!ficha) {
      return res.status(404).json({ ok: false, mensaje: 'Colaborador no encontrado.' });
    }
    return res.status(200).json({ ok: true, data: { ...ficha, ...await obtenerHistorial(id, req.query) } });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ ok: false, mensaje: error.message });
    console.error('Error al obtener ficha de colaborador:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar ficha individual.' });
  }
};

exports.actualizarObservaciones = async (req, res) => {
  const id = Number(req.params.id);
  const valor = req.body?.observaciones_rrhh;
  if (!Number.isSafeInteger(id) || id <= 0 || typeof valor !== 'string' || valor.length > 10000) {
    return res.status(400).json({ ok: false, mensaje: 'Las observaciones deben tener hasta 10000 caracteres.' });
  }
  try {
    const [rows] = await pool.query('SELECT id FROM empleados WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Colaborador no encontrado.' });
    await pool.query('UPDATE empleados SET observaciones_rrhh = ? WHERE id = ?', [valor.trim() || null, id]);
    return res.json({ ok: true, mensaje: 'Observaciones guardadas.', observaciones_rrhh: valor.trim() });
  } catch (error) {
    console.error('Error al guardar observaciones:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'No se pudieron guardar las observaciones.' });
  }
};

function validarFecha(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor ? null : valor;
}

const VINCULOS_VALIDOS = new Set([
  'trabajador',
  'practicante preprofesional',
  'practicante profesional',
  'voluntario',
  'otro'
]);
const ESTADOS_VALIDOS = new Set(['activo', 'inactivo', 'finalizado', 'suspendido']);

function normalizarPuestoConvenio(body, fechaIngreso, anterior = {}) {
  const contiene = (campo) => Object.prototype.hasOwnProperty.call(body, campo) && body[campo] !== undefined;
  const rechazar = (mensaje) => { throw Object.assign(new Error(mensaje), { status: 400 }); };
  let puesto = contiene('puesto') ? body.puesto : anterior.puesto ?? null;
  if (puesto !== null && typeof puesto !== 'string') rechazar('El puesto debe ser texto de hasta 150 caracteres.');
  puesto = puesto === null ? null : puesto.trim() || null;
  if (puesto && puesto.length > 150) rechazar('El puesto debe tener hasta 150 caracteres.');
  const valorFecha = contiene('fecha_vencimiento_convenio') ? body.fecha_vencimiento_convenio : anterior.fecha_vencimiento_convenio ?? null;
  const fecha = validarFecha(valorFecha);
  if (valorFecha !== null && valorFecha !== '' && fecha === null) rechazar('La fecha de vencimiento del convenio no es válida.');
  if (fecha && fecha < fechaIngreso) rechazar('El vencimiento del convenio no puede preceder a la fecha de ingreso.');
  return { puesto, fecha_vencimiento_convenio: fecha };
}

function normalizarPayload(body) {
  return {
    tipo_documento: body.tipo_documento || 'DNI',
    numero_documento: String(body.numero_documento || '').trim(),
    nombres: String(body.nombres || '').trim(),
    apellidos: String(body.apellidos || '').trim(),
    fecha_nacimiento: validarFecha(body.fecha_nacimiento),
    telefono: body.telefono ? String(body.telefono).trim() : null,
    correo_personal: body.correo_personal ? String(body.correo_personal).trim() : null,
    direccion: body.direccion ? String(body.direccion).trim() : null,
    carrera: body.carrera ? String(body.carrera).trim() : null,
    institucion_educativa: body.institucion_educativa ? String(body.institucion_educativa).trim() : null,
    empresa_id: Number(body.empresa_id),
    area_id: Number(body.area_id),
    cargo_id: Number(body.cargo_id),
    tipo_vinculo: String(body.tipo_vinculo || 'trabajador').trim().toLowerCase(),
    estado: String(body.estado || 'activo').trim().toLowerCase(),
    fecha_ingreso: validarFecha(body.fecha_ingreso),
    fecha_finalizacion: validarFecha(body.fecha_finalizacion),
    horas_totales_asignadas: body.horas_totales_asignadas === '' || body.horas_totales_asignadas == null ? 0 : Number(body.horas_totales_asignadas),
    observaciones_rrhh: body.observaciones_rrhh ? String(body.observaciones_rrhh).trim() : null
  };
}

async function validarRelacionOrganizacional(payload) {
  const [rows] = await pool.query(`
    SELECT a.id AS area_id, a.empresa_id, c.id AS cargo_id, c.area_id AS cargo_area_id
    FROM areas a
    INNER JOIN cargos c ON c.id = ?
    WHERE a.id = ? AND a.empresa_id = ? AND c.area_id = a.id
    LIMIT 1
  `, [payload.cargo_id, payload.area_id, payload.empresa_id]);
  return rows.length > 0;
}

exports.crearColaborador = async (req, res) => {
  const p = normalizarPayload(req.body || {});
  try {
    Object.assign(p, normalizarPuestoConvenio(req.body || {}, p.fecha_ingreso));
    if (p.fecha_vencimiento_convenio && !p.tipo_vinculo.startsWith('practicante')) return res.status(400).json({ ok: false, mensaje: 'El vencimiento del convenio corresponde a un practicante.' });
    if (!p.numero_documento || !p.nombres || !p.apellidos || !p.empresa_id || !p.area_id || !p.cargo_id || !p.fecha_ingreso) {
      return res.status(400).json({ ok: false, mensaje: 'Complete DNI, nombres, apellidos, empresa, área, cargo y fecha de ingreso.' });
    }
    if (!VINCULOS_VALIDOS.has(p.tipo_vinculo)) return res.status(400).json({ ok: false, mensaje: 'Tipo de vínculo no válido.' });
    if (!ESTADOS_VALIDOS.has(p.estado)) return res.status(400).json({ ok: false, mensaje: 'Estado no válido.' });
    if (p.fecha_nacimiento === null && req.body.fecha_nacimiento) return res.status(400).json({ ok: false, mensaje: 'Fecha de nacimiento no válida.' });
    if (p.fecha_finalizacion === null && req.body.fecha_finalizacion) return res.status(400).json({ ok: false, mensaje: 'Fecha de finalización no válida.' });
    if (p.fecha_finalizacion && p.fecha_finalizacion < p.fecha_ingreso) return res.status(400).json({ ok: false, mensaje: 'La fecha de finalización no puede preceder al ingreso.' });
    if (!Number.isFinite(p.horas_totales_asignadas) || p.horas_totales_asignadas < 0) return res.status(400).json({ ok: false, mensaje: 'Las horas asignadas deben ser un número mayor o igual a 0.' });
    if (!(await validarRelacionOrganizacional(p))) return res.status(400).json({ ok: false, mensaje: 'La empresa, área y cargo seleccionados no corresponden entre sí.' });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(`
        INSERT INTO empleados
        (tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, telefono, correo_personal,
         direccion, carrera, institucion_educativa, empresa_id, area_id, cargo_id, tipo_vinculo,
         horas_totales_asignadas, horas_completadas, estado, fecha_ingreso, fecha_finalizacion, observaciones_rrhh, puesto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `, [p.tipo_documento, p.numero_documento, p.nombres, p.apellidos, p.fecha_nacimiento, p.telefono,
        p.correo_personal, p.direccion, p.carrera, p.institucion_educativa, p.empresa_id, p.area_id, p.cargo_id,
        p.tipo_vinculo, p.horas_totales_asignadas, p.estado, p.fecha_ingreso, p.fecha_finalizacion, p.observaciones_rrhh, p.puesto]);

      if (p.tipo_vinculo.startsWith('practicante')) {
        const horasMeta = p.horas_totales_asignadas > 0 ? p.horas_totales_asignadas : 320;
        await connection.query(`
          INSERT INTO practicante_detalles (empleado_id, horas_meta, estado_completado, fecha_vencimiento_convenio)
          VALUES (?, ?, FALSE, ?)
        `, [result.insertId, horasMeta, p.fecha_vencimiento_convenio]);
      }
      await connection.commit();
      res.locals = res.locals || {};
      res.locals.auditoria = { tabla: 'empleados', registroId: result.insertId, accion: 'INSERT', nuevos: { id: result.insertId, ...p } };
      return res.status(201).json({ ok: true, mensaje: 'Personal registrado correctamente.', id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, mensaje: 'El número de documento ya está registrado.' });
    if (error.status === 400) return res.status(400).json({ ok: false, mensaje: error.message });
    console.error('Error al crear colaborador:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al registrar personal.' });
  }
};

exports.actualizarColaborador = async (req, res) => {
  const p = normalizarPayload(req.body || {});
  const id = Number(req.params.id);
  try {
    normalizarPuestoConvenio(req.body || {}, p.fecha_ingreso);
    if (req.body.fecha_vencimiento_convenio && !p.tipo_vinculo.startsWith('practicante')) return res.status(400).json({ ok: false, mensaje: 'El vencimiento del convenio corresponde a un practicante.' });
    if (!Number.isSafeInteger(id) || id <= 0 || !p.numero_documento || !p.nombres || !p.apellidos || !p.empresa_id || !p.area_id || !p.cargo_id || !p.fecha_ingreso) return res.status(400).json({ ok: false, mensaje: 'Complete los campos obligatorios.' });
    if (!VINCULOS_VALIDOS.has(p.tipo_vinculo)) return res.status(400).json({ ok: false, mensaje: 'Tipo de vínculo no válido.' });
    if (!ESTADOS_VALIDOS.has(p.estado)) return res.status(400).json({ ok: false, mensaje: 'Estado no válido.' });
    if (!Number.isFinite(p.horas_totales_asignadas) || p.horas_totales_asignadas < 0) return res.status(400).json({ ok: false, mensaje: 'Las horas asignadas deben ser un número mayor o igual a 0.' });
    if ((req.body.fecha_nacimiento && !p.fecha_nacimiento) || (req.body.fecha_finalizacion && !p.fecha_finalizacion)) return res.status(400).json({ ok: false, mensaje: 'Fecha no válida.' });
    if (p.fecha_finalizacion && p.fecha_finalizacion < p.fecha_ingreso) return res.status(400).json({ ok: false, mensaje: 'La fecha de finalización no puede preceder al ingreso.' });
    if (!(await validarRelacionOrganizacional(p))) return res.status(400).json({ ok: false, mensaje: 'La empresa, área y cargo seleccionados no corresponden entre sí.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT e.*, DATE_FORMAT(pd.fecha_vencimiento_convenio, '%Y-%m-%d') AS fecha_vencimiento_convenio
        FROM empleados e LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id WHERE e.id = ? FOR UPDATE`, [id]);
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ ok: false, mensaje: 'Colaborador no encontrado.' }); }
      Object.assign(p, normalizarPuestoConvenio(req.body || {}, p.fecha_ingreso, rows[0]));
      await connection.query(
        'UPDATE empleados SET tipo_documento=?, numero_documento=?, nombres=?, apellidos=?, fecha_nacimiento=?, telefono=?, correo_personal=?, direccion=?, carrera=?, institucion_educativa=?, empresa_id=?, area_id=?, cargo_id=?, tipo_vinculo=?, horas_totales_asignadas=?, estado=?, fecha_ingreso=?, fecha_finalizacion=?, observaciones_rrhh=?, puesto=? WHERE id=?',
        [p.tipo_documento, p.numero_documento, p.nombres, p.apellidos, p.fecha_nacimiento, p.telefono, p.correo_personal, p.direccion, p.carrera, p.institucion_educativa, p.empresa_id, p.area_id, p.cargo_id, p.tipo_vinculo, p.horas_totales_asignadas, p.estado, p.fecha_ingreso, p.fecha_finalizacion, p.observaciones_rrhh, p.puesto, id]);
      if (p.tipo_vinculo.startsWith('practicante')) {
        await connection.query('INSERT INTO practicante_detalles (empleado_id, horas_meta, estado_completado, fecha_vencimiento_convenio) VALUES (?, ?, FALSE, ?) ON DUPLICATE KEY UPDATE horas_meta = VALUES(horas_meta), fecha_vencimiento_convenio = VALUES(fecha_vencimiento_convenio)',
          [id, p.horas_totales_asignadas > 0 ? p.horas_totales_asignadas : 320, p.fecha_vencimiento_convenio]);
      } else if (Object.prototype.hasOwnProperty.call(req.body, 'fecha_vencimiento_convenio')) {
        await connection.query('UPDATE practicante_detalles SET fecha_vencimiento_convenio = ? WHERE empleado_id = ?', [p.fecha_vencimiento_convenio, id]);
      }
      await connection.commit();
      res.locals = res.locals || {};
      res.locals.auditoria = { tabla: 'empleados', registroId: id, accion: 'UPDATE', anterior: rows[0], nuevos: { id, ...p } };
      return res.status(200).json({ ok: true, mensaje: 'Datos del personal actualizados correctamente.' });
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, mensaje: 'El número de documento ya está registrado.' });
    if (error.status === 400) return res.status(400).json({ ok: false, mensaje: error.message });
    console.error('Error al actualizar colaborador:', error.code || error.name);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar personal.' });
  }
};


exports.actualizarHorasPracticas = async (req, res) => {
  const empleadoId = Number(req.params.id);
  const horasMeta = Number(req.body?.horas_meta);

  if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
    return res.status(400).json({ ok: false, mensaje: 'Colaborador no válido.' });
  }
  if (!Number.isFinite(horasMeta) || horasMeta <= 0) {
    return res.status(400).json({ ok: false, mensaje: 'La meta de horas debe ser mayor a 0.' });
  }

  try {
    const [empleadoRows] = await pool.query(`
      SELECT id, tipo_vinculo FROM empleados WHERE id = ? LIMIT 1
    `, [empleadoId]);
    if (!empleadoRows.length) return res.status(404).json({ ok: false, mensaje: 'Colaborador no encontrado.' });
    if (!String(empleadoRows[0].tipo_vinculo || '').toLowerCase().startsWith('practicante')) {
      return res.status(400).json({ ok: false, mensaje: 'El colaborador seleccionado no es practicante.' });
    }

    await pool.query(`
      INSERT INTO practicante_detalles (empleado_id, horas_meta, estado_completado)
      VALUES (?, ?, FALSE)
      ON DUPLICATE KEY UPDATE horas_meta = VALUES(horas_meta)
    `, [empleadoId, horasMeta]);
    await pool.query(`UPDATE empleados SET horas_totales_asignadas = ? WHERE id = ?`, [horasMeta, empleadoId]);

    return res.status(200).json({ ok: true, mensaje: 'Meta de horas de prácticas actualizada correctamente.' });
  } catch (error) {
    console.error('Error al actualizar horas de prácticas:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar la meta de horas.' });
  }
};
