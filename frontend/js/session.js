// La API decide el panel y los permisos; el almacenamiento local sólo conserva la sesión.
(function () {
  'use strict';

  const API_BASE = new URL('/api', location.href).href;
  const nativeFetch = window.fetch.bind(window);
  if (!document.querySelector('link[rel="icon"]')) {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.href = 'assets/logo-sbss.png';
    document.head.appendChild(favicon);
  }
  const domReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  const pages = {
    'dashboard.html': 'dashboard', 'recursoshumanos.html': 'rrhh',
    'empresas.html': 'empresas', 'fichaindividual.html': 'personal',
    'documentos.html': 'documentos', 'contratos.html': 'contratos',
    'capacitaciones.html': 'capacitaciones', 'horarios.html': 'horarios', 'registros.html': 'asistencia',
    'reportes.html': 'reportes', 'auditoria.html': 'auditoria', 'mipanel.html': 'mi-panel',
    'administracion.html': 'administracion'
  };
  const currentPage = decodeURIComponent(location.pathname.split('/').pop() || 'index.html').toLowerCase();
  let verifiedSession = null;
  document.documentElement.classList.add('sbss-session-pending');

  // Las pantallas antiguas leen este objeto antes de que termine la verificación.
  try { JSON.parse(localStorage.getItem('sbss_usuario') || '{}'); }
  catch (_) { localStorage.removeItem('sbss_usuario'); }

  function navigate(file) {
    const destination = new URL(file, location.href).href;
    if (window.parent !== window) {
      try { window.top.location.replace(destination); return; } catch (_) { /* Abrir en el marco actual. */ }
    }
    location.replace(destination);
  }

  let closingSession = false;
  async function logout(revoke = true) {
    if (closingSession) return false;
    closingSession = true;
    // Los dos botones usan una sola operación, evitando clics repetidos.
    document.querySelectorAll('#btnCerrarSesion, #logoutButton, [data-logout]').forEach(button => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    });
    const token = localStorage.getItem('sbss_token');
    let serverRevoked = !token || revoke === false;
    if (token && revoke !== false) {
      try {
        const response = await nativeFetch(`${API_BASE}/auth/logout`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store', signal: AbortSignal.timeout(10000)
        });
        if (!response.ok && response.status !== 401) throw new Error('Cierre no confirmado');
        serverRevoked = true;
      } catch (_) {
        // El cierre local no debe quedarse bloqueado si falla la red o la API.
        try {
          sessionStorage.setItem('sbss_logout_warning',
            'Se cerró el acceso en este navegador, pero no se pudo confirmar la revocación en el servidor. Si compartiste tu sesión, cambia la contraseña.');
        } catch (_) { /* Se puede continuar sin almacenamiento de sesión. */ }
      }
    }
    verifiedSession = null;
    localStorage.removeItem('sbss_token');
    localStorage.removeItem('sbss_usuario');
    localStorage.removeItem('sbss_acceso');
    navigate('login.html');
    return serverRevoked;
  }

  // Captura también botones creados después de verificar la sesión (menú lateral).
  // Evita depender de onclick y de manejadores particulares de cada módulo.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#btnCerrarSesion, #logoutButton, [data-logout]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    void logout();
  }, true);

  async function showStatus(message, retry = false) {
    await domReady;
    let status = document.querySelector('.sbss-session-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'sbss-session-status';
      status.setAttribute('role', 'status');
      document.body.appendChild(status);
    }
    status.replaceChildren();
    const brand = document.createElement('strong');
    brand.textContent = 'SBSS';
    const text = document.createElement('p');
    text.textContent = message;
    status.append(brand, text);
    if (retry) {
      const button = document.createElement('button');
      button.textContent = 'Volver a intentar';
      button.onclick = () => location.reload();
      const exit = document.createElement('button');
      exit.textContent = 'Ir al inicio de sesión';
      exit.onclick = logout;
      status.append(button, exit);
    }
  }

  function abbreviateUserName(usuario) {
    return [usuario.nombres, usuario.apellidos]
      .map(value => (value || '').trim().split(/\s+/).filter(Boolean)
        .map(part => part.charAt(0).toUpperCase())
        .join(''))
      .filter(Boolean).join('');
  }


  function nombreVisible(usuario) {
    return [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim()
      || usuario.email || 'Mi cuenta';
  }

  function iniciales(usuario) {
    return [usuario.nombres, usuario.apellidos]
      .map(text => String(text || '').trim().charAt(0).toUpperCase()).join('') || 'U';
  }

  // Todas las pantallas usan el mismo bloque de cuenta y un SVG propio;
  // esto no depende de que una biblioteca de iconos se inicialice.
  function unificarCabecera(usuario) {
    const header = document.querySelector('header.sbss-header, header.topbar');
    if (!header || header.querySelector('.sbss-session-account')) return;
    const nombreAnterior = header.querySelector('#nombreUsuarioSesion, #accountName');
    const rolAnterior = header.querySelector('#rolUsuarioSesion, #accountRole');
    const avatarAnterior = header.querySelector('#avatarLetra, #accountInitials');
    const botonAnterior = header.querySelector('#btnCerrarSesion, #logoutButton');
    const partes = [nombreAnterior, rolAnterior, avatarAnterior, botonAnterior].filter(Boolean);
    if (!partes.length) return;

    const personal = currentPage === 'mipanel.html';
    const mostrarDatosCuenta = usuario.rol !== 'Administrador General' || currentPage === 'administracion.html';
    const cuenta = document.createElement('div');
    cuenta.className = 'sbss-session-account';
    cuenta.setAttribute('aria-label', 'Cuenta y sesión actual');

    const avatar = document.createElement('span');
    avatar.id = personal ? 'accountInitials' : 'avatarLetra';
    avatar.className = 'sbss-session-account-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = iniciales(usuario);

    const detalles = document.createElement('div');
    detalles.className = 'sbss-session-account-details';
    const nombre = document.createElement('strong');
    nombre.id = personal ? 'accountName' : 'nombreUsuarioSesion';
    nombre.className = 'sbss-session-account-name';
    nombre.textContent = nombreVisible(usuario);
    nombre.title = nombreVisible(usuario);
    const rol = document.createElement('span');
    rol.id = personal ? 'accountRole' : 'rolUsuarioSesion';
    rol.className = 'sbss-session-account-role';
    rol.textContent = usuario.rol || '';
    detalles.append(nombre, rol);

    const salir = document.createElement('button');
    salir.id = personal ? 'logoutButton' : 'btnCerrarSesion';
    salir.type = 'button';
    salir.className = 'sbss-session-account-logout';
    salir.setAttribute('aria-label', 'Cerrar sesión');
    salir.title = 'Cerrar sesión';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const marco = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    marco.setAttribute('d', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4');
    const flecha = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flecha.setAttribute('d', 'm16 17 5-5-5-5M21 12H9');
    svg.append(marco, flecha);
    const texto = document.createElement('span');
    texto.textContent = 'Cerrar sesión';
    salir.append(svg, texto);
    if (mostrarDatosCuenta) cuenta.append(avatar, detalles, salir);
    else cuenta.append(salir);

    // Si la cabecera tiene un grupo de cuenta ya formado, se sustituye entero.
    // Si el nombre, avatar y botón están sueltos (p. ej. Auditoría),
    // se retiran solo esos elementos; nunca se quitan filtros de empresa.
    let grupo = (botonAnterior || avatarAnterior || nombreAnterior).parentElement;
    while (grupo && grupo !== header && !partes.every(elemento => grupo.contains(elemento))) {
      grupo = grupo.parentElement;
    }
    if (grupo && grupo !== header) {
      grupo.replaceWith(cuenta);
    } else {
      const bloques = new Set();
      partes.forEach(elemento => {
        let bloque = elemento;
        while (bloque.parentElement && bloque.parentElement !== header) bloque = bloque.parentElement;
        if (bloque.parentElement === header) bloques.add(bloque);
      });
      bloques.forEach(bloque => bloque.remove());
      header.append(cuenta);
    }
  }

  function configureNavigation(session) {
    const { usuario, acceso } = session;
    const allowed = new Set(acceso.modulos);
    const permissions = new Set(acceso.permisos || []);
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const url = new URL(href, location.href);
      const filename = decodeURIComponent(url.pathname.split('/').pop()).toLowerCase();
      if (!pages[filename]) return;
      if (filename === 'dashboard.html' && acceso.panel !== 'Dashboard.html') {
        link.setAttribute('href', acceso.panel);
        const icon = link.querySelector('svg, i');
        link.replaceChildren();
        if (icon) link.appendChild(icon);
        link.appendChild(document.createTextNode('Mi inicio'));
      } else if (!allowed.has(pages[filename])) {
        link.hidden = true;
        link.setAttribute('data-sbss-denied', '');
      } else if (filename === 'empresas.html') {
        link.setAttribute('href', 'empresas.html');
      }
    });
    document.querySelectorAll('[data-permission]').forEach(element => {
      if (!permissions.has(element.dataset.permission)) {
        element.hidden = true;
        element.setAttribute('data-sbss-denied', '');
      }
    });
    const name = document.getElementById('nombreUsuarioSesion');
    const role = document.getElementById('rolUsuarioSesion');
    const avatar = document.getElementById('avatarLetra');
    if (name) {
      name.textContent = nombreVisible(usuario);
      name.title = nombreVisible(usuario);
    }
    if (role) role.textContent = usuario.rol;
    if (avatar) avatar.textContent = iniciales(usuario);
    // El cierre de sesión se gestiona de forma global mediante delegación de eventos.
  }

  async function verifySession() {
    showStatus('Verificando tu acceso…');
    const token = localStorage.getItem('sbss_token');
    if (!token) { logout(false); return null; }
    try {
      const perfilUrl = currentPage === 'administracion.html'
        ? `${API_BASE}/auth/perfil?contexto=usuarios`
        : `${API_BASE}/auth/perfil`;
      const response = await nativeFetch(perfilUrl, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      });
      if (response.status === 401 || response.status === 403) { logout(false); return null; }
      if (!response.ok) throw new Error('No se pudo verificar tu sesión.');
      const data = await response.json();
      if (!data.ok || !data.usuario || !data.acceso || !Array.isArray(data.acceso.modulos)
          || !pages[String(data.acceso.panel).toLowerCase()]
          || !data.acceso.modulos.includes(pages[String(data.acceso.panel).toLowerCase()])) {
        throw new Error('El servidor no devolvió un panel válido para tu cuenta.');
      }
      localStorage.setItem('sbss_usuario', JSON.stringify(data.usuario));
      localStorage.setItem('sbss_acceso', JSON.stringify(data.acceso));
      if (!pages[currentPage] || !data.acceso.modulos.includes(pages[currentPage])) {
        navigate(data.acceso.panel);
        return null;
      }
      await domReady;
      if (window.SBSSNavigation) window.SBSSNavigation.render(data);
      unificarCabecera(data.usuario);
      configureNavigation(data);
      verifiedSession = data;
      document.querySelector('.sbss-session-status')?.remove();
      document.documentElement.classList.remove('sbss-session-pending');
      return data;
    } catch (_) {
      await showStatus('No pudimos comprobar tu acceso. Revisa que el servidor esté encendido y vuelve a intentar.', true);
      return null;
    }
  }

  const session = { API_BASE, ready: null, logout, abbreviateUserName, get current() { return verifiedSession; } };
  window.SBSSSession = session;
  // También protege las peticiones de las pantallas existentes antes de cargar sus datos.
  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (!url.href.startsWith(`${API_BASE}/`)) return nativeFetch(input, init);
    const verified = await session.ready;
    if (!verified) throw new Error('La sesión no está disponible.');
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set('Authorization', `Bearer ${localStorage.getItem('sbss_token')}`);
    const response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401) logout(false);
    return response;
  };
  session.fetch = (...args) => window.fetch(...args);
  session.ready = verifySession();

  window.addEventListener('storage', event => {
    if (event.key === 'sbss_token') {
      document.documentElement.classList.add('sbss-session-pending');
      location.reload();
    }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
