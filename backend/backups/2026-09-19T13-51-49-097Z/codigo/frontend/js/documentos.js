// Panel conectado a la API autenticada. Los archivos y estados se guardan en el servidor.
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const STATES = {
    sin_entregar: 'Sin entregar', pendiente: 'Por revisar',
    validado: 'Validado', rechazado: 'Observado'
  };
  const ALLOWED_MIME = new Set([
    'application/pdf', 'image/jpeg', 'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const initialEmployee = new URLSearchParams(location.search).get('empleado_id');
  const state = {
    catalogs: null, rows: [], selected: null, page: 1, total: 0, limit: 5,
    employeeId: /^\d+$/.test(initialEmployee || '') ? initialEmployee : '',
    listRevision: 0, previewRevision: 0, previewUrl: null,
    listController: null, previewController: null, loading: false,
    uploading: false, reviewing: false, generating: false
  };

  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.appendChild(use);
    return svg;
  }

  function actionButton(label, iconName, callback, className = 'icon-button') {
    const button = node('button', className);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    if (iconName) button.appendChild(icon(iconName));
    button.addEventListener('click', callback);
    return button;
  }

  function badge(estado) {
    const safeState = Object.hasOwn(STATES, estado) ? estado : 'pendiente';
    return node('span', `badge badge-${safeState}`, STATES[safeState]);
  }

  function displayDate(value) {
    if (!value) return '—';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function notify(message = '', error = false) {
    const element = $('mensajeGlobal');
    element.textContent = message;
    element.className = error ? 'notice notice-error' : 'notice';
    element.setAttribute('role', error ? 'alert' : 'status');
    element.hidden = !message;
  }

  function formError(id, message = '') {
    $(id).textContent = message;
    $(id).hidden = !message;
  }

  function friendlyError(error) {
    if (error.name === 'TimeoutError') return 'La solicitud tardó demasiado. Revisa la conexión y vuelve a intentar.';
    if (error.name === 'TypeError') return 'No se pudo conectar con el servidor. Comprueba que el backend esté encendido.';
    return error.message || 'No se pudo completar la operación. Vuelve a intentar.';
  }

  async function request(path, options = {}, asBlob = false) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(options.signal.reason);
    if (options.signal) {
      if (options.signal.aborted) abortFromCaller();
      else options.signal.addEventListener('abort', abortFromCaller, { once: true });
    }
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
    try {
      const response = await window.SBSSSession.fetch(`${window.SBSSSession.API_BASE}${path}`, {
        ...options, signal: controller.signal, cache: 'no-store'
      });
      if (asBlob && response.ok) return await response.blob();
      let data;
      try { data = await response.json(); }
      catch (_) { throw new Error('El servidor no devolvió una respuesta válida. Comprueba la configuración del backend.'); }
      if (!response.ok || data.ok === false) {
        throw new Error(data.mensaje || data.error || 'No se pudo completar la operación.');
      }
      return data;
    } catch (error) {
      if (timedOut) {
        const timeout = new Error('La solicitud tardó demasiado. Vuelve a intentar.');
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  function setListStatus(message, error = false) {
    $('estadoLista').hidden = false;
    $('estadoLista').classList.toggle('is-error', error);
    $('textoEstadoLista').textContent = message;
    $('btnReintentar').hidden = !error;
    $('tablaContenedor').hidden = true;
  }

  function fillSelect(id, items, textKey, firstLabel) {
    const select = $(id);
    const previous = select.value;
    const fragment = document.createDocumentFragment();
    const first = node('option', '', firstLabel);
    first.value = '';
    fragment.appendChild(first);
    items.forEach(item => {
      const option = node('option', '', typeof textKey === 'function' ? textKey(item) : item[textKey]);
      option.value = String(item.id);
      fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
    if (Array.from(select.options).some(option => option.value === previous)) select.value = previous;
  }

  async function loadCatalogs() {
    const data = await request('/documentos/catalogos');
    if (!Array.isArray(data.empleados) || !Array.isArray(data.empresas) || !Array.isArray(data.tipos)) {
      throw new Error('No se pudieron cargar los colaboradores y tipos de documento.');
    }
    state.catalogs = data;
    fillSelect('fEmpresa', data.empresas, 'razon_social', 'Todas las empresas');
    fillSelect('fTipo', data.tipos, 'nombre', 'Todos los tipos');
    const employeeLabel = employee => `${employee.colaborador} · ${employee.numero_documento} · ${employee.empresa}`;
    fillSelect('subirEmpleado', data.empleados, employeeLabel, 'Selecciona un colaborador');
    fillSelect('generarEmpleado', data.empleados, employeeLabel, 'Selecciona un colaborador');
    fillSelect('subirTipo', data.tipos, 'nombre', 'Selecciona un tipo');
    updateEmployeeFilter();
    setCatalogButtons();
  }

  function setCatalogButtons() {
    const hasEmployees = Boolean(state.catalogs?.empleados.length);
    const canUpload = hasEmployees && Boolean(state.catalogs?.tipos.length);
    $('btnSubir').disabled = !canUpload;
    $('btnGenerar').disabled = !hasEmployees;
    document.querySelectorAll('[data-plantilla]').forEach(button => { button.disabled = !hasEmployees; });
  }

  function updateEmployeeFilter() {
    $('filtroPersona').hidden = !state.employeeId;
    if (state.employeeId) {
      const employee = state.catalogs?.empleados.find(item => String(item.id) === state.employeeId);
      $('filtroPersona').querySelector('span').textContent = employee
        ? `Expediente de ${employee.colaborador}` : `Expediente del colaborador ${state.employeeId}`;
    }
  }

  function searchParams() {
    const params = new URLSearchParams({ pagina: state.page, limite: state.limit });
    const values = {
      q: $('fBuscar').value.trim(), empresa_id: $('fEmpresa').value,
      tipo_documento_id: $('fTipo').value, estado: $('fEstado').value,
      empleado_id: state.employeeId
    };
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params;
  }

  function updateCards(summary) {
    const map = { totalSinEntregar: 'sin_entregar', totalPendiente: 'pendiente', totalValidado: 'validado', totalRechazado: 'rechazado' };
    Object.entries(map).forEach(([id, field]) => { $(id).textContent = summary ? String(summary[field] || 0) : '—'; });
    document.querySelectorAll('.summary-card').forEach(card => {
      card.setAttribute('aria-pressed', String(card.dataset.estado === $('fEstado').value));
    });
  }

  function updatePagination() {
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    $('paginaActual').textContent = `${state.page} / ${pages}`;
    $('btnAnterior').disabled = state.loading || state.page <= 1;
    $('btnSiguiente').disabled = state.loading || state.page >= pages;
    $('rangoDocumentos').textContent = state.total
      ? `Mostrando ${(state.page - 1) * state.limit + 1}–${Math.min(state.page * state.limit, state.total)} de ${state.total}`
      : 'Sin registros';
  }

  async function loadDocuments({ preserveSelection = true } = {}) {
    const revision = ++state.listRevision;
    state.listController?.abort();
    state.listController = new AbortController();
    const selectedKey = preserveSelection ? state.selected?.clave : null;
    state.loading = true;
    clearPreview(false);
    $('conteoDocumentos').textContent = 'Cargando…';
    setListStatus('Cargando documentos…');
    updatePagination();
    try {
      if (!state.catalogs) await loadCatalogs();
      if (revision !== state.listRevision) return;
      const data = await request(`/documentos?${searchParams()}`, { signal: state.listController.signal });
      if (revision !== state.listRevision) return;
      if (!Array.isArray(data.documentos) || !Number.isFinite(Number(data.total))) {
        throw new Error('La lista de documentos no tiene un formato válido.');
      }
      state.rows = data.documentos;
      state.total = Number(data.total);
      state.page = Number(data.pagina) || state.page;
      const lastPage = Math.max(1, Math.ceil(state.total / state.limit));
      if (state.page > lastPage) {
        state.page = lastPage;
        return loadDocuments({ preserveSelection: false });
      }
      updateCards(data.resumen);
      $('conteoDocumentos').textContent = `${state.total} ${state.total === 1 ? 'registro' : 'registros'}`;
      renderRows();
      const previous = state.rows.find(row => row.clave === selectedKey);
      if (previous) selectDocument(previous, false);
      if (!state.rows.length) {
        setListStatus(state.catalogs.empleados.length
          ? 'No hay documentos que coincidan con los filtros. Puedes limpiar la búsqueda o subir un archivo.'
          : 'Aún no hay colaboradores. Registra personal para comenzar a gestionar sus documentos.');
      }
    } catch (error) {
      if (revision !== state.listRevision || error.name === 'AbortError') return;
      state.rows = [];
      state.total = 0;
      $('filasDocumentos').replaceChildren();
      $('conteoDocumentos').textContent = 'Sin conexión de datos';
      updateCards(null);
      setListStatus(friendlyError(error), true);
    } finally {
      if (revision === state.listRevision) {
        state.loading = false;
        updatePagination();
      }
    }
  }

  function renderRows() {
    const fragment = document.createDocumentFragment();
    state.rows.forEach(row => {
      const tr = node('tr');
      tr.dataset.clave = row.clave;
      tr.classList.toggle('selected', row.clave === state.selected?.clave);
      const person = node('td', 'person-cell');
      person.append(node('strong', '', row.colaborador), node('small', '', row.empresa), node('small', 'person-id', `DNI / documento: ${row.numero_documento}`));
      const doc = node('td', 'document-cell', row.tipo_documento);
      if (row.es_obligatorio) doc.appendChild(node('small', '', 'Obligatorio'));
      const date = node('td', 'date-cell', displayDate(row.fecha_subida));
      const status = node('td', 'status-cell');
      status.appendChild(badge(row.estado));
      const actions = node('td', 'actions-cell');
      const view = actionButton(`Ver ${row.tipo_documento} de ${row.colaborador}`, 'eye', () => selectDocument(row, true));
      view.dataset.action = 'ver';
      actions.appendChild(view);
      if (row.documento_id) {
        const download = actionButton(`Descargar ${row.tipo_documento} de ${row.colaborador}`, 'download', event => downloadFile(row, event.currentTarget));
        download.dataset.action = 'descargar';
        actions.appendChild(download);
      } else {
        const upload = actionButton(`Subir ${row.tipo_documento} de ${row.colaborador}`, 'upload', () => openUpload(row), 'button row-upload');
        upload.dataset.action = 'subir';
        upload.appendChild(node('span', '', 'Subir'));
        actions.appendChild(upload);
      }
      tr.append(person, doc, date, status, actions);
      fragment.appendChild(tr);
    });
    $('filasDocumentos').replaceChildren(fragment);
    $('estadoLista').hidden = true;
    $('tablaContenedor').hidden = !state.rows.length;
  }

  function clearPreview(restoreFocus = true) {
    const previous = state.selected;
    state.previewRevision++;
    state.previewController?.abort();
    state.previewController = null;
    $('archivoVista').replaceChildren();
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
    state.selected = null;
    $('vistaDetalle').hidden = true;
    $('vistaVacia').hidden = false;
    $('btnCerrarVista').hidden = true;
    $('observacion').value = '';
    document.querySelectorAll('#filasDocumentos tr').forEach(tr => tr.classList.remove('selected'));
    if (restoreFocus && previous) {
      Array.from($('filasDocumentos').children).find(tr => tr.dataset.clave === previous.clave)?.querySelector('button')?.focus();
    }
  }

  async function selectDocument(row, focus = false) {
    clearPreview(false);
    state.selected = row;
    const revision = state.previewRevision;
    $('vistaVacia').hidden = true;
    $('vistaDetalle').hidden = false;
    $('btnCerrarVista').hidden = false;
    $('detalleTipo').textContent = row.tipo_documento;
    $('detallePersona').textContent = row.colaborador;
    $('detalleEmpresa').textContent = row.empresa;
    const status = badge(row.estado);
    status.id = 'detalleEstado';
    $('detalleEstado').replaceWith(status);
    $('detalleArchivo').textContent = row.nombre_archivo || 'Archivo pendiente de entrega';
    $('detalleFecha').textContent = row.fecha_subida ? `Cargado el ${displayDate(row.fecha_subida)}` : 'Este requisito aún no tiene un archivo.';
    $('observacionAnterior').textContent = row.observacion ? `Última revisión: ${row.observacion}` : '';
    $('observacionAnterior').hidden = !row.observacion;
    $('btnDescargar').hidden = !row.documento_id;
    $('revisionCampos').hidden = !row.documento_id;
    $('btnNuevaVersion').replaceChildren(icon('upload'), document.createTextNode(row.documento_id ? 'Subir nueva versión' : 'Subir documento'));
    $('btnObservar').disabled = state.reviewing;
    $('btnValidar').disabled = state.reviewing;
    document.querySelectorAll('#filasDocumentos tr').forEach(tr => tr.classList.toggle('selected', tr.dataset.clave === row.clave));
    if (focus) {
      $('panelVista').focus({ preventScroll: true });
      if (matchMedia('(max-width: 1080px)').matches) $('panelVista').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
    if (!row.documento_id) {
      $('archivoVista').append(icon('upload'), node('p', '', 'Todavía no se ha entregado el archivo. Súbelo para iniciar la revisión.'));
      return;
    }
    $('archivoVista').appendChild(node('p', '', 'Cargando vista previa…'));
    state.previewController = new AbortController();
    try {
      const blob = await request(`/documentos/${row.documento_id}/archivo`, { signal: state.previewController.signal }, true);
      if (revision !== state.previewRevision) return;
      if (!ALLOWED_MIME.has(blob.type.split(';')[0])) throw new Error('No se puede mostrar este formato. Puedes descargar el archivo para revisarlo.');
      state.previewUrl = URL.createObjectURL(blob);
      let preview;
      if (blob.type.startsWith('image/')) {
        preview = node('img');
        preview.src = state.previewUrl;
        preview.alt = `${row.tipo_documento} de ${row.colaborador}`;
        preview.addEventListener('error', () => {
          if (revision === state.previewRevision) previewFailure(row, 'El navegador no pudo mostrar la imagen. Puedes descargarla para revisarla.');
        }, { once: true });
      } else if (blob.type === 'application/pdf') {
        preview = node('object');
        preview.type = 'application/pdf';
        preview.data = `${state.previewUrl}#toolbar=0&navpanes=0&view=FitH`;
        preview.setAttribute('aria-label', `Vista previa de ${row.nombre_archivo}`);
        preview.appendChild(node('p', '', 'Tu navegador no muestra PDF aquí. Usa el botón Descargar documento.'));
      } else {
        preview = node('div', 'preview-empty');
        preview.append(icon('file-text'), node('h3', '', 'Archivo de Word'), node('p', '', 'Los archivos DOC y DOCX se almacenan en el expediente y pueden descargarse para su revisión.'));
      }
      $('archivoVista').replaceChildren(preview);
    } catch (error) {
      if (revision !== state.previewRevision || error.name === 'AbortError') return;
      previewFailure(row, friendlyError(error));
    }
  }

  function previewFailure(row, message) {
    const retry = node('button', 'button button-outline', 'Reintentar vista previa');
    retry.type = 'button';
    retry.addEventListener('click', () => selectDocument(row));
    $('archivoVista').replaceChildren(node('p', '', message), retry);
  }

  async function downloadFile(row, button) {
    if (!row?.documento_id) return;
    button.disabled = true;
    try {
      const blob = await request(`/documentos/${row.documento_id}/descargar`, {}, true);
      const url = URL.createObjectURL(blob);
      const anchor = node('a');
      anchor.href = url;
      anchor.download = row.nombre_archivo || `documento-${row.documento_id}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { notify(friendlyError(error), true); }
    finally { button.disabled = false; }
  }

  function openUpload(row = null) {
    if (!state.catalogs) return;
    $('formSubir').reset();
    formError('errorSubir');
    $('tituloSubir').textContent = row?.documento_id ? 'Subir nueva versión' : 'Subir documento';
    $('subirEmpleado').value = row ? String(row.empleado_id) : state.employeeId;
    $('subirTipo').value = row ? String(row.tipo_documento_id) : '';
    $('subirEmpleado').disabled = Boolean(row);
    $('subirTipo').disabled = Boolean(row);
    $('modalSubir').showModal();
    if (row) $('subirArchivo').focus();
  }

  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado. Vuelve a seleccionarlo.'));
      reader.onabort = () => reject(new Error('Se interrumpió la lectura del archivo.'));
      reader.readAsDataURL(file);
    });
  }

  async function submitUpload(event) {
    event.preventDefault();
    if (state.uploading) return;
    formError('errorSubir');
    const file = $('subirArchivo').files[0];
    if (!$('subirEmpleado').value || !$('subirTipo').value || !file) {
      formError('errorSubir', 'Selecciona colaborador, tipo de documento y archivo.');
      return;
    }
    // El MIME que informa el navegador puede ser genérico; el servidor verifica el contenido.
    if (!/\.(pdf|jpe?g|png|docx|doc)$/i.test(file.name)) {
      formError('errorSubir', 'Selecciona un archivo PDF, Word (DOC/DOCX), JPG o PNG.');
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      formError('errorSubir', 'El archivo debe tener contenido y pesar como máximo 5 MB (5 MiB).');
      return;
    }
    const empleadoId = Number($('subirEmpleado').value);
    const tipoId = Number($('subirTipo').value);
    state.uploading = true;
    setDialogBusy('modalSubir', true);
    $('btnGuardarArchivo').textContent = 'Guardando…';
    try {
      const contenido = await readFileBase64(file);
      const data = await request('/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleado_id: empleadoId, tipo_documento_id: tipoId, nombre_archivo: file.name, contenido_base64: contenido })
      });
      $('modalSubir').close();
      notify(data.mensaje || 'Documento guardado. Quedó pendiente de revisión.');
      await loadDocuments();
    } catch (error) { formError('errorSubir', friendlyError(error)); }
    finally {
      state.uploading = false;
      setDialogBusy('modalSubir', false);
      $('btnGuardarArchivo').replaceChildren(icon('upload'), document.createTextNode('Guardar documento'));
    }
  }

  function setDialogBusy(id, busy) {
    const dialog = $(id);
    dialog.setAttribute('aria-busy', String(busy));
    dialog.querySelectorAll('button, input, select, textarea').forEach(element => {
      if (busy) {
        element.dataset.previousDisabled = String(element.disabled);
        element.disabled = true;
      } else {
        element.disabled = element.dataset.previousDisabled === 'true';
        delete element.dataset.previousDisabled;
      }
    });
  }

  async function reviewDocument(estado) {
    const row = state.selected;
    if (!row?.documento_id || state.reviewing) return;
    const observacion = $('observacion').value.trim();
    if (estado === 'rechazado' && !observacion) {
      notify('Escribe el motivo en “Observación de revisión” antes de observar el documento.', true);
      $('observacion').focus();
      return;
    }
    state.reviewing = true;
    $('btnObservar').disabled = true;
    $('btnValidar').disabled = true;
    $('observacion').disabled = true;
    try {
      const data = await request(`/documentos/${row.documento_id}/revision`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, observacion })
      });
      notify(data.mensaje || (estado === 'validado' ? 'Documento validado correctamente.' : 'Documento observado. El motivo quedó registrado.'));
      await loadDocuments();
    } catch (error) { notify(friendlyError(error), true); }
    finally {
      state.reviewing = false;
      $('btnObservar').disabled = false;
      $('btnValidar').disabled = false;
      $('observacion').disabled = false;
    }
  }

  async function loadGenerationCatalogs(force = false) {
    if (!state.generationCatalogs || force) state.generationCatalogs = await request('/documentos/generacion/catalogos');
    const catalogs = state.generationCatalogs;
    fillSelect('generarEmpresa', catalogs.empresas, 'razon_social', 'Selecciona una empresa');
    fillSelect('plantillaCodigo', catalogs.plantillas.map(item => ({ ...item, id: item.codigo })), 'titulo', 'Selecciona una plantilla');
    return catalogs;
  }

  function fillGenerationAreas() {
    fillSelect('generarArea', (state.generationCatalogs?.areas || []).filter(item => String(item.empresa_id) === $('generarEmpresa').value), 'nombre', 'Selecciona un área');
    fillGenerationPositions();
  }

  function fillGenerationPositions() {
    fillSelect('generarCargo', (state.generationCatalogs?.cargos || []).filter(item => String(item.area_id) === $('generarArea').value), 'nombre', 'Selecciona un cargo');
  }

  function fillGenerationHours() {
    const progress = state.generationFicha?.progresoHoras;
    if (!progress) return;
    $('generarHoras').value = Number($('generarTipo').value === 'aceptacion' ? progress.horasMeta : progress.horasRealizadas) || 0;
    $('generarHorasAyuda').textContent = 'Expediente: ' + (Number(progress.horasRealizadas) || 0) + ' horas registradas de ' + (Number(progress.horasMeta) || 0) + ' previstas. Puedes ajustar las horas de este documento antes de emitirlo.';
  }

  async function fillGenerationEmployee() {
    const revision = (state.employeeRevision || 0) + 1;
    state.employeeRevision = revision;
    state.generationFicha = null;
    $('generarHoras').value = '';
    const id = $('generarEmpleado').value;
    state.employeeLoading = Boolean(id);
    $('btnCrearVista').disabled = Boolean(id);
    if (!id) return;
    formError('errorGenerar');
    try {
      const response = await request('/personal/' + id);
      if (revision !== state.employeeRevision) return;
      const ficha = response.data || response;
      if (!ficha.empleado) throw new Error('No se encontró la ficha del colaborador.');
      state.generationFicha = ficha;
      $('generarEmpresa').value = String(ficha.empleado.empresa_id);
      fillGenerationAreas();
      $('generarArea').value = String(ficha.empleado.area_id);
      fillGenerationPositions();
      $('generarCargo').value = String(ficha.empleado.cargo_id);
      fillGenerationHours();
    } catch (error) { if (revision === state.employeeRevision) formError('errorGenerar', friendlyError(error)); }
    finally {
      if (revision === state.employeeRevision) {
        state.employeeLoading = false;
        $('btnCrearVista').disabled = false;
      }
    }
  }

  async function openGenerate(type = 'aceptacion') {
    if (!state.catalogs || state.generating || $('modalGenerar').open) return;
    $('formGenerar').reset();
    state.generationFicha = null;
    formError('errorGenerar');
    $('generarTipo').value = ['aceptacion', 'constancia_practicas', 'culminacion'].includes(type) ? type : 'aceptacion';
    const now = new Date();
    $('generarFecha').value = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    $('generarEmpleado').value = state.selected ? String(state.selected.empleado_id) : state.employeeId;
    $('modalGenerar').showModal();
    setDialogBusy('modalGenerar', true);
    try { await loadGenerationCatalogs(true); fillGenerationAreas(); }
    catch (error) { formError('errorGenerar', friendlyError(error)); }
    finally { setDialogBusy('modalGenerar', false); }
    if (state.generationCatalogs) await fillGenerationEmployee();
  }

  async function submitGenerate(event) {
    event.preventDefault();
    if (state.generating || state.employeeLoading) return;
    formError('errorGenerar');
    state.generating = true;
    const payload = {
      codigo: $('generarTipo').value, empleado_id: Number($('generarEmpleado').value),
      empresa_id: Number($('generarEmpresa').value), area_id: Number($('generarArea').value),
      cargo_id: Number($('generarCargo').value), fecha: $('generarFecha').value, horas: $('generarHoras').value
    };
    setDialogBusy('modalGenerar', true);
    $('btnCrearVista').textContent = 'Preparando…';
    try {
      const { documento } = await request('/documentos/generar/vista-previa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.generatedDocument = documento;
      state.generatedPayload = { ...payload, revision_plantilla: documento.revision_plantilla };
      $('generadoEmpresa').textContent = documento.empresa;
      $('generadoTitulo').textContent = documento.titulo;
      $('generadoCuerpo').textContent = documento.cuerpo;
      formError('errorPdf');
      $('modalGenerar').close();
      $('modalDocumentoGenerado').showModal();
    } catch (error) { formError('errorGenerar', friendlyError(error)); }
    finally {
      state.generating = false;
      setDialogBusy('modalGenerar', false);
      $('btnCrearVista').textContent = 'Abrir vista previa';
    }
  }

  async function downloadGenerated() {
    if (!state.generatedPayload || state.downloadingGenerated) return;
    state.downloadingGenerated = true;
    $('btnPdfGenerado').disabled = true;
    formError('errorPdf');
    try {
      const blob = await request('/documentos/generar/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.generatedPayload)
      }, true);
      if (blob.type !== 'application/pdf') throw new Error('No se pudo obtener un PDF válido.');
      const url = URL.createObjectURL(blob);
      const anchor = node('a');
      anchor.href = url;
      anchor.download = state.generatedDocument.nombre_archivo;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { formError('errorPdf', friendlyError(error)); }
    finally { state.downloadingGenerated = false; $('btnPdfGenerado').disabled = false; }
  }

  function fillTemplateEditor() {
    const template = state.generationCatalogs?.plantillas.find(item => item.codigo === $('plantillaCodigo').value);
    $('plantillaTitulo').value = template?.titulo || '';
    $('plantillaCuerpo').value = template?.cuerpo || '';
    formError('errorPlantilla');
  }

  async function openTemplateEditor() {
    if ($('modalPlantillas').open) return;
    $('modalPlantillas').showModal();
    formError('errorPlantilla');
    setDialogBusy('modalPlantillas', true);
    try {
      const catalogs = await loadGenerationCatalogs(true);
      $('plantillaCodigo').value = catalogs.plantillas[0]?.codigo || '';
      fillTemplateEditor();
      $('plantillaCampos').replaceChildren(...catalogs.campos.map(campo => {
        const button = node('button', '', '{{' + campo + '}}');
        button.type = 'button';
        button.addEventListener('click', () => {
          const input = $('plantillaCuerpo');
          input.setRangeText('{{' + campo + '}}', input.selectionStart, input.selectionEnd, 'end');
          input.focus();
        });
        return button;
      }));
    } catch (error) { formError('errorPlantilla', friendlyError(error)); }
    finally { setDialogBusy('modalPlantillas', false); }
  }

  async function saveTemplate(event) {
    event.preventDefault();
    if (state.savingTemplate) return;
    state.savingTemplate = true;
    formError('errorPlantilla');
    const codigo = $('plantillaCodigo').value;
    const payload = { titulo: $('plantillaTitulo').value, cuerpo: $('plantillaCuerpo').value };
    setDialogBusy('modalPlantillas', true);
    try {
      const { plantilla } = await request('/documentos/plantillas/' + encodeURIComponent(codigo), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.generationCatalogs.plantillas = state.generationCatalogs.plantillas.map(item => item.codigo === codigo ? plantilla : item);
      $('modalPlantillas').close();
      notify('Plantilla guardada. Se utilizará en los próximos documentos.');
    } catch (error) { formError('errorPlantilla', friendlyError(error)); }
    finally { state.savingTemplate = false; setDialogBusy('modalPlantillas', false); }
  }

  function applyFilters() {
    state.page = 1;
    notify();
    loadDocuments({ preserveSelection: false });
  }

  function clearEmployeeFilter() {
    state.employeeId = '';
    const url = new URL(location.href);
    url.searchParams.delete('empleado_id');
    history.replaceState(null, '', url);
    updateEmployeeFilter();
  }

  function bindEvents() {
    let searchTimer;
    $('fBuscar').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 350);
    });
    ['fEmpresa', 'fTipo', 'fEstado'].forEach(id => $(id).addEventListener('change', () => { clearTimeout(searchTimer); applyFilters(); }));
    $('filtrosDocumentos').addEventListener('submit', event => { event.preventDefault(); clearTimeout(searchTimer); applyFilters(); });
    $('btnLimpiar').addEventListener('click', () => { clearTimeout(searchTimer); $('filtrosDocumentos').reset(); clearEmployeeFilter(); applyFilters(); });
    $('btnQuitarPersona').addEventListener('click', () => { clearEmployeeFilter(); applyFilters(); });
    document.querySelectorAll('.summary-card').forEach(card => card.addEventListener('click', () => {
      $('fEstado').value = $('fEstado').value === card.dataset.estado ? '' : card.dataset.estado;
      clearTimeout(searchTimer);
      applyFilters();
    }));
    $('btnAnterior').addEventListener('click', () => { if (state.page > 1 && !state.loading) { state.page--; loadDocuments({ preserveSelection: false }); } });
    $('btnSiguiente').addEventListener('click', () => { if (state.page * state.limit < state.total && !state.loading) { state.page++; loadDocuments({ preserveSelection: false }); } });
    $('btnReintentar').addEventListener('click', () => loadDocuments());
    $('btnActualizarLista').addEventListener('click', () => loadDocuments());
    $('btnCerrarVista').addEventListener('click', () => clearPreview());
    $('btnDescargar').addEventListener('click', event => downloadFile(state.selected, event.currentTarget));
    $('btnSubir').addEventListener('click', () => openUpload());
    $('btnNuevaVersion').addEventListener('click', () => openUpload(state.selected));
    $('formSubir').addEventListener('submit', submitUpload);
    $('btnObservar').addEventListener('click', () => reviewDocument('rechazado'));
    $('btnValidar').addEventListener('click', () => reviewDocument('validado'));
    $('btnGenerar').addEventListener('click', () => openGenerate());
    document.querySelectorAll('[data-plantilla]').forEach(button => button.addEventListener('click', () => openGenerate(button.dataset.plantilla)));
    $('formGenerar').addEventListener('submit', submitGenerate);
    $('generarEmpleado').addEventListener('change', fillGenerationEmployee);
    $('generarTipo').addEventListener('change', fillGenerationHours);
    $('generarEmpresa').addEventListener('change', fillGenerationAreas);
    $('generarArea').addEventListener('change', fillGenerationPositions);
    $('btnPdfGenerado').addEventListener('click', downloadGenerated);
    $('btnVolverGenerar').addEventListener('click', () => { $('modalDocumentoGenerado').close(); $('modalGenerar').showModal(); });
    $('btnPlantillas').addEventListener('click', openTemplateEditor);
    $('plantillaCodigo').addEventListener('change', fillTemplateEditor);
    $('formPlantilla').addEventListener('submit', saveTemplate);
    $('modalPlantillas').addEventListener('cancel', event => { if (state.savingTemplate) event.preventDefault(); });
    document.querySelectorAll('[data-cerrar]').forEach(button => button.addEventListener('click', () => $(button.dataset.cerrar).close()));
    $('modalSubir').addEventListener('cancel', event => { if (state.uploading) event.preventDefault(); });
    $('modalGenerar').addEventListener('cancel', event => { if (state.generating) event.preventDefault(); });
    window.addEventListener('pagehide', () => {
      state.listController?.abort();
      state.previewController?.abort();
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    });
  }

  async function initialize() {
    const session = await window.SBSSSession.ready;
    if (!session) return;
    bindEvents();
    const initialState = new URLSearchParams(location.search).get('estado');
    if (Object.hasOwn(STATES, initialState)) $('fEstado').value = initialState;
    setCatalogButtons();
    await loadDocuments();
    const initialTemplate = new URLSearchParams(location.search).get('generar');
    if (initialTemplate && state.catalogs) await openGenerate(initialTemplate);
  }

  initialize();
})();
