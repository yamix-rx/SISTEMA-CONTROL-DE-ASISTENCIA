const fs=require('node:fs/promises');
const mysql=require('mysql2/promise');
const {options}=require('./db-options');
const quote=value=>'`'+String(value).replace(/`/g,'``')+'`';

// Respaldo de tablas y vistas de la aplicación sin depender de un ejecutable externo.
async function volcar(database,archivo){
  const connection=await mysql.createConnection(options(database));
  const file=await fs.open(archivo,'w',0o600);
  const write=text=>file.write(text+'\n');
  try{
    const [routines]=await connection.query('SELECT ROUTINE_NAME FROM information_schema.routines WHERE routine_schema=?',[database]);
    const [events]=await connection.query('SELECT EVENT_NAME FROM information_schema.events WHERE event_schema=?',[database]);
    if(routines.length||events.length)throw new Error('Esta base tiene rutinas o eventos adicionales. Use mysqldump para conservarlos.');
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    await write('-- Respaldo SBSS: esquema y datos bajo una instantánea consistente.');
    await write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET @SBSS_OLD_SQL_MODE=@@SQL_MODE;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';");
    const [tables]=await connection.query('SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.tables WHERE table_schema=? ORDER BY TABLE_NAME',[database]);
    for(const table of tables.filter(t=>t.TABLE_TYPE==='BASE TABLE')){
      const tableName=quote(table.TABLE_NAME);
      const [ddl]=await connection.query(`SHOW CREATE TABLE ${tableName}`);
      await write(ddl[0]['Create Table']+';');
      const [fields]=await connection.query(`SHOW COLUMNS FROM ${tableName}`);
      const names=fields.filter(f=>!/GENERATED/.test(f.Extra||'')).map(f=>f.Field);
      // Batches keep binary attachments and large histories from exhausting memory.
      let offset=0;
      for(;;){
        const [rows]=await connection.query(`SELECT ${names.map(quote).join(',')} FROM ${tableName} LIMIT 500 OFFSET ${offset}`);
        if(!rows.length)break;
        for(const row of rows){
          const values=names.map(name=>{let value=row[name];if(value!==null&&typeof value==='object'&&!Buffer.isBuffer(value)&&!(value instanceof Date))value=JSON.stringify(value);return connection.escape(value);});
          await write(`INSERT INTO ${tableName} (${names.map(quote).join(',')}) VALUES (${values.join(',')});`);
        }
        offset+=rows.length;
      }
    }
    for(const table of tables.filter(t=>t.TABLE_TYPE==='VIEW')){
      const [ddl]=await connection.query(`SHOW CREATE VIEW ${quote(table.TABLE_NAME)}`);
      await write(ddl[0]['Create View']+';');
    }
    const [triggers]=await connection.query('SHOW TRIGGERS');
    for(const trigger of triggers){const[ddl]=await connection.query(`SHOW CREATE TRIGGER ${quote(trigger.Trigger)}`);await write(ddl[0]['SQL Original Statement']+';');}
    await write('SET SQL_MODE=@SBSS_OLD_SQL_MODE;\nSET FOREIGN_KEY_CHECKS=1;');
    await connection.commit();
  }catch(e){await connection.rollback();throw e;}finally{await file.close();await connection.end();}
}
module.exports={volcar};
