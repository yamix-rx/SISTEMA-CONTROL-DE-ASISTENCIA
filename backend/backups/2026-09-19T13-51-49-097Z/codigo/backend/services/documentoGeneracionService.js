const { createHash } = require('node:crypto');
const pool = require('../config/database');
const { idPositivo } = require('./documentoService');

const CAMPOS = Object.freeze(['trabajador', 'documento', 'empresa', 'ruc', 'fecha', 'fecha_ingreso', 'fecha_finalizacion', 'cargo', 'area', 'horas', 'horas_meta']);
const PREDETERMINADAS = Object.freeze({
  aceptacion: {
    titulo: 'CARTA DE ACEPTACIÓN DE PRÁCTICAS',
    cuerpo: 'Por medio de la presente, {{empresa}} acepta a {{trabajador}}, identificado(a) con {{documento}}, para realizar prácticas en el área de {{area}}, en el cargo de {{cargo}}.\n\nLas prácticas contemplan {{horas}} horas, de acuerdo con las condiciones del convenio correspondiente.\n\nFecha de emisión: {{fecha}}.\n\nAtentamente,\n\n\n________________________________\nFirma del responsable\nNombre y cargo'
  },
  constancia_practicas: {
    titulo: 'CONSTANCIA DE PRÁCTICAS',
    cuerpo: '{{empresa}} deja constancia de que {{trabajador}}, identificado(a) con {{documento}}, realiza o ha realizado prácticas en el área de {{area}}, en el cargo de {{cargo}}, con fecha de ingreso {{fecha_ingreso}}.\n\nSe certifica un total de {{horas}} horas de prácticas a la fecha indicada.\n\nSe expide la presente constancia a solicitud del interesado(a).\n\nFecha de emisión: {{fecha}}.\n\n\n________________________________\nFirma del responsable\nNombre y cargo'
  },
  culminacion: {
    titulo: 'CARTA DE CULMINACIÓN DE PRÁCTICAS',
    cuerpo: '{{empresa}} hace constar que {{trabajador}}, identificado(a) con {{documento}}, culminó sus prácticas en el área de {{area}}, desempeñando el cargo de {{cargo}}, con un total de {{horas}} horas.\n\nFecha de ingreso: {{fecha_ingreso}}. Fecha de finalización registrada: {{fecha_finalizacion}}.\n\nSe extiende la presente para los fines que el interesado(a) considere pertinentes.\n\nFecha de emisión: {{fecha}}.\n\n\n________________________________\nFirma del responsable\nNombre y cargo'
  }
});

