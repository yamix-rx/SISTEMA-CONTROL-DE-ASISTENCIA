(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('formLogin'), fields = $('camposLogin'), button = $('btnIngresar');
  const connection = $('estadoConexion'), message = $('mensajeConexion'), link = $('enlaceServidor'), retry = $('btnReintentarConexion');
  const current = new URL(location.href);
  const canonical = new URL('http://localhost:3000/login.html');
  if (current.protocol === 'http:' || current.protocol === 'https:') {
    canonical.protocol = current.protocol;
    canonical.hostname = current.hostname;
  }
  let serverReady = false, checking = false, submitting = false;
  link.href = canonical.href;
  link.textContent = 'Abrir SBSS: ' + canonical.host;

  function showError(text) { $('mensajeError').textContent = text; $('alertaError').classList.add('show'); }
  async function identifiesServer(origin) {
    try {
      const response = await fetch(origin + '/api/auth/disponibilidad', {
        method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000)
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return false;
      const data = await response.json();
      return data.ok === true && data.servicio === 'sbss-auth';
    } catch { return false; }
  }
  async function checkConnection() {
    if (checking) return;
    checking = true; serverReady = false; fields.disabled = true; button.disabled = true;
    connection.hidden = false; link.hidden = true; retry.hidden = true;
    message.textContent = 'Comprobando conexión con SBSS…';
    try {
      const webOrigin = ['http:', 'https:'].includes(current.protocol);
      if (webOrigin && await identifiesServer(current.origin)) {
        serverReady = true; fields.disabled = false; button.disabled = false; connection.hidden = true;
        return;
      }
      if ((!webOrigin || canonical.origin !== current.origin) && await identifiesServer(canonical.origin)) {
        message.textContent = 'Abriendo el servidor de SBSS…'; link.hidden = false;
        location.replace(canonical.href);
        return;
      }
      message.textContent = 'No se pudo conectar con el servidor de SBSS. Comprueba que esté iniciado y abre la dirección del servidor.';
      link.hidden = false; retry.hidden = false;
    } finally { checking = false; }
  }
  retry.addEventListener('click', checkConnection);
  $('btnTogglePassword').addEventListener('click', () => {
    const visible = $('password').type === 'password';
    $('password').type = visible ? 'text' : 'password';
    $('btnTogglePassword').textContent = visible ? 'Ocultar' : 'Mostrar';
    $('btnTogglePassword').setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    $('btnTogglePassword').setAttribute('aria-pressed', String(visible));
  });

  // Se registra antes de iniciar cualquier consulta; nunca se envían claves por GET.
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!serverReady || submitting) return;
    const email = $('email').value.trim(), password = $('password').value;
    if (!email || !password) { showError('Por favor, complete todos los campos.'); return; }
    submitting = true; button.disabled = true; button.textContent = 'VALIDANDO...';
    $('alertaError').classList.remove('show');
    try {
      const response = await fetch(current.origin + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
        body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(12000)
      });
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('El servidor devolvió una respuesta inesperada. Vuelve a intentar o consulta al administrador.');
      }
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo iniciar sesión. Vuelve a intentar.');
      const panels = ['Dashboard.html', 'RecursosHumanos.html', 'MiPanel.html'];
      if (!data.acceso || !panels.includes(data.acceso.panel) || data.redirectUrl !== data.acceso.panel || typeof data.token !== 'string' || !data.token || !data.usuario) {
        throw new Error('Tu cuenta no tiene un panel habilitado. Contacta al administrador.');
      }
      localStorage.setItem('sbss_token', data.token);
      localStorage.setItem('sbss_usuario', JSON.stringify(data.usuario));
      localStorage.setItem('sbss_acceso', JSON.stringify(data.acceso));
      location.replace(new URL(data.acceso.panel, current.origin + '/').href);
    } catch (error) {
      showError(error.name === 'TypeError' || error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'No se pudo conectar con SBSS. Comprueba que el servidor siga iniciado y vuelve a intentar.'
        : error.name === 'SyntaxError' ? 'El servidor devolvió una respuesta no válida. Consulta al administrador.' : error.message);
    } finally { submitting = false; button.disabled = false; button.textContent = 'INGRESAR'; }
  });
  checkConnection();
})();
