// Utilidades de PDF para reemplazar un membrete sin moverlo ni deformarlo.
function cajaLogoOriginal(doc, archivoOriginal, { x, y, width }) {
  const original = doc.openImage(archivoOriginal);
  return { x, y, width, height: width * original.height / original.width };
}

function dibujarLogoEnCaja(doc, logo, caja, { horizontal = 'left', vertical = 'top' } = {}) {
  if (!logo || !caja || !(caja.width > 0) || !(caja.height > 0)) return null;
  const imagen = doc.openImage(logo);
  const escala = Math.min(caja.width / imagen.width, caja.height / imagen.height);
  const width = imagen.width * escala;
  const height = imagen.height * escala;
  const x = caja.x + (horizontal === 'center' ? (caja.width - width) / 2 : horizontal === 'right' ? caja.width - width : 0);
  const y = caja.y + (vertical === 'center' ? (caja.height - height) / 2 : vertical === 'bottom' ? caja.height - height : 0);
  doc.image(logo, x, y, { width, height });
  return { x, y, width, height };
}

module.exports = { cajaLogoOriginal, dibujarLogoEnCaja };
