'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let empleado;
let estructura;
let guardadas;
const pool = { async query(sql, params = []) {
  if (/SELECT codigo, titulo, cuerpo_html FROM plantillas_documentos/.test(sql)) return [[...guardadas.values()]];
  if (/INSERT INTO plantillas_documentos/.test(sql)) {
    guardadas.set(params[0], { codigo: params[0], titulo: params[1], cuerpo_html: params[2] });
    return [{ insertId: 1 }];
  }
  if (/FROM empleados e LEFT JOIN practicante_detalles/.test(sql)) return [params[0] === empleado.id ? [empleado] : []];
  if (/FROM empresas emp INNER JOIN areas/.test(sql)) return [params.join(',') === '10,20,30' ? [estructura] : []];
  if (/FROM empresas ORDER BY/.test(sql)) return [[{ id: 10, razon_social: estructura.empresa, ruc: estructura.ruc, direccion: estructura.empresa_direccion }]];
  if (/FROM areas ORDER BY/.test(sql)) return [[{ id: 20, nombre: estructura.area, empresa_id: 10 }]];
  if (/FROM cargos ORDER BY/.test(sql)) return [[{ id: 30, nombre: estructura.cargo, area_id: 20 }]];
  throw new Error('Consulta no prevista en la prueba de modelos: ' + sql);
} };
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: pool };
const { preparar, catalogos, guardarPlantilla } = require('../services/documentoGeneracionService');
const { catalogoModelos } = require('../services/documentoModelosService');

beforeEach(() => {
  guardadas = new Map();
  empleado = {
    id: 101, nombres: 'Ana María', apellidos: 'Prueba Integración', tipo_documento: 'DNI',
    numero_documento: '99990001', tipo_vinculo: 'practicante_preprofesional', empresa_id: 10,
    carrera: 'Ing. de Sistemas', institucion_educativa: 'Universidad Privada del Norte',
    direccion: 'Domicilio del estudiante de prueba 123', fecha_nacimiento: '2002-03-15',
    fecha_ingreso: '2026-08-03', fecha_finalizacion: '2026-12-31',
    fecha_vencimiento_convenio: '2026-11-03', horas_meta: 320, puesto: 'Asistente de sistemas'
  };
  estructura = {
    empresa: 'SBSS OUTSOURCING S.A.C.', ruc: '20000000001',
    empresa_direccion: 'Domicilio empresarial de prueba 456',
    area: 'Área de Sistemas de Prueba', cargo: 'Practicante de Sistemas'
  };
});

function payload(extra = {}) {
  return { codigo: 'aceptacion', empleado_id: 101, empresa_id: 10, area_id: 20, cargo_id: 30,
    fecha: '2026-10-13', horas: 280, ...extra };
}

test('el catálogo conserva cinco cartas corporativas sin agregar formación académica al cuerpo', async () => {
  const catalogo = await catalogos();
  const cartas = catalogo.modelos.filter(modelo => modelo.codigo === 'aceptacion');
  assert.deepEqual(cartas.map(modelo => modelo.empresa_clave).sort(), ['camara', 'nanas', 'ong', 'sbss', 'silsan']);
  assert.equal(catalogo.empresas[0].empresa_modelo_clave, 'sbss');
  assert.equal(catalogo.modelos.filter(modelo => modelo.codigo === 'convenio_pasantia').length, 8);
  for (const carta of cartas) {
    const plantilla = catalogo.plantillas.find(item => item.codigo === carta.id);
    assert.equal(plantilla.personalizada, false);
    assert.doesNotMatch(plantilla.cuerpo, /\{\{formacion_academica\}\}|^Carrera:|^Institución educativa:/m);
  }
});

