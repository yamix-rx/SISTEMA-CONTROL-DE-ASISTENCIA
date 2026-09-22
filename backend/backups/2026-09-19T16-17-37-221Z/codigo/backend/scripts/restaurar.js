const fs=require('node:fs/promises');
const path=require('node:path');
const mysql=require('mysql2/promise');
const {createHash}=require('node:crypto');
const {options,databaseName}=require('./db-options');
async function restaurar(folder,target){
  databaseName(target);
  if(target===process.env.DB_NAME)throw new Error('Restaure en una base distinta de la base en uso.');
  const root=path.resolve(folder);
  const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
  const sql=await fs.readFile(path.join(root,'base-datos.sql'));
  if(createHash('sha256').update(sql).digest('hex')!==manifest.sha256)throw new Error('El respaldo no coincide con su suma de verificación.');
  const connection=await mysql.createConnection({...options(null),multipleStatements:true});
  try{
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.changeUser({database:target});
    const [tables]=await connection.query('SHOW TABLES');
    if(tables.length)throw new Error('La base de destino debe estar vacía. No se eliminó información.');
    await connection.query(sql.toString('utf8'));
    const [result]=await connection.query('SHOW TABLES');
    return {base:target,tablas:result.length,uploads:path.join(root,'uploads')};
  }finally{await connection.end();}
}
if(require.main===module){const[folder,target]=process.argv.slice(2);if(!folder||!target){console.error('Uso: node scripts/restaurar.js carpeta-respaldo base_nueva');process.exitCode=1;}else restaurar(folder,target).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error('Restauración no completada:',e.code||e.message);process.exitCode=1;});}
module.exports={restaurar};
