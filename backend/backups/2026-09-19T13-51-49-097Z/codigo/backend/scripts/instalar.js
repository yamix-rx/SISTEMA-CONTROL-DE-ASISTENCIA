const mysql=require('mysql2/promise');
const {options,databaseName}=require('./db-options');
const {migrar}=require('./migrar-v1');
const bcrypt=require('bcryptjs');

async function instalar(){
  const nombre=databaseName(process.env.DB_NAME);
  const email=process.env.ADMIN_EMAIL;
  const password=process.env.ADMIN_PASSWORD;
  const adminNombre=process.env.ADMIN_NOMBRES;
  const adminApellidos=process.env.ADMIN_APELLIDOS;
  const documento=process.env.ADMIN_DOCUMENTO;
  if(!email||!password||!adminNombre||!adminApellidos||!documento)throw new Error('Configure ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRES, ADMIN_APELLIDOS y ADMIN_DOCUMENTO para la instalación inicial.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>120||password.length<10||Buffer.byteLength(password)>72)throw new Error('Correo o contraseña inicial no válidos (mínimo 10 caracteres).');
  const connection=await mysql.createConnection(options(null));
  try{
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.changeUser({database:nombre});
    const [tables]=await connection.query('SHOW TABLES');
    if(tables.length)throw new Error('La base ya contiene tablas. Use npm run migrar; no se sobrescribió ningún registro.');
    await migrar(connection,console.log);
    await connection.beginTransaction();
    const empresas=['Droguería Silsan','Importadora Silsan','SBSS Outsourcing','Nanas & Amas','Centro de Conciliación SBSS','Estudio Jurídico SBSS','ONG MESPO'];
    let empresa;
    for(const razon of empresas){const [r]=await connection.query('INSERT INTO empresas (razon_social) VALUES (?)',[razon]);if(razon==='SBSS Outsourcing')empresa=r.insertId;}
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
