// Crea bases aisladas para comprobar instalación y restauración sin tocar DB_NAME.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');
const { options } = require('./db-options');

async function verificar() {
  const original = process.env.DB_NAME;
  const database = `sbss_validacion_${Date.now()}`;
  const target = database + '_restore';
  process.env.DB_NAME = database;
  Object.assign(process.env, { ADMIN_EMAIL: 'instalacion@sbss.invalid', ADMIN_PASSWORD: randomBytes(24).toString('hex'),
    ADMIN_NOMBRES: 'Cuenta', ADMIN_APELLIDOS: 'Validacion', ADMIN_DOCUMENTO: '99999999' });
  try {
    await require('./instalar').instalar();
    const connection = await mysql.createConnection(options());
    let tables;
    try {
      [tables] = await connection.query('SHOW TABLES');
      const [[empresas]] = await connection.query('SELECT COUNT(*) total FROM empresas');
      const [[roles]] = await connection.query('SELECT COUNT(*) total FROM roles');
      const [[tipos]] = await connection.query('SELECT COUNT(*) total FROM tipo_permisos');
      const [[admin]] = await connection.query('SELECT COUNT(*) total FROM usuarios WHERE activo=1');
      require('node:assert/strict').deepEqual([tables.length,empresas.total,roles.total,tipos.total,admin.total],[18,7,3,5,1]);
    } finally { await connection.end(); }
    const folder = await require('./backup').respaldo({ database, codigo: false });
    const restored = await require('./restaurar').restaurar(folder, target);
    require('node:assert/strict').equal(restored.tablas, 18);
    const restoredConnection = await mysql.createConnection(options(target));
    try {
      const [[users]] = await restoredConnection.query('SELECT COUNT(*) total FROM usuarios');
      require('node:assert/strict').equal(users.total, 1);
    } finally { await restoredConnection.end(); }
    const report = { fecha: new Date().toISOString(), baseValidacion: database, baseRestaurada: target, tablas: tables.length,
      instalacion: true, respaldo: true, restauracion: true, baseOriginalConservada: original };
    await fs.mkdir(path.resolve(__dirname,'../backups'), { recursive: true });
    await fs.writeFile(path.resolve(__dirname,'../backups/validacion-entrega.json'), JSON.stringify(report,null,2), { mode: 0o600 });
    console.log(`Instalación y restauración correctas. Base aislada para integración: ${database}`);
    return report;
  } finally { process.env.DB_NAME = original; delete process.env.ADMIN_PASSWORD; }
}
if(require.main===module)verificar().catch(e=>{console.error('Falló la validación de entrega:',e.code||e.message);process.exitCode=1;});
module.exports={verificar};
