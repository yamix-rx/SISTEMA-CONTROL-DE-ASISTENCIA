(function () {
    'use strict';

    const status = document.getElementById('estadoCarga');
    const message = document.getElementById('mensajeCarga');
    const retry = document.getElementById('btnReintentar');
    const summary = document.getElementById('resumenHoy');
    const documentState = document.getElementById('estadoDocumentos');
    const documentTable = document.getElementById('tablaDocumentos');
    const documents = document.getElementById('documentosPendientes');
    let loading = false;
    const create = (tag, value, cls) => { const element = document.createElement(tag); if (value != null) element.textContent = String(value); if (cls) element.className = cls; return element; };
    const num = value => Number(value || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 });

    function showFollowup(data) {
        const body = document.getElementById('seguimientoPracticas'); body.replaceChildren();
        const rows = data.seguimientoPracticas || [];
        rows.forEach(item => {
            const row = create('tr'), person = create('a', item.colaborador);
            person.href = 'FichaIndividual.html?empleado_id=' + encodeURIComponent(item.empleado_id);
            const first = create('td'); first.append(person); row.append(first);
            [item.empresa, num(item.horas_realizadas) + ' / ' + num(item.horas_meta) + ' h', num(item.horas_pendientes) + ' h'].forEach(value => row.append(create('td', value)));
            const advance = create('td'), progress = create('progress'); progress.max = 100; progress.value = Number(item.porcentaje_avance); progress.setAttribute('aria-label', 'Avance de ' + item.colaborador);
            advance.append(progress, create('span', num(item.porcentaje_avance) + ' %')); row.append(advance);
            const completed = Number(item.horas_realizadas) >= Number(item.horas_meta);
            row.append(create('td', completed ? 'HORAS DE PRÁCTICAS COMPLETADAS' : Number(item.porcentaje_avance) >= 80 ? 'Próximo a completar' : 'En progreso'));
            body.append(row);
        });
        if (!rows.length) { const row = create('tr'), cell = create('td', 'No hay practicantes con una meta asignada.'); cell.colSpan = 6; row.append(cell); body.append(row); }
        const alerts = document.getElementById('alertasSeguimiento'); alerts.replaceChildren();
        const add = (message, href) => { const p = create('p'); p.append(create('span', message + ' ')); const a = create('a', 'Ver expediente'); a.href = href; p.append(a); alerts.append(p); };
        (data.practicantesProximos || []).forEach(item => add(item.colaborador + ': próximo a completar sus horas; faltan ' + num(item.horas_pendientes) + ' h.', 'FichaIndividual.html?empleado_id=' + item.empleado_id));
        (data.practicantesCompletados || []).forEach(item => add(item.colaborador + ': HORAS DE PRÁCTICAS COMPLETADAS.', 'FichaIndividual.html?empleado_id=' + item.empleado_id));
        (data.contratosPorVencer || []).forEach(item => add(item.colaborador + ': ' + item.tipo_contrato + ' vence el ' + String(item.fecha_fin).slice(0, 10) + ' (' + num(item.dias_restantes) + ' días).', 'FichaIndividual.html?empleado_id=' + item.empleado_id));
        (data.tardanzasAcumuladas || []).forEach(item => add(item.colaborador + ': ' + num(item.tardanzas) + ' tardanzas este mes, ' + num(item.minutos) + ' minutos acumulados.', 'FichaIndividual.html?empleado_id=' + item.empleado_id));
        if (!alerts.children.length) alerts.append(create('p', 'Sin alertas de horas, vencimientos ni tardanzas acumuladas.'));
        const agreements = document.getElementById('alertasConvenios'); agreements.replaceChildren();
        (data.conveniosPorVencer || []).forEach(item => {
            const p = create('p'), a = create('a', 'Ver expediente');
            const date = String(item.fecha_vencimiento_convenio).slice(0, 10).split('-').reverse().join('/');
            const when = Number(item.dias_restantes) === 0 ? 'hoy' : 'en ' + num(item.dias_restantes) + ' días';
            p.append(create('span', item.colaborador + ' · ' + item.empresa + ': convenio de prácticas vence ' + when + ' (' + date + '). '));
            a.href = 'FichaIndividual.html?vista=practicantes&empleado_id=' + encodeURIComponent(item.empleado_id); p.append(a); agreements.append(p);
        });
        if (!agreements.children.length) agreements.append(create('p', 'No hay convenios de prácticas por vencer en los próximos 30 días.'));
        [['kpiTrabajadores', 'trabajadoresActivos'], ['kpiPracticantes', 'practicantesActivos'], ['kpiFaltas', 'faltasHoy'], ['kpiPermisos', 'permisosHoy']].forEach(([id, key]) => { document.getElementById(id).textContent = num(data.kpis[key]); });
    }

    function showDocuments(rows) {
        documents.replaceChildren();
        rows.forEach(item => {
            const row = document.createElement('tr');
            [item.colaborador, item.empresa, item.documento_faltante].forEach((value, index) => {
                const cell = document.createElement('td');
                if (index === 0) { const a = create('a', value || 'Colaborador'); a.href = 'Documentos.html?empleado_id=' + encodeURIComponent(item.empleado_id); cell.append(a); }
                else cell.textContent = value || 'Sin información';
                row.appendChild(cell);
            });
            documents.appendChild(row);
        });
        documentTable.hidden = rows.length === 0;
        documentState.hidden = rows.length > 0;
        documentState.textContent = 'No hay documentos obligatorios pendientes de entrega.';
    }

    async function loadSummary() {
        if (loading) return;
        loading = true;
        status.hidden = false;
        status.classList.remove('is-error');
        message.textContent = 'Cargando el resumen de hoy…';
        retry.hidden = true;
        summary.setAttribute('aria-busy', 'true');
        documentState.hidden = false;
        documentState.textContent = 'Cargando documentos pendientes…';
        documentTable.hidden = true;

        try {
            const params = new URLSearchParams();
            const select = document.getElementById('empresaResumen');
            if (select.value) params.set('empresa_id', select.value);
            const response = await window.SBSSSession.fetch(`${window.SBSSSession.API_BASE}/dashboard?${params}`, {
                cache: 'no-store', signal: AbortSignal.timeout(15000)
            });
            if (!response.ok) throw new Error('No se pudo consultar el resumen.');
            const data = await response.json();
            if (!data.ok || !data.kpis || !Array.isArray(data.alertasDocumentos)) {
                throw new Error('El resumen no está disponible.');
            }
            document.getElementById('kpiTurno').textContent = data.kpis.enTurnoHoy ?? '—';
            document.getElementById('kpiAsistencia').textContent = data.kpis.porcentajeAsistencia ?? '—';
            document.getElementById('kpiTardanzas').textContent = data.kpis.tardanzasHoy ?? '—';
            document.getElementById('kpiDocumentos').textContent = data.kpis.documentosPendientes ?? '—';
            showDocuments(data.alertasDocumentos);
            showFollowup(data);
            if (select.options.length === 1) (data.empresas || []).forEach(item => select.append(new Option(item.razon_social, item.id)));
            status.hidden = true;
        } catch (_) {
            status.classList.add('is-error');
            message.textContent = 'No pudimos cargar el resumen. Revisa la conexión con el servidor y vuelve a intentar.';
            retry.hidden = false;
            documentState.textContent = 'No se pudieron consultar los documentos pendientes.';
        } finally {
            loading = false;
            summary.setAttribute('aria-busy', 'false');
        }
    }

    async function init() {
        const session = await window.SBSSSession.ready;
        if (!session) return;
        const name = (session.usuario.nombres || '').trim();
        document.getElementById('saludo').textContent = name ? `Hola, ${name}` : 'Hola, bienvenido';
        const now = new Date();
        const date = document.getElementById('fechaHoy');
        date.dateTime = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
        date.textContent = new Intl.DateTimeFormat('es-PE', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }).format(now);
        retry.addEventListener('click', loadSummary);
        document.getElementById('empresaResumen').addEventListener('change', loadSummary);
        document.getElementById('btnActualizarResumen').addEventListener('click', loadSummary);
        await loadSummary();
    }

    init();
    window.addEventListener('storage', event => { if (event.key === 'sbss_asistencia_actualizada') loadSummary(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && SBSSSession.current) loadSummary(); });
})();
