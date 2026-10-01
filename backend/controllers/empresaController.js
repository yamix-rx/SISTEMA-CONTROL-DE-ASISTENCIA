const pool = require('../config/database');
const crypto = require('node:crypto');

function encryptionKey() {
  const value = process.env.LOGO_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('LOGO_ENCRYPTION_KEY debe contener 64 caracteres hexadecimales.');
  return Buffer.from(value, 'hex');
}

function cifrarLogo(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { data, iv, tag: cipher.getAuthTag() };
}

function descifrarLogo(logo) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), logo.logo_iv);
  decipher.setAuthTag(logo.logo_tag);
  return Buffer.concat([decipher.update(logo.logo_data), decipher.final()]);
}

// 1. Listar todas las empresas con total de trabajadores activos
exports.listarEmpresas = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id,
        e.razon_social,
        e.ruc,
        e.direccion,
        CASE WHEN MAX(e.logo_data IS NOT NULL) = 1 THEN CONCAT('/api/empresas/', e.id, '/logo') ELSE NULL END AS logo_url,
        NULL AS telefono,
        NULL AS email_contacto,
        e.estado,
        COUNT(emp.id) AS total_empleados
      FROM empresas e
      LEFT JOIN empleados emp ON emp.empresa_id = e.id AND emp.estado = 'activo'
      GROUP BY e.id, e.razon_social, e.ruc, e.direccion, e.estado
      ORDER BY e.razon_social ASC
    `;

    const [rows] = await pool.query(query);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error('Error al listar empresas:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar empresas.' });
  }
};

exports.subirLogo = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || !req.file) {
    return res.status(400).json({ ok: false, mensaje: 'Seleccione una imagen válida para la empresa.' });
  }

  try {
    const [rows] = await pool.query('SELECT id FROM empresas WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Empresa no encontrada.' });

    const encrypted = cifrarLogo(req.file.buffer);
    await pool.query('UPDATE empresas SET logo_data = ?, logo_iv = ?, logo_tag = ?, logo_mime = ? WHERE id = ?', [encrypted.data, encrypted.iv, encrypted.tag, req.file.mimetype, id]);
    return res.json({ ok: true, logo_url: `/api/empresas/${id}/logo`, mensaje: 'Logo de empresa actualizado.' });
  } catch (error) {
    console.error('Error al guardar logo de empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar el logo de la empresa.' });
  }
};

exports.obtenerLogo = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, mensaje: 'Empresa no válida.' });
  try {
    const [rows] = await pool.query('SELECT logo_data, logo_iv, logo_tag, logo_mime FROM empresas WHERE id = ?', [id]);
    if (!rows.length || !rows[0].logo_data) return res.status(404).json({ ok: false, mensaje: 'La empresa no tiene logo.' });
    const image = descifrarLogo(rows[0]);
    res.set('Content-Type', rows[0].logo_mime);
    res.set('Cache-Control', 'private, no-store');
    return res.send(image);
  } catch (error) {
    console.error('Error al descifrar logo de empresa:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo obtener el logo de la empresa.' });
  }
};

// 2. Registrar o Actualizar Empresa
exports.guardarEmpresa = async (req, res) => {
  const { id, razon_social, ruc, direccion, estado } = req.body;

  if (typeof razon_social !== 'string' || !razon_social.trim() || razon_social.length > 150 || (ruc && !/^\d{11}$/.test(ruc))) {
    return res.status(400).json({ ok: false, mensaje: 'Ingrese la razón social y, si corresponde, un RUC de 11 dígitos.' });
  }
  if (estado && !['activo','inactivo'].includes(estado)) return res.status(400).json({ ok:false, mensaje:'Estado de empresa no válido.' });
  if (id && (!Number.isInteger(Number(id)) || Number(id) <= 0)) return res.status(400).json({ ok:false, mensaje:'Empresa no válida.' });

  try {
    if (id) {
      // Actualizar
      const [result] = await pool.query(`
        UPDATE empresas 
        SET razon_social = ?, ruc = ?, direccion = ?, estado = ?
        WHERE id = ?
      `, [razon_social.trim(), ruc || null, direccion || null, estado || 'activo', id]);
      if (!result.affectedRows) return res.status(404).json({ok:false, mensaje:'Empresa no encontrada.'});

      return res.status(200).json({ ok: true, mensaje: 'Empresa actualizada correctamente.' });
    } else {
      // Insertar
      const [result] = await pool.query(`
        INSERT INTO empresas (razon_social, ruc, direccion, estado)
        VALUES (?, ?, ?, ?)
      `, [razon_social.trim(), ruc || null, direccion || null, estado || 'activo']);

      return res.status(201).json({ ok: true, mensaje: 'Empresa registrada con éxito.', id: result.insertId });
    }
  } catch (error) {
    console.error('Error al guardar empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al guardar empresa en la base de datos.' });
  }
};

// 3. Cambiar estado (Activar / Inactivar)
exports.cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  if (!['activo','inactivo'].includes(estado) || !Number.isInteger(Number(id)) || Number(id)<=0) return res.status(400).json({ok:false,mensaje:'Empresa o estado no válido.'});

  try {
    const [result] = await pool.query(`UPDATE empresas SET estado = ? WHERE id = ?`, [estado, id]);
    if (!result.affectedRows) return res.status(404).json({ok:false,mensaje:'Empresa no encontrada.'});
    return res.status(200).json({ ok: true, mensaje: 'Estado actualizado correctamente.' });
  } catch (error) {
    console.error('Error al cambiar estado de la empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar el estado.' });
  }
};
