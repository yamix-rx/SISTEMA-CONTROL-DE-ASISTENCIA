const { catalogoModelos } = require('../../services/documentoModelosService');

function certificado(clave = 'sbss', cambios = {}) {
  const modelo = catalogoModelos().find(item => item.id === `culminacion_${clave}`);
  const campos = {
    ...modelo.datos_predeterminados,
    empresa: modelo.nombre.split(' · ')[1], ruc: modelo.empresa_ruc,
    trabajador: 'Ana María Prueba Visual', documento: 'DNI 99990001',
    carrera: 'Ingeniería de Sistemas Computacionales', institucion_educativa: 'Universidad Privada del Norte',
    area: 'Sistemas', cargo: 'Practicante de Sistemas', horas: '320',
    fecha_ingreso: '3 de agosto de 2026', fecha_finalizacion: '3 de noviembre de 2026',
    lugar_fecha: 'Trujillo, 3 de noviembre de 2026',
    actividades: '- Brindar soporte a los usuarios en el uso de equipos y herramientas tecnológicas.\n- Apoyar en la organización y gestión de información digital de la empresa.\n- Participar en el mantenimiento y revisión de equipos y sistemas.\n- Apoyar en la identificación y solución de incidencias tecnológicas.\n- Colaborar en la mejora de procesos mediante herramientas tecnológicas.'
  };
  return { ...modelo, ...campos, diseno: 'certificado', firma: clave, firmante_empresa: campos.supervisor,
    cuerpo: modelo.cuerpo.replace(/\{\{(\w+)\}\}/g, (_, key) => campos[key] || ''), ...cambios };
}

module.exports = { certificado };
