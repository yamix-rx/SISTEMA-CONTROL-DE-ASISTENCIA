// Contenidos compartidos por las plantillas generales y sus variantes por empresa.
module.exports = Object.freeze({
  constancia_practicas: {
    nombre: 'Constancia de prácticas',
    titulo: 'CONSTANCIA DE PRÁCTICAS',
    cuerpo: '{{lugar_fecha}}\n\n{{empresa}}, con RUC {{ruc}}, deja constancia de que {{trabajador}}, identificado(a) con {{documento}}, realiza prácticas en el área de {{area}}, desempeñando el cargo de {{cargo}}.\n\n{{formacion_academica}}\n\nFecha de inicio: {{fecha_ingreso}}.\nHoras de prácticas realizadas: {{horas}} horas.\n\nSe expide la presente constancia a solicitud del interesado(a), para los fines que estime conveniente.\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  },
  culminacion: {
    nombre: 'Carta de culminación de prácticas',
    titulo: 'CARTA DE CULMINACIÓN DE PRÁCTICAS',
    cuerpo: '{{lugar_fecha}}\n\n{{empresa}}, con RUC {{ruc}}, hace constar que {{trabajador}}, identificado(a) con {{documento}}, culminó sus prácticas en el área de {{area}}, desempeñando el cargo de {{cargo}}.\n\n{{formacion_academica}}\n\nFecha de inicio: {{fecha_ingreso}}.\nFecha de finalización: {{fecha_finalizacion}}.\nTotal de horas de prácticas: {{horas}} horas.\n\nSe extiende la presente para los fines que el interesado(a) considere pertinentes.\n\nAtentamente,\n\n\n________________________________\n{{supervisor}}\nFirma del responsable'
  }
});
