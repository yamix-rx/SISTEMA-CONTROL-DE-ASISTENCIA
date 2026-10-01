(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { ficha: null, catalogos: { empresas: [], areas: [], cargos: [] }, revision: 0, listaRevision: 0, paginas: { asistencias: 1, permisos: 1 } };
  const initialId = new URLSearchParams(location.search).get('empleado_id');
  const onlyInterns = new URLSearchParams(location.search).get('vista') === 'practicantes';
  const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const number = value => Number(value || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 });
  const date = value => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
  const time = value => value ? String(value).slice(0, 5) : '—';
  const node = (tag, value, cls) => { const el = document.createElement(tag); if (value != null) el.textContent = String(value); if (cls) el.className = cls; return el; };
  const text = (id, value) => { $(id).textContent = value ?? '—'; };
  function notice(message, error = false) { text('mensaje', message); $('mensaje').hidden = !message; $('mensaje').classList.toggle('error', error); }
  async function api(path, options = {}) {
    const response = await SBSSSession.fetch(SBSSSession.API_BASE + path, { cache: 'no-store', ...options });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.mensaje || 'No se pudo completar la solicitud.');
    return data;
  }
  function fill(select, rows, label, first, current = '') {
    select.replaceChildren(new Option(first, ''));
    rows.forEach(row => select.append(new Option(label(row), row.id)));
    select.value = current;
  }
  function table(id, rows, columns, render) {
    const body = $(id); body.replaceChildren();
    if (!rows.length) { const tr = node('tr'), td = node('td', 'No hay registros.', 'empty'); td.colSpan = columns; tr.append(td); body.append(tr); return; }
    rows.forEach(item => { const tr = node('tr'); render(item).forEach(value => { const td = node('td'); value instanceof Node ? td.append(value) : td.textContent = value ?? '—'; tr.append(td); }); body.append(tr); });
  }
  function metrics(id, values) {
    $(id).replaceChildren(...values.map(([label, value]) => { const div = node('div', null, 'metric'); div.append(node('span', label), node('strong', value)); return div; }));
  }
  function selectAreas(prefix, current = '') {
    const empresa = $(prefix === 'p' ? 'pEmpresa' : 'filtroEmpresa').value;
    const target = $(prefix === 'p' ? 'pArea' : 'filtroArea');
    fill(target, state.catalogos.areas.filter(item => !empresa || String(item.empresa_id) === empresa), item => item.nombre, prefix === 'p' ? 'Seleccione área' : 'Todas las áreas', current);
  }
  function selectCargos(prefix, current = '') {
    const area = $(prefix === 'p' ? 'pArea' : 'filtroArea').value;
    const empresa = $(prefix === 'p' ? 'pEmpresa' : 'filtroEmpresa').value;
    const areas = new Set(state.catalogos.areas.filter(item => !empresa || String(item.empresa_id) === empresa).map(item => Number(item.id)));
    fill($(prefix === 'p' ? 'pCargo' : 'filtroCargo'), state.catalogos.cargos.filter(item => area ? String(item.area_id) === area : areas.has(Number(item.area_id))), item => item.nombre, prefix === 'p' ? 'Seleccione cargo' : 'Todos los cargos', current);
  }
  async function loadCatalogs() {
    state.catalogos = (await api('/personal/catalogos')).data;
    fill($('filtroEmpresa'), state.catalogos.empresas, x => x.razon_social, 'Todas las empresas');
    fill($('pEmpresa'), state.catalogos.empresas, x => x.razon_social, 'Seleccione empresa');
    selectAreas('f'); selectCargos('f');
  }
  async function loadList(preferredId) {
    const revision = ++state.listaRevision;
    const params = new URLSearchParams();
    if (onlyInterns) params.set('tipo_vinculo', 'practicante');
    [['buscar', 'buscar'], ['filtroEmpresa', 'empresa_id'], ['filtroArea', 'area_id'], ['filtroCargo', 'cargo_id'], ['filtroEstado', 'estado']].forEach(([id, key]) => { if ($(id).value.trim()) params.set(key, $(id).value.trim()); });
    try {
      const data = await api('/personal?' + params);
      if (revision !== state.listaRevision) return;
      const rows = (data.data || []).filter(item => !onlyInterns || String(item.tipo_vinculo || '').toLowerCase().startsWith('practicante'));
      const wanted = String(preferredId || state.ficha?.empleado.id || '');
      const selected = rows.find(item => String(item.id) === wanted)?.id || rows[0]?.id;
      fill($('selectColaborador'), rows, x => x.colaborador + ' · ' + x.numero_documento + ' · ' + x.estado, rows.length ? 'Seleccione un colaborador' : 'No hay personal con estos filtros', selected || '');
      text('totalColaboradores', '(' + rows.length + ')');
      if (selected) await loadFicha(selected, true);
      else { ++state.revision; state.ficha = null; $('expediente').hidden = true; $('estadoFicha').hidden = false; text('estadoFicha', 'No se encontraron colaboradores con estos filtros.'); }
    } catch (error) { notice(error.message, true); }
  }
  async function loadFicha(id, reset = false) {
    if (reset) state.paginas = { asistencias: 1, permisos: 1 };
    const revision = ++state.revision;
    $('estadoFicha').hidden = false; text('estadoFicha', 'Cargando expediente…');
    $('expediente').setAttribute('aria-busy', 'true');
    const params = new URLSearchParams({ asistencias_pagina: state.paginas.asistencias, permisos_pagina: state.paginas.permisos });
    try {
      const data = await api('/personal/' + encodeURIComponent(id) + '?' + params);
      if (revision !== state.revision) return;
      const changed = Number(state.ficha?.empleado.id) !== Number(data.data.empleado.id);
      state.ficha = data.data;
      renderFicha(changed);
      $('expediente').hidden = false; $('estadoFicha').hidden = true;
      const url = new URL(location.href); url.searchParams.set('empleado_id', id); history.replaceState(null, '', url);
    } catch (error) { if (revision === state.revision) { $('expediente').hidden = true; text('estadoFicha', error.message); } }
    finally { if (revision === state.revision) $('expediente').removeAttribute('aria-busy'); }
  }
  function renderFicha(changed) {
    const data = state.ficha, e = data.empleado, p = data.progresoHoras, resumen = data.resumenHistorial || {};
    text('nombre', e.colaborador_completo); text('badgeEstado', e.estado);
    const fields = [['Documento', e.tipo_documento + ' ' + e.numero_documento], ['Empresa', e.empresa], ['Área', e.area], ['Cargo', e.cargo], ['Puesto', e.puesto], ['Vínculo', e.tipo_vinculo], ['Nacimiento', date(e.fecha_nacimiento)], ['Teléfono', e.telefono], ['Correo', e.correo_personal], ['Dirección', e.direccion], ['Carrera', e.carrera], ['Universidad / Instituto', e.institucion_educativa], ['Ingreso', date(e.fecha_ingreso)], ['Finalización', date(e.fecha_finalizacion)]];
    if (p.esPracticante || e.fecha_vencimiento_convenio) fields.push(['Vencimiento del convenio de prácticas', e.fecha_vencimiento_convenio ? date(e.fecha_vencimiento_convenio) : 'No registrado']);
    $('datosPersonales').replaceChildren(...fields.map(([label, value]) => { const div = node('div'); div.append(node('dt', label), node('dd', value || 'No registrado')); return div; }));
    if (changed || !$('obs').dataset.dirty) { $('obs').value = e.observaciones_rrhh || ''; delete $('obs').dataset.dirty; text('estadoObs', ''); }
    table('horariosRows', data.horarios || [], 4, h => [days[h.dia_semana], time(h.hora_entrada), time(h.hora_salida), number(h.tolerancia_minutos) + ' min']);
    metrics('horasResumen', [['Meta', p.esPracticante ? number(p.horasMeta) + ' h' : 'No aplica'], ['Realizadas', number(p.horasRealizadas) + ' h'], ['Pendientes', p.esPracticante ? number(p.horasPendientes) + ' h' : 'No aplica']]);
    $('progress').hidden = !p.esPracticante; $('progress').value = parseFloat(p.porcentajeAvance) || 0;
    text('progressText', p.esPracticante ? number(p.horasRealizadas) + ' / ' + number(p.horasMeta) + ' horas · ' + p.porcentajeAvance : 'Horas acumuladas de asistencia.');
    text('estadoProgreso', p.esPracticante ? p.estado : 'Jornada laboral ordinaria');
    const pendientes = (data.legajoDigital || []).filter(d => Number(d.es_obligatorio) === 1 && d.estado_documento !== 'validado').length;
    const alerts = [];
    if (p.esPracticante && p.horasCompletadas) alerts.push('HORAS DE PRÁCTICAS COMPLETADAS');
    else if (p.esPracticante && parseFloat(p.porcentajeAvance) >= 80) alerts.push('Practicante próximo a completar sus horas: faltan ' + number(p.horasPendientes) + ' horas.');
    if (pendientes) alerts.push(pendientes + ' documento(s) obligatorio(s) por entregar, revisar o corregir.');
    if (Number(resumen.tardanzas) >= 3) alerts.push(number(resumen.tardanzas) + ' tardanzas acumuladas en todo el historial (' + number(resumen.minutos_tardanza) + ' minutos).');
    if (!data.horarios?.length) alerts.push('Sin horario activo asignado.');
    if (e.fecha_finalizacion) { const faltan = Math.ceil((new Date(String(e.fecha_finalizacion).slice(0, 10) + 'T23:59:59') - new Date()) / 86400000); if (faltan >= 0 && faltan <= 30) alerts.push('Fecha de finalización de la ficha dentro de ' + faltan + ' día(s).'); }
    if (p.esPracticante && e.estado === 'activo' && e.fecha_vencimiento_convenio) {
      const hoy = new Date(), currentDay = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const dias = Math.round((Date.parse(String(e.fecha_vencimiento_convenio).slice(0, 10) + 'T00:00:00Z') - currentDay) / 86400000);
      if (dias >= 0 && dias <= 30) alerts.push('El convenio de prácticas vence ' + (dias === 0 ? 'hoy' : 'en ' + dias + ' día(s)') + ' (' + date(e.fecha_vencimiento_convenio) + ').');
    }
    $('alertasFicha').replaceChildren(...(alerts.length ? alerts : ['Sin alertas del expediente.']).map(value => node('li', value)));
    $('abrirDocumentos').href = 'Documentos.html?empleado_id=' + e.id;
    $('abrirReportes').href = 'Reportes.html?empleado_id=' + e.id;
    table('documentosRows', data.legajoDigital || [], 5, d => [d.tipo_documento, Number(d.es_obligatorio) === 1 ? 'Obligatorio' : 'Opcional', d.nombre_archivo || 'Sin entregar', date(d.fecha_subida), d.estado_documento === 'sin_entregar' ? 'Sin entregar' : d.estado_documento]);
    $('docsGenerated').replaceChildren(...[['aceptacion', 'Carta de aceptación'], ['constancia_practicas', 'Constancia de prácticas'], ['culminacion', 'Carta de culminación']].map(([tipo, label]) => { const a = node('a', label, 'button'); a.href = 'Documentos.html?empleado_id=' + e.id + '&generar=' + tipo; return a; }));
    metrics('resumenHistorial', [['Asistencias', number(resumen.asistencias)], ['Faltas', number(resumen.faltas)], ['Tardanzas', number(resumen.tardanzas)], ['Minutos de tardanza', number(resumen.minutos_tardanza)], ['Permisos', number(resumen.permisos)]]);
    table('asistenciasRows', data.asistencias || [], 8, a => [date(a.fecha), time(a.hora_programada), time(a.hora_ingreso), time(a.hora_salida), number(a.horas_trabajadas), number(a.minutos_tardanza) + ' min', a.estado, a.observacion]);
    table('permisosRows', data.permisos || [], 7, p => [date(p.fecha_inicio) + ' — ' + date(p.fecha_fin), time(p.hora_desde) + ' — ' + time(p.hora_hasta), p.tipo_permiso, p.motivo, p.observaciones, p.estado, sustentoButton(p)]);
    for (const type of ['asistencias', 'permisos']) {
      const meta = data.paginacion[type]; state.paginas[type] = meta.pagina;
      text(type + 'Pagina', 'Página ' + meta.pagina + ' de ' + meta.paginas + ' · ' + meta.total + ' registros');
      $(type + 'Anterior').disabled = meta.pagina <= 1; $(type + 'Siguiente').disabled = meta.pagina >= meta.paginas;
    }
  }
  function sustentoButton(p) {
    if (!p.archivo_sustento) return '—';
    const b = node('button', 'Descargar', 'button'); b.type = 'button';
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await SBSSSession.fetch(SBSSSession.API_BASE + '/asistencias/permisos/' + p.id + '/sustento?descargar=1');
        if (!r.ok) { const error = await r.json().catch(() => ({})); throw new Error(error.mensaje || 'No se pudo descargar el sustento.'); }
        const url = URL.createObjectURL(await r.blob()), a = node('a'); a.href = url; a.download = p.archivo_sustento_nombre || 'sustento'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) { notice(error.message, true); }
      finally { b.disabled = false; }
    }); return b;
  }
  function practiceFields() { const practicante = $('pVinculo').value.startsWith('practicante'); $('horasPracticasField').hidden = !practicante; $('pHorasPracticas').required = practicante; $('vencimientoConvenioField').hidden = !practicante; $('pVencimientoConvenio').disabled = !practicante; }
  const fields = { pTipoDocumento: 'tipo_documento', pDocumento: 'numero_documento', pNombres: 'nombres', pApellidos: 'apellidos', pNacimiento: 'fecha_nacimiento', pTelefono: 'telefono', pCorreo: 'correo_personal', pDireccion: 'direccion', pCarrera: 'carrera', pInstitucion: 'institucion_educativa', pEmpresa: 'empresa_id', pArea: 'area_id', pCargo: 'cargo_id', pPuesto: 'puesto', pVinculo: 'tipo_vinculo', pEstado: 'estado', pIngreso: 'fecha_ingreso', pFinalizacion: 'fecha_finalizacion', pVencimientoConvenio: 'fecha_vencimiento_convenio', pHorasPracticas: 'horas_totales_asignadas', pObservaciones: 'observaciones_rrhh' };
  function openForm(edit) {
    $('formPersonal').reset(); $('pId').value = edit ? state.ficha.empleado.id : '';
    $('errorPersonal').hidden = true; text('modalTitulo', onlyInterns ? (edit ? 'Editar ficha del practicante' : 'Registrar practicante') : (edit ? 'Editar ficha del personal' : 'Registrar personal'));
    const e = edit ? state.ficha.empleado : {};
    $('pEmpresa').value = e.empresa_id || ''; selectAreas('p', String(e.area_id || '')); selectCargos('p', String(e.cargo_id || ''));
    if (edit) for (const [id, key] of Object.entries(fields)) $(id).value = key.startsWith('fecha_') ? String(e[key] || '').slice(0, 10) : e[key] ?? '';
    else if (onlyInterns) $('pVinculo').value = 'practicante preprofesional';
    $('pHorasPracticas').value = e.horas_totales_asignadas || 320;
    practiceFields(); $('modalPersonal').showModal();
  }
  $('formPersonal').addEventListener('submit', async event => {
    event.preventDefault(); const b = $('btnGuardarPersonal'); b.disabled = true; $('errorPersonal').hidden = true;
    const payload = Object.fromEntries(Object.entries(fields).map(([id, key]) => [key, $(id).value.trim()]));
    payload.puesto = payload.puesto || null;
    if (!payload.tipo_vinculo.startsWith('practicante')) { payload.horas_totales_asignadas = 0; delete payload.fecha_vencimiento_convenio; }
    else payload.fecha_vencimiento_convenio = payload.fecha_vencimiento_convenio || null;
    try {
      const id = $('pId').value, result = await api('/personal' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      $('modalPersonal').close(); notice(result.mensaje);
      for (const control of ['buscar', 'filtroEmpresa', 'filtroArea', 'filtroCargo', 'filtroEstado']) $(control).value = '';
      selectAreas('f'); selectCargos('f'); delete $('obs').dataset.dirty;
      await loadList(result.id || id);
    } catch (error) { text('errorPersonal', error.message); $('errorPersonal').hidden = false; }
    finally { b.disabled = false; }
  });
  $('formObservaciones').addEventListener('submit', async event => {
    event.preventDefault(); if (!state.ficha) return;
    const id = state.ficha.empleado.id, value = $('obs').value; $('btnGuardarObs').disabled = true;
    try {
      const data = await api('/personal/' + id + '/observaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observaciones_rrhh: value }) });
      if (state.ficha?.empleado.id === id) { state.ficha.empleado.observaciones_rrhh = data.observaciones_rrhh; delete $('obs').dataset.dirty; text('estadoObs', data.mensaje); }
    } catch (error) { text('estadoObs', error.message); }
    finally { $('btnGuardarObs').disabled = false; }
  });
  $('obs').addEventListener('input', () => { $('obs').dataset.dirty = 'true'; text('estadoObs', 'Cambios sin guardar.'); });
  $('btnNuevoPersonal').addEventListener('click', () => openForm(false));
  $('btnEditarPersonal').addEventListener('click', () => openForm(true));
  ['btnCerrarModal', 'btnCancelarModal'].forEach(id => $(id).addEventListener('click', () => $('modalPersonal').close()));
  $('pEmpresa').addEventListener('change', () => { selectAreas('p'); selectCargos('p'); });
  $('pArea').addEventListener('change', () => selectCargos('p')); $('pVinculo').addEventListener('change', practiceFields);
  $('filtroEmpresa').addEventListener('change', () => { selectAreas('f'); selectCargos('f'); loadList(); });
  $('filtroArea').addEventListener('change', () => { selectCargos('f'); loadList(); });
  ['filtroCargo', 'filtroEstado'].forEach(id => $(id).addEventListener('change', () => loadList()));
  let searchTimer; $('buscar').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadList(), 250); });
  $('btnLimpiarFiltros').addEventListener('click', () => { ['buscar', 'filtroEmpresa', 'filtroEstado'].forEach(id => $(id).value = ''); selectAreas('f'); selectCargos('f'); loadList(); });
  $('selectColaborador').addEventListener('change', () => { if ($('selectColaborador').value) loadFicha($('selectColaborador').value, true); });
  for (const type of ['asistencias', 'permisos']) for (const [direction, delta] of [['Anterior', -1], ['Siguiente', 1]]) $(type + direction).addEventListener('click', () => { if (state.ficha) { state.paginas[type] += delta; loadFicha(state.ficha.empleado.id); } });
  window.addEventListener('storage', event => { if (event.key === 'sbss_asistencia_actualizada' && state.ficha) loadFicha(state.ficha.empleado.id); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.ficha && !$('modalPersonal').open) loadFicha(state.ficha.empleado.id); });
  if (onlyInterns) {
    document.title = 'SBSS · Practicantes y expediente'; text('tituloPersonal', 'Practicantes y expediente');
    text('descripcionPersonal', 'Consulta los convenios, las horas y el expediente de los practicantes.'); text('btnNuevoPersonal', '＋ Nuevo practicante');
    Array.from($('pVinculo').options).forEach(option => { option.hidden = option.disabled = !option.value.startsWith('practicante'); });
  }
  (async () => { if (!await SBSSSession.ready) return; try { await loadCatalogs(); await loadList(initialId); } catch (error) { text('estadoFicha', error.message); notice(error.message, true); } })();
})();
