const fs=require('node:fs/promises');
const path=require('node:path');
const mysql=require('mysql2/promise');
const {options}=require('./db-options');

async function migrar(connection, informar=()=>{}) {
  // Solo crea tablas ausentes; nunca elimina datos ni ejecuta los datos de demostración.
  const base=await fs.readFile(path.resolve(__dirname,'../base-actualizada.sql'),'utf8');
  for(const match of base.matchAll(/CREATE TABLE\s+(\w+)\s*\([\s\S]*?\);/g)) {
    await connection.query(match[0].replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS '));
  }
  const [columns]=await connection.query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE FROM information_schema.columns WHERE table_schema=DATABASE()');
  const has=(tabla,columna)=>columns.some(c=>c.TABLE_NAME===tabla&&c.COLUMN_NAME===columna);
  const add=async(tabla,columna,definition)=>{
    if(!has(tabla,columna)){await connection.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definition}`);informar(`${tabla}.${columna} agregada`);}
  };
  if(!has('documentos_empleado','ruta_archivo')&&has('documentos_empleado','ruta_almacenamiento')) {
    await connection.query('ALTER TABLE documentos_empleado CHANGE COLUMN ruta_almacenamiento ruta_archivo VARCHAR(255) NOT NULL');
  }
  await add('usuarios','sesion_version','INT NOT NULL DEFAULT 0');
  await add('empleados','puesto','VARCHAR(150) NULL');
  await add('practicante_detalles','fecha_vencimiento_convenio','DATE NULL');
  await add('permisos','observaciones','TEXT NULL');
  await add('permisos','archivo_sustento_nombre','VARCHAR(200) NULL');
  await add('asistencias','hora_programada_entrada','TIME NULL');
  await add('asistencias','hora_programada_salida','TIME NULL');
  await add('asistencias','tolerancia_minutos','INT NULL');
  await add('documentos_empleado','observacion','TEXT NULL');
  await add('documentos_empleado','revisado_por','INT NULL');
  await add('documentos_empleado','fecha_revision','DATETIME NULL');
  await add('documentos_empleado','mime_type','VARCHAR(100) NULL');
  // Las metas admiten cualquier cantidad positiva, incluidas fracciones de hora.
  await connection.query('ALTER TABLE practicante_detalles MODIFY horas_meta DECIMAL(8,2) NOT NULL DEFAULT 320');
  await connection.query('ALTER TABLE horarios ALTER COLUMN tolerancia_minutos SET DEFAULT 0');
  await connection.query("ALTER TABLE historial_cambios MODIFY accion ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO','DENEGADO','ERROR') NOT NULL");
  const [indexes]=await connection.query('SELECT TABLE_NAME,INDEX_NAME FROM information_schema.statistics WHERE table_schema=DATABASE()');
  for(const [tabla,nombre,campos] of [
    ['documentos_empleado','idx_documento_version','empleado_id,tipo_documento_id,id'],
    ['historial_cambios','idx_historial_created_at','created_at'],
    ['historial_cambios','idx_historial_usuario','usuario_id'],
    ['historial_cambios','idx_historial_tabla_accion','tabla_afectada,accion'],
    ['permisos','idx_permisos_empleado_fecha','empleado_id,fecha_inicio'],
    ['asistencias','idx_asistencias_fecha_estado','fecha,estado'],
    ['practicante_detalles','idx_practicante_vencimiento','fecha_vencimiento_convenio']
  ]) if(!indexes.some(i=>i.TABLE_NAME===tabla&&i.INDEX_NAME===nombre))await connection.query(`CREATE INDEX ${nombre} ON ${tabla} (${campos})`);
  for(const rol of ['Administrador General','Recursos Humanos','Trabajador/Practicante']) {
    await connection.query('INSERT IGNORE INTO roles (nombre) VALUES (?)',[rol]);
  }
  const organizaciones = await require('./organizaciones-sbss').completar(connection);
  if (organizaciones.length) informar(`Organizaciones agregadas: ${organizaciones.join(', ')}`);
  informar('Esquema V1 actualizado. Se conservaron usuarios y registros.');
}
async function main(){
  if(!process.argv.includes('--sin-respaldo'))console.log(`Respaldo previo: ${await require('./backup').respaldo()}`);
  const connection=await mysql.createConnection(options());
  try{await migrar(connection,console.log);}finally{await connection.end();}
}
if(require.main===module)main().catch(e=>{console.error('Migración no completada:',e.code||e.message);process.exitCode=1;});
module.exports={migrar};
