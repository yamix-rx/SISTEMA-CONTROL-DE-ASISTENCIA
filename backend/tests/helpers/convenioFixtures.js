const { catalogoModelos } = require('../../services/documentoModelosService');

function convenio(clave = 'sistemas', codigo = 'convenio_pasantia', cambios = {}) {
  const modelo = catalogoModelos().find(item => item.id === `${codigo === 'plan_capacitacion' ? 'plan' : 'convenio'}_${clave}`);
  const campos = {
    ...modelo.datos_predeterminados,
    empresa: 'EMPRESA DE DEMOSTRACIÓN S.A.C.', ruc: '20000000001',
    empresa_direccion: 'Av. Ejemplo 123, Trujillo', actividad_economica: 'Servicios empresariales y tecnológicos',
    trabajador: 'ESTUDIANTE DE DEMOSTRACIÓN', documento: 'DNI 00000000',
    representante: 'REPRESENTANTE DE DEMOSTRACIÓN', representante_documento: '00000001',
    representante_cargo: 'Gerente General', supervisor: 'SUPERVISOR DE DEMOSTRACIÓN', supervisor_telefono: '900 000 000',
    direccion: 'Jr. Ejemplo 456, Trujillo', fecha_nacimiento: '1 de enero de 2004',
    fecha_ingreso: '1 de septiembre de 2026', fecha_finalizacion: '30 de noviembre de 2026',
    fecha: '28 de agosto de 2026', horario: 'Lunes a viernes, de 08:00 a 13:00 horas.',
    ...cambios
  };
  return { ...modelo, ...campos, firma: null, firmante_empresa: campos.representante,
    cuerpo: modelo.cuerpo.replace(/\{\{(\w+)\}\}/g, (_, campo) => campos[campo] || '') };
}

module.exports = { convenio };
