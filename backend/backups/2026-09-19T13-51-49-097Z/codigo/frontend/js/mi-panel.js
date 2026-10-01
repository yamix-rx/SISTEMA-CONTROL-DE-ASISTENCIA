(() => {
    'use strict';

    const element = (id) => document.getElementById(id);
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const numberFormatter = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });
    const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    const statuses = {
        activo: ['Activo', 'success'], inactivo: ['Inactivo', 'danger'],
        aprobado: ['Aprobado', 'success'], validado: ['Validado', 'success'], entregado: ['Entregado', 'success'],
        presente: ['Presente', 'success'], puntual: ['Puntual', 'success'],
        sin_entregar: ['Sin entregar', 'danger'], pendiente: ['Pendiente', 'warning'], solicitado: ['Solicitado', 'warning'], tardanza: ['Tardanza', 'warning'],
        tarde: ['Tarde', 'warning'], en_revision: ['En revisión', 'info'],
        rechazado: ['Rechazado', 'danger'], falta: ['Falta', 'danger'],
        ausente: ['Ausente', 'danger'], justificado: ['Justificado', 'info'],
        vacaciones: ['Vacaciones', 'info'], permiso: ['Permiso', 'info'],
        descanso: ['Descanso', 'info'], feriado: ['Feriado', 'info'],
        suspendido: ['Suspendido', 'warning'], finalizado: ['Finalizado', 'info']
    };
    let currentSession = null;
    let isLoading = false;
    const pages = { asistencias: 1, permisos: 1 };

    function setText(id, value, fallback = 'No registrado') {
        element(id).textContent = value === null || value === undefined || value === '' ? fallback : String(value);
    }

    function label(value) {
        if (value === null || value === undefined || value === '') return 'No registrado';
        const text = String(value).replace(/_/g, ' ');
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function number(value) {
        if (value === null || value === undefined || value === '') return '—';
        const result = Number(value);
        return Number.isFinite(result) ? numberFormatter.format(result) : '—';
    }

    function date(value) {
        if (!value) return '—';
        // Database DATE values must keep their calendar day across time zones.
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        const result = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
        return Number.isNaN(result.getTime()) ? '—' : dateFormatter.format(result);
    }

    function time(value) {
        if (!value) return '—';
        const result = String(value).match(/^(\d{1,2}):(\d{2})/);
        return result ? `${result[1].padStart(2, '0')}:${result[2]}` : '—';
    }

    function setBadge(node, value) {
        const key = String(value || '').toLowerCase();
        const entry = statuses[key];
        node.className = `badge${entry ? ` badge-${entry[1]}` : ''}`;
        node.textContent = entry ? entry[0] : label(value);
    }

    function cell(value, className) {
        const node = document.createElement('td');
        node.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
        if (className) node.className = className;
        return node;
    }

    function badgeCell(value) {
        const node = document.createElement('td');
        const badge = document.createElement('span');
        setBadge(badge, value);
        node.append(badge);
        return node;
    }

    function table(id, rows, columnCount, emptyMessage, renderRow) {
        const body = element(id);
        body.replaceChildren();
        if (!rows.length) {
            const row = document.createElement('tr');
            const message = cell(emptyMessage, 'empty-cell');
            message.colSpan = columnCount;
            row.append(message);
            body.append(row);
            return;
        }
        const fragment = document.createDocumentFragment();
        rows.forEach((item) => {
            const row = document.createElement('tr');
            row.append(...renderRow(item));
            fragment.append(row);
        });
        body.append(fragment);
    }

    async function openFile(path, filename, button, preview = false) {
        const tab = preview ? window.open('', '_blank') : null;
        if (preview && !tab) { setText('fileStatus', 'Permite ventanas emergentes para abrir la vista previa.'); element('fileStatus').hidden = false; return; }
        if (tab) { tab.opener = null; tab.document.body.textContent = 'Preparando documento…'; }
        button.disabled = true;
        try {
            const response = await SBSSSession.fetch(SBSSSession.API_BASE + path);
            if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.mensaje || 'No se pudo recuperar el archivo.'); }
            const url = URL.createObjectURL(await response.blob());
            if (tab) tab.location.replace(url);
            else { const a = document.createElement('a'); a.href = url; a.download = filename || 'documento'; document.body.append(a); a.click(); a.remove(); }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            element('fileStatus').hidden = true;
        } catch (error) { if (tab) tab.close(); setText('fileStatus', error.message); element('fileStatus').hidden = false; }
        finally { button.disabled = false; }
    }

    function fileButton(label, path, filename, preview = false) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-secondary'; button.textContent = label;
        button.addEventListener('click', () => openFile(path, filename, button, preview));
        return button;
    }

    function fileActions(item) {
        const td = cell(null);
        if (!item.documento_id) return td;
        td.replaceChildren(fileButton('Ver', `/documentos/mios/${item.documento_id}/archivo`, item.nombre_archivo, true), fileButton('Descargar', `/documentos/mios/${item.documento_id}/descargar`, item.nombre_archivo));
        td.className = 'file-actions'; return td;
    }

    function permissionFile(item) {
        const td = cell(null);
        if (item.archivo_sustento) td.replaceChildren(fileButton('Descargar', `/asistencias/permisos/${item.id}/sustento?descargar=1`, item.archivo_sustento_nombre || 'sustento'));
        return td;
    }

    function renderAccount(usuario) {
        const fullName = [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ') || usuario.email || 'Mi cuenta';
        setText('accountName', window.SBSSSession.abbreviateUserName(usuario) || fullName);
        element('accountName').title = fullName;
        setText('accountRole', usuario.rol, 'Colaborador');
        setText('accountInitials', fullName.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase());
        setText('welcomeText', usuario.nombres ? `Hola, ${usuario.nombres}. Aquí puedes consultar tu información personal.` : 'Aquí puedes consultar tu información personal.');
    }

    function render(data) {
        const empleado = data.empleado;
        const horarios = Array.isArray(data.horarios) ? data.horarios : [];
        const asistencias = Array.isArray(data.asistencias) ? data.asistencias : [];
        const documentos = Array.isArray(data.legajoDigital) ? data.legajoDigital : [];
        const permisos = Array.isArray(data.permisos) ? data.permisos : [];
        const progress = data.progresoHoras || {};

        setText('profileName', empleado.colaborador_completo || [empleado.nombres, empleado.apellidos].filter(Boolean).join(' '));
        setText('profileCompany', empleado.empresa);
        setText('profileArea', empleado.area);
        setText('profilePosition', empleado.cargo);
        setText('profileDocument', [empleado.tipo_documento, empleado.numero_documento].filter(Boolean).join(' '));
        setText('profileRelationship', label(empleado.tipo_vinculo));
        setText('profileStartDate', date(empleado.fecha_ingreso));
        setText('profileEmail', currentSession.usuario.email);
        setText('profilePhone', empleado.telefono);
        setText('profileAddress', empleado.direccion);
        setText('profileCareer', empleado.carrera);
        setText('profileSchool', empleado.institucion_educativa);
        setText('profileEnd', date(empleado.fecha_finalizacion));
        setBadge(element('employmentStatus'), empleado.estado);

        const today = new Date().getDay() || 7;
        const todayShifts = horarios.filter((item) => Number(item.dia_semana) === today);
        setText('todaySchedule', todayShifts.length ? todayShifts.map((item) => `${time(item.hora_entrada)} – ${time(item.hora_salida)}`).join(' / ') : 'Sin turno');
        setText('todayScheduleDetail', todayShifts.length ? `${days[today]} · Horario asignado` : `${days[today]} · Sin horario asignado para hoy`);
        const latest = asistencias[0];
        setText('lastAttendance', latest ? date(latest.fecha) : 'Sin registros');
        setText('lastAttendanceDetail', latest ? `${label(latest.estado)} · Ingreso ${time(latest.hora_ingreso)}` : 'Aún no tienes asistencias registradas');
        const pendingDocuments = documentos.filter((item) => (item.es_obligatorio === true || Number(item.es_obligatorio) === 1) && ['sin_entregar', 'pendiente', 'rechazado'].includes(String(item.estado_documento).toLowerCase()));
        setText('pendingDocuments', pendingDocuments.length);
        setText('pendingPermissions', data.resumenHistorial?.permisosSolicitados ?? 0);

        table('scheduleRows', horarios, 4, 'Aún no tienes un horario asignado. Consulta con el responsable de personal.', (item) => [
            cell(days[Number(item.dia_semana)] || 'Día no registrado'), cell(time(item.hora_entrada), 'nowrap'),
            cell(time(item.hora_salida), 'nowrap'), cell(`${number(item.tolerancia_minutos)} min`, 'nowrap')
        ]);
        table('attendanceRows', asistencias, 6, 'Aún no tienes registros de asistencia.', (item) => [
            cell(date(item.fecha), 'nowrap'), cell(time(item.hora_ingreso), 'nowrap'), cell(time(item.hora_salida), 'nowrap'),
            cell(`${number(item.minutos_tardanza)} min`, 'nowrap'), cell(number(item.horas_trabajadas), 'nowrap'), badgeCell(item.estado)
        ]);
        table('documentRows', documentos, 6, 'Aún no hay tipos de documento configurados para tu expediente.', (item) => [
            cell(item.tipo_documento, 'wrap'), cell(item.es_obligatorio === true || Number(item.es_obligatorio) === 1 ? 'Obligatorio' : 'Opcional'),
            cell(item.nombre_archivo || 'Sin archivo registrado', 'wrap'), cell(date(item.fecha_subida), 'nowrap'), badgeCell(item.estado_documento), fileActions(item)
        ]);
        table('permissionRows', permisos, 6, 'Aún no tienes permisos registrados.', (item) => [
            cell(date(item.fecha_inicio) + ' — ' + date(item.fecha_fin), 'nowrap'), cell(time(item.hora_desde) + ' — ' + time(item.hora_hasta), 'nowrap'), cell(label(item.tipo_permiso), 'wrap'), cell(item.motivo, 'wrap'), badgeCell(item.estado), permissionFile(item)
        ]);
        for (const [type, prefix] of [['asistencias', 'attendance'], ['permisos', 'permission']]) {
            const meta = data.paginacion[type];
            pages[type] = meta.pagina;
            setText(prefix + 'Pagination', `Página ${meta.pagina} de ${meta.paginas} · ${meta.total} registros`);
            element(prefix + 'Previous').disabled = meta.pagina <= 1;
            element(prefix + 'Next').disabled = meta.pagina >= meta.paginas;
        }

        const isIntern = progress.esPracticante === true;
        element('progreso').hidden = !isIntern;
        element('practiceNav').hidden = !isIntern;
        if (isIntern) {
            const target = Number(progress.horasMeta) || 0;
            const completed = Number(progress.horasRealizadas) || 0;
            const percentage = target > 0 ? Math.min(100, Math.max(0, Math.round(completed / target * 1000) / 10)) : 0;
            setText('completedHours', `${number(completed)} h`);
            setText('targetHours', target > 0 ? `${number(target)} h` : 'Sin asignar');
            setText('remainingHours', target > 0 ? `${number(Math.max(0, target - completed))} h` : '—');
            setText('progressText', progress.horasCompletadas ? 'HORAS DE PRÁCTICAS COMPLETADAS' : target > 0 ? 'Avance hacia tu meta de prácticas' : 'Tu meta de horas aún no ha sido asignada.');
            setText('progressPercentage', target > 0 ? `${percentage}%` : '—');
            element('practiceProgress').value = percentage;
            element('practiceProgress').textContent = `${percentage}%`;
        }
        setText('updatedAt', `Actualizado a las ${new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`);
    }

    async function loadPanel() {
        if (isLoading || !currentSession) return;
        isLoading = true;
        element('refreshButton').disabled = true;
        element('retryButton').disabled = true;
        element('loadingState').hidden = false;
        element('errorState').hidden = true;
        element('panelContent').hidden = true;
        element('mainContent').setAttribute('aria-busy', 'true');
        try {
            const params = new URLSearchParams({ asistencias_pagina: pages.asistencias, permisos_pagina: pages.permisos });
            const response = await window.SBSSSession.fetch(`${window.SBSSSession.API_BASE}/mi-panel?${params}`, {
                cache: 'no-store', signal: AbortSignal.timeout(15000)
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload || !payload.ok || !payload.data || !payload.data.empleado) {
                throw new Error(payload?.mensaje || 'No fue posible consultar tu información. Vuelve a intentarlo.');
            }
            render(payload.data);
            element('panelContent').hidden = false;
        } catch (error) {
            const message = error?.name === 'TimeoutError'
                ? 'El servidor tardó demasiado en responder. Vuelve a intentarlo.'
                : error instanceof TypeError
                    ? 'No se pudo conectar con el servidor. Comprueba que el programa esté en ejecución y vuelve a intentarlo.'
                    : error?.message || 'No se pudo cargar tu información. Vuelve a intentarlo.';
            setText('errorMessage', message);
            element('errorState').hidden = false;
        } finally {
            element('loadingState').hidden = true;
            element('refreshButton').disabled = false;
            element('retryButton').disabled = false;
            element('mainContent').removeAttribute('aria-busy');
            isLoading = false;
        }
    }

    function setMenuOpen(open) {
        element('personalSidebar').classList.toggle('is-open', open);
        element('sidebarBackdrop').hidden = !open;
        element('menuToggle').setAttribute('aria-expanded', String(open));
        element('menuToggle').setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }

    element('menuToggle').addEventListener('click', () => setMenuOpen(element('menuToggle').getAttribute('aria-expanded') !== 'true'));
    element('sidebarBackdrop').addEventListener('click', () => setMenuOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && element('menuToggle').getAttribute('aria-expanded') === 'true') {
            setMenuOpen(false);
            element('menuToggle').focus();
        }
    });
    document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach((item) => item.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'location');
        setMenuOpen(false);
        const section = document.querySelector(link.getAttribute('href'));
        if (section && !section.hidden) {
            section.setAttribute('tabindex', '-1');
            section.focus({ preventScroll: true });
        }
    }));
    window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
        if (event.matches) setMenuOpen(false);
    });
    element('logoutButton').addEventListener('click', () => window.SBSSSession.logout());
    element('refreshButton').addEventListener('click', loadPanel);
    element('retryButton').addEventListener('click', loadPanel);
    for (const [type, prefix] of [['asistencias', 'attendance'], ['permisos', 'permission']]) {
        element(prefix + 'Previous').addEventListener('click', () => { if (!isLoading && pages[type] > 1) { pages[type]--; loadPanel(); } });
        element(prefix + 'Next').addEventListener('click', () => { if (!isLoading) { pages[type]++; loadPanel(); } });
    }

    async function initialize() {
        try {
            currentSession = await window.SBSSSession.ready;
            if (!currentSession || !currentSession.acceso?.modulos?.includes('mi-panel')) return;
            renderAccount(currentSession.usuario);
            await loadPanel();
        } catch {
            element('loadingState').hidden = true;
            setText('errorMessage', 'No se pudo verificar tu sesión. Recarga la página para volver a intentarlo.');
            element('errorState').hidden = false;
            element('retryButton').addEventListener('click', () => window.location.reload(), { once: true });
        }
    }

    initialize();
})();
