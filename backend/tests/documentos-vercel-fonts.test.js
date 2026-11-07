'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const configuration=require('../../vercel.json');

test('Vercel incluye todas las fuentes estándar de PDFKit que se cargan en tiempo de ejecución',()=>{
  const entry=configuration.functions?.['server.js'];
  assert.ok(entry,'Falta configuración de la función Express de Vercel');
  assert.match(entry.includeFiles||'',/node_modules\/pdfkit\/js\/standard-fonts\/\*\*/);
  const fontDir=path.resolve(__dirname,'../../node_modules/pdfkit/js/standard-fonts');
  // PDFKit puede distribuir varias familias dentro de un solo módulo .cjs.
  // No asumir un archivo por cada variante de fuente.
  assert.ok(fs.statSync(path.join(fontDir,'Helvetica.cjs')).size > 0);
  assert.ok(fs.readdirSync(fontDir).some(filename=>filename.endsWith('.cjs')),
    'No se instalaron los recursos de fuentes estándar PDFKit');
});

test('Vercel incluye las imágenes de las cartas y certificados PDF',()=>{
  const entry=configuration.functions['server.js'];
  assert.match(entry.includeFiles||'',/backend\/assets\/documentos\/\*\*/);
  const assets=path.resolve(__dirname,'../assets/documentos');
  for(const filename of ['sbss.png','certificados/sbss.png'])
    assert.ok(fs.statSync(path.join(assets,filename)).size > 0,'Falta imagen '+filename);
});

test('El motor PDF de cartas genera un documento válido con recursos locales',async()=>{
  const {generarPdf}=require('../services/documentoPdfService');
  const buffer=await generarPdf({
    estilo:'formal', codigo:'aceptacion', diseno:'carta',
    titulo:'CARTA DE PRUEBA SBSS', empresa:'Empresa de prueba',
    fecha:'2026-10-28', cuerpo:'Documento de prueba. No contiene datos de colaboradores.',
    logo:'sbss', firmante_empresa:''
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(buffer.length>1000);
});
