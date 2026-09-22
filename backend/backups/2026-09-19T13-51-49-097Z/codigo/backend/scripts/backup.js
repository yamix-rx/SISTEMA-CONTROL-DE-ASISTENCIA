const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { options, databaseName } = require('./db-options');
async function respaldo({destino, database=process.env.DB_NAME, codigo=true}={}) {
  databaseName(database);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const folder=path.resolve(destino || path.join(__dirname,'../backups',stamp));
  await fs.mkdir(folder,{recursive:true,mode:0o700});
  const archivo=path.join(folder,'base-datos.sql');
  const config=options(database);
  const executable=process.env.MYSQLDUMP_PATH || (process.platform==='win32' ? 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe' : 'mysqldump');
  const args=['--single-transaction','--routines','--triggers','--events','--hex-blob','--no-tablespaces','--set-gtid-purged=OFF',
    '--column-statistics=0',`--host=${config.host}`,`--port=${config.port}`,`--user=${config.user}`,`--result-file=${archivo}`,database];
  try { await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{windowsHide:true,env:{...process.env,MYSQL_PWD:config.password || ''},stdio:['ignore','ignore','pipe']});
    let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`El respaldo MySQL no terminó (código ${code}). ${stderr.replace(/password[^\n]*/gi,'[credencial omitida]')}`)));
  }); } catch(e) {
    if(!['EPERM','ENOENT','EACCES'].includes(e.code))throw e;
    await require('./respaldo-sql').volcar(database,archivo);
  }
  const source=path.resolve(__dirname,'../..');
  async function copiarCodigo(origen,destinoCodigo) {
    await fs.mkdir(destinoCodigo,{recursive:true});
    for(const item of await fs.readdir(origen,{withFileTypes:true})) {
      if(['node_modules','.git','backups','uploads','.env'].includes(item.name)||item.isSymbolicLink())continue;
      const entrada=path.join(origen,item.name), salida=path.join(destinoCodigo,item.name);
      if(item.isDirectory())await copiarCodigo(entrada,salida);else if(item.isFile())await fs.copyFile(entrada,salida);
    }
  }
  if(codigo) await copiarCodigo(source,path.join(folder,'codigo'));
  const uploads=path.resolve(__dirname,'../uploads');
  try { await fs.cp(uploads,path.join(folder,'uploads'),{recursive:true}); } catch(e) {if(e.code!=='ENOENT')throw e;}
  try { await fs.copyFile(path.resolve(__dirname,'../.env'),path.join(folder,'configuracion.env')); } catch(e) {if(e.code!=='ENOENT')throw e;}
  const hash=createHash('sha256').update(await fs.readFile(archivo)).digest('hex');
  const manifest={formato:1,fecha:new Date().toISOString(),base:database,sql:'base-datos.sql',sha256:hash,
    contiene:{codigo,uploads:true,configuracion:'configuracion.env (privada)'},restaurar:'Consultar docs/INSTALACION.md; restaurar primero en una base nueva.'};
  await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  return folder;
}
if(require.main===module)respaldo().then(folder=>console.log(`Respaldo creado: ${folder}`)).catch(e=>{console.error('No se creó el respaldo:',e.message);process.exitCode=1;});
module.exports={respaldo};
