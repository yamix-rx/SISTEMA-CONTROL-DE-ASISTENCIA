const pool = require('../config/database');

// 1. Listar todas las empresas con total de trabajadores activos
exports.listarEmpresas = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id,
        e.razon_social,
        e.ruc,
        e.direccion,
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