function error(mensaje, status = 400) { return Object.assign(new Error(mensaje), { status }); }
function codigoValido(codigo) {
  if (!Object.hasOwn(PREDETERMINADAS, codigo)) throw error('El tipo de documento no está disponible.');
  return codigo;
}
function textoPlano(valor, nombre, maximo) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > maximo) throw error(`${nombre} es obligatorio y admite hasta ${maximo} caracteres.`);
  const limpio = valor.replace(/\r\n?/g, '\n').trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(limpio) || /<\/?[a-z][^>]*>/i.test(limpio)) {
    throw error(`${nombre} debe contener texto plano, sin etiquetas HTML.`);
  }
  return limpio;
}
function validarPlantilla(body) {
  const titulo = textoPlano(body.titulo, 'El título', 150);
  const cuerpo = textoPlano(body.cuerpo, 'El contenido', 12000);
  for (const contenido of [titulo, cuerpo]) {
    const restante = contenido.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, campo) => {
      if (!CAMPOS.includes(campo)) throw error(`El campo {{${campo}}} no está permitido.`);
      return '';
    });
    if (/[{}]/.test(restante)) throw error('Revisa los campos: usa el formato {{trabajador}} y los nombres disponibles.');
  }
  return { titulo, cuerpo };
}
function revision(plantilla) {
  return createHash('sha256').update(plantilla.titulo + '\n' + plantilla.cuerpo).digest('hex');
}
async function plantillas() {
  const [rows] = await pool.query('SELECT codigo, titulo, cuerpo_html FROM plantillas_documentos ORDER BY codigo');
  return Object.entries(PREDETERMINADAS).map(([codigo, predeterminada]) => {
    const almacenada = rows.find(row => row.codigo === codigo);
    const plantilla = almacenada ? { titulo: almacenada.titulo, cuerpo: almacenada.cuerpo_html } : { ...predeterminada };
    return { codigo, ...plantilla, revision: revision(plantilla) };
  });
}
async function catalogos() {
  const [templates, [empresas], [areas], [cargos]] = await Promise.all([
    plantillas(),
    pool.query('SELECT id, razon_social FROM empresas ORDER BY razon_social'),
    pool.query('SELECT id, nombre, empresa_id FROM areas ORDER BY nombre'),
    pool.query('SELECT id, nombre, area_id FROM cargos ORDER BY nombre')
  ]);
  return { plantillas: templates, empresas, areas, cargos, campos: CAMPOS };
}
async function guardarPlantilla(codigo, body) {
  codigoValido(codigo);
  const plantilla = validarPlantilla(body);
  const [result] = await pool.query(`INSERT INTO plantillas_documentos (codigo, titulo, cuerpo_html)
    VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), titulo = VALUES(titulo), cuerpo_html = VALUES(cuerpo_html)`,
  [codigo, plantilla.titulo, plantilla.cuerpo]);
  return { id: Number(result.insertId) || null, codigo, ...plantilla, revision: revision(plantilla) };
}
function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw error('La fecha de emisión no es válida.');
  const date = new Date(`${valor}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== valor) throw error('La fecha de emisión no es válida.');
  return valor;
}
function formatoFecha(valor) {
  if (!valor) return 'No registrada';
  const iso = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
async function preparar(body = {}) {
  const codigo = codigoValido(body.codigo);
  const empleadoId = idPositivo(body.empleado_id, 'colaborador');
  const empresaId = idPositivo(body.empresa_id, 'empresa');
  const areaId = idPositivo(body.area_id, 'área');
  const cargoId = idPositivo(body.cargo_id, 'cargo');
  const fecha = fechaValida(body.fecha);
  const horas = Number(body.horas);
  if (body.horas === '' || body.horas == null || !Number.isFinite(horas) || horas < 0 || horas > 999999.99) throw error('Las horas deben ser un número entre 0 y 999999.99.');
  const [templates, [empleados], [estructura]] = await Promise.all([
    plantillas(),
    pool.query(`SELECT e.id, e.nombres, e.apellidos, e.tipo_documento, e.numero_documento,
      e.tipo_vinculo, e.fecha_ingreso, e.fecha_finalizacion,
      COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0) AS horas_meta
      FROM empleados e LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id
      WHERE e.id = ? LIMIT 1`, [empleadoId]),
    pool.query(`SELECT emp.razon_social AS empresa, emp.ruc, ar.nombre AS area, c.nombre AS cargo
      FROM empresas emp INNER JOIN areas ar ON ar.empresa_id = emp.id
      INNER JOIN cargos c ON c.area_id = ar.id
      WHERE emp.id = ? AND ar.id = ? AND c.id = ? LIMIT 1`, [empresaId, areaId, cargoId])
  ]);
  if (!empleados.length) throw error('No se encontró el colaborador.', 404);
  if (!estructura.length) throw error('La empresa, el área y el cargo deben corresponder entre sí.');
  const empleado = empleados[0];
  const plantilla = templates.find(item => item.codigo === codigo);
  if (body.revision_plantilla && body.revision_plantilla !== plantilla.revision) throw error('La plantilla cambió. Abre una nueva vista previa antes de descargar.', 409);
  // Aun las plantillas antiguas de la base se procesan como texto, nunca como HTML.
  validarPlantilla(plantilla);
  const campos = {
    trabajador: `${empleado.nombres} ${empleado.apellidos}`,
    documento: `${empleado.tipo_documento || 'DNI'} ${empleado.numero_documento}`,
    ...estructura[0], ruc: estructura[0].ruc || 'No registrado',
    fecha: formatoFecha(fecha), fecha_ingreso: formatoFecha(empleado.fecha_ingreso),
    fecha_finalizacion: formatoFecha(empleado.fecha_finalizacion),
    horas: horas.toLocaleString('es-PE', { maximumFractionDigits: 2 }),
    horas_meta: Number(empleado.horas_meta).toLocaleString('es-PE', { maximumFractionDigits: 2 })
  };
  const completar = texto => texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, campo) => String(campos[campo] ?? ''));
  return {
    codigo, titulo: completar(plantilla.titulo), cuerpo: completar(plantilla.cuerpo),
    empresa: campos.empresa, trabajador: campos.trabajador, fecha,
    revision_plantilla: plantilla.revision,
    nombre_archivo: `${codigo}-${empleado.numero_documento}-${fecha}.pdf`.replace(/[\\/\r\n]/g, '_')
  };
}

module.exports = { catalogos, guardarPlantilla, preparar, validarPlantilla, CAMPOS, PREDETERMINADAS };
