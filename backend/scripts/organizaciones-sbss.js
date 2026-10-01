const mysql=require('mysql2/promise');
const {options}=require('./db-options');
const ORGANIZACIONES=[
  ['Droguería Silsan',/drogueria.*silsan/],['Importadora Silsan',/importadora.*silsan/],
  ['SBSS Outsourcing',/sbss.*outsourcing/],['Nanas & Amas',/nanas.*amas/],
  ['Centro de Conciliación SBSS',/conciliacion.*sbss/],['Estudio Jurídico SBSS',/estudio.*juridico.*sbss/],['ONG MESPO',/mespo/]
];
const normalizar=valor=>valor.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function completar(connection){
  const [existentes]=await connection.query('SELECT id,razon_social FROM empresas');
  const creadas=[];
  await connection.beginTransaction();
  try{
    for(const [nombre,patron] of ORGANIZACIONES){
      if(existentes.some(e=>patron.test(normalizar(e.razon_social))))continue;
      const [result]=await connection.query('INSERT INTO empresas (razon_social) VALUES (?)',[nombre]);
      await connection.query(`INSERT INTO historial_cambios (tabla_afectada,registro_id,accion,datos_nuevos) VALUES ('empresas',?,'INSERT',?)`,[result.insertId,JSON.stringify({origen:'Configuración de organizaciones del requerimiento SBSS',razon_social:nombre})]);
      creadas.push(nombre);
    }
    await connection.commit();return creadas;
  }catch(e){await connection.rollback();throw e;}
}
if(require.main===module)(async()=>{const c=await mysql.createConnection(options());try{console.log(JSON.stringify({organizacionesAgregadas:await completar(c)}));}finally{await c.end();}})().catch(e=>{console.error('No se completaron las organizaciones:',e.code||e.message);process.exitCode=1;});
module.exports={completar};
