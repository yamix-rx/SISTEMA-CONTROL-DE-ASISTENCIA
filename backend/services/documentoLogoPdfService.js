'use strict';

function dibujarLogoPersonalizado(doc, documento, {
  x = 0, y = 0, maxWidth = 180, maxHeight = 70, align = 'center'
} = {}) {
  const buffer = documento?.logo_personalizado_buffer;
  if (!Buffer.isBuffer(buffer) || !buffer.length) return 0;
  const imagen = doc.openImage(buffer);
  const escala = Math.min(maxWidth / imagen.width, maxHeight / imagen.height, 1);
  const width = imagen.width * escala;
  const height = imagen.height * escala;
  const left = align === 'left' ? x : align === 'right' ? x + maxWidth - width : x + (maxWidth - width) / 2;
  const top = y + (maxHeight - height) / 2;
  doc.image(buffer, left, top, { width, height });
  return height;
}

const CERTIFICADOS = Object.freeze({
  sbss: { mask: [38, 12, 190, 84], box: [48, 18, 170, 70] },
  nanas: { mask: [438, 12, 145, 70], box: [446, 16, 130, 60] },
  silsan: { mask: [10, 20, 280, 105], box: [18, 27, 260, 90] },
  camara: { mask: [20, 12, 330, 105], box: [28, 20, 310, 88] },
  ong: { mask: [710, 10, 125, 118], box: [718, 16, 108, 106] }
});

function dibujarLogoCertificado(doc, documento, marca) {
  if (!Buffer.isBuffer(documento?.logo_personalizado_buffer)) return 0;
  const layout = CERTIFICADOS[marca];
  if (!layout) {
    return dibujarLogoPersonalizado(doc, documento, {
      x: (doc.page.width - 190) / 2, y: 12, maxWidth: 190, maxHeight: 72
    });
  }
  const [maskX, maskY, maskWidth, maskHeight] = layout.mask;
  doc.save().fillColor('#ffffff').rect(maskX, maskY, maskWidth, maskHeight).fill().restore();
  const [x, y, maxWidth, maxHeight] = layout.box;
  return dibujarLogoPersonalizado(doc, documento, { x, y, maxWidth, maxHeight });
}

module.exports = { dibujarLogoPersonalizado, dibujarLogoCertificado };
