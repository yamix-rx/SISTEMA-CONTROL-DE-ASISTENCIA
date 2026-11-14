'use strict';
// Panel de practicantes: lectura de la vista public.practicantes (solo PostgreSQL/Supabase).
const pool = require('../config/database');
const { patronBusqueda } = require('../services/busquedaTexto');

const HOY_SQL = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date";
const ESTADOS = new Set(['activo', 'inactivo', 'finalizado', 'suspendido']);
// Se compara con las horas exactas (no con el porcentaje redondeado) para no marcar 100 % antes de tiempo.
const AVANCES = {
  completado: 'horas_meta > 0 AND horas_realizadas >= horas_meta',
  por_completar: 'horas_meta > 0 AND horas_realizadas >= horas_meta * 0.8 AND horas_realizadas < horas_meta',
  en_curso: 'horas_meta > 0 AND horas_realizadas < horas_meta * 0.8'
};
const CONVENIOS = {
  por_vencer: `fecha_vencimiento_convenio BETWEEN ${HOY_SQL} AND ${HOY_SQL} + 30`,
  vencido: `fecha_vencimiento_convenio < ${HOY_SQL}`
};

const enteroPositivo = valor => (/^\d+$/.test(String(valor ?? '')) && Number(valor) > 0 ? Number(valor) : null);

function construirFiltros(query, { soloEmpresa = false } = {}) {
  const condiciones = [];
  const params = [];
  if (query.empresa_id) {
    const empresa = enteroPositivo(query.empresa_id);
    if (!empresa) return { error: 'Empresa no válida.' };
    condiciones.push('empresa_id = ?');
    params.push(empresa);
  }
  if (soloEmpresa) return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
  if (query.estado && query.estado !== 'todos') {
    if (!ESTADOS.has(query.estado)) return { error: 'Estado no válido.' };
    condiciones.push('estado = ?');
    params.push(query.estado);
  }
  if (query.avance) {
    if (!AVANCES[query.avance]) return { error: 'Filtro de avance no válido.' };
    condiciones.push(`(${AVANCES[query.avance]})`);
  }
  if (query.convenio) {
    if (!CONVENIOS[query.convenio]) return { error: 'Filtro de convenio no válido.' };
    condiciones.push(`(${CONVENIOS[query.convenio]})`);
  }
  if (query.buscar) {
    condiciones.push(`(LOWER(CONCAT(COALESCE(nombres, ''), ' ', COALESCE(apellidos, ''))) LIKE ?
      OR LOWER(COALESCE(numero_documento, '')) LIKE ? OR LOWER(COALESCE(empresa, '')) LIKE ?
      OR LOWER(COALESCE(area, '')) LIKE ? OR LOWER(COALESCE(carrera, '')) LIKE ?
      OR LOWER(COALESCE(institucion_educativa, '')) LIKE ?)`);
    params.push(...Array(6).fill(patronBusqueda(query.buscar)));
  }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
}

exports.listar = async (req, res) => {
  const filtros = construirFiltros(req.query);
  if (filtros.error) return res.status(400).json({ ok: false, mensaje: filtros.error });
  const limite = Math.min(50, enteroPositivo(req.query.limite) || 10);
  const pagina = enteroPositivo(req.query.pagina) || 1;
  try {
    const [[conteo], [filas]] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM practicantes ${filtros.where}`, filtros.params),
      pool.query(`
        SELECT empleado_id, tipo_documento, numero_documento, nombres, apellidos,
          CONCAT(nombres, ' ', apellidos) AS practicante,
          carrera, institucion_educativa, telefono, correo_personal,
          empresa, area, cargo, puesto, estado,
          TO_CHAR(fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
          horas_meta, horas_realizadas, horas_pendientes,
          CASE WHEN horas_meta > 0 AND horas_realizadas >= horas_meta THEN 100
               ELSE LEAST(porcentaje_avance, 99.9) END AS porcentaje_avance,
          TO_CHAR(fecha_vencimiento_convenio, 'YYYY-MM-DD') AS fecha_vencimiento_convenio,
          (fecha_vencimiento_convenio - ${HOY_SQL}) AS dias_convenio
        FROM practicantes ${filtros.where}
        ORDER BY apellidos ASC, nombres ASC
        LIMIT ? OFFSET ?`, [...filtros.params, limite, (pagina - 1) * limite])
    ]);
    const total = Number(conteo[0]?.total || 0);
    return res.status(200).json({
      ok: true,
      data: filas,
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) }
    });
  } catch (error) {
    console.error('Error al listar practicantes:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar practicantes.' });
  }
};

exports.resumen = async (req, res) => {
  const filtros = construirFiltros(req.query, { soloEmpresa: true });
  if (filtros.error) return res.status(400).json({ ok: false, mensaje: filtros.error });
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(*)::int AS total,
        (COUNT(*) FILTER (WHERE estado = 'activo'))::int AS activos,
        (COUNT(*) FILTER (WHERE ${AVANCES.completado}))::int AS completados,
        (COUNT(*) FILTER (WHERE ${AVANCES.por_completar}))::int AS por_completar,
        (COUNT(*) FILTER (WHERE estado = 'activo' AND ${CONVENIOS.por_vencer}))::int AS convenios_por_vencer
      FROM practicantes ${filtros.where}`, filtros.params);
    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al resumir practicantes:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar el resumen de practicantes.' });
  }
};

exports.catalogos = async (req, res) => {
  try {
    const [empresas] = await pool.query('SELECT DISTINCT empresa_id AS id, empresa AS razon_social FROM practicantes ORDER BY empresa');
    return res.status(200).json({ ok: true, data: { empresas, estados: [...ESTADOS] } });
  } catch (error) {
    console.error('Error al cargar catálogos de practicantes:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar los filtros.' });
  }
};
