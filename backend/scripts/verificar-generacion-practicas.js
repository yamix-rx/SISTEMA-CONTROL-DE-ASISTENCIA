#!/usr/bin/env node
'use strict';
// Chrome + controladores y generadores reales sobre datos aislados, sin MySQL.
// Requiere Chrome aislado en SBSS_CHROME_PORT (por defecto 9224).
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const express = require('express');
const { CDP, onlyLocalNetwork } = require('./verificar-navegador');
const datos = require('../data/modelos-documentos.json');
const { leerPdf } = require('../tests/helpers/pdf');
const output = path.resolve(__dirname, '../../artifacts/validacion/generacion-practicas');
const empresas = datos.empresas.map((empresa, i) => ({ id: i + 1, razon_social: empresa.nombre, ruc: empresa.ruc, direccion: 'Domicilio empresarial de prueba 123' }));
const empleados = datos.carreras.map((carrera, i) => ({
  id: i + 1, nombres: 'Estudiante', apellidos: `Prueba ${i + 1}`, colaborador: `Estudiante Prueba ${i + 1}`,
  tipo_documento: 'DNI', numero_documento: `9999000${i + 1}`, tipo_vinculo: 'practicante_preprofesional',
  empresa_id: i % empresas.length + 1, area_id: i % empresas.length + 1, cargo_id: i % empresas.length + 1,
  carrera: carrera.aliases.at(-1), institucion_educativa: 'Universidad Privada del Norte',
  direccion: 'Domicilio del estudiante de prueba 456', fecha_nacimiento: '2002-01-01',
  fecha_ingreso: '2026-06-01', fecha_finalizacion: '2026-09-20', fecha_vencimiento_convenio: '2026-09-01', horas_meta: 320
}));
const areas = empresas.map(empresa => ({ id: empresa.id, empresa_id: empresa.id, nombre: 'Área de prueba' }));
const cargos = areas.map(area => ({ id: area.id, area_id: area.id, nombre: 'Practicante' }));
const pool = { async query(sql, params = []) {
  if (/SELECT codigo, titulo, cuerpo_html/.test(sql)) return [[]];
  if (/FROM empleados e LEFT JOIN practicante_detalles/.test(sql)) return [empleados.filter(empleado => empleado.id === params[0])];
  if (/FROM empresas emp INNER JOIN areas/.test(sql)) {
    const empresa = empresas.find(empresa => empresa.id === params[0]);
    return [[{ empresa: empresa.razon_social, ruc: empresa.ruc, empresa_direccion: empresa.direccion, area: 'Área de prueba', cargo: 'Practicante' }]];
  }
  if (/FROM empresas ORDER BY/.test(sql)) return [empresas];
  if (/FROM areas ORDER BY/.test(sql)) return [areas];
  if (/FROM cargos ORDER BY/.test(sql)) return [cargos];
  throw new Error('Consulta inesperada: ' + sql);
} };
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: pool };
const controller = require('../controllers/documentoController');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(output, { recursive: true });
  const app = express(), errors = [], results = [];
  app.use(express.json());
  app.get('/api/auth/perfil', (_, res) => res.json({ ok: true, usuario: { nombres: 'Usuario', apellidos: 'Prueba', rol: 'Recursos Humanos' }, acceso: { panel: 'RecursosHumanos.html', modulos: ['rrhh', 'personal', 'documentos'], permisos: [] } }));
  app.get('/api/documentos/catalogos', (_, res) => res.json({ ok: true, empleados, empresas, tipos: [] }));
  app.get('/api/documentos', (_, res) => res.json({ ok: true, documentos: [], total: 0, pagina: 1, resumen: {} }));
  app.get('/api/personal/:id', (req, res) => res.json({ ok: true, data: { empleado: empleados.find(empleado => empleado.id === Number(req.params.id)), progresoHoras: { horasMeta: 320, horasRealizadas: 280 } } }));
  app.get('/api/documentos/generacion/catalogos', controller.catalogosGeneracion);
  app.post('/api/documentos/generar/vista-previa', controller.vistaGenerada);
  app.post('/api/documentos/generar/pdf', controller.pdfGenerado);
  app.use('/api', (req, res) => { errors.push('Ruta inesperada: ' + req.path); res.status(404).end(); });
  app.use(express.static(path.resolve(__dirname, '../../frontend')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const debug = 'http://127.0.0.1:' + Number(process.env.SBSS_CHROME_PORT || 9224);
  let cdp, target;
  try {
    target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json();
    cdp = await CDP.connect(target.webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown', data => errors.push(data.exceptionDetails.exception?.description || data.exceptionDetails.text));
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    const external = await onlyLocalNetwork(cdp, base);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('sbss_token','fixture-aislada');
      window.__downloads=[];HTMLAnchorElement.prototype.click=function(){if(this.download)window.__downloads.push({href:this.href,nombre:this.download})};` });
    const wait = async expression => {
      const until = Date.now() + 15000;
      while (Date.now() < until) { try { if (await cdp.evaluate(expression)) return; } catch {} await pause(100); }
      throw new Error('No alcanzado: ' + expression + ' · ' + await cdp.evaluate('document.getElementById("errorGenerar").textContent'));
    };
    const change = (id, value) => cdp.evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change'));})()`);
    await cdp.send('Page.navigate', { url: base + '/Documentos.html?vista=generacion' });
    await wait('!document.getElementById("btnGenerar").disabled');
    for (const codigo of ['constancia_practicas', 'culminacion']) {
      for (const empleado of empleados.slice(0, codigo === 'culminacion' ? 5 : 8)) {
        if (!(await cdp.evaluate('document.getElementById("modalGenerar").open'))) await cdp.evaluate('document.getElementById("btnGenerar").click()');
        await wait('document.getElementById("modalGenerar").open && !document.getElementById("generarEmpleado").disabled');
        await change('generarTipo', codigo);
        await change('generarEmpleado', empleado.id);
        await wait('!document.getElementById("btnCrearVista").disabled && document.getElementById("generarModelo").value!==""');
        const expected = codigo === 'culminacion' ? `culminacion_${datos.empresas[empleado.empresa_id - 1].clave}` : `constancia_${datos.carreras[empleado.id - 1].clave}`;
        assert.equal(await cdp.evaluate('document.getElementById("generarModelo").value'), expected);
        assert.equal(await cdp.evaluate('document.getElementById("generarHoras").value'), codigo === 'culminacion' ? '280' : '320');
        assert.equal(await cdp.evaluate('document.getElementById("generarDato_fecha_finalizacion").value'), codigo === 'culminacion' ? empleado.fecha_finalizacion : empleado.fecha_vencimiento_convenio);
        await cdp.evaluate(`document.querySelectorAll('#generarDatosModelo [required]').forEach(e=>{if(!e.value)e.value=e.type==='date'?'2026-01-01':e.name==='horario'?'Lunes a viernes de 09:00 a 13:00':'Dato de prueba';});document.getElementById('generarFecha').value='2026-09-20';`);
        if (codigo === 'culminacion') {
          assert.ok(await cdp.evaluate('document.getElementById("generarDato_actividades").value.length>30'));
          await change('generarDato_actividades', '- ACTIVIDAD REAL VERIFICADA EN NAVEGADOR');
        }
        assert.equal(await cdp.evaluate('document.getElementById("formGenerar").checkValidity()'), true);
        await cdp.evaluate('document.getElementById("formGenerar").requestSubmit()');
        await wait('document.getElementById("modalDocumentoGenerado").open');
        const pdfBytes = await cdp.evaluate('(async()=>Array.from(new Uint8Array(await(await fetch(document.getElementById("generadoPdf").src.split("#")[0])).arrayBuffer())))()');
        const pdf = Buffer.from(pdfBytes), inspected = leerPdf(pdf);
        const texto = inspected.paginas.flatMap(pagina => pagina.textos.map(item => item.texto)).join(' ');
        assert.ok(texto.includes(empleado.colaborador));
        assert.ok(texto.includes(codigo === 'culminacion' ? 'ACTIVIDAD REAL VERIFICADA EN NAVEGADOR' : 'MODELO DE PLAN DE CAPACITACIÓN'));
        if (codigo === 'culminacion' && empleado.empresa_id === 4) assert.match(await cdp.evaluate('document.getElementById("generadoPapel").textContent'), /horizontal/);
        await fs.writeFile(path.join(output, expected + '.pdf'), pdf);
        await cdp.evaluate('document.getElementById("btnPdfGenerado").click()');
        assert.equal(await cdp.evaluate('window.__downloads.at(-1).href'), await cdp.evaluate('document.getElementById("generadoPdf").src.split("#")[0]'));
        if (empleado.id === 1) {
          await cdp.evaluate('document.getElementById("btnVolverGenerar").click()');
          assert.equal(await cdp.evaluate('document.getElementById("generarModelo").value'), expected);
          await cdp.evaluate('document.getElementById("modalGenerar").close()');
        } else await cdp.evaluate('document.getElementById("modalDocumentoGenerado").close()');
        results.push({ codigo, modelo: expected, paginas: inspected.paginas.length });
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await fs.writeFile(path.join(output, 'resultados.json'), JSON.stringify({ ok: true, datos: 'aislados', results, errors }, null, 2));
    console.log(JSON.stringify({ ok: true, documentos: results.length, output }, null, 2));
  } catch (error) {
    if (cdp) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) await fs.writeFile(path.join(output, 'fallo.png'), Buffer.from(shot.data, 'base64'));
    }
    throw error;
  } finally {
    cdp?.close();
    if (target) await fetch(debug + '/json/close/' + target.id).catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
