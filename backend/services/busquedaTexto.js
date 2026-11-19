'use strict';

function textoBusqueda(value) {
  return String(value ?? '').trim().toLowerCase();
}

function patronBusqueda(value) {
  return `%${textoBusqueda(value)}%`;
}

module.exports = { textoBusqueda, patronBusqueda };
