const { createHash } = require('node:crypto');
const pool = require('../config/database');
const { idPositivo } = require('./documentoService');
const { catalogoModelos, resolverModelo, resolverEmpresa, CAMPOS_MODELO } = require('./documentoModelosService');

const CAMPOS = Object.freeze([...new Set(['trabajador', 'documento', 'empresa', 'ruc', 'fecha', 'fecha_ingreso', 'fecha_finalizacion', 'cargo', 'area', 'horas', 'horas_meta', 'formacion_academica', 'lugar_fecha', ...CAMPOS_MODELO.map(campo => campo.clave)])]);
const CAMPOS_CALCULADOS_OPCIONALES = new Set(['formacion_academica', 'lugar_fecha']);
const NOMBRES_DOCUMENTOS = Object.freeze({ aceptacion: 'Carta de aceptación', constancia_practicas: 'Constancia de prácticas',
  culminacion: 'Carta de culminación', carta: 'Carta de presentación', horas: 'Constancia de horas', trabajo: 'Certificado de trabajo',
  convenio_pasantia: 'Convenio de pasantía', plan_capacitacion: 'Plan de capacitación' });
const PREDETERMINADAS = Object.freeze({
  aceptacion: {
    titulo: 'CARTA DE ACEPTACIÓN PARA PROYECTO DE PASANTÍA',
    cuerpo: '{{lugar_fecha}}\n\nEstimado(a):\n{{destinatario}}\n{{destinatario_cargo}}\n\nASUNTO: Aceptación para Proyecto de Pasantía\n\nDe mi consideración:\n\nPor medio de la presente me dirijo a usted para expresarle mi saludo cordial, y a la vez hacer de su conocimiento que nuestra empresa ha aceptado al siguiente estudiante:\n\n{{trabajador}} — {{documento}}\n\nPara desarrollo del proyecto en la modalidad de pasantía antes mencionado por un periodo de {{duracion}} o {{horas}} horas y así complementar su formación académica, del curso de prácticas, el cual es obligatorio para el estudiante y en lo dispuesto en la Ley Sobre Modalidades Formativas Laborales (Nº 28518).\n\nLos datos para registro son los siguientes:\n- RUC empresa: {{ruc}}\n- Razón social: {{empresa}}\n- Supervisor del practicante: {{supervisor}}\n- Cel. supervisor: {{supervisor_telefono}}\n- Área de desempeño: {{area}}\n{{formacion_academica}}\n\nAtentamente,\n\n\n_______________________________\n{{supervisor}}'
  },
  constancia_practicas: {
    titulo: 'CONSTANCIA DE PRÁCTICAS',
    cuerpo: '{{lugar_fecha}}\n\n{{empresa}}, con RUC {{ruc}}, deja constancia de que {{trabajador}}, identificado(a) con {{documento}}, realiza prácticas en el área de {{area}}, desempeñando el cargo de {{cargo}}.\n\n{{formacion_academica}}\n\nFecha de inicio: {{fecha_ingreso}}.\nHoras de prácticas realizadas: {{horas}} horas.\n\nSe expide la presente constancia a solicitud del interesado(a), para los fines que estime conveniente.\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  },
  culminacion: {
    titulo: 'CARTA DE CULMINACIÓN DE PRÁCTICAS',
    cuerpo: '{{lugar_fecha}}\n\n{{empresa}}, con RUC {{ruc}}, hace constar que {{trabajador}}, identificado(a) con {{documento}}, culminó sus prácticas en el área de {{area}}, desempeñando el cargo de {{cargo}}.\n\n{{formacion_academica}}\n\nFecha de inicio: {{fecha_ingreso}}.\nFecha de finalización: {{fecha_finalizacion}}.\nTotal de horas de prácticas: {{horas}} horas.\n\nSe extiende la presente para los fines que el interesado(a) considere pertinentes.\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  },
  carta: {
    titulo: 'CARTA DE PRESENTACIÓN',
    cuerpo: '{{lugar_fecha}}\n\nA quien corresponda:\n\n{{empresa}} presenta a {{trabajador}}, identificado(a) con {{documento}}, quien desempeña el cargo de {{cargo}} en el área de {{area}}.\n\n{{formacion_academica}}\n\nSe extiende la presente para las gestiones correspondientes.\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  },
  horas: {
    titulo: 'CONSTANCIA DE HORAS',
    cuerpo: '{{lugar_fecha}}\n\nSe deja constancia de que {{trabajador}}, identificado(a) con {{documento}}, registra {{horas}} horas en {{empresa}}, en el área de {{area}} y cargo de {{cargo}}.\n\n{{formacion_academica}}\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  },
  trabajo: {
    titulo: 'CERTIFICADO DE TRABAJO',
    cuerpo: '{{lugar_fecha}}\n\n{{empresa}} certifica que {{trabajador}}, identificado(a) con {{documento}}, figura en sus registros como trabajador(a) en el cargo de {{cargo}}, área de {{area}}, con fecha de ingreso {{fecha_ingreso}}.\n\nSe expide el presente documento a solicitud del interesado(a).\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  }
});

function error(mensaje, status = 400) { return Object.assign(new Error(mensaje), { status }); }
function codigoValido(codigo) {
  if (typeof codigo !== 'string' || !(Object.hasOwn(PREDETERMINADAS, codigo) || ['convenio_pasantia', 'plan_capacitacion'].includes(codigo))) throw error('El tipo de documento no está disponible.');
  return codigo;
}
function textoPlano(valor, nombre, maximo, saltosPagina = false) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > maximo) throw error(`${nombre} es obligatorio y admite hasta ${maximo} caracteres.`);
  const limpio = valor.replace(/\r\n?/g, '\n').trim();
  if (/[\u0000-\u0008\u000b\u000e-\u001f]/.test(limpio) || (!saltosPagina && limpio.includes('\f')) || /<\/?[a-z][^>]*>/i.test(limpio)) {
    throw error(`${nombre} debe contener texto plano, sin etiquetas HTML.`);
  }
  return limpio;
}
function validarPlantilla(body) {
  const titulo = textoPlano(body.titulo, 'El título', 150);
  const cuerpo = textoPlano(body.cuerpo, 'El contenido', 50000, true);
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
  const definiciones = [...Object.entries(PREDETERMINADAS), ...catalogoModelos().map(modelo => [modelo.id, { titulo: modelo.titulo, cuerpo: modelo.cuerpo }])];
  return definiciones.map(([codigo, predeterminada]) => {
    const almacenada = rows.find(row => row.codigo === codigo);
    const plantilla = almacenada ? { titulo: almacenada.titulo, cuerpo: almacenada.cuerpo_html } : { ...predeterminada };
    return { codigo, ...plantilla, personalizada: Boolean(almacenada), revision: revision(plantilla) };
  });
}
async function catalogos() {
  const [templates, [empresas], [areas], [cargos]] = await Promise.all([
    plantillas(),
    pool.query('SELECT id, razon_social, ruc, direccion FROM empresas ORDER BY razon_social'),
    pool.query('SELECT id, nombre, empresa_id FROM areas ORDER BY nombre'),
    pool.query('SELECT id, nombre, area_id FROM cargos ORDER BY nombre')
  ]);
  return { plantillas: templates, empresas: empresas.map(empresa => ({ ...empresa,
    empresa_modelo_clave: resolverEmpresa({ empresa: empresa.razon_social, ruc: empresa.ruc })?.clave || null })),
  areas, cargos, campos: CAMPOS, modelos: catalogoModelos(), campos_modelo: CAMPOS_MODELO };
}
async function guardarPlantilla(codigo, body) {
  if (typeof codigo !== 'string' || !(Object.hasOwn(PREDETERMINADAS, codigo) || catalogoModelos().some(modelo => modelo.id === codigo))) throw error('La plantilla no está disponible.');
  const plantilla = validarPlantilla(body);
  const [result] = await pool.query(`INSERT INTO plantillas_documentos (codigo, titulo, cuerpo_html)
    VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), titulo = VALUES(titulo), cuerpo_html = VALUES(cuerpo_html)`,
  [codigo, plantilla.titulo, plantilla.cuerpo]);
  return { id: Number(result.insertId) || null, codigo, ...plantilla, personalizada: true, revision: revision(plantilla) };
}
function fechaValida(valor, nombre = 'La fecha de emisión') {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw error(`${nombre} no es válida.`);
  const date = new Date(`${valor}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== valor) throw error(`${nombre} no es válida.`);
  return valor;
}
function formatoFecha(valor) {
  if (!valor) return 'No registrada';
  const iso = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function fechaIso(valor) {
  if (!valor) return '';
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
}
function normalizarDatos(body) {
  const datos = body.datos_documento === undefined ? {} : body.datos_documento;
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw error('Los datos del documento deben ser un objeto de campos.');
  const resultado = {};
  for (const [clave, valor] of Object.entries(datos)) {
    const campo = CAMPOS_MODELO.find(item => item.clave === clave);
    if (!campo) throw error(`El campo ${clave} no está permitido en el documento.`);
    if (valor === '' || valor === null) { resultado[clave] = ''; continue; }
    if (campo.tipo === 'date' || clave.startsWith('fecha_')) {
      resultado[clave] = fechaValida(valor, campo.etiqueta);
    } else if (campo.tipo === 'number') {
      const numero = Number(valor);
      if (!['string', 'number'].includes(typeof valor) || typeof valor === 'string' && !valor.trim() || !Number.isFinite(numero) || numero < 0 || numero > (campo.maximo_numero || 99999999.99)) throw error(`${campo.etiqueta} debe ser un número válido mayor o igual a cero.`);
      resultado[clave] = numero;
    } else {
      resultado[clave] = textoPlano(valor, campo.etiqueta, campo.maximo || (campo.tipo === 'textarea' ? 4000 : 500));
    }
    if (campo.opciones?.length) {
      const opciones = campo.opciones.map(opcion => typeof opcion === 'object' ? opcion.valor ?? opcion.value ?? opcion.id : opcion);
      if (!opciones.includes(resultado[clave])) throw error(`Seleccione una opción válida para ${campo.etiqueta}.`);
    }
  }
  return resultado;
}
function comprobarDatosModelo(modelo, datos) {
  const faltantes = (modelo.campos_requeridos || []).filter(clave => datos[clave] == null || String(datos[clave]).trim() === '');
  if (faltantes.length) throw error('Completa los datos del documento: ' + faltantes.map(clave => CAMPOS_MODELO.find(campo => campo.clave === clave)?.etiqueta || clave).join(', ') + '.');
  if (datos.fecha_ingreso && datos.fecha_finalizacion && fechaIso(datos.fecha_finalizacion) < fechaIso(datos.fecha_ingreso)) throw error('La fecha de finalización no puede ser anterior a la fecha de inicio.');
  if (datos.fecha_nacimiento && datos.fecha_ingreso && fechaIso(datos.fecha_nacimiento) >= fechaIso(datos.fecha_ingreso)) throw error('La fecha de nacimiento debe ser anterior al inicio de las prácticas.');
  if (['convenio_pasantia', 'plan_capacitacion'].includes(modelo.codigo)) {
    const institucion = String(datos.institucion_educativa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!/(?:\bupn\b|universidad privada del norte)/.test(institucion)) throw error('Este modelo corresponde a la Universidad Privada del Norte (UPN). Revisa la institución educativa del colaborador.');
  }
}
async function preparar(body = {}) {
  const codigo = codigoValido(body.codigo);
  if (body.modelo_id !== undefined && (typeof body.modelo_id !== 'string' || !body.modelo_id || body.modelo_id.length > 50)) throw error('El modelo de documento no es válido.');
  const empleadoId = idPositivo(body.empleado_id, 'colaborador');
  const empresaId = idPositivo(body.empresa_id, 'empresa');
  const areaId = idPositivo(body.area_id, 'área');
  const cargoId = idPositivo(body.cargo_id, 'cargo');
  const fecha = fechaValida(body.fecha);
  const adicionales = normalizarDatos(body);
  const horas = Number(body.horas);
  if (!['string', 'number'].includes(typeof body.horas) || typeof body.horas === 'string' && !body.horas.trim() || !Number.isFinite(horas) || horas < 0 || horas > 999999.99) throw error('Las horas deben ser un número entre 0 y 999999.99.');
  const [templates, [empleados], [estructura]] = await Promise.all([
    plantillas(),
    pool.query(`SELECT e.id, e.nombres, e.apellidos, e.tipo_documento, e.numero_documento,
      e.tipo_vinculo, e.fecha_ingreso, e.fecha_finalizacion, e.carrera, e.institucion_educativa,
      e.direccion, e.fecha_nacimiento, e.puesto, pd.fecha_vencimiento_convenio,
      COALESCE(pd.horas_meta, e.horas_totales_asignadas, 0) AS horas_meta
      FROM empleados e LEFT JOIN practicante_detalles pd ON pd.empleado_id = e.id
      WHERE e.id = ? LIMIT 1`, [empleadoId]),
    pool.query(`SELECT emp.razon_social AS empresa, emp.ruc, emp.direccion AS empresa_direccion, ar.nombre AS area, c.nombre AS cargo
      FROM empresas emp INNER JOIN areas ar ON ar.empresa_id = emp.id
      INNER JOIN cargos c ON c.area_id = ar.id
      WHERE emp.id = ? AND ar.id = ? AND c.id = ? LIMIT 1`, [empresaId, areaId, cargoId])
  ]);
  if (!empleados.length) throw error('No se encontró el colaborador.', 404);
  if (!estructura.length) throw error('La empresa, el área y el cargo deben corresponder entre sí.');
  const empleado = empleados[0];
  const identidad = resolverEmpresa({ empresa: estructura[0].empresa, ruc: estructura[0].ruc });
  if (codigo === 'trabajo' && empleado.tipo_vinculo !== 'trabajador') throw error('El certificado de trabajo corresponde a colaboradores con vínculo de trabajador.');
  if (['aceptacion', 'convenio_pasantia', 'plan_capacitacion'].includes(codigo) && !String(empleado.tipo_vinculo || '').toLowerCase().startsWith('practicante')) throw error('Este documento corresponde a colaboradores con vínculo de practicante.');
  const modelo = ['aceptacion', 'convenio_pasantia', 'plan_capacitacion'].includes(codigo)
    ? resolverModelo({ codigo, empresa: estructura[0].empresa, ruc: estructura[0].ruc, carrera: adicionales.carrera ?? empleado.carrera, modelo_id: body.modelo_id }) : null;
  if (body.modelo_id && !modelo) throw error('El modelo seleccionado no corresponde al tipo de documento.');
  if (!modelo && ['convenio_pasantia', 'plan_capacitacion'].includes(codigo)) throw error('No hay un modelo UPN disponible para la carrera seleccionada.');
  const plantilla = templates.find(item => item.codigo === (modelo?.id || codigo));
  if (body.revision_plantilla && body.revision_plantilla !== plantilla.revision) throw error('La plantilla cambió. Abre una nueva vista previa antes de descargar.', 409);
  // Aun las plantillas antiguas de la base se procesan como texto, nunca como HTML.
  validarPlantilla(plantilla);
  const originales = {
    trabajador: `${empleado.nombres} ${empleado.apellidos}`,
    documento: `${empleado.tipo_documento || 'DNI'} ${empleado.numero_documento}`,
    ...estructura[0], carrera: empleado.carrera, institucion_educativa: empleado.institucion_educativa,
    direccion: empleado.direccion, fecha_nacimiento: fechaIso(empleado.fecha_nacimiento),
    puesto: empleado.puesto || estructura[0].cargo,
    fecha, fecha_ingreso: fechaIso(empleado.fecha_ingreso),
    fecha_finalizacion: fechaIso(modelo ? empleado.fecha_vencimiento_convenio || empleado.fecha_finalizacion : empleado.fecha_finalizacion),
    horas, horas_meta: Number(empleado.horas_meta || 0)
  };
  // Los modelos aportan únicamente datos institucionales. Los datos registrados y
  // los ajustes explícitos prevalecen; las condiciones no se infieren de contratos.
  const datos = { ...(identidad?.datos_predeterminados || {}), ...(modelo?.datos_predeterminados || {}),
    ...Object.fromEntries(Object.entries(originales).filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')), ...adicionales };
  const requeridos = modelo || plantilla.personalizada ? [...new Set([
    ...(modelo?.campos_requeridos || []),
    ...[...`${plantilla.titulo}\n${plantilla.cuerpo}`.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map(match => match[1])
  ])].filter(campo => !CAMPOS_CALCULADOS_OPCIONALES.has(campo)) : [];
  comprobarDatosModelo({ ...(modelo || {}), campos_requeridos: requeridos }, datos);
  const campos = Object.fromEntries(Object.entries(datos).map(([clave, valor]) => [clave,
    clave === 'fecha' || clave.startsWith('fecha_') ? (valor ? formatoFecha(valor) : '')
      : typeof valor === 'number' ? valor.toLocaleString('es-PE', { maximumFractionDigits: 2 }) : valor]));
  if (!modelo) {
    campos.ruc ||= 'No registrado';
    campos.fecha_ingreso ||= 'No registrada';
    campos.fecha_finalizacion ||= 'No registrada';
  }
  campos.formacion_academica = [datos.carrera ? `Carrera: ${datos.carrera}.` : '',
    datos.institucion_educativa ? `Institución educativa: ${datos.institucion_educativa}.` : ''].filter(Boolean).join('\n');
  campos.lugar_fecha = `${datos.ciudad ? datos.ciudad + ', ' : ''}${formatoFecha(fecha)}`;
  const diseno = ['convenio_pasantia', 'plan_capacitacion'].includes(codigo) ? 'convenio' : 'carta';
  const firmante = diseno === 'convenio' ? datos.representante || datos.supervisor : datos.supervisor || datos.representante;
  const normalizarNombre = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const firmantesFuente = [identidad?.datos_predeterminados?.supervisor, identidad?.datos_predeterminados?.representante].filter(Boolean);
  const firma = identidad && firmante && firmantesFuente.some(nombre => normalizarNombre(nombre) === normalizarNombre(firmante)) ? identidad.clave : null;
  const completar = texto => texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, campo) => String(campos[campo] ?? ''));
  return {
    codigo, titulo: completar(plantilla.titulo), cuerpo: completar(plantilla.cuerpo),
    empresa: campos.empresa, trabajador: campos.trabajador, fecha,
    carrera: datos.carrera || '', institucion_educativa: datos.institucion_educativa || '', tipo_documento_nombre: NOMBRES_DOCUMENTOS[codigo],
    modelo_id: modelo?.id || null, modelo_nombre: diseno === 'carta'
      ? `${NOMBRES_DOCUMENTOS[codigo]} · ${campos.empresa}` : modelo.nombre,
    estilo: 'formal', diseno, logo: identidad?.logo || modelo?.logo || null,
    firma, firmante_empresa: firmante || '',
    revision_plantilla: plantilla.revision,
    nombre_archivo: `${codigo}-${empleado.numero_documento}-${fecha}.pdf`.replace(/[\\/\r\n]/g, '_')
  };
}

module.exports = { catalogos, guardarPlantilla, preparar, validarPlantilla, CAMPOS, PREDETERMINADAS };
