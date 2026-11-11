'use strict';

function filtrarSeguimientoPracticas(registros) {
  if (!Array.isArray(registros)) return [];
  return registros.filter(item => {
    const meta = Number(item?.horas_meta);
    const realizadas = Number(item?.horas_realizadas);
    if (!Number.isFinite(meta) || meta <= 0 || !Number.isFinite(realizadas)) return false;
    return realizadas >= meta || realizadas >= meta * 0.8;
  });
}

module.exports = { filtrarSeguimientoPracticas };
