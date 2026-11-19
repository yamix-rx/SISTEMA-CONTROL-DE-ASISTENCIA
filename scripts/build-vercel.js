'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'frontend'),output=path.join(root,'public');
if(!fs.existsSync(path.join(input,'vendor')))throw new Error('Falta compilar frontend/vendor con npm --prefix frontend run build.');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
for(const name of fs.readdirSync(input)){
  const source=path.join(input,name),info=fs.statSync(source);
  if(info.isFile()&&(/\.html$/i.test(name)||['favicon.svg','logo-sbss.svg'].includes(name))) {
    fs.copyFileSync(source,path.join(output,name));
  }
}
for(const dir of ['assets','css','js','vendor'])fs.cpSync(path.join(input,dir),path.join(output,dir),{recursive:true});
for(const name of ['login.html','cambiar-clave.html','Dashboard.html','index.html'])
  if(!fs.existsSync(path.join(output,name)))throw new Error('Pantalla faltante: '+name);
console.log('SBSS frontend estático preparado con lista blanca en /public');
