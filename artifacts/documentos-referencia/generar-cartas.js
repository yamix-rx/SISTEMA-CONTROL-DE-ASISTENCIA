const fs = require('node:fs');
const path = require('node:path');
const { catalogoModelos } = require('../../backend/services/documentoModelosService');
const { generarPdfCarta } = require('../../backend/services/documentoCartaPdfService');
const { leerPdf } = require('../../backend/tests/helpers/pdf');

(async () => {
  const nombres = {
    sbss: 'SBSS OUTSOURCING S.A.C.', nanas: 'NANAS & AMAS PERU S.A.C.',
    silsan: 'DROGUERÍA SILSAN S.A.C.', ong: 'MUJER LA EDUCACIÓN ES PODER',
    camara: 'SBSS CÁMARA DE CONCILIACIÓN Y ARBITRAJE DEL PERÚ'
  };
  for (const modelo of catalogoModelos().filter(m => m.codigo === 'aceptacion')) {
    const clave = modelo.logo;
    const campos = { ...modelo.datos_predeterminados, empresa: nombres[clave], ruc: modelo.empresa_ruc,
      trabajador: 'ANA MARÍA EJEMPLO GARCÍA', documento: 'DNI: 00000000',
      fecha: '13 de octubre de 2026', horas: '320', area: 'Área de Sistemas' };
    const documento = { ...modelo, empresa: campos.empresa, firma: clave,
      cuerpo: modelo.cuerpo.replace(/\{\{(\w+)\}\}/g, (_, campo) => campos[campo] || '') };
    const pdf = await generarPdfCarta(documento);
    fs.writeFileSync(path.join(__dirname, `carta-generada-${clave}.pdf`), pdf);
    const { paginas } = leerPdf(pdf);
    console.log(clave, paginas.length, 'página(s)', paginas.map(p => p.imagenes));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
