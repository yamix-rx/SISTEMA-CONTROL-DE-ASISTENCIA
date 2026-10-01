const datos = require('../data/modelos-documentos.json');

// Los datos variables siempre son campos. El catálogo no contiene estudiantes
// de los PDF originales ni incorpora las firmas o los sellos de los ejemplos.
const CAMPOS_MODELO = Object.freeze([
  { clave: 'carrera', etiqueta: 'Carrera profesional', tipo: 'text', maximo: 180 },
  { clave: 'institucion_educativa', etiqueta: 'Centro de formación profesional', tipo: 'text', maximo: 200 },
  { clave: 'direccion', etiqueta: 'Domicilio del estudiante', tipo: 'text', maximo: 350 },
  { clave: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date', maximo: 10 },
  { clave: 'fecha_ingreso', etiqueta: 'Inicio de la pasantía', tipo: 'date', maximo: 10 },
  { clave: 'fecha_finalizacion', etiqueta: 'Término de la pasantía', tipo: 'date', maximo: 10 },
  { clave: 'empresa_direccion', etiqueta: 'Domicilio de la empresa', tipo: 'text', maximo: 350 },
  { clave: 'actividad_economica', etiqueta: 'Actividad económica de la empresa', tipo: 'textarea', maximo: 1200 },
  { clave: 'representante', etiqueta: 'Representante de la empresa', tipo: 'text', maximo: 180 },
  { clave: 'representante_documento', etiqueta: 'Documento del representante de la empresa', tipo: 'text', maximo: 20 },
  { clave: 'representante_cargo', etiqueta: 'Cargo del representante', tipo: 'text', maximo: 120 },
  { clave: 'supervisor', etiqueta: 'Supervisor del estudiante', tipo: 'text', maximo: 180 },
  { clave: 'supervisor_telefono', etiqueta: 'Teléfono del supervisor', tipo: 'tel', maximo: 35 },
  { clave: 'destinatario', etiqueta: 'Destinatario de la carta', tipo: 'text', maximo: 180 },
  { clave: 'destinatario_cargo', etiqueta: 'Cargo del destinatario', tipo: 'text', maximo: 180 },
  { clave: 'ciudad', etiqueta: 'Ciudad de suscripción', tipo: 'text', maximo: 120 },
  { clave: 'duracion', etiqueta: 'Plazo de duración', tipo: 'text', maximo: 180 },
  { clave: 'horario', etiqueta: 'Horario de la pasantía (días y horas)', tipo: 'textarea', maximo: 1200 },
  { clave: 'institucion_ruc', etiqueta: 'RUC del centro de formación', tipo: 'text', maximo: 11 },
  { clave: 'institucion_direccion', etiqueta: 'Domicilio del centro de formación', tipo: 'text', maximo: 350 },
  { clave: 'institucion_representante', etiqueta: 'Representante del centro de formación', tipo: 'text', maximo: 180 },
  { clave: 'institucion_representante_documento', etiqueta: 'Documento del representante del centro de formación', tipo: 'text', maximo: 20 },
  { clave: 'empresa_email', etiqueta: 'Correo de contacto de la empresa', tipo: 'email', maximo: 200 }
]);

const FIRMAS = `
_______________________________
{{trabajador}}
Documento de identidad: {{documento}}
(Estudiante)

_______________________________
{{representante}}
{{representante_cargo}}
Contacto del supervisor: {{supervisor_telefono}}

_______________________________
CENTRO DE FORMACIÓN PROFESIONAL
{{institucion_educativa}}`;

const CONVENIO = `Conste por el presente documento que se firma por cuadruplicado, el Convenio de Pasantía, celebrado de conformidad con el Artículo 23º y siguientes, de la Ley sobre Modalidades Formativas Laborales, Ley N° 28518, y su Reglamento aprobado mediante el Decreto Supremo Nº 007-2005-TR, que se celebra entre LA EMPRESA, EL CENTRO DE FORMACIÓN PROFESIONAL y EL (LA) BENEFICIARIO (A), identificados en este documento, de acuerdo con los términos y condiciones siguientes:

DATOS GENERALES
A. LA EMPRESA
Razón social: {{empresa}}
RUC: {{ruc}}
Domicilio: {{empresa_direccion}}
Actividad económica: {{actividad_economica}}
Representante: {{representante}}
Doc. de identidad del representante: {{representante_documento}}

B. EL CENTRO DE FORMACIÓN PROFESIONAL
Razón social: {{institucion_educativa}}
RUC: {{institucion_ruc}}
Domicilio: {{institucion_direccion}}
Representante: {{institucion_representante}}
Doc. de identidad del representante: {{institucion_representante_documento}}

C. EL (LA) BENEFICIARIO (A)
Nombre: {{trabajador}}
Doc. de identidad: {{documento}}
Fecha de nacimiento: {{fecha_nacimiento}}
Domicilio: {{direccion}}
Carrera: {{carrera}}

D. CONDICIONES DEL CONVENIO
Plazo de duración: {{duracion}}, desde el {{fecha_ingreso}} hasta el {{fecha_finalizacion}}.
Horario de la pasantía: {{horario}}
Área a desempeñar pasantía: {{area}}
\fCLÁUSULAS DEL CONVENIO

PRIMERO: EL (LA) BENEFICIARIO (A) es aquel que cumple con los requisitos de edad, y manifiesta su interés y necesidad de reforzar la capacitación laboral adquirida en el CENTRO DE FORMACIÓN PROFESIONAL mediante el desarrollo de actividades formativas en LA EMPRESA.

SEGUNDO: En virtud del presente Convenio EL CENTRO DE FORMACIÓN PROFESIONAL informa a LA EMPRESA su interés y necesidad de que un (a) BENEFICIARIO (A) efectúe su pasantía para los fines de relacionarlo con el mundo laboral y la empresa.

TERCERO: EL (LA) BENEFICIARIO (A) desempeñará las actividades formativas inherentes a {{area}}, descritas en el Plan Específico de Pasantía anexo, de acuerdo a los datos generales señalados en el literal D).

CUARTO: Para efectos del presente convenio LA EMPRESA se obliga a:
1) Brindar las facilidades a EL (LA) BENEFICIARIO (A) para que realice su pasantía mediante la ejecución de tareas productivas, según el Plan Específico de Pasantía.
2) Proporcionar la dirección técnica y los medios necesarios para la formación laboral, sistemática e integral de EL (LA) BENEFICIARIO (A), en la ocupación materia del presente convenio.
3) No cobrar a EL (LA) BENEFICIARIO (A) suma alguna por su formación.
4) Emitir cuando corresponda los informes que requiera EL CENTRO DE FORMACIÓN PROFESIONAL en que cursó estudios EL/LA BENEFICIARIO (A).
5) Entregar a EL (LA) BENEFICIARIO (A) el respectivo Certificado sobre su actuación y desempeño.

QUINTO: Para efectos del presente convenio EL CENTRO DE FORMACIÓN PROFESIONAL se obliga a:
1) Planificar y desarrollar el Plan Específico de Pasantía en coordinación con el Programa que respalda ésta, el que deberá responder a las necesidades del mercado laboral.
2) Supervisar, evaluar las actividades formativas.

SEXTO: Para efectos del presente convenio EL (LA) BENEFICIARIO (A) se obliga a:
1) Suscribir un convenio de pasantía con LA EMPRESA, acatando las disposiciones formativas que se le asigne.
2) Desarrollar la pasantía con disciplina y responsabilidad.
3) Cumplir las tareas productivas de la empresa conforme a la reglamentación y normatividad de ésta y del Plan Específico de Pasantía.
4) Cumplir con diligencia las obligaciones convenidas.
5) Guardar estricta confidencialidad de los datos e información a la que la empresa le brinde acceso.

SÉPTIMO: Cualquiera de las partes se reserva el derecho de dar por concluido el presente convenio de manera inmediata en el momento que considere conveniente.
Cualquier modificación a lo expuesto en este convenio requerirá de un acuerdo expreso entre las partes que lo celebran.

OCTAVO: EL (LA) BENEFICIARIO (A) declara conocer la naturaleza del presente convenio, el cual no tiene carácter laboral, por cual no contempla subvención alguna, de tal modo que sólo genera para las partes los derechos y obligaciones específicamente previstos en el mismo y en el texto de la Ley N° 28518 y el Decreto Supremo N° 007-2005-TR.

NOVENO: Para todos los efectos relacionados con el presente convenio, las partes señalan como su domicilio el que aparece consignado en la parte introductoria de éste, los cuales se tendrán por válidos en tanto la variación no haya sido comunicada por escrito a la otra parte.

Las partes, después de leído el presente convenio, se ratifican en su contenido y lo suscriben en señal de conformidad con una copia para LA EMPRESA, la segunda para EL (LA) BENEFICIARIO (A), la tercera para el CENTRO DE FORMACIÓN PROFESIONAL, y la cuarta será puesta en conocimiento y registrada ante la Autoridad Administrativa de Trabajo dentro de los quince (15) días naturales de la suscripción; de lo que damos fe.

Suscrito en la ciudad de {{ciudad}}, el {{fecha}}.
${FIRMAS}`;

function lista(elementos) {
  return elementos.map((contenido, indice) => `${String.fromCharCode(97 + indice)}) ${contenido}`).join('\n');
}

function cuerpoPlan(carrera) {
  const especificas = carrera.competencias_especificas.map(([competencia, indicador], indice) => `${indice + 1}. ${competencia} | ${indice + 1}.1 ${indicador}`).join('\n');
  return `Denominación del Plan de Capacitación (Marque con una X):
[ ] Plan Específico de Aprendizaje con predominio en la Empresa.
[ ] Plan Específico de Aprendizaje con predominio en el Centro de Formación Profesional: Prácticas Pre Profesionales.
[X] Plan Específico de Pasantía en la Empresa.
[ ] Plan/Itinerario de Pasantía de Docentes y Catedráticos.

I. DATOS GENERALES
DE LA EMPRESA
1. Razón social de la empresa: {{empresa}}
2. Actividad económica: {{actividad_economica}}
3. Nombre del área en la que realizará el beneficiario su actividad formativa: {{area}}

DEL CENTRO DE FORMACIÓN PROFESIONAL
1.1. Nombre del Centro de Formación Profesional: {{institucion_educativa}}
1.2. Nombre de la persona responsable de la supervisión de las actividades que desarrolla el beneficiario en la empresa: {{supervisor}}

EL BENEFICIARIO
1.3. Nombres y apellidos del beneficiario: {{trabajador}}
1.4. Condiciones pactadas entre el Beneficiario, la Empresa y el Centro de Formación Profesional:
Monto de la subvención S/.: No aplica.
Jornada formativa (días, horas): {{horario}}
Pasante en: {{carrera}}
Área: {{area}}

II. OBJETIVO DEL PLAN
Señala la información básica pertinente del proceso que el beneficiario seguirá a través de la modalidad materia del Convenio.
2.1. Objetivos que debe lograr el beneficiario al término de su formación en la empresa (tomar como referencia los objetivos planteados para cada modalidad en la Ley Nº 28518).
\fIII. ACTIVIDADES FORMATIVAS EN LA EMPRESA
3.1. Función principal del puesto de trabajo u ocupación donde se realizará la actividad formativa laboral
${carrera.funcion}

3.2. Actividades/tareas principales que se desprenden de la función del puesto de trabajo u ocupación
${lista(carrera.actividades)}

3.3. Competencias
${lista(carrera.competencias)}

3.3.1. Competencias específicas
Competencias específicas | Indicador de logro
${especificas}

3.3.2. Competencias genéricas o transversales
Relacionadas a los comportamientos y actitudes laborales propios que el beneficiario desarrollará en la actividad formativa laboral. Por ejemplo: trabajo en equipo, comunicación, etc.
Competencias genéricas/transversales | Indicador de logro
1. Trabajo en equipo | 1.1 Evaluación del supervisor.
2. Comunicación oral y escrita | 2.1 ${carrera.indicador_comunicacion || 'Nivel de convencimiento para cerrar contratos.'}
3. Capacidad crítica y autocrítica | 3.1 Argumentos individuales.
4. Capacidad de análisis y síntesis | 4.1 Aportación de ideas innovadoras.
\fIV. DURACIÓN
4.1. Inicio y término
Fecha de inicio: {{fecha_ingreso}}
Fecha de término: {{fecha_finalizacion}}

V. CONTEXTO FORMATIVO
Elemento | Descripción
INFRAESTRUCTURA Y AMBIENTE | {{empresa}}
MAQUINARIAS/EQUIPOS | Computadora personal, dispositivo móvil.
HERRAMIENTAS | Archivadores, libros de actas, etc.
INSUMOS | Ninguno. No aplica.
EQUIPO PERSONAL | Ninguno. No aplica.

VI. MAPA DE RECORRIDO EN EMPRESA
Relación de áreas o departamentos donde rotará el/los beneficiarios, con la actividad formativa.
Área o departamento
1. {{area}}

VII. MONITOREO Y EVALUACIÓN
1. Evaluación personal del beneficiario en relación con los logros alcanzados a nivel de competencias específicas y competencias genéricas/transversales.
2. Observación de las actividades formativas realizadas por el/los beneficiarios en la empresa:
- A través de 4 (cuatro) Raps – Reportes de Actividades Periódicas, elaborados por el estudiante y firmados por el supervisor en la empresa.
- Seguimiento de la pertinencia de la actividad formativa.
- Resultados de la actividad formativa.

Este anexo contiene información fidedigna, que compromete en su ejecución a los firmantes.
${FIRMAS}`;
}

function camposRequeridos(cuerpo) {
  return [...new Set([...cuerpo.matchAll(/\{\{([a-z_]+)\}\}/g)].map(coincidencia => coincidencia[1]))].filter(campo => campo !== 'formacion_academica');
}

function datosEmpresa(empresa) {
  // Contactos de las cartas aportadas, editables antes de emitir. Silsan no
  // cuenta con convenio de referencia: no se supone su representante legal.
  return {
    supervisor: 'Sofía Beatriz Silva Santisteban',
    supervisor_telefono: '908 915 276',
    ...(empresa.clave !== 'silsan' ? {
      representante: 'Sofía Silva Santisteban',
      representante_documento: '43517907',
      representante_cargo: 'Gerente General',
      empresa_direccion: 'MZA. J LOTE. 33 URB. NATASHA ALTA, LA LIBERTAD - TRUJILLO - TRUJILLO'
    } : {}),
    ...empresa.datos
  };
}

function modeloCarta(empresa) {
  const cuerpo = `{{ciudad}}, {{fecha}}
${empresa.clave === 'nanas' ? '\n{{institucion_educativa}}\n' : ''}
Estimado(a):
{{destinatario}}
{{destinatario_cargo}}

ASUNTO: Aceptación para Proyecto de Pasantía

De mi consideración:

Por medio de la presente me dirijo a usted para expresarle mi saludo cordial, y a la vez hacer de su conocimiento que nuestra empresa ha aceptado al siguiente estudiante:

{{trabajador}} — {{documento}}

Para desarrollo del proyecto en la modalidad de pasantía antes mencionado por un periodo de {{duracion}} o {{horas}} horas y así complementar su formación académica, del curso de prácticas, el cual es obligatorio para el estudiante y en lo dispuesto en la Ley Sobre Modalidades Formativas Laborales (Nº 28518).

Los datos para registro son los siguientes:
- RUC empresa: {{ruc}}
- Razón social: {{empresa}}
- Supervisor del practicante: {{supervisor}}
- Cel. supervisor: {{supervisor_telefono}}
- Área de desempeño: {{area}}
{{formacion_academica}}

Atentamente,


_______________________________
{{supervisor}}
${empresa.clave === 'nanas' ? '\n{{supervisor_telefono}}\n{{empresa_email}}\n{{empresa_direccion}}' : ''}`.trim();
  return {
    id: `carta_aceptacion_${empresa.clave}`,
    nombre: `Carta de aceptación · ${empresa.nombre}`,
    codigo: 'aceptacion',
    empresa_clave: empresa.clave,
    empresa_ruc: empresa.ruc,
    empresa_aliases: [...empresa.aliases],
    titulo: 'CARTA DE ACEPTACIÓN PARA PROYECTO DE PASANTÍA',
    cuerpo,
    fuente: empresa.fuente,
    datos_predeterminados: {
      ...datosEmpresa(empresa),
      ciudad: 'Trujillo',
      duracion: 'tres meses',
      destinatario: empresa.clave === 'camara' ? 'Ricardo Obregon Rivera' : 'Luis Agustín Vilca Gavidia',
      destinatario_cargo: empresa.clave === 'nanas' ? 'Responsable de Orientación Profesional' : 'Director Académico',
      ...(empresa.clave === 'nanas' ? { institucion_educativa: 'UNIVERSIDAD PRIVADA DEL NORTE', empresa_email: empresa.datos.empresa_email } : {})
    },
    campos_requeridos: camposRequeridos(cuerpo),
    estilo: 'formal',
    logo: empresa.clave
  };
}

function modelosCarrera(carrera) {
  const plan = cuerpoPlan(carrera);
  const predeterminados = {
    carrera: carrera.nombre,
    area: carrera.area,
    institucion_educativa: 'UNIVERSIDAD PRIVADA DEL NORTE S.A.C.',
    institucion_ruc: '20215276024',
    institucion_direccion: 'Av. Tingo María 1122, Cercado de Lima',
    institucion_representante: carrera.institucion_representante || 'Luis Agustín Vilca Gavidia',
    institucion_representante_documento: carrera.institucion_representante_documento || '18085055',
    ciudad: 'Trujillo',
    duracion: 'Aproximadamente (03) tres meses'
  };
  return [
    { codigo: 'convenio_pasantia', prefijo: 'convenio', etiqueta: 'Convenio y plan de capacitación', titulo: 'CONVENIO DE PASANTÍA EN LA EMPRESA', cuerpo: `${CONVENIO}\fMODELO DE PLAN DE CAPACITACIÓN\n\n${plan}` },
    { codigo: 'plan_capacitacion', prefijo: 'plan', etiqueta: 'Plan de capacitación', titulo: 'MODELO DE PLAN DE CAPACITACIÓN', cuerpo: plan }
  ].map(tipo => ({
    id: `${tipo.prefijo}_${carrera.clave}`,
    nombre: `${tipo.etiqueta} · ${carrera.nombre}`,
    codigo: tipo.codigo,
    carrera: carrera.nombre,
    carrera_aliases: [...carrera.aliases],
    titulo: tipo.titulo,
    cuerpo: tipo.cuerpo,
    fuente: carrera.fuente,
    incluye_plan: tipo.codigo === 'convenio_pasantia',
    datos_predeterminados: { ...predeterminados },
    campos_requeridos: camposRequeridos(tipo.cuerpo),
    estilo: 'formal'
  }));
}

const MODELOS = [...datos.empresas.map(modeloCarta), ...datos.carreras.flatMap(modelosCarrera)];

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function normalizarEmpresa(valor) {
  return normalizar(valor).replace(/\s+(?:s a c|sac|s a|sa|e i r l|eirl)$/, '').trim();
}

function buscarEmpresa(empresa, ruc) {
  const numero = String(ruc || '').replace(/[\s-]/g, '');
  // El RUC reconocido tiene prioridad. Los aliases exactos también identifican
  // marcas del grupo con otra razón social; no alteran el RUC de sus registros.
  const porRuc = numero && datos.empresas.find(item => item.ruc === numero);
  if (porRuc) return porRuc;
  const nombre = normalizarEmpresa(empresa);
  if (!nombre) return null;
  return datos.empresas.find(item => item.aliases.some(alias => normalizarEmpresa(alias) === nombre)) || null;
}

function buscarCarrera(carrera) {
  const nombre = normalizar(carrera);
  if (!nombre) return null;
  return datos.carreras.find(item => item.aliases.some(alias => normalizar(alias) === nombre)) || null;
}

function copiar(modelo) { return JSON.parse(JSON.stringify(modelo)); }
function incompatible(mensaje) { return Object.assign(new Error(mensaje), { status: 400 }); }

function catalogoModelos() {
  return MODELOS.map(copiar);
}

function resolverEmpresa({ empresa, ruc } = {}) {
  const encontrada = buscarEmpresa(empresa, ruc);
  if (!encontrada) return null;
  return { clave: encontrada.clave, nombre: encontrada.nombre, logo: encontrada.clave,
    datos_predeterminados: { ciudad: 'Trujillo', ...datosEmpresa(encontrada) } };
}

function resolverModelo({ codigo, empresa, ruc, carrera, modelo_id } = {}) {
  const empresaEncontrada = buscarEmpresa(empresa, ruc);
  const carreraEncontrada = buscarCarrera(carrera);
  let modelo;
  if (modelo_id) {
    modelo = MODELOS.find(item => item.id === modelo_id);
    if (!modelo) throw incompatible('El modelo de documento seleccionado no existe.');
    if (modelo.codigo !== codigo) throw incompatible('El modelo seleccionado no corresponde al tipo de documento.');
    if (modelo.empresa_clave && modelo.empresa_clave !== empresaEncontrada?.clave) {
      throw incompatible('El modelo de carta no corresponde a la empresa seleccionada. Revisa su razón social y RUC.');
    }
    if (modelo.carrera && normalizar(carrera) && modelo.carrera !== carreraEncontrada?.nombre) {
      throw incompatible('El modelo seleccionado no corresponde a la carrera del estudiante.');
    }
  } else if (codigo === 'aceptacion' && empresaEncontrada) {
    modelo = MODELOS.find(item => item.codigo === codigo && item.empresa_clave === empresaEncontrada.clave);
  } else if (['convenio_pasantia', 'plan_capacitacion'].includes(codigo) && carreraEncontrada) {
    modelo = MODELOS.find(item => item.codigo === codigo && item.carrera === carreraEncontrada.nombre);
  }
  if (!modelo) return null;
  const resultado = copiar(modelo);
  // Se ofrecen únicamente datos corporativos del modelo de la empresa resuelta.
  // La razón social y el RUC siempre proceden del registro seleccionado en la BD.
  if (empresaEncontrada) Object.assign(resultado.datos_predeterminados, datosEmpresa(empresaEncontrada));
  return resultado;
}

module.exports = { catalogoModelos, resolverModelo, resolverEmpresa, CAMPOS_MODELO };
