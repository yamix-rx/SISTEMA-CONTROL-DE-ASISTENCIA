(function () {
  'use strict';

  const API = '/contratos';
  const state = { pagina: 1, limite: 10, paginas: 1, catalogos: null };
  const $ = id => document.getElementById(id);
  const text = value => value === null || value === undefined || value === '' ? '—' : String(value);
  const estadoLabel = value => ({ borrador: 'Borrador', vigente: 'Vigente', por_vencer: 'Por vencer', vencido: 'Vencido', finalizado: 'Finalizado', cancelado: 'Cancelado' }[value] || text(value));

  function fecha(value) {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    const [y, m, d] = raw.split('-');
    return y && m && d ? `${d}/${m}/${y}` : raw;
  }

  function dinero(value, moneda = 'PEN') {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return text(value);
    try { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda || 'PEN' }).format(number); }
    catch (_) { return `S/ ${number.toFixed(2)}`; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  async function api(path, options = {}) {
    const response = await fetch(`${window.SBSSSession.API_BASE}${API}${path}`, options);
    let body = {};
    try { body = await response.json(); } catch (_) { /* sin cuerpo */ }
    if (!response.ok || body.ok === false) throw new Error(body.mensaje || 'No se pudo completar la operación.');
    return body;
  }

  function notice(message, isError = false) {
    const node = $('mensajeContratos');
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.hidden = false;
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => { node.hidden = true; }, isError ? 7000 : 3500);
  }

  function fillSelect(select, items, { value = 'id', label = 'razon_social', first = null } = {}) {
    const current = select.value;
    select.replaceChildren();
    if (first) {
      const option = document.createElement('option');
      option.value = first.value;
      option.textContent = first.label;
      select.appendChild(option);
    }
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = typeof value === 'function' ? value(item) : item[value];
      option.textContent = typeof label === 'function' ? label(item) : item[label];
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  async function loadCatalogs() {
    const result = await api('/catalogos');
    state.catalogos = result.data;
    fillSelect($('filtroEmpresa'), result.data.empresas, { first: { value: '', label: 'Todas las empresas' } });
    fillSelect($('contratoEmpleado'), result.data.empleados, {
      first: { value: '', label: 'Seleccione un colaborador' },
      label: e => `${e.colaborador} · DNI ${e.numero_documento} · ${e.empresa}`
    });
    fillSelect($('filtroTipo'), result.data.tipos_contrato.map(x => ({ id: x, label: x })), { label: 'label', first: { value: '', label: 'Todos los tipos' } });
    fillSelect($('contratoTipo'), result.data.tipos_contrato.map(x => ({ id: x, label: x })), { label: 'label', first: { value: '', label: 'Seleccione un tipo' } });
    fillSelect($('filtroEstado'), result.data.estados.map(x => ({ id: x, label: estadoLabel(x) })), { label: 'label', first: { value: '', label: 'Todos los estados' } });
  }

  async function loadSummary() {
    const result = await api('/resumen');
    const r = result.data || {};
    $('resTotal').textContent = r.total ?? 0;
    $('resVigentes').textContent = r.vigente ?? 0;
    $('resPorVencer').textContent = r.por_vencer ?? 0;
    $('resVencidos').textContent = r.vencido ?? 0;
  }

  function queryString() {
    const params = new URLSearchParams({ pagina: state.pagina, limite: state.limite });
    const buscar = $('buscarContrato').value.trim();
    const empresa = $('filtroEmpresa').value;
    const estado = $('filtroEstado').value;
    if (buscar) params.set('buscar', buscar);
    if (empresa) params.set('empresa_id', empresa);
    if (estado) params.set('estado', estado);
    const tipo = $('filtroTipo').value;
    if (tipo) params.set('tipo_contrato', tipo);
    return params.toString();
  }

  async function loadList() {
    $('tablaContratos').innerHTML = '<tr><td colspan="9" class="table-message">Cargando contratos...</td></tr>';
    try {
      const result = await api(`/?${queryString()}`);
      state.paginas = result.paginacion?.paginas || 1;
      state.pagina = result.paginacion?.pagina || 1;
      renderRows(result.data || []);
      renderPagination(result.paginacion || { pagina: 1, paginas: 1, total: 0 });
    } catch (error) {
      $('tablaContratos').innerHTML = `<tr><td colspan="9" class="table-message">${escapeHtml(error.message)}</td></tr>`;
      notice(error.message, true);
    }
  }

  function renderRows(rows) {
    if (!rows.length) {
      $('tablaContratos').innerHTML = '<tr><td colspan="9" class="table-message">No se encontraron contratos con los filtros seleccionados.</td></tr>';
      return;
    }
    const start = (state.pagina - 1) * state.limite;
    $('tablaContratos').innerHTML = rows.map((row, index) => `
      <tr>
        <td>${start + index + 1}</td>
        <td class="person"><strong>${escapeHtml(row.colaborador)}</strong><small>DNI: ${escapeHtml(row.numero_documento)} · ${escapeHtml(row.cargo || '')}</small></td>
        <td>${escapeHtml(row.empresa)}</td>
        <td>${escapeHtml(row.tipo_contrato)}</td>
        <td>${fecha(row.fecha_inicio)}</td>
        <td>${fecha(row.fecha_fin)}</td>
        <td class="money">${dinero(row.remuneracion, row.moneda)}</td>
        <td><span class="badge badge-${escapeHtml(row.estado_vigencia)}">${escapeHtml(estadoLabel(row.estado_vigencia))}</span></td>
        <td><div class="actions">
          <button class="icon-button" type="button" data-action="view" data-id="${row.id}" title="Ver detalle"><svg class="icon"><use href="#i-eye"/></svg></button>
          <button class="icon-button edit" type="button" data-action="edit" data-id="${row.id}" title="Editar contrato"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button class="icon-button danger" type="button" data-action="delete" data-id="${row.id}" title="Eliminar contrato"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div></td>
      </tr>`).join('');
  }

  function renderPagination(p) {
    const total = Number(p.total || 0);
    const start = total ? (p.pagina - 1) * p.limite + 1 : 0;
    const end = Math.min(total, p.pagina * p.limite);
    $('contadorContratos').textContent = `${total} contrato${total === 1 ? '' : 's'}`;
    $('textoPaginacion').textContent = total ? `Mostrando ${start} a ${end} de ${total} registros` : 'Mostrando 0 registros';
    $('paginaAnterior').disabled = p.pagina <= 1;
    $('paginaSiguiente').disabled = p.pagina >= p.paginas;
    const pages = $('paginasContratos');
    pages.replaceChildren();
    const from = Math.max(1, p.pagina - 2);
    const to = Math.min(p.paginas, p.pagina + 2);
    for (let i = from; i <= to; i += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `page-number${i === p.pagina ? ' active' : ''}`;
      b.textContent = i;
      b.onclick = () => { state.pagina = i; loadList(); };
      pages.appendChild(b);
    }
  }

  function resetForm() {
    $('formContrato').reset();
    $('contratoId').value = '';
    $('contratoEstado').value = 'borrador';
    $('tituloFormContrato').textContent = 'Nuevo contrato';
    $('errorFormContrato').hidden = true;
  }

  async function openEdit(id) {
    try {
      const result = await api(`/${id}`);
      const c = result.data;
      resetForm();
      $('contratoId').value = c.id;
      $('tituloFormContrato').textContent = 'Editar contrato';
      $('contratoEmpleado').value = c.empleado_id;
      $('contratoCodigo').value = c.codigo || '';
      $('contratoTipo').value = c.tipo_contrato || '';
      $('contratoModalidad').value = c.modalidad || '';
      $('contratoEstado').value = c.estado || 'borrador';
      $('contratoInicio').value = String(c.fecha_inicio || '').slice(0, 10);
      $('contratoFin').value = String(c.fecha_fin || '').slice(0, 10);
      $('contratoRemuneracion').value = c.remuneracion ?? '';
      $('contratoHoras').value = c.horas_semanales ?? '';
      $('contratoObservaciones').value = c.observaciones || '';
      $('dialogContrato').showModal();
    } catch (error) { notice(error.message, true); }
  }

  async function openDetail(id) {
    try {
      const { data: c } = await api(`/${id}`);
      $('detalleContrato').innerHTML = `
        <div class="detail-item"><small>Colaborador</small><strong>${escapeHtml(c.colaborador)}</strong><span>DNI ${escapeHtml(c.numero_documento)}</span></div>
        <div class="detail-item"><small>Empresa / cargo</small><strong>${escapeHtml(c.empresa)}</strong><span>${escapeHtml(c.cargo)}</span></div>
        <div class="detail-item"><small>Código</small><strong>${escapeHtml(text(c.codigo))}</strong></div>
        <div class="detail-item"><small>Tipo</small><strong>${escapeHtml(c.tipo_contrato)}</strong></div>
        <div class="detail-item"><small>Vigencia</small><span>${fecha(c.fecha_inicio)} — ${fecha(c.fecha_fin)}</span></div>
        <div class="detail-item"><small>Estado</small><span class="badge badge-${escapeHtml(c.estado_vigencia)}">${escapeHtml(estadoLabel(c.estado_vigencia))}</span></div>
        <div class="detail-item"><small>Remuneración</small><strong>${dinero(c.remuneracion, c.moneda)}</strong></div>
        <div class="detail-item"><small>Horas semanales</small><strong>${escapeHtml(text(c.horas_semanales))}</strong></div>
        <div class="detail-item full"><small>Observaciones</small><strong class="detail-observation">${escapeHtml(text(c.observaciones))}</strong></div>`;
      $('dialogDetalleContrato').showModal();
    } catch (error) { notice(error.message, true); }
  }

  function formPayload() {
    return {
      empleado_id: Number($('contratoEmpleado').value),
      codigo: $('contratoCodigo').value.trim() || null,
      tipo_contrato: $('contratoTipo').value,
      modalidad: $('contratoModalidad').value.trim() || null,
      fecha_inicio: $('contratoInicio').value,
      fecha_fin: $('contratoFin').value || null,
      remuneracion: $('contratoRemuneracion').value === '' ? null : Number($('contratoRemuneracion').value),
      moneda: 'PEN',
      horas_semanales: $('contratoHoras').value === '' ? null : Number($('contratoHoras').value),
      estado: $('contratoEstado').value,
      observaciones: $('contratoObservaciones').value.trim() || null
    };
  }

  async function saveContract(event) {
    event.preventDefault();
    const errorNode = $('errorFormContrato');
    errorNode.hidden = true;
    const id = $('contratoId').value;
    const button = $('btnGuardarContrato');
    button.disabled = true;
    try {
      await api(id ? `/${id}` : '/', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPayload())
      });
      $('dialogContrato').close();
      notice(id ? 'Contrato actualizado correctamente.' : 'Contrato registrado correctamente.');
      await Promise.all([loadSummary(), loadList()]);
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
    } finally { button.disabled = false; }
  }

  async function deleteContract(id) {
    if (!window.confirm('¿Deseas eliminar este contrato? Los contratos vigentes deben finalizarse o cancelarse antes de eliminarlos.')) return;
    try {
      await api(`/${id}`, { method: 'DELETE' });
      notice('Contrato eliminado correctamente.');
      await Promise.all([loadSummary(), loadList()]);
    } catch (error) { notice(error.message, true); }
  }

  function bindEvents() {
    $('btnNuevoContrato').addEventListener('click', () => { resetForm(); $('dialogContrato').showModal(); });
    $('btnBuscar').addEventListener('click', () => { state.pagina = 1; loadList(); });
    $('buscarContrato').addEventListener('keydown', event => { if (event.key === 'Enter') { state.pagina = 1; loadList(); } });
    $('btnLimpiar').addEventListener('click', () => {
      $('buscarContrato').value = ''; $('filtroEmpresa').value = ''; $('filtroTipo').value = ''; $('filtroEstado').value = ''; state.pagina = 1; loadList();
    });
    $('paginaAnterior').addEventListener('click', () => { if (state.pagina > 1) { state.pagina -= 1; loadList(); } });
    $('paginaSiguiente').addEventListener('click', () => { if (state.pagina < state.paginas) { state.pagina += 1; loadList(); } });
    $('formContrato').addEventListener('submit', saveContract);
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(button.dataset.closeDialog)?.close()));
    document.querySelectorAll('[data-resumen-estado]').forEach(card => card.addEventListener('click', () => {
      $('filtroEstado').value = card.dataset.resumenEstado;
      state.pagina = 1;
      loadList();
    }));
    $('tablaContratos').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === 'view') openDetail(id);
      if (button.dataset.action === 'edit') openEdit(id);
      if (button.dataset.action === 'delete') deleteContract(id);
    });
  }

  async function init() {
    const session = await window.SBSSSession.ready;
    if (!session) return;
    bindEvents();
    try {
      await loadCatalogs();
      await Promise.all([loadSummary(), loadList()]);
    } catch (error) { notice(error.message, true); }
  }

  init();
})();
