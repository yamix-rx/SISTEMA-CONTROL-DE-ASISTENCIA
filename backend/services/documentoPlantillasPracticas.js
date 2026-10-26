// Contenidos compartidos por las plantillas generales y sus variantes por empresa.
module.exports = Object.freeze({
  constancia_practicas: {
    nombre: 'Constancia de prácticas',
    titulo: 'CONSTANCIA DE PRÁCTICAS',
    cuerpo: '{{lugar_fecha}}\n\n{{empresa}}, con RUC {{ruc}}, deja constancia de que {{trabajador}}, identificado(a) con {{documento}}, realiza prácticas en el área de {{area}}, desempeñando el cargo de {{cargo}}.\n\n{{formacion_academica}}\n\nFecha de inicio: {{fecha_ingreso}}.\nHoras de prácticas realizadas: {{horas}} horas.\n\nSe expide la presente constancia a solicitud del interesado(a), para los fines que estime conveniente.\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  },
  culminacion: {
    nombre: 'Carta de culminación de prácticas',
    titulo: 'CERTIFICADO DE PRÁCTICAS PRE-PROFESIONALES',
    cuerpo: '{{lema_anual}}\n\nSe le otorga a:\n\n{{trabajador}}, identificado(a) con {{documento}}, estudiante de la carrera de {{carrera}} de {{institucion_educativa}}, quien realizó y culminó sus prácticas preprofesionales dentro de nuestra empresa {{empresa}}, con RUC {{ruc}}, en el área de {{area}}, desempeñando el cargo de {{cargo}}, cumpliendo un total de {{horas}} horas de prácticas preprofesionales, las cuales se desarrollaron desde el {{fecha_ingreso}} hasta el {{fecha_finalizacion}}, realizando las siguientes actividades:\n\n{{actividades}}\n\nSe le expide la presente, a solicitud de la parte interesada, para los fines pertinentes.\n\n{{lugar_fecha}}\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}'
  }
});
