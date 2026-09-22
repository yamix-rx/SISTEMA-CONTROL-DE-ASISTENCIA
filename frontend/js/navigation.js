// Menú común de gestión: la sesión verificada determina los enlaces disponibles.
(function () {
  'use strict';

  const icons = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    empresas: '<rect x="4" y="7" width="7" height="14" rx="1"/><path d="M11 21h9V3H9v4M7 11v1m0 3v1m8-9h1m-1 4h1m-1 4h1m-1 4h1"/>',
    personal: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
    practicantes: '<path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7c3 3 9 3 12 0v-7M22 8v8"/>',
    permisos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5 3 3 5-5"/>',
    generar: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 15h8m-4-4v8"/>',
    documentos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h8"/>',
    contratos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6M14 2v6h6V8l-6-6M14 18l3 3 5-6"/>',
    capacitaciones: '<path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c3 3 9 3 12 0v-6M22 9v7"/>',
    horarios: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    asistencia: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    reportes: '<path d="M4 20V10m5 10V6m5 14v-7m5 7V3M3 20h18"/>',
    auditoria: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    cerrar: '<path d="m14 6-6 6 6 6"/>',
    abrir: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };

  function icon(name) {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + icons[name] + '</svg>';
    return wrapper.firstElementChild;
  }

  function desktopHidden() {
    try { return localStorage.getItem('sbss_sidebar') === 'oculto'; }
    catch (_) { return false; }
  }

  function filename(path) {
    return decodeURIComponent(new URL(path, location.href).pathname.split('/').pop() || '').toLowerCase();
  }

  function render(session) {
    const sidebar = document.getElementById('sidebarMenu');
    if (!sidebar || !session?.acceso) return;
    const allowed = new Set(session.acceso.modulos || []);
    const panel = session.acceso.panel;
    const currentPage = filename(location.pathname);
    const params = new URLSearchParams(location.search);
    const requestedView = params.get('vista') || (currentPage === 'documentos.html' && params.has('generar') ? 'generar' : '');
    const availableViews = { 'fichaindividual.html': 'practicantes', 'registros.html': 'permisos', 'documentos.html': 'generar' };
    const currentView = availableViews[currentPage] === requestedView ? requestedView : '';
    const homeLabel = filename(panel) === 'recursoshumanos.html' ? 'Inicio RRHH'
      : filename(panel) === 'dashboard.html' ? 'Dashboard' : 'Mi inicio';
    const groups = [
      { links: [
        { label: homeLabel, href: panel, icon: 'dashboard', primary: true },
        { label: 'Empresas', href: 'empresas.html', icon: 'empresas', module: 'empresas', primary: true }
      ] },
      { label: 'Gestión de personal', id: 'sbss-menu-personal', links: [
        { label: 'Registro Personal', href: 'FichaIndividual.html', icon: 'personal', module: 'personal', primary: true },
        { label: 'Practicantes', href: 'FichaIndividual.html?vista=practicantes', view: 'practicantes', icon: 'practicantes', module: 'personal', primary: true },
        { label: 'Documentos', href: 'Documentos.html', icon: 'documentos', module: 'documentos', primary: true },
        { label: 'Generar documentos', href: 'Documentos.html?vista=generar', view: 'generar', icon: 'generar', module: 'documentos', primary: true },
        { label: 'Contratos', href: 'Contratos.html', icon: 'contratos', module: 'contratos', primary: true },
        { label: 'Capacitaciones', href: 'Capacitaciones.html', icon: 'capacitaciones', module: 'capacitaciones', primary: true }
      ] },
      { label: 'Control y reportes', id: 'sbss-menu-control', links: [
        { label: 'Horarios', href: 'Horarios.html', icon: 'horarios', module: 'horarios', primary: true },
        { label: 'Asistencia', href: 'Registros.html', icon: 'asistencia', module: 'asistencia', primary: true },
        { label: 'Permisos', href: 'Registros.html?vista=permisos', view: 'permisos', icon: 'permisos', module: 'asistencia', primary: true },
        { label: 'Reportes', href: 'Reportes.html', icon: 'reportes', module: 'reportes', primary: true },
        { label: 'Auditoría', href: 'Auditoria.html', icon: 'auditoria', module: 'auditoria', primary: true },
        { label: 'Usuarios y configuración', href: 'Administracion.html', icon: 'personal', module: 'administracion', primary: true }
      ] }
    ];
    const heading = document.createElement('div');
    heading.className = 'sbss-sidebar-heading';
    const title = document.createElement('span');
    title.textContent = 'Menú de módulos';
    const close = document.createElement('button');
    close.id = 'btnCerrarSidebar';
    close.type = 'button';
    close.title = 'Ocultar menú lateral';
    close.setAttribute('aria-label', 'Ocultar menú lateral');
    close.setAttribute('aria-controls', 'sidebarMenu');
    close.appendChild(icon('cerrar'));
    heading.append(title, close);
    const nav = document.createElement('nav');
    nav.className = 'sbss-navigation';
    nav.setAttribute('aria-label', 'Módulos del sistema');
    let currentAssigned = false;
    groups.forEach(group => {
      const permitted = group.links.filter(link => !link.module || allowed.has(link.module));
      if (!permitted.length) return;
      const section = document.createElement('div');
      section.className = 'sbss-nav-group';
      if (group.label) {
        section.setAttribute('role', 'group');
        section.setAttribute('aria-labelledby', group.id);
        const label = document.createElement('p');
        label.className = 'sbss-nav-label';
        label.id = group.id;
        label.textContent = group.label;
        section.appendChild(label);
      }
      permitted.forEach(item => {
        const link = document.createElement('a');
        link.className = 'sbss-nav-link';
        link.setAttribute('href', item.href);
        if (item.module) link.dataset.module = item.module;
        if (!currentAssigned && item.primary && filename(item.href) === currentPage && (item.view || '') === currentView) {
          link.setAttribute('aria-current', 'page');
          currentAssigned = true;
        }
        const label = document.createElement('span');
        label.textContent = item.label;
        link.append(icon(item.icon), label);
        section.appendChild(link);
      });
      nav.appendChild(section);
    });
    sidebar.replaceChildren(heading, nav);
    sidebar.setAttribute('aria-label', 'Menú de módulos');
    // Se aplica antes de mostrar la página para evitar un parpadeo del menú en móvil.
    const hidden = window.matchMedia('(max-width: 768px)').matches || desktopHidden();
    sidebar.classList.toggle('sidebar-oculto', hidden);
    sidebar.inert = hidden;
    sidebar.setAttribute('aria-hidden', String(hidden));
    const open = document.getElementById('btnAbrirSidebar');
    if (open) {
      open.replaceChildren(icon('abrir'));
      open.classList.toggle('hidden', !hidden);
      open.setAttribute('aria-controls', 'sidebarMenu');
      open.setAttribute('aria-label', 'Mostrar menú lateral');
      open.setAttribute('aria-expanded', String(!hidden));
      open.type = 'button';
    }
    sidebar.dataset.sbssRendered = 'true';
  }

  window.SBSSNavigation = { render, desktopHidden };
})();
