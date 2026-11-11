'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'js/session.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/session.css'), 'utf8');
const inicio = js.indexOf('  function nombreVisible(usuario)');
const fin = js.indexOf('  function configureNavigation(session)');

class Nodo {
  constructor(tag, id = '') {
    this.tag = tag;
    this.id = id;
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.className = '';
    this.textContent = '';
  }
  append(...nodos) {
    for (const nodo of nodos) {
      if (nodo.parentElement) nodo.remove();
      this.children.push(nodo);
      nodo.parentElement = this;
    }
  }
  insertBefore(nodo, referencia) {
    if (nodo.parentElement) nodo.remove();
    const indice = this.children.indexOf(referencia);
    this.children.splice(indice < 0 ? this.children.length : indice, 0, nodo);
    nodo.parentElement = this;
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  contains(nodo) { return this === nodo || this.children.some(hijo => hijo.contains(nodo)); }
  remove() {
    if (!this.parentElement) return;
    const hermanos = this.parentElement.children;
    hermanos.splice(hermanos.indexOf(this), 1);
    this.parentElement = null;
  }
  replaceWith(nuevo) {
    const hermanos = this.parentElement.children;
    hermanos[hermanos.indexOf(this)] = nuevo;
    nuevo.parentElement = this.parentElement;
    this.parentElement = null;
  }
  querySelector(query) {
    const selectores = query.split(',').map(x => x.trim());
    const recorrer = nodo => {
      for (const selector of selectores) {
        if (selector.startsWith('#') && nodo.id === selector.slice(1)) return nodo;
        if (selector.startsWith('.') && nodo.className.split(/\s+/).includes(selector.slice(1))) return nodo;
      }
      for (const hijo of nodo.children) {
        const hallado = recorrer(hijo);
        if (hallado) return hallado;
      }
      return null;
    };
    return recorrer(this);
  }
}

test('todas las pantallas protegidas comparten el script central de sesión', () => {
  const archivos = fs.readdirSync(root).filter(x => x.endsWith('.html') &&
    !['login.html', 'index.html', 'cambiar-clave.html'].includes(x));
  assert.ok(archivos.length >= 10);
  for (const archivo of archivos) {
    const html = fs.readFileSync(path.join(root, archivo), 'utf8');
    assert.match(html, /src="js\/session\.js"/, archivo);
    assert.match(html, /href="css\/session\.css"/, archivo);
  }
  assert.match(css, /header\.sbss-header #btnCerrarSesion\.sbss-session-account-logout/);
  assert.match(css, /header\.topbar #logoutButton\.sbss-session-account-logout/);
});

test('la cabecera compartida normaliza todas las variantes sin perder el filtro de empresas', () => {
  assert.ok(inicio !== -1 && fin > inicio);
  const codigo = js.slice(inicio, fin);
  for (const variante of ['empresa', 'modulo', 'auditoria', 'practicante', 'administracion']) {
    const header = new Nodo('header');
    const personal = variante === 'practicante';
    const nombre = new Nodo('strong', personal ? 'accountName' : 'nombreUsuarioSesion');
    const rol = new Nodo('span', personal ? 'accountRole' : 'rolUsuarioSesion');
    const avatar = new Nodo('span', personal ? 'accountInitials' : 'avatarLetra');
    const salir = new Nodo('button', personal ? 'logoutButton' : 'btnCerrarSesion');
    const detalles = new Nodo('div');
    detalles.append(nombre, rol);
    const marca = new Nodo('a');
    let filtro = null;

    if (variante === 'empresa') {
      const fila = new Nodo('div');
      const derecha = new Nodo('div');
      const anterior = new Nodo('div');
      filtro = new Nodo('label', 'empresaGlobal');
      anterior.append(avatar, detalles, salir);
      derecha.append(filtro, anterior);
      fila.append(marca, derecha);
      header.append(fila);
    } else if (variante === 'modulo') {
      header.append(marca, detalles, avatar, salir);
    } else if (variante === 'auditoria') {
      header.append(marca, detalles, avatar);
    } else {
      const anterior = new Nodo('div');
      anterior.append(avatar, detalles, salir);
      header.append(marca, anterior);
    }

    const document = {
      querySelector: () => header,
      createElement: tag => new Nodo(tag),
      createElementNS: (_ns, tag) => new Nodo(tag)
    };
    const crear = new Function('document', 'currentPage', 'window', codigo + 'return unificarCabecera;');
    const pagina = variante === 'administracion' ? 'administracion.html' : personal ? 'mipanel.html' : 'dashboard.html';
    const window = { location: { hash: '' }, addEventListener() {} };
    const render = crear(document, pagina, window);
    render({ nombres: 'Admin', apellidos: 'SBSS', rol: 'Administrador General' });

    const cuenta = header.querySelector('.sbss-session-account');
    assert.ok(cuenta, variante);
    const boton = header.querySelector(personal ? '#logoutButton' : '#btnCerrarSesion');
    assert.ok(cuenta.contains(boton), variante);
    assert.equal(boton.attributes['aria-label'], 'Cerrar sesión');
    assert.ok(boton.children.some(hijo => hijo.tag === 'svg'));
    assert.ok(boton.children.some(hijo => hijo.tag === 'span' && hijo.textContent === 'Cerrar sesión'));
    const nombreVisible = header.querySelector(personal ? '#accountName' : '#nombreUsuarioSesion');
    if (variante === 'administracion') {
      assert.equal(nombreVisible.textContent, 'Admin SBSS');
      assert.ok(header.querySelector(personal ? '#accountInitials' : '#avatarLetra'));
    } else {
      assert.equal(nombreVisible, null, 'no exponer datos del administrador en ' + variante);
      assert.equal(header.querySelector(personal ? '#accountInitials' : '#avatarLetra'), null);
      assert.equal(header.querySelector(personal ? '#accountRole' : '#rolUsuarioSesion'), null);
    }
    assert.ok(header.contains(marca), 'conservar logotipo: ' + variante);
    if (filtro) assert.ok(header.contains(filtro), 'conservar selector de empresa');
    render({ nombres: 'Admin', apellidos: 'SBSS', rol: 'Administrador General' });
    assert.equal(header.querySelector('.sbss-session-account'), cuenta, 'sin duplicar controles: ' + variante);
  }
});

test('la identidad administrativa solo se muestra en la sección Usuarios de configuración', () => {
  const header = new Nodo('header');
  const marca = new Nodo('a');
  const cuentaAnterior = new Nodo('div');
  const avatar = new Nodo('span', 'avatarLetra');
  const detalles = new Nodo('div');
  detalles.append(new Nodo('strong', 'nombreUsuarioSesion'), new Nodo('span', 'rolUsuarioSesion'));
  const salir = new Nodo('button', 'btnCerrarSesion');
  cuentaAnterior.append(avatar, detalles, salir);
  header.append(marca, cuentaAnterior);
  const document = {
    querySelector: () => header,
    createElement: tag => new Nodo(tag),
    createElementNS: (_ns, tag) => new Nodo(tag)
  };
  const eventos = {};
  const window = {
    location: { hash: '#areas' },
    addEventListener: (evento, callback) => { eventos[evento] = callback; }
  };
  const codigo = js.slice(inicio, fin);
  const render = new Function('document', 'currentPage', 'window', codigo + 'return unificarCabecera;')
    (document, 'administracion.html', window);
  render({ nombres: 'Admin', apellidos: 'SBSS', rol: 'Administrador General' });
  assert.equal(header.querySelector('#nombreUsuarioSesion'), null);
  assert.ok(header.querySelector('#btnCerrarSesion'));
  window.location.hash = '#cuentas';
  eventos.hashchange();
  assert.equal(header.querySelector('#nombreUsuarioSesion').textContent, 'Admin SBSS');
  assert.ok(header.querySelector('#avatarLetra'));
  window.location.hash = '#areas';
  eventos.hashchange();
  assert.equal(header.querySelector('#nombreUsuarioSesion'), null);
  assert.ok(header.querySelector('#btnCerrarSesion'));
});

test('el botón superior sigue usando el logout delegado y no depende de iconos externos', () => {
  assert.match(js, /closest\?\.\('#btnCerrarSesion, #logoutButton, \[data-logout\]'\)/);
  assert.match(js, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/);
  assert.match(js, /unificarCabecera\(data\.usuario\)/);
  assert.match(js, /auth\/perfil\?contexto=usuarios/);
  assert.match(js, /window\.location\.hash === '#cuentas'/);
  assert.match(js, /window\.addEventListener\('hashchange'/);
  assert.match(js, /salir\.append\(svg, texto\)/);
});
