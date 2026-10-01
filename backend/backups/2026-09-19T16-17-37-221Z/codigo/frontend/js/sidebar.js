// Apertura accesible del menú común en escritorio y móvil.
(function () {
  'use strict';

  async function initialize() {
    const session = await window.SBSSSession.ready;
    if (!session) return;
    const sidebar = document.getElementById('sidebarMenu');
    if (!sidebar || !window.SBSSNavigation) return;
    if (!sidebar.dataset.sbssRendered) window.SBSSNavigation.render(session);
    const open = document.getElementById('btnAbrirSidebar');
    const close = document.getElementById('btnCerrarSidebar');
    if (!open || !close) return;
    const mobile = window.matchMedia('(max-width: 768px)');
    const backdrop = document.createElement('div');
    backdrop.className = 'sbss-sidebar-backdrop';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    sidebar.after(backdrop);

    const background = [document.querySelector('.sbss-header'),
      sidebar.parentElement.querySelector(':scope > main')].filter(Boolean);
    const previousInert = new Map();
    let isHidden = sidebar.classList.contains('sidebar-oculto');

    function setHidden(hidden, { persist = false, focus = false } = {}) {
      isHidden = hidden;
      sidebar.classList.toggle('sidebar-oculto', hidden);
      sidebar.setAttribute('aria-hidden', String(hidden));
      sidebar.inert = hidden;
      open.classList.toggle('hidden', !hidden);
      open.setAttribute('aria-expanded', String(!hidden));
      const modal = mobile.matches && !hidden;
      backdrop.hidden = !modal;
      document.body.classList.toggle('sbss-mobile-menu-open', modal);
      if (modal) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        background.forEach(element => {
          if (!previousInert.has(element)) previousInert.set(element, element.inert);
          element.inert = true;
        });
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        previousInert.forEach((value, element) => { element.inert = value; });
        previousInert.clear();
      }
      if (persist && !mobile.matches) {
        try { localStorage.setItem('sbss_sidebar', hidden ? 'oculto' : 'visible'); }
        catch (_) { /* El menú funciona también sin almacenamiento local. */ }
      }
      if (focus) (hidden ? open : close).focus({ preventScroll: true });
    }

    open.addEventListener('click', () => setHidden(false, { persist: true, focus: true }));
    close.addEventListener('click', () => setHidden(true, { persist: true, focus: true }));
    backdrop.addEventListener('click', () => setHidden(true, { focus: true }));
    sidebar.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (link && mobile.matches && link.getAttribute('href') !== '#') {
        setHidden(true, { focus: true });
      }
    });

    document.addEventListener('keydown', event => {
      if (isHidden) return;
      if (event.key === 'Escape' && (mobile.matches || sidebar.contains(document.activeElement))) {
        event.preventDefault();
        setHidden(true, { persist: true, focus: true });
      } else if (mobile.matches && event.key === 'Tab') {
        const focusable = Array.from(sidebar.querySelectorAll('a[href], button:not([disabled])'))
          .filter(element => !element.hidden && !element.hasAttribute('data-sbss-denied'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Actuar sólo al cruzar el ancho móvil evita cierres mientras se desplaza la pantalla.
    mobile.addEventListener('change', () => {
      const restoreFocus = sidebar.contains(document.activeElement);
      setHidden(mobile.matches || window.SBSSNavigation.desktopHidden(), { focus: restoreFocus });
    });
    setHidden(isHidden);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
