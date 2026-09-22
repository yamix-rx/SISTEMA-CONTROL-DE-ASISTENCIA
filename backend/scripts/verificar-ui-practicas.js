#!/usr/bin/env node
'use strict';
// UI real con respuestas API simuladas en Chrome. Ninguna consulta ni escritura llega a la base.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { CDP } = require('./verificar-navegador');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const base = process.env.SBSS_UI_URL || 'http://127.0.0.1:3000';
  const out = path.resolve(__dirname, '../backups/validacion-ui-practicas'); await fs.mkdir(out, { recursive: true });
  const target = await (await fetch('http://127.0.0.1:9224/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl), errors = [], results = [];
  cdp.on('Runtime.exceptionThrown', data => errors.push(data.exceptionDetails.exception?.description || data.exceptionDetails.text));
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  const day = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const empleado = { id: 42, tipo_documento: 'DNI', numero_documento: '99990001', nombres: 'Practicante', apellidos: 'Prueba UI', colaborador: 'Practicante Prueba UI', colaborador_completo: 'Practicante Prueba UI', empresa_id: 1, empresa: 'Empresa UI', area_id: 2, area: 'Proyectos', cargo_id: 3, cargo: 'Asistente', puesto: 'Apoyo de proyectos <turno A>', tipo_vinculo: 'practicante preprofesional', estado: 'activo', fecha_ingreso: '2026-01-01', fecha_vencimiento_convenio: day, horas_totales_asignadas: 320 };
  const catalogos = { empresas: [{ id: 1, razon_social: 'Empresa UI' }], areas: [{ id: 2, empresa_id: 1, nombre: 'Proyectos' }], cargos: [{ id: 3, area_id: 2, nombre: 'Asistente' }] };
  const ficha = { empleado, progresoHoras: { esPracticante: true, horasMeta: 320, horasRealizadas: 80, horasPendientes: 240, porcentajeAvance: '25%', estado: 'En progreso', horasCompletadas: false }, horarios: [], legajoDigital: [], asistencias: [], permisos: [], resumenHistorial: {}, paginacion: { asistencias: { pagina: 1, paginas: 1, total: 0 }, permisos: { pagina: 1, paginas: 1, total: 0 } } };
  const convenio = { ...empleado, empleado_id: 42, dias_restantes: 10 };
  const setup = '(' + function (fixture) {
    const nativeFetch = window.fetch.bind(window);
    localStorage.setItem('sbss_token', 'simulacion-ui-sin-credenciales-reales');
    localStorage.removeItem('sbss_usuario'); localStorage.removeItem('sbss_acceso');
    window.__uiCalls = []; window.__uiUnknown = []; window.__uiAgreements = [fixture.convenio];
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);
      const method = init.method || 'GET';
      window.__uiCalls.push({ path: url.pathname + url.search, method, body: init.body ? JSON.parse(init.body) : null });
      const response = data => Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
      const isWorker = location.pathname.endsWith('/MiPanel.html'), isAdmin = location.pathname.endsWith('/Dashboard.html');
      const panel = isWorker ? 'MiPanel.html' : isAdmin ? 'Dashboard.html' : 'RecursosHumanos.html';
      if (url.pathname === '/api/auth/perfil') return response({ ok: true, usuario: { nombres: 'Usuario', apellidos: 'UI', rol: isWorker ? 'Trabajador/Practicante' : isAdmin ? 'Administrador General' : 'Recursos Humanos', email: 'ui@example.test' }, acceso: { panel, modulos: ['dashboard', 'rrhh', 'personal', 'mi-panel', 'contratos', 'documentos', 'asistencia', 'horarios', 'reportes', 'empresas', 'administracion', 'auditoria', 'capacitaciones'], permisos: [] } });
      if (url.pathname === '/api/personal/catalogos') return response({ ok: true, data: fixture.catalogos });
      if (url.pathname === '/api/personal' && method === 'GET') return response({ ok: true, data: [fixture.ficha.empleado, { ...fixture.ficha.empleado, id: 43, colaborador: 'Trabajador UI', numero_documento: '99990002', tipo_vinculo: 'trabajador' }] });
      if (url.pathname.startsWith('/api/personal') && ['POST', 'PUT'].includes(method)) return response({ ok: true, id: 42, mensaje: 'Simulación: ficha recibida sin guardar en base de datos.' });
      if (url.pathname === '/api/personal/42' || url.pathname === '/api/personal/43' || url.pathname === '/api/mi-panel') return response({ ok: true, data: fixture.ficha });
      if (url.pathname === '/api/dashboard') return response({ ok: true, kpis: { enTurnoHoy: 0, porcentajeAsistencia: '0%', tardanzasHoy: 0, documentosPendientes: 0, trabajadoresActivos: 1, practicantesActivos: 1, faltasHoy: 0, permisosHoy: 0 }, empresas: fixture.catalogos.empresas, personalEnTurno: [], alertasDocumentos: [], seguimientoPracticas: [], practicantesProximos: [], practicantesCompletados: [], contratosPorVencer: [], tardanzasAcumuladas: [], conveniosPorVencer: window.__uiAgreements });
      if (url.pathname === '/api/contratos/catalogos') return response({ ok: true, data: { empresas: fixture.catalogos.empresas, empleados: [fixture.ficha.empleado], tipos_contrato: ['Plazo fijo', 'Convenio de prácticas'], estados: ['borrador', 'vigente'] } });
      if (url.pathname === '/api/contratos/resumen') return response({ ok: true, data: {} });
      if (url.pathname === '/api/contratos/' || url.pathname === '/api/contratos') return response({ ok: true, data: [], paginacion: { pagina: 1, paginas: 1, total: 0 } });
      window.__uiUnknown.push(url.pathname); return response({ ok: false, mensaje: 'Ruta de prueba no configurada.' });
    };
  }.toString() + ')(' + JSON.stringify({ ficha, catalogos, convenio }) + ');';
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
  async function wait(expression) { const until = Date.now() + 15000; while (Date.now() < until) { try { if (await cdp.evaluate(expression)) return; } catch {} await pause(75); } throw new Error('No alcanzado: ' + expression); }
  async function capture(name) { const image = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(out, name), Buffer.from(image.data, 'base64')); }
  async function navigate(file, expression) { await cdp.send('Page.navigate', { url: base + '/' + file }); await wait(expression); }
  async function safeRequests() { assert.deepEqual(await cdp.evaluate('window.__uiUnknown'), []); }
  async function submit() { await cdp.evaluate('document.getElementById("formPersonal").requestSubmit()'); await wait('!document.getElementById("modalPersonal").open && !document.getElementById("expediente").hidden'); return cdp.evaluate('window.__uiCalls.filter(call=>["POST","PUT"].includes(call.method)).at(-1)'); }
  try {
    for (const width of [390, 1440]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width === 390 });
      await navigate('FichaIndividual.html?vista=practicantes', '!document.getElementById("expediente")?.hidden && document.getElementById("datosPersonales")?.textContent.includes("Apoyo de proyectos")');
      assert.equal(await cdp.evaluate('document.getElementById("selectColaborador").options.length'), 2);
      assert.match(await cdp.evaluate('document.getElementById("btnNuevoPersonal").textContent'), /Nuevo practicante/);
      assert.ok(await cdp.evaluate('window.__uiCalls.some(call=>call.path.includes("tipo_vinculo=practicante"))'));
      assert.ok(await cdp.evaluate('location.search.includes("vista=practicantes") && location.search.includes("empleado_id=42")'));
      assert.equal(await cdp.evaluate('document.querySelectorAll("#datosPersonales turno").length'), 0);
      await cdp.evaluate('document.getElementById("btnNuevoPersonal").click()');
      assert.equal(await cdp.evaluate('document.getElementById("pVinculo").value'), 'practicante preprofesional');
      assert.equal(await cdp.evaluate('document.getElementById("pPuesto").maxLength'), 150);
      assert.equal(await cdp.evaluate('document.getElementById("pPuesto").required'), false);
      assert.equal(await cdp.evaluate('document.getElementById("vencimientoConvenioField").hidden'), false);
      await cdp.evaluate('document.getElementById("pEmpresa").value="1";document.getElementById("pEmpresa").dispatchEvent(new Event("change"));document.getElementById("pArea").value="2";document.getElementById("pArea").dispatchEvent(new Event("change"));document.getElementById("pCargo").value="3";document.getElementById("pDocumento").value="99990003";document.getElementById("pNombres").value="Nueva";document.getElementById("pApellidos").value="Practicante UI";document.getElementById("pIngreso").value="2026-01-01";document.getElementById("pPuesto").value="Apoyo específico UI";document.getElementById("pVencimientoConvenio").value=' + JSON.stringify(day));
      assert.ok(await cdp.evaluate('document.getElementById("formPersonal").checkValidity()'));
      await cdp.evaluate('document.getElementById("pVencimientoConvenio").scrollIntoView({block:"center"})'); await capture('Alta-practicante-' + width + '.png');
      const created = await submit(); assert.equal(created.method, 'POST'); assert.equal(created.body.cargo_id, '3'); assert.equal(created.body.puesto, 'Apoyo específico UI'); assert.equal(created.body.fecha_vencimiento_convenio, day);
      await cdp.evaluate('document.getElementById("btnEditarPersonal").click()');
      assert.equal(await cdp.evaluate('document.getElementById("pPuesto").value'), empleado.puesto);
      assert.equal(await cdp.evaluate('document.getElementById("pVencimientoConvenio").value'), day);
      assert.equal(await cdp.evaluate('document.getElementById("pCargo").value'), '3');
      const bounds = await cdp.evaluate('(()=>{const d=document.getElementById("modalPersonal"),r=d.getBoundingClientRect();return {documentWidth:document.documentElement.scrollWidth,width:innerWidth,dialogWidth:r.width,scrollWidth:d.scrollWidth,clientWidth:d.clientWidth};})()');
      assert.ok(bounds.documentWidth <= width + 2 && bounds.scrollWidth <= bounds.clientWidth + 2, JSON.stringify(bounds));
      await cdp.evaluate('document.getElementById("pVencimientoConvenio").value="";document.getElementById("pPuesto").value=""');
      const cleared = await submit(); assert.equal(cleared.method, 'PUT'); assert.equal(cleared.body.puesto, null); assert.equal(cleared.body.fecha_vencimiento_convenio, null);
      await safeRequests(); results.push({ action: 'Alta, edición y borrado opcional de puesto/convenio; contexto exclusivo de practicantes', width, ok: true, bounds });
    }
    await navigate('FichaIndividual.html', '!document.getElementById("expediente")?.hidden');
    await cdp.evaluate('document.getElementById("btnNuevoPersonal").click()');
    assert.equal(await cdp.evaluate('document.getElementById("pVinculo").value'), 'trabajador');
    assert.equal(await cdp.evaluate('document.getElementById("pVencimientoConvenio").disabled'), true);
    await cdp.evaluate('document.getElementById("btnCancelarModal").click();document.getElementById("btnEditarPersonal").click();document.getElementById("pVinculo").value="trabajador";document.getElementById("pVinculo").dispatchEvent(new Event("change"))');
    const changed = await submit(); assert.equal('fecha_vencimiento_convenio' in changed.body, false); assert.equal(changed.body.cargo_id, '3');
    results.push({ action: 'Personal normal: trabajador inicial y cambio de vínculo conserva fecha histórica por omisión', ok: true }); await safeRequests();
    await navigate('MiPanel.html', 'document.getElementById("profileJob")?.textContent.includes("Apoyo de proyectos")');
    assert.equal(await cdp.evaluate('document.getElementById("profileJob").textContent'), empleado.puesto);
    assert.equal(await cdp.evaluate('document.getElementById("profilePosition").textContent'), empleado.cargo);
    assert.equal(await cdp.evaluate('document.getElementById("profileAgreementField").hidden'), false);
    assert.match(await cdp.evaluate('document.getElementById("profileAgreementEnd").textContent'), new RegExp('^' + day.slice(8) + ' .+ ' + day.slice(0, 4) + '$'));
    await safeRequests(); results.push({ action: 'Mi panel muestra cargo, puesto y vencimiento por separado', ok: true });
    for (const [page, id] of [['RecursosHumanos.html', 'alertasConvenios'], ['Dashboard.html', 'tbodyConveniosPorVencer']]) {
      await navigate(page, 'document.getElementById(' + JSON.stringify(id) + ')?.textContent.includes("Practicante Prueba UI")');
      assert.ok(await cdp.evaluate('document.getElementById(' + JSON.stringify(id) + ').textContent.includes("10")'));
      const selector = page === 'RecursosHumanos.html' ? 'empresaResumen' : 'empresaGlobal';
      await cdp.evaluate('window.__uiAgreements=[];document.getElementById(' + JSON.stringify(selector) + ').value="1";document.getElementById(' + JSON.stringify(selector) + ').dispatchEvent(new Event("change"))');
      await wait('document.getElementById(' + JSON.stringify(id) + ').textContent.includes("No hay convenios")');
      assert.ok(await cdp.evaluate('window.__uiCalls.some(call=>call.path.includes("empresa_id=1"))'));
      await safeRequests(); results.push({ action: page + ': alerta independiente de Contratos, filtro empresa y estado vacío', ok: true });
    }
    await navigate('Contratos.html', 'Array.from(document.getElementById("contratoTipo")?.options||[]).some(option=>option.value==="Convenio de prácticas")');
    assert.ok(await cdp.evaluate('Array.from(document.getElementById("filtroTipo").options).some(option=>option.value==="Convenio de prácticas")'));
    await safeRequests(); results.push({ action: 'Convenio de prácticas disponible en formulario y filtro por catálogo API', ok: true });
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(out, 'resultados.json'), JSON.stringify({ checkedAt: new Date().toISOString(), api: 'simulada; sin acceso a base de datos', results, javascript: errors }, null, 2));
    console.log(results.length + '/' + results.length + ' comprobaciones UI correctas; API simulada y sin acceso a base de datos.');
  } catch (error) { await capture('fallo.png').catch(() => {}); await fs.writeFile(path.join(out, 'fallo.json'), JSON.stringify({ results, message: error.message, javascript: errors }, null, 2)); throw error; }
  finally { cdp.close(); await fetch('http://127.0.0.1:9224/json/close/' + target.id).catch(() => {}); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
