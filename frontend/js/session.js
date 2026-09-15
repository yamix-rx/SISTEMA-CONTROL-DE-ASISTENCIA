// La API decide el panel y los permisos; el almacenamiento local sólo conserva la sesión.
(function () {
  'use strict';

  const API_BASE = 'http://localhost:3000/api';
  const nativeFetch = window.fetch.bind(window);
  const domReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  const pages = {
    'dashboard.html': 'dashboard', 'recursoshumanos.html': 'rrhh',
    'empresas.html': 'empresas', 'fichaindividual.html': 'personal',
    'documentos.html': 'documentos', 'contratos.html': 'contratos',
    'capacitaciones.html': 'capacitaciones', 'horarios.html': 'horarios', 'registros.html': 'asistencia',
    'reportes.html': 'reportes', 'mipanel.html': 'mi-panel'
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

  function logout() {
    verifiedSession = null;
    localStorage.removeItem('sbss_token');
    localStorage.removeItem('sbss_usuario');
    localStorage.removeItem('sbss_acceso');
    navigate('login.html');
  }

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
    if (name) name.textContent = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
    if (role) role.textContent = usuario.rol;
    if (avatar) avatar.textContent = (usuario.nombres || 'U').charAt(0).toUpperCase();
    document.querySelectorAll('#btnCerrarSesion, [data-logout]').forEach(button => { button.onclick = logout; });
  }

  async function verifySession() {
    showStatus('Verificando tu acceso…');
    const token = localStorage.getItem('sbss_token');
    if (!token) { logout(); return null; }
    try {
      const response = await nativeFetch(`${API_BASE}/auth/perfil`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      });
      if (response.status === 401 || response.status === 403) { logout(); return null; }
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

  const session = { API_BASE, ready: null, logout, get current() { return verifiedSession; } };
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
    if (response.status === 401) logout();
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
