'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const src=readFileSync(join(__dirname,'../js/login.js'),'utf8');
test('En Vercel la URL del servidor conserva solo el origen real sin puerto 3000',()=>{
  assert.match(src,/new URL\('\/login\.html', current\.origin\)/);
  assert.doesNotMatch(src,/canonical\.hostname\s*=\s*current\.hostname/);
  assert.doesNotMatch(src,/canonical\.protocol\s*=\s*current\.protocol/);
});
test('La comprobación de API incluye la cookie del mismo origen para Vercel Authentication',()=>{
  assert.match(src,/credentials:\s*'same-origin'/);
  assert.doesNotMatch(src,/credentials:\s*'omit'/);
  assert.match(src,/redirect:\s*'error'/);
});
test('Se mantiene el servidor local solo para archivos abiertos fuera de http(s)',()=>{
  assert.match(src,/new URL\('http:\/\/localhost:3000\/login\.html'\)/);
});
