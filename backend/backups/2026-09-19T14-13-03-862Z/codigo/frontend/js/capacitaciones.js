(function () {
  'use strict';

  const API = '/capacitaciones';
  const state = { pagina: 1, limite: 10, paginas: 1, catalogos: null, capacitacionActual: null };
  const $ = id => document.getElementById(id);
  const statusLabel = value => ({
    borrador: 'Borrador', programada: 'Próxima', en_curso: 'En curso', finalizada: 'Finalizada', cancelada: 'Cancelada',
    inscrito: 'Inscrito', aprobado: 'Aprobado', desaprobado: 'Desaprobado', no_asistio: 'No asistió', cancelado: 'Retirado'
  }[value] || String(value || '—'));
  const modalidadLabel = value => ({ presencial: 'Presencial', virtual: 'Virtual', hibrida: 'Híbrida' }[value] || String(value || '—'));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function fecha(value) {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    const [y, m, d] = raw.split('-');
    return y && m && d ? `${d}/${m}/${y}` : raw;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${window.SBSSSession.API_BASE}${API}${path}`, options);
    let body = {};
    try { body = await response.json(); } catch (_) { /* sin cuerpo */ }
    if (!response.ok || body.ok === false) throw new Error(body.mensaje || 'No se pudo completar la operación.');
    return body;
  }

  function notice(message, isError = false) {
    const node = $('mensajeCapacitaciones');
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
    fillSelect($('filtroEmpresaCap'), result.data.empresas, { first: { value: '', label: 'Todas las empresas' } });
    fillSelect($('capEmpresa'), result.data.empresas, { first: { value: '', label: 'Todas las empresas' } });
    fillSelect($('filtroModalidad'), result.data.modalidades.map(x => ({ id: x, label: modalidadLabel(x) })), { label: 'label', first: { value: '', label: 'Todas las modalidades' } });
    fillSelect($('filtroEstadoCap'), result.data.estados.map(x => ({ id: x, label: statusLabel(x) })), { label: 'label', first: { value: '', label: 'Todos los estados' } });
  }

  async function loadSummary() {
    const { data: r } = await api('/resumen');
    $('capTotal').textContent = r.total ?? 0;
    $('capEnCurso').textContent = r.en_curso ?? 0;
    $('capProgramadas').textContent = r.programada ?? 0;
    $('capFinalizadas').textContent = r.finalizada ?? 0;
  }

  function queryString() {
    const params = new URLSearchParams({ pagina: state.pagina, limite: state.limite });
    const buscar = $('buscarCapacitacion').value.trim();
    const empresa = $('filtroEmpresaCap').value;
    const modalidad = $('filtroModalidad').value;
    const estado = $('filtroEstadoCap').value;
    if (buscar) params.set('buscar', buscar);
    if (empresa) params.set('empresa_id', empresa);
    if (modalidad) params.set('modalidad', modalidad);
    if (estado) params.set('estado', estado);
    return params.toString();
  }

  async function loadList() {
    $('tablaCapacitaciones').innerHTML = '<tr><td colspan="9" class="table-message">Cargando capacitaciones...</td></tr>';
    try {
      const result = await api(`/?${queryString()}`);
      state.paginas = result.paginacion?.paginas || 1;
      state.pagina = result.paginacion?.pagina || 1;
      renderRows(result.data || []);
      renderPagination(result.paginacion || { pagina: 1, paginas: 1, total: 0, limite: state.limite });
    } catch (error) {
      $('tablaCapacitaciones').innerHTML = `<tr><td colspan="9" class="table-message">${escapeHtml(error.message)}</td></tr>`;
      notice(error.message, true);
    }
  }

  function renderRows(rows) {
    if (!rows.length) {
      $('tablaCapacitaciones').innerHTML = '<tr><td colspan="9" class="table-message">No se encontraron capacitaciones con los filtros seleccionados.</td></tr>';
      return;
    }
    const start = (state.pagina - 1) * state.limite;
    $('tablaCapacitaciones').innerHTML = rows.map((row, index) => {
      const cupo = row.cupo ? `${Number(row.inscritos || 0)}/${row.cupo}` : `${Number(row.inscritos || 0)} / Sin límite`;
      return `
        <tr>
          <td>${start + index + 1}</td>
          <td class="training-title"><strong>${escapeHtml(row.titulo)}</strong><small>${escapeHtml(row.categoria || row.proveedor || 'Sin categoría')}</small></td>
          <td>${escapeHtml(row.empresa || 'Todas las empresas')}</td>
          <td><span class="badge badge-${escapeHtml(row.modalidad)}">${escapeHtml(modalidadLabel(row.modalidad))}</span></td>
          <td>${fecha(row.fecha_inicio)}</td>
          <td>${fecha(row.fecha_fin)}</td>
          <td>${escapeHtml(cupo)}</td>
          <td><span class="badge badge-${escapeHtml(row.estado)}">${escapeHtml(statusLabel(row.estado))}</span></td>
          <td><div class="actions">
            <button class="icon-button people" type="button" data-action="people" data-id="${row.id}" title="Participantes"><svg class="icon"><use href="#i-users"/></svg></button>
            <button class="icon-button edit" type="button" data-action="edit" data-id="${row.id}" title="Editar capacitación"><svg class="icon"><use href="#i-edit"/></svg></button>
            <button class="icon-button danger" type="button" data-action="delete" data-id="${row.id}" title="Eliminar capacitación"><svg class="icon"><use href="#i-trash"/></svg></button>
          </div></td>
        </tr>`;
    }).join('');
  }

  function renderPagination(p) {
    const total = Number(p.total || 0);
    const limit = Number(p.limite || state.limite);
    const start = total ? (p.pagina - 1) * limit + 1 : 0;
    const end = Math.min(total, p.pagina * limit);
    $('contadorCapacitaciones').textContent = `${total} capacitación${total === 1 ? '' : 'es'}`;
    $('textoPaginacionCap').textContent = total ? `Mostrando ${start} a ${end} de ${total} registros` : 'Mostrando 0 registros';
    $('paginaAnteriorCap').disabled = p.pagina <= 1;
    $('paginaSiguienteCap').disabled = p.pagina >= p.paginas;
    const pages = $('paginasCapacitaciones');
    pages.replaceChildren();
    const from = Math.max(1, p.pagina - 2);
    const to = Math.min(p.paginas, p.pagina + 2);
    for (let i = from; i <= to; i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-number${i === p.pagina ? ' active' : ''}`;
      button.textContent = i;
      button.onclick = () => { state.pagina = i; loadList(); };
      pages.appendChild(button);
    }
  }

  function resetForm() {
    $('formCapacitacion').reset();
    $('capacitacionId').value = '';
    $('capModalidad').value = 'presencial';
    $('capEstado').value = 'borrador';
    $('tituloFormCapacitacion').textContent = 'Nueva capacitación';
    $('errorFormCapacitacion').hidden = true;
  }

  async function openEdit(id) {
    try {
      const { data: c } = await api(`/${id}`);
      resetForm();
      $('capacitacionId').value = c.id;
      $('tituloFormCapacitacion').textContent = 'Editar capacitación';
      $('capTitulo').value = c.titulo || '';
      $('capCategoria').value = c.categoria || '';
      $('capProveedor').value = c.proveedor || '';
      $('capEmpresa').value = c.empresa_id || '';
      $('capModalidad').value = c.modalidad || 'presencial';
      $('capInicio').value = String(c.fecha_inicio || '').slice(0, 10);
      $('capFin').value = String(c.fecha_fin || '').slice(0, 10);
      $('capHoraInicio').value = String(c.hora_inicio || '').slice(0, 5);
      $('capHoraFin').value = String(c.hora_fin || '').slice(0, 5);
      $('capHoras').value = c.horas ?? '';
      $('capCupo').value = c.cupo ?? '';
      $('capLugar').value = c.lugar || '';
      $('capEnlace').value = c.enlace || '';
      $('capEstado').value = c.estado || 'borrador';
      $('capObligatoria').checked = Boolean(Number(c.obligatorio));
      $('capDescripcion').value = c.descripcion || '';
      $('dialogCapacitacion').showModal();
    } catch (error) { notice(error.message, true); }
  }

  function formPayload() {
    return {
      titulo: $('capTitulo').value.trim(),
      categoria: $('capCategoria').value.trim() || null,
      proveedor: $('capProveedor').value.trim() || null,
      empresa_id: $('capEmpresa').value ? Number($('capEmpresa').value) : null,
      modalidad: $('capModalidad').value,
      fecha_inicio: $('capInicio').value,
      fecha_fin: $('capFin').value,
      hora_inicio: $('capHoraInicio').value || null,
      hora_fin: $('capHoraFin').value || null,
      horas: Number($('capHoras').value),
      cupo: $('capCupo').value ? Number($('capCupo').value) : null,
      lugar: $('capLugar').value.trim() || null,
      enlace: $('capEnlace').value.trim() || null,
      obligatorio: $('capObligatoria').checked,
      estado: $('capEstado').value,
      descripcion: $('capDescripcion').value.trim() || null
    };
  }

  async function saveTraining(event) {
    event.preventDefault();
    const errorNode = $('errorFormCapacitacion');
    errorNode.hidden = true;
    const id = $('capacitacionId').value;
    const button = $('btnGuardarCapacitacion');
    button.disabled = true;
    try {
      await api(id ? `/${id}` : '/', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPayload())
      });
      $('dialogCapacitacion').close();
      notice(id ? 'Capacitación actualizada correctamente.' : 'Capacitación registrada correctamente.');
      await Promise.all([loadSummary(), loadList()]);
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
    } finally { button.disabled = false; }
  }

  async function deleteTraining(id) {
    if (!window.confirm('¿Deseas eliminar esta capacitación? Sólo puede eliminarse si está en borrador o cancelada y no tiene participantes activos.')) return;
    try {
      await api(`/${id}`, { method: 'DELETE' });
      notice('Capacitación eliminada correctamente.');
      await Promise.all([loadSummary(), loadList()]);
    } catch (error) { notice(error.message, true); }
  }

  function participantStatusOptions(selected) {
    const options = [
      ['inscrito', 'Inscrito'], ['en_curso', 'En curso'], ['aprobado', 'Aprobado'],
      ['desaprobado', 'Desaprobado'], ['no_asistio', 'No asistió'], ['cancelado', 'Retirado']
    ];
    return options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  }

  function renderParticipantSelector(cap) {
    const active = new Set((cap.participantes || []).filter(p => p.estado !== 'cancelado').map(p => Number(p.empleado_id)));
    let employees = state.catalogos?.empleados || [];
    if (cap.empresa_id) employees = employees.filter(e => Number(e.empresa_id) === Number(cap.empresa_id));
    employees = employees.filter(e => !active.has(Number(e.id)));
    fillSelect($('participanteNuevo'), employees, {
      first: { value: '', label: employees.length ? 'Seleccione un colaborador' : 'No hay colaboradores disponibles' },
      label: e => `${e.colaborador} · ${e.empresa}`
    });
    $('btnAgregarParticipante').disabled = !employees.length;
  }

  function renderParticipants(cap) {
    const rows = cap.participantes || [];
    if (!rows.length) {
      $('tablaParticipantes').innerHTML = '<tr><td colspan="5" class="table-message">Aún no hay participantes registrados.</td></tr>';
      return;
    }
    $('tablaParticipantes').innerHTML = rows.map(p => `
      <tr data-employee="${p.empleado_id}">
        <td class="person"><strong>${escapeHtml(p.colaborador)}</strong><small>DNI ${escapeHtml(p.numero_documento)} · ${escapeHtml(p.area || '')}</small></td>
        <td><select data-field="estado">${participantStatusOptions(p.estado)}</select></td>
        <td><input data-field="asistencia_porcentaje" type="number" min="0" max="100" step="0.01" value="${p.asistencia_porcentaje ?? ''}" placeholder="0-100"></td>
        <td><input data-field="nota" type="number" min="0" max="100" step="0.01" value="${p.nota ?? ''}" placeholder="0-100"></td>
        <td><div class="participant-actions"><button class="mini-button save" type="button" data-participant-action="save">Guardar</button><button class="mini-button remove" type="button" data-participant-action="remove">Retirar</button></div></td>
      </tr>`).join('');
  }

  async function openParticipants(id) {
    const error = $('errorParticipantes');
    error.hidden = true;
    try {
      const { data: cap } = await api(`/${id}`);
      state.capacitacionActual = cap;
      $('tituloParticipantes').textContent = cap.titulo;
      $('resumenCapacitacion').innerHTML = `
        <div><small>Empresa</small><strong>${escapeHtml(cap.empresa || 'Todas las empresas')}</strong></div>
        <div><small>Modalidad</small><strong>${escapeHtml(modalidadLabel(cap.modalidad))}</strong></div>
        <div><small>Fechas</small><strong>${fecha(cap.fecha_inicio)} — ${fecha(cap.fecha_fin)}</strong></div>
        <div><small>Cupo</small><strong>${cap.cupo ? `${cap.participantes.filter(p => p.estado !== 'cancelado').length}/${cap.cupo}` : 'Sin límite'}</strong></div>`;
      renderParticipantSelector(cap);
      renderParticipants(cap);
      if (!$('dialogParticipantes').open) $('dialogParticipantes').showModal();
    } catch (err) {
      if ($('dialogParticipantes').open) {
        error.textContent = err.message;
        error.hidden = false;
      } else notice(err.message, true);
    }
  }

  async function addParticipant() {
    const cap = state.capacitacionActual;
    const employeeId = $('participanteNuevo').value;
    if (!cap || !employeeId) return;
    const button = $('btnAgregarParticipante');
    button.disabled = true;
    try {
      await api(`/${cap.id}/participantes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleado_id: Number(employeeId) })
      });
      await openParticipants(cap.id);
      await loadList();
    } catch (error) {
      $('errorParticipantes').textContent = error.message;
      $('errorParticipantes').hidden = false;
    } finally { button.disabled = false; }
  }

  async function updateParticipant(row) {
    const cap = state.capacitacionActual;
    const employeeId = row.dataset.employee;
    const estado = row.querySelector('[data-field="estado"]').value;
    const asistenciaRaw = row.querySelector('[data-field="asistencia_porcentaje"]').value;
    const notaRaw = row.querySelector('[data-field="nota"]').value;
    try {
      await api(`/${cap.id}/participantes/${employeeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado,
          asistencia_porcentaje: asistenciaRaw === '' ? null : Number(asistenciaRaw),
          nota: notaRaw === '' ? null : Number(notaRaw)
        })
      });
      await openParticipants(cap.id);
      await loadList();
    } catch (error) {
      $('errorParticipantes').textContent = error.message;
      $('errorParticipantes').hidden = false;
    }
  }

  async function removeParticipant(row) {
    const cap = state.capacitacionActual;
    const employeeId = row.dataset.employee;
    if (!window.confirm('¿Deseas retirar a este colaborador de la capacitación?')) return;
    try {
      await api(`/${cap.id}/participantes/${employeeId}`, { method: 'DELETE' });
      await openParticipants(cap.id);
      await loadList();
    } catch (error) {
      $('errorParticipantes').textContent = error.message;
      $('errorParticipantes').hidden = false;
    }
  }

  function bindEvents() {
    $('btnNuevaCapacitacion').addEventListener('click', () => { resetForm(); $('dialogCapacitacion').showModal(); });
    $('btnBuscarCap').addEventListener('click', () => { state.pagina = 1; loadList(); });
    $('buscarCapacitacion').addEventListener('keydown', event => { if (event.key === 'Enter') { state.pagina = 1; loadList(); } });
    $('btnLimpiarCap').addEventListener('click', () => {
      $('buscarCapacitacion').value = ''; $('filtroEmpresaCap').value = ''; $('filtroModalidad').value = ''; $('filtroEstadoCap').value = ''; state.pagina = 1; loadList();
    });
    $('paginaAnteriorCap').addEventListener('click', () => { if (state.pagina > 1) { state.pagina -= 1; loadList(); } });
    $('paginaSiguienteCap').addEventListener('click', () => { if (state.pagina < state.paginas) { state.pagina += 1; loadList(); } });
    $('formCapacitacion').addEventListener('submit', saveTraining);
    $('btnAgregarParticipante').addEventListener('click', addParticipant);
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(button.dataset.closeDialog)?.close()));
    document.querySelectorAll('[data-resumen-estado]').forEach(card => card.addEventListener('click', () => {
      $('filtroEstadoCap').value = card.dataset.resumenEstado;
      state.pagina = 1;
      loadList();
    }));
    $('tablaCapacitaciones').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      if (button.dataset.action === 'people') openParticipants(button.dataset.id);
      if (button.dataset.action === 'edit') openEdit(button.dataset.id);
      if (button.dataset.action === 'delete') deleteTraining(button.dataset.id);
    });
    $('tablaParticipantes').addEventListener('click', event => {
      const button = event.target.closest('[data-participant-action]');
      const row = button?.closest('tr[data-employee]');
      if (!button || !row) return;
      if (button.dataset.participantAction === 'save') updateParticipant(row);
      if (button.dataset.participantAction === 'remove') removeParticipant(row);
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
