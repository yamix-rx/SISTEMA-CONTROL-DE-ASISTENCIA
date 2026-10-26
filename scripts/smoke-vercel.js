'use strict';
// Smoke real de Express + frontend compilado, sin usuarios ni accesos a base de datos.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const app=require('../server');

const publicDir=path.resolve(__dirname,'../public');
for(const name of ['index.html','login.html','cambiar-clave.html','Dashboard.html','css/session.css'])
  assert.ok(fs.statSync(path.join(publicDir,name)).isFile(), 'Recurso Vercel ausente: '+name);

const http=app.listen(0,'127.0.0.1',async()=>{
  const url='http://127.0.0.1:'+http.address().port;
  try{
    let r=await fetch(url+'/api/auth/disponibilidad');
    assert.equal(r.status,200);
    assert.ok(r.headers.get('content-type')?.includes('application/json'));
    const body=await r.json();
    assert.deepEqual(body,{ok:true,servicio:'sbss-auth'});
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');
    // Sin token no es posible leer perfiles ni preparar archivos privados.
    for(const protectedPath of ['/api/auth/perfil','/api/documentos/preparar-subida',
      '/api/asistencias/permisos/preparar-subida']) {
      const options=protectedPath.includes('preparar-subida')
        ? {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}
        : {};
      const denied=await fetch(url+protectedPath,options);
      assert.equal(denied.status,401,'No se protegió '+protectedPath);
    }
    r=await fetch(url+'/ruta-inexistente');
    assert.equal(r.status,404);
    r=await fetch(url+'/login.html');
    assert.equal(r.status,200);
    assert.match(await r.text(),/formLogin/);
    console.log('SMOKE PASS: Express, API, páginas estáticas y 404.');
  }catch(e){console.error('SMOKE FAIL:',e);process.exitCode=1;}
  finally{http.close();try{require('../backend/config/database').end();}catch{}}
});
http.on('error',e=>{console.error('SMOKE FAIL:',e);process.exitCode=1;});
