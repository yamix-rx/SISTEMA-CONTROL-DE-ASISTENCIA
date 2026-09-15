// Panel conectado a la API autenticada. Los archivos y estados se guardan en el servidor.
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const STATES = {
    sin_entregar: 'Sin entregar', pendiente: 'Por revisar',
    validado: 'Validado', rechazado: 'Observado'
  };
  const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
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
      } else {
        preview = node('object');
        preview.type = 'application/pdf';
        preview.data = `${state.previewUrl}#toolbar=0&navpanes=0&view=FitH`;
        preview.setAttribute('aria-label', `Vista previa de ${row.nombre_archivo}`);
        preview.appendChild(node('p', '', 'Tu navegador no muestra PDF aquí. Usa el botón Descargar documento.'));
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
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || (file.type && !ALLOWED_MIME.has(file.type))) {
      formError('errorSubir', 'Selecciona un archivo PDF, JPG o PNG.');
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
    dialog.querySelectorAll('button, input, select').forEach(element => {
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

  function openGenerate(type = 'carta') {
    if (!state.catalogs) return;
    $('formGenerar').reset();
    formError('errorGenerar');
    $('generarTipo').value = type;
    $('generarEmpleado').value = state.selected ? String(state.selected.empleado_id) : state.employeeId;
    $('modalGenerar').showModal();
  }

  function writePrintPreview(win, ficha, type) {
    const employee = ficha.empleado;
    const titles = { carta: 'CARTA DE PRESENTACIÓN', horas: 'CONSTANCIA DE HORAS', trabajo: 'CERTIFICADO DE TRABAJO' };
    const title = titles[type];
    const doc = win.document;
    doc.documentElement.lang = 'es';
    doc.title = `${title} - ${employee.colaborador_completo}`;
    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'UTF-8');
    const viewport = doc.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0';
    const style = doc.createElement('style');
    style.textContent = '*{box-sizing:border-box}body{margin:0;background:#edf2f7;color:#24354b;font:15px/1.8 Georgia,serif}.toolbar{padding:16px 24px;background:#114e79;color:white;display:flex;align-items:center;justify-content:space-between;gap:20px;font:13px/1.5 Arial,sans-serif}.toolbar button{border:0;border-radius:5px;padding:11px 16px;cursor:pointer;background:white;color:#135780;font-weight:700}.toolbar p{margin:0}.sheet{background:white;max-width:794px;min-height:1000px;margin:30px auto;padding:65px 70px;box-shadow:0 2px 12px #1233}.brand{font:700 19px/1.4 Arial,sans-serif;color:#174f77;border-bottom:2px solid #174f77;padding-bottom:16px;margin:0 0 8px}.draft{font:11px/1.5 Arial,sans-serif;color:#6c7989;margin:0 0 55px}h1{text-align:center;font:700 20px/1.5 Arial,sans-serif;letter-spacing:.8px;margin:0 0 45px}.sheet p{margin:0 0 23px;overflow-wrap:anywhere}.date{text-align:right;margin-top:40px!important}.signature{margin:90px 0 0;border-top:1px solid #455;width:280px;padding-top:10px;text-align:center;font:13px/1.7 Arial,sans-serif}.signature span{display:block;color:#687887;font-size:11px}.source{margin-top:60px!important;color:#6d7989;font:10px/1.6 Arial,sans-serif;border-top:1px solid #ddd;padding-top:12px}@page{size:A4;margin:20mm}@media print{body{background:white}.toolbar{display:none}.sheet{max-width:none;min-height:0;padding:0;margin:0;box-shadow:none}.draft{color:#444}.source{break-inside:avoid}}@media(max-width:600px){.sheet{padding:35px 25px;margin:15px}.toolbar{align-items:flex-start}.toolbar button{flex-shrink:0;padding:10px}.sheet h1{font-size:18px}.signature{max-width:100%}}';
    doc.head.replaceChildren(charset, viewport, style, doc.createElement('title'));
    doc.title = `${title} - ${employee.colaborador_completo}`;
    const create = (tag, cls, value) => {
      const element = doc.createElement(tag);
      if (cls) element.className = cls;
      if (value !== undefined) element.textContent = String(value);
      return element;
    };
    const toolbar = create('div', 'toolbar');
    const instruction = create('p', '', 'Vista previa para impresión · Revisa el contenido antes de emitirlo. En la ventana de impresión puedes elegir Guardar como PDF.');
    const print = create('button', '', 'Imprimir / Guardar PDF');
    print.type = 'button';
    print.addEventListener('click', () => win.print());
    toolbar.append(instruction, print);
    const sheet = create('main', 'sheet');
    sheet.append(create('div', 'brand', employee.empresa), create('p', 'draft', 'BORRADOR · Pendiente de revisión y firma del responsable'), create('h1', '', title));
    const fullName = employee.colaborador_completo || `${employee.nombres} ${employee.apellidos}`;
    const identity = `${employee.tipo_documento || 'Documento'} N.° ${employee.numero_documento}`;
    if (type === 'carta') {
      sheet.append(create('p', '', 'A quien corresponda:'), create('p', '', `Por medio de la presente, ${employee.empresa} presenta a ${fullName}, identificado(a) con ${identity}, registrado(a) como ${employee.cargo || 'colaborador(a)'} en el área de ${employee.area || 'la empresa'}.`), create('p', '', 'Esta carta se extiende para su presentación y para las gestiones que correspondan. La información consignada procede de su ficha de personal y debe ser verificada por el responsable antes de la firma.'));
    } else if (type === 'horas') {
      const hours = Number(ficha.progresoHoras?.horasRealizadas);
      if (!Number.isFinite(hours)) throw new Error('No hay información válida de horas para generar la constancia.');
      sheet.append(create('p', '', `Se deja constancia de que ${fullName}, identificado(a) con ${identity}, registra un total de ${hours.toLocaleString('es-PE', { maximumFractionDigits: 2 })} horas de asistencia en ${employee.empresa}, de acuerdo con la información disponible en el sistema al momento de esta consulta.`), create('p', '', `Área: ${employee.area || 'Sin área registrada'}. Cargo: ${employee.cargo || 'Sin cargo registrado'}.`), create('p', '', 'La cantidad corresponde a la suma de las horas registradas en las asistencias del colaborador. El responsable deberá revisar y validar estos registros antes de emitir la constancia.'));
    } else {
      if (employee.tipo_vinculo !== 'trabajador') throw new Error('El certificado de trabajo corresponde a colaboradores con vínculo de trabajador. Para esta persona puedes generar una carta de presentación o constancia de horas.');
      const joining = employee.fecha_ingreso ? ` con fecha de ingreso ${displayDate(employee.fecha_ingreso)}` : '';
      sheet.append(create('p', '', `${employee.empresa} hace constar que ${fullName}, identificado(a) con ${identity}, figura en sus registros de personal como trabajador(a) en el cargo de ${employee.cargo || 'cargo no registrado'}, en el área de ${employee.area || 'área no registrada'}${joining}.`), create('p', '', `Estado registrado en el sistema: ${employee.estado || 'No especificado'}.`), create('p', '', 'Se extiende el presente documento con base en la información de su ficha de personal. Los datos y el período laboral deberán ser confirmados por el responsable antes de su emisión.'));
    }
    sheet.appendChild(create('p', 'date', `Fecha de elaboración: ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`));
    const signature = create('div', 'signature', 'Firma del responsable');
    signature.append(create('span', '', 'Nombre y cargo: ________________________'));
    sheet.append(signature, create('p', 'source', 'Elaborado desde SBSS con los datos actuales del sistema. Este borrador no contiene firma ni sello de autorización.'));
    doc.body.replaceChildren(toolbar, sheet);
  }

  async function submitGenerate(event) {
    event.preventDefault();
    if (state.generating) return;
    formError('errorGenerar');
    if (!$('generarEmpleado').value) return;
    // Abrir durante el clic evita que los navegadores bloqueen la ventana tras el fetch.
    const preview = window.open('', '_blank');
    if (!preview) {
      formError('errorGenerar', 'El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio y vuelve a generar el documento.');
      return;
    }
    preview.opener = null;
    preview.document.title = 'Preparando documento';
    preview.document.body.textContent = 'Preparando la vista previa con los datos del colaborador…';
    const employeeId = $('generarEmpleado').value;
    const type = $('generarTipo').value;
    state.generating = true;
    setDialogBusy('modalGenerar', true);
    $('btnCrearVista').textContent = 'Preparando…';
    try {
      const data = await request(`/personal/${employeeId}`);
      const ficha = data.data || data;
      if (!ficha.empleado) throw new Error('No se encontraron los datos del colaborador.');
      if (preview.closed) throw new Error('Se cerró la ventana de vista previa. Genera el documento nuevamente.');
      writePrintPreview(preview, ficha, type);
      $('modalGenerar').close();
    } catch (error) {
      if (!preview.closed) preview.close();
      formError('errorGenerar', friendlyError(error));
    } finally {
      state.generating = false;
      setDialogBusy('modalGenerar', false);
      $('btnCrearVista').textContent = 'Abrir vista previa';
    }
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
  }

  initialize();
})();
