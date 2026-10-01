const mysql=require('mysql2/promise');
const {options,databaseName}=require('./db-options');
const {migrar}=require('./migrar-v1');
const bcrypt=require('bcryptjs');

async function instalar(){
  const nombre=databaseName(process.env.DB_NAME);
  const email=process.env.ADMIN_EMAIL;
  const password=process.env.ADMIN_PASSWORD;
  const adminNombre=process.env.ADMIN_NOMBRES?.trim();
  const adminApellidos=process.env.ADMIN_APELLIDOS?.trim();
  const documento=process.env.ADMIN_DOCUMENTO?.trim();
  if(!email||!password||!adminNombre||!adminApellidos||!documento)throw new Error('Configure ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRES, ADMIN_APELLIDOS y ADMIN_DOCUMENTO para la instalación inicial.');
  if(adminNombre.length>100||adminApellidos.length>100||documento.length>15)throw new Error('Nombres y apellidos admiten hasta 100 caracteres; el documento, hasta 15.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>120||password.length<10||Buffer.byteLength(password)>72)throw new Error('Correo o contraseña inicial no válidos (mínimo 10 caracteres).');
  const connection=await mysql.createConnection(options(null));
  try{
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.changeUser({database:nombre});
    const [tables]=await connection.query('SHOW TABLES');
    if(tables.length)throw new Error('La base ya contiene tablas. Use npm run migrar; no se sobrescribió ningún registro.');
    await migrar(connection,console.log);
    await connection.beginTransaction();
    // La migración compartida ya configura las siete organizaciones.
    const [[organizacion]]=await connection.query("SELECT id FROM empresas WHERE razon_social='SBSS Outsourcing' ORDER BY id LIMIT 1");
    if(!organizacion)throw new Error('No se configuró la organización inicial.');
    const empresa=organizacion.id;
    const [area]=await connection.query('INSERT INTO areas (nombre,empresa_id) VALUES (?,?)',['Administración',empresa]);
    const [cargo]=await connection.query('INSERT INTO cargos (nombre,area_id) VALUES (?,?)',['Administrador del sistema',area.insertId]);
    const [empleado]=await connection.query(`INSERT INTO empleados (numero_documento,nombres,apellidos,empresa_id,area_id,cargo_id,fecha_ingreso,tipo_vinculo) VALUES (?,?,?,?,?,?,CURDATE(),'trabajador')`,[documento,adminNombre,adminApellidos,empresa,area.insertId,cargo.insertId]);
    const [roles]=await connection.query("SELECT id FROM roles WHERE nombre='Administrador General'");
    await connection.query('INSERT INTO usuarios (empleado_id,rol_id,email,password,activo) VALUES (?,?,?,?,1)',[empleado.insertId,roles[0].id,email.trim().toLowerCase(),await bcrypt.hash(password,12)]);
    for(const [tipo,obligatorio]of [['DNI',true],['Currículum Vitae',true],['Carta de presentación',false],['Carta de aceptación',false],['Convenio de prácticas',false],['Certificados',false],['Constancia de prácticas',false],['Carta de culminación',false],['Otros documentos',false]])await connection.query('INSERT INTO tipo_documentos (nombre,es_obligatorio) VALUES (?,?)',[tipo,obligatorio]);
    await connection.commit();
    console.log('Instalación completada con siete organizaciones y la cuenta administradora configurada. Retire ADMIN_PASSWORD de su entorno después de guardar las credenciales.');
  }catch(e){await connection.rollback();throw e;}finally{await connection.end();}
}
if(require.main===module)instalar().catch(e=>{console.error('Instalación no completada:',e.code||e.message);process.exitCode=1;});
module.exports={instalar};