test('preparar resuelve SBSS y conserva la identidad, horas y estructura del expediente', async () => {
  const documento = await preparar(payload());
  const modelo = catalogoModelos().find(item => item.id === 'carta_aceptacion_sbss');
  assert.equal(documento.modelo_id, modelo.id);
  assert.equal(documento.logo, 'sbss');
  assert.equal(documento.firma, 'sbss');
  assert.equal(documento.diseno, 'carta');
  assert.equal(documento.estilo, 'formal');
  assert.equal(documento.firmante_empresa, modelo.datos_predeterminados.supervisor);
  assert.equal(documento.empresa, estructura.empresa);
  assert.equal(documento.trabajador, 'Ana María Prueba Integración');
  assert.equal(documento.carrera, empleado.carrera);
  assert.match(documento.cuerpo, /DNI[: ]+99990001/);
  assert.match(documento.cuerpo, /280 horas/);
  assert.match(documento.cuerpo, /20000000001/);
  assert.ok(documento.cuerpo.includes(estructura.area));
  assert.match(documento.cuerpo, /^13 de octubre de 2026/);
  assert.doesNotMatch(documento.cuerpo, /\{\{|^Carrera:|^Institución educativa:/m);
});

test('Nanas conserva institución y contactos editables con su propia marca y firma', async () => {
  estructura.empresa = 'NANAS & AMAS PERU S.A.C.';
  estructura.ruc = '20000000002';
  const documento = await preparar(payload({ datos_documento: {
    supervisor_telefono: '900 000 001', empresa_email: 'contacto@example.test', ciudad: 'Chiclayo'
  } }));
  assert.equal(documento.modelo_id, 'carta_aceptacion_nanas');
  assert.equal(documento.logo, 'nanas');
  assert.equal(documento.firma, 'nanas');
  assert.equal(documento.institucion_educativa, empleado.institucion_educativa);
  assert.match(documento.cuerpo, /^Chiclayo, 13 de octubre de 2026/);
  assert.ok(documento.cuerpo.includes(empleado.institucion_educativa));
  assert.match(documento.cuerpo, /900 000 001/);
  assert.match(documento.cuerpo, /contacto@example\.test/);
  assert.ok(documento.cuerpo.includes(estructura.empresa_direccion));
  assert.match(documento.cuerpo, /20000000002/);
  assert.doesNotMatch(documento.cuerpo, /\{\{|^Carrera:|^Institución educativa:/m);
});

test('cambiar el supervisor mantiene el membrete y reserva firma manual para el nuevo responsable', async () => {
  const documento = await preparar(payload({ datos_documento: { supervisor: 'Responsable de Prueba', supervisor_telefono: '900 000 002' } }));
  assert.equal(documento.logo, 'sbss');
  assert.equal(documento.firma, null);
  assert.equal(documento.firmante_empresa, 'Responsable de Prueba');
  assert.match(documento.cuerpo, /Supervisor del practicante: Responsable de Prueba/);
  assert.match(documento.cuerpo, /_{5,}\nResponsable de Prueba/);
});

test('los ocho convenios y planes se resuelven por carrera con datos del expediente y ajustes explícitos', async () => {
  const modelos = catalogoModelos().filter(modelo => ['convenio_pasantia', 'plan_capacitacion'].includes(modelo.codigo));
  assert.equal(modelos.length, 16);
  for (const modelo of modelos) {
    empleado.carrera = modelo.carrera_aliases.at(-1);
    const documento = await preparar(payload({ codigo: modelo.codigo, datos_documento: {
      horario: 'Lunes a viernes de 09:00 a 13:00', duracion: 'Cuatro meses según cronograma',
      institucion_representante: 'Representante Académico de Prueba',
      institucion_representante_documento: '99990002'
    } }));
    assert.equal(documento.modelo_id, modelo.id, modelo.carrera);
    assert.equal(documento.diseno, 'convenio');
    assert.equal(documento.logo, 'sbss');
    assert.equal(documento.firma, 'sbss');
    assert.equal(documento.trabajador, 'Ana María Prueba Integración');
    assert.equal(documento.carrera, empleado.carrera);
    assert.match(documento.cuerpo, /Ana María Prueba Integración/);
    assert.ok(documento.cuerpo.includes(estructura.area));
    assert.match(documento.cuerpo, /3 de agosto de 2026/);
    assert.match(documento.cuerpo, /3 de noviembre de 2026/);
    assert.doesNotMatch(documento.cuerpo, /31 de diciembre de 2026|\{\{/);
    if (modelo.codigo === 'convenio_pasantia') {
      assert.ok(documento.cuerpo.includes(estructura.empresa_direccion));
      assert.match(documento.cuerpo, /Cuatro meses según cronograma/);
      assert.match(documento.cuerpo, /Lunes a viernes de 09:00 a 13:00/);
      assert.match(documento.cuerpo, /Representante Académico de Prueba/);
      assert.match(documento.cuerpo, /99990002/);
      assert.match(documento.cuerpo, /MODELO DE PLAN DE CAPACITACIÓN/);
    }
  }
});

test('una plantilla corporativa guardada conserva texto y campos personalizados al generar', async () => {
  const antes = await preparar(payload());
  const plantilla = { titulo: 'Aceptación personalizada de {{empresa}}',
    cuerpo: 'Texto conservado para {{trabajador}}.\n\n{{formacion_academica}}\n\nContacto: {{supervisor_telefono}}.' };
  const guardada = await guardarPlantilla('carta_aceptacion_sbss', plantilla);
  const documento = await preparar(payload({ datos_documento: { supervisor_telefono: '900 000 003' } }));
  assert.equal(documento.titulo, 'Aceptación personalizada de ' + estructura.empresa);
  assert.match(documento.cuerpo, /^Texto conservado para Ana María Prueba Integración\./);
  assert.match(documento.cuerpo, /Carrera: Ing\. de Sistemas\./);
  assert.match(documento.cuerpo, /Contacto: 900 000 003\./);
  assert.doesNotMatch(documento.cuerpo, /Por medio de la presente/);
  assert.equal(documento.logo, 'sbss');
  assert.equal(documento.firma, 'sbss');
  assert.equal(documento.revision_plantilla, guardada.revision);
  assert.notEqual(documento.revision_plantilla, antes.revision_plantilla);
  const catalogo = await catalogos();
  const encontrada = catalogo.plantillas.find(item => item.codigo === 'carta_aceptacion_sbss');
  assert.equal(encontrada.personalizada, true);
  assert.equal(encontrada.cuerpo, plantilla.cuerpo);
  assert.equal(guardadas.get('carta_aceptacion_sbss').cuerpo_html, plantilla.cuerpo);
  await assert.rejects(preparar(payload({ revision_plantilla: antes.revision_plantilla })), { status: 409 });
});

test('no mezcla un modelo corporativo o de carrera con un expediente incompatible', async () => {
  await assert.rejects(preparar(payload({ modelo_id: 'carta_aceptacion_nanas' })), { status: 400 });
  await assert.rejects(preparar(payload({ codigo: 'convenio_pasantia', modelo_id: 'convenio_derecho' })), { status: 400 });
  empleado.institucion_educativa = 'Universidad de Prueba Ajena';
  await assert.rejects(preparar(payload({ codigo: 'convenio_pasantia', datos_documento: { horario: 'Lunes de 09:00 a 13:00' } })),
    error => error.status === 400 && /UPN/.test(error.message));
});

test('los nombres de las siete empresas registradas seleccionan sus tres plantillas para practicantes y trabajadores', async () => {
  const empresas = [
    ['Droguería Silsan S.A.C.', 'silsan'], ['Importadora Silsan S.A.C.', 'silsan'],
    ['SBSS Outsourcing E.I.R.L.', 'sbss'], ['Nanas & Amas del Norte S.A.C.', 'nanas'],
    ['Centro de Conciliación SBSS', 'camara'], ['Estudio Jurídico SBSS', 'sbss'], ['ONG MESPO', 'ong']
  ];
  for (const [empresa, clave] of empresas) {
    estructura.empresa = empresa;
    for (const tipo_vinculo of ['practicante_preprofesional', 'trabajador']) {
      empleado.tipo_vinculo = tipo_vinculo;
      for (const codigo of ['aceptacion', 'constancia_practicas', 'culminacion']) {
        const documento = await preparar(payload({ codigo }));
        assert.equal(documento.modelo_id, `${codigo === 'aceptacion' ? 'carta_aceptacion' : codigo}_${clave}`, empresa);
        assert.equal(documento.logo, clave);
        assert.equal(documento.empresa, empresa);
        assert.ok(documento.cuerpo.includes(empresa));
        assert.doesNotMatch(documento.cuerpo, /\{\{/);
        if (codigo === 'culminacion') {
          assert.match(documento.cuerpo, /31 de diciembre de 2026/);
          assert.doesNotMatch(documento.cuerpo, /3 de noviembre de 2026/);
        }
      }
    }
  }
});

test('constancia y culminación conservan los cambios generales y permiten una plantilla propia por empresa', async () => {
  for (const codigo of ['constancia_practicas', 'culminacion']) {
    await guardarPlantilla(codigo, { titulo: 'Documento general', cuerpo: 'General para {{trabajador}} de {{empresa}}.' });
    assert.match((await preparar(payload({ codigo }))).cuerpo, /^General para/);
    const plantilla = await guardarPlantilla(`${codigo}_sbss`, {
      titulo: 'Documento de {{empresa}}', cuerpo: 'Texto exclusivo para {{trabajador}} de {{empresa}}.'
    });
    const documento = await preparar(payload({ codigo }));
    assert.match(documento.cuerpo, /^Texto exclusivo para/);
    assert.equal(documento.revision_plantilla, plantilla.revision);
    estructura.empresa = 'Nanas & Amas del Norte S.A.C.';
    assert.match((await preparar(payload({ codigo }))).cuerpo, /^General para/);
    estructura.empresa = 'SBSS OUTSOURCING S.A.C.';
  }
});

test('rechaza mezclar la empresa del colaborador o plantillas de otra empresa en los tres documentos', async () => {
  for (const codigo of ['aceptacion', 'constancia_practicas', 'culminacion']) {
    const prefijo = codigo === 'aceptacion' ? 'carta_aceptacion' : codigo;
    await assert.rejects(preparar(payload({ codigo, modelo_id: `${prefijo}_nanas` })), { status: 400 });
    empleado.empresa_id = 11;
    await assert.rejects(preparar(payload({ codigo })), error => error.status === 400 && /empresa registrada/.test(error.message));
    empleado.empresa_id = 10;
  }
});
