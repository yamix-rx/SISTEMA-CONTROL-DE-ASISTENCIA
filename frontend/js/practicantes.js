(function () {
  'use strict';

  const API = '/practicantes';
  const state = { pagina: 1, limite: 10, paginas: 1, revision: 0 };
  const AUTO_REFRESH_MS = 30000;
  let refreshTimer = null;
  let refreshing = false;
  const $ = id => document.getElementById(id);
  const estadoLabel = value => ({ activo: 'Activo', inactivo: 'Inactivo', finalizado: 'Finalizado', suspendido: 'Suspendido' }[value] || String(value || '—'));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function fecha(value) {
    if (!value) return '—';
    const [y, m, d] = String(value).slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : String(value);
  }

  const horas = value => (Math.round(Number(value || 0) * 100) / 100).toLocaleString('es-PE', { maximumFractionDigits: 2 });

  async function api(path, options = {}) {
    const response = await fetch(`${window.SBSSSession.API_BASE}${API}${path}`, { ...options, cache: 'no-store' });
    let body = {};
    try { body = await response.json(); } catch (_) { /* sin cuerpo */ }
    if (!response.ok || body.ok === false) throw new Error(body.mensaje || 'No se pudo completar la operación.');
    return body;
  }

  function notice(message, isError = false) {
    const node = $('mensajePracticantes');
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.hidden = false;
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => { node.hidden = true; }, isError ? 7000 : 3500);
  }

  function fillSelect(select, items, first) {
    const current = select.value;
    select.replaceChildren();
    const base = document.createElement('option');
    base.value = '';
    base.textContent = first;
    select.appendChild(base);
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  async function loadCatalogs() {
    const { data } = await api('/catalogos');
    fillSelect($('filtroEmpresaPrac'), data.empresas.map(e => ({ value: e.id, label: e.razon_social })), 'Todas las empresas');
    fillSelect($('filtroEstadoPrac'), data.estados.map(e => ({ value: e, label: estadoLabel(e) })), 'Todos los estados');
  }

  async function loadSummary() {
    const params = new URLSearchParams();
    if ($('filtroEmpresaPrac').value) params.set('empresa_id', $('filtroEmpresaPrac').value);
    const { data: r } = await api(`/resumen?${params}`);
    $('pracTotal').textContent = r.total ?? 0;
    $('pracCompletados').textContent = r.completados ?? 0;
    $('pracPorCompletar').textContent = r.por_completar ?? 0;
    $('pracConvenios').textContent = r.convenios_por_vencer ?? 0;
  }

  function queryString() {
    const params = new URLSearchParams({ pagina: state.pagina, limite: state.limite });
    const campos = { buscar: $('buscarPracticante').value.trim(), empresa_id: $('filtroEmpresaPrac').value,
      estado: $('filtroEstadoPrac').value, avance: $('filtroAvancePrac').value, convenio: $('filtroConvenioPrac').value };
    Object.entries(campos).forEach(([clave, valor]) => { if (valor) params.set(clave, valor); });
    return params.toString();
  }

  function convenioBadge(row) {
    if (!row.fecha_vencimiento_convenio) return '<span class="badge badge-conv-none">Sin fecha</span>';
    const dias = Number(row.dias_convenio);
    if (dias < 0) return `<small>${fecha(row.fecha_vencimiento_convenio)}</small><br><span class="badge badge-conv-vencido">Vencido</span>`;
    if (dias <= 30) return `<small>${fecha(row.fecha_vencimiento_convenio)}</small><br><span class="badge badge-conv-pronto">En ${dias} día${dias === 1 ? '' : 's'}</span>`;
    return `<span class="badge badge-conv-ok">${fecha(row.fecha_vencimiento_convenio)}</span>`;
  }

  function barClass(row) {
    const pct = Number(row.porcentaje_avance || 0);
    return Number(row.horas_meta) > 0 && Number(row.horas_realizadas) >= Number(row.horas_meta) ? 'bar-completado' : pct >= 80 ? 'bar-por_completar' : 'bar-en_curso';
  }

  function renderRows(rows) {
    const body = $('tablaPracticantes');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9" class="table-message">No se encontraron practicantes con los filtros seleccionados.</td></tr>';
      return;
    }
    const start = (state.pagina - 1) * state.limite;
    body.innerHTML = rows.map((row, index) => `
      <tr>
        <td>${start + index + 1}</td>
        <td class="person-cell" data-label="Practicante"><strong>${escapeHtml(row.practicante)}</strong><small>${escapeHtml(row.tipo_documento || 'DNI')} ${escapeHtml(row.numero_documento || 'sin documento')}</small></td>
        <td class="person-cell" data-label="Empresa / área"><strong>${escapeHtml(row.empresa)}</strong><small>${escapeHtml(row.area)} · ${escapeHtml(row.cargo)}</small></td>
        <td class="person-cell" data-label="Carrera / institución"><strong>${escapeHtml(row.carrera || '—')}</strong><small>${escapeHtml(row.institucion_educativa || 'Sin institución')}</small></td>
        <td class="hours-cell" data-label="Horas"><strong>${horas(row.horas_realizadas)} / ${horas(row.horas_meta)} h</strong><small>Faltan ${horas(row.horas_pendientes)} h</small></td>
        <td data-label="Avance"><div class="progress ${barClass(row)}" role="progressbar" aria-label="Avance de ${escapeHtml(row.practicante)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(row.porcentaje_avance || 0)}"><span data-ancho="${Number(row.porcentaje_avance || 0)}"></span></div><span class="progress-text">${Number(row.porcentaje_avance || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })} %</span></td>
        <td data-label="Convenio vence">${convenioBadge(row)}</td>
        <td data-label="Estado"><span class="badge badge-${escapeHtml(row.estado)}">${escapeHtml(estadoLabel(row.estado))}</span></td>
        <td data-label="Ficha"><a class="row-link" href="FichaIndividual.html?empleado_id=${encodeURIComponent(row.empleado_id)}">Ver ficha</a></td>
      </tr>`).join('');
    // Los anchos se aplican por CSSOM, sin atributos style en el HTML generado.
    body.querySelectorAll('[data-ancho]').forEach(node => { node.style.width = `${Math.max(0, Math.min(100, Number(node.dataset.ancho)))}%`; });
  }

  function renderPagination(p) {
    const total = Number(p.total || 0);
    const limit = Number(p.limite || state.limite);
    const start = total ? (p.pagina - 1) * limit + 1 : 0;
    const end = Math.min(total, p.pagina * limit);
    $('contadorPracticantes').textContent = `${total} practicante${total === 1 ? '' : 's'}`;
    $('textoPaginacionPrac').textContent = total ? `Mostrando ${start} a ${end} de ${total} registros` : 'Mostrando 0 registros';
    $('paginaAnteriorPrac').disabled = p.pagina <= 1;
    $('paginaSiguientePrac').disabled = p.pagina >= p.paginas;
    const pages = $('paginasPracticantes');
    pages.replaceChildren();
    for (let i = Math.max(1, p.pagina - 2); i <= Math.min(p.paginas, p.pagina + 2); i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-number${i === p.pagina ? ' active' : ''}`;
      button.textContent = i;
      button.onclick = () => { state.pagina = i; loadList(); };
      pages.appendChild(button);
    }
  }

  async function loadList({ silent = false } = {}) {
    const revision = ++state.revision;
    if (!silent) $('tablaPracticantes').innerHTML = '<tr><td colspan="9" class="table-message">Cargando practicantes...</td></tr>';
    try {
      const result = await api(`/?${queryString()}`);
      if (revision !== state.revision) return;
      state.paginas = result.paginacion?.paginas || 1;
      state.pagina = result.paginacion?.pagina || 1;
      renderRows(result.data || []);
      renderPagination(result.paginacion || { pagina: 1, paginas: 1, total: 0, limite: state.limite });
    } catch (error) {
      if (revision !== state.revision || silent) return;
      $('tablaPracticantes').innerHTML = `<tr><td colspan="9" class="table-message">${escapeHtml(error.message)}</td></tr>`;
      notice(error.message, true);
    }
  }

  async function refreshAutomatically() {
    if (document.hidden || refreshing) return;
    refreshing = true;
    try { await Promise.all([loadSummary(), loadList({ silent: true })]); }
    catch (_) { /* Se reintenta en el próximo intervalo. */ }
    finally { refreshing = false; }
  }

  function search() { state.pagina = 1; loadSummary().catch(error => notice(error.message, true)); loadList(); }

  function bindEvents() {
    $('btnBuscarPrac').addEventListener('click', search);
    $('btnLimpiarPrac').addEventListener('click', () => {
      ['buscarPracticante', 'filtroEmpresaPrac', 'filtroEstadoPrac', 'filtroAvancePrac', 'filtroConvenioPrac'].forEach(id => { $(id).value = ''; });
      search();
    });
    $('buscarPracticante').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
    ['filtroEmpresaPrac', 'filtroEstadoPrac', 'filtroAvancePrac', 'filtroConvenioPrac'].forEach(id => $(id).addEventListener('change', search));
    document.querySelectorAll('[data-resumen-avance]').forEach(card => card.addEventListener('click', () => {
      $('filtroAvancePrac').value = card.dataset.resumenAvance || '';
      $('filtroConvenioPrac').value = card.dataset.resumenConvenio || '';
      search();
    }));
    $('paginaAnteriorPrac').addEventListener('click', () => { if (state.pagina > 1) { state.pagina -= 1; loadList(); } });
    $('paginaSiguientePrac').addEventListener('click', () => { if (state.pagina < state.paginas) { state.pagina += 1; loadList(); } });
  }

  async function init() {
    const session = await window.SBSSSession.ready;
    if (!session) return;
    bindEvents();
    try { await Promise.all([loadCatalogs(), loadSummary(), loadList()]); }
    catch (error) { notice(error.message, true); }
    refreshTimer = setInterval(refreshAutomatically, AUTO_REFRESH_MS);
  }

  window.addEventListener('pagehide', () => clearInterval(refreshTimer));
  init();
})();
