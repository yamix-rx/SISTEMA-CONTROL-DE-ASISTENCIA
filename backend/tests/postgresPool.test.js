'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {placeholders,prepare,mysqlResult,createPostgresPool}=require('../config/postgresPool');

test('Los parámetros no alteran cadenas, identificadores ni comentarios',()=>{
  assert.equal(placeholders("SELECT '?' AS literal,id FROM usuarios WHERE id=? AND email=? -- ?\n",[4,'a@b.pe']),
    "SELECT '?' AS literal,id FROM usuarios WHERE id=$1 AND email=$2 -- ?\n");
  const backtick=String.fromCharCode(96);
  assert.equal(placeholders('SELECT '+backtick+'correo'+backtick+' FROM '+backtick+'usuarios'+backtick+' WHERE id=? /* ? */',[7]),
    'SELECT "correo" FROM "usuarios" WHERE id=$1 /* ? */');
  assert.throws(()=>placeholders('SELECT ?',[]),/Marcadores SQL/);
});
test('Rechaza la sintaxis MySQL no portada',()=>{
  for(const statement of ['SELECT DATE_FORMAT(fecha, "%Y-%m-%d")','SELECT CURDATE()',
      'SELECT WEEKDAY(?)','INSERT IGNORE INTO roles(nombre) VALUES(?)','SELECT DATE_ADD(fecha,INTERVAL 1 DAY)'])
    assert.throws(()=>prepare(statement,statement.includes('?')?['2026-10-26']:[]),{code:'SBSS_SQL_NOT_MIGRATED'});
});
test('Preserva la respuesta mysql2 para inserciones y lecturas',()=>{
  assert.equal(prepare('INSERT INTO empleados(nombres) VALUES(?)',['Ejemplo']),
    'INSERT INTO empleados(nombres) VALUES($1) RETURNING id');
  assert.equal(mysqlResult({command:'INSERT',rowCount:1,rows:[{id:8}]} )[0].insertId,8);
  assert.deepEqual(mysqlResult({command:'SELECT',rowCount:1,rows:[{id:8}]} )[0],[{id:8}]);
});
function fakePg(){
  const calls=[];let next=0;
  class Pool{
    async connect(){
      const id=++next;
      return {query:async(text,values=[])=>{
        calls.push({id,text,values});
        if(/^SELECT/.test(text))return {command:'SELECT',rows:[{id:3}],rowCount:1};
        if(/^INSERT/.test(text))return {command:'INSERT',rows:[{id:11}],rowCount:1};
        return {command:text.split(' ')[0],rows:[],rowCount:0};
      },release:()=>calls.push({id,text:'RELEASE'})};
    }
    async end(){}
  }
  return {pgModule:{Pool,types:{setTypeParser(){}}},calls};
}
test('Una transacción de solicitud comparte conexión y termina en COMMIT',async()=>{
  const mock=fakePg(),pool=createPostgresPool({connectionString:'postgresql://a:b@localhost:5432/db',pgModule:mock.pgModule});
  const tx=await pool.beginRequestTransaction();
  await tx.run(async()=>{
    const [r]=await pool.query('INSERT INTO empresas(razon_social) VALUES(?)',['SBSS']);
    assert.equal(r.insertId,11);
    const cx=await pool.getConnection();
    await cx.query('SELECT id FROM usuarios WHERE id=?',[1]);
    await cx.commit();cx.release();
  });
  await tx.complete(true);
  assert.deepEqual(mock.calls.filter(x=>['BEGIN','COMMIT','ROLLBACK'].includes(x.text)).map(x=>x.text),['BEGIN','COMMIT']);
  assert.equal(new Set(mock.calls.map(x=>x.id)).size,1);
  await pool.end();
});
test('Una solicitud de ROLLBACK impide COMMIT',async()=>{
  const mock=fakePg(),pool=createPostgresPool({connectionString:'postgresql://a:b@localhost:5432/db',pgModule:mock.pgModule});
  const tx=await pool.beginRequestTransaction();
  await tx.run(async()=>{const cx=await pool.getConnection();await cx.rollback();cx.release();});
  await tx.complete(true);
  assert.equal(mock.calls.filter(x=>x.text==='ROLLBACK').length,1);
  assert.equal(mock.calls.filter(x=>x.text==='COMMIT').length,0);
  await pool.end();
});
