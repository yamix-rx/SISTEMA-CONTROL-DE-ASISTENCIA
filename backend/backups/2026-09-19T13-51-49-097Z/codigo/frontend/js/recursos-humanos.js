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

    function showDocuments(rows) {
        documents.replaceChildren();
        rows.forEach(item => {
            const row = document.createElement('tr');
            [item.colaborador, item.empresa, item.documento_faltante].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value || 'Sin información';
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
            const response = await window.SBSSSession.fetch(`${window.SBSSSession.API_BASE}/dashboard`, {
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
        await loadSummary();
    }

    init();
})();
