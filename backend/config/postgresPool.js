'use strict';
/* Adaptador temporal PostgreSQL compatible con mysql2. Nunca traduce SQL MySQL complejo silenciosamente. */
const { AsyncLocalStorage } = require('node:async_hooks');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { X509Certificate } = require('node:crypto');

// Supabase Root 2021 CA (certificado público, nunca la clave privada).
// Se verifica su huella para no aceptar una CA inesperada.
const SUPABASE_ROOT_SHA256 = '807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA';
function pgTlsOptions(connectionString) {
  const url = new URL(connectionString);
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error('Protocolo PostgreSQL inválido.');
  if (!/^(?:[a-z0-9-]+\\.)*pooler\\.supabase\\.com$/i.test(url.hostname)) {
    throw new Error('La conexión debe utilizar el pooler verificado de Supabase.');
  }
  if (['disable','allow','prefer'].includes((url.searchParams.get('sslmode') || '').toLowerCase())) {
    throw new Error('No se permite desactivar ni debilitar TLS para PostgreSQL.');
  }
  for (const option of ['sslcert','sslkey','sslrootcert']) {
    if (url.searchParams.has(option)) throw new Error('Los certificados TLS deben proceder de la configuración de la aplicación.');
  }
  // node-postgres reemplaza la opción ssl si sslmode está en connectionString.
  // Retirarlo permite TLS con autoridad validada y nombre de servidor verificado.
  url.searchParams.delete('sslmode');
  const ca = readFileSync(join(__dirname,'../certs/supabase-root-2021.crt'),'utf8');
  const certificate = new X509Certificate(ca);
  if (certificate.fingerprint256.replace(/:/g,'') !== SUPABASE_ROOT_SHA256) {
    throw new Error('La huella digital del certificado raíz Supabase no coincide.');
  }
  return {
    connectionString:url.toString(),
    ssl:{ca,rejectUnauthorized:true,servername:url.hostname}
  };
}

function placeholders(statement, params = []) {
  if (typeof statement !== 'string') throw new TypeError('SQL inválido');
  let out = '', state = 'code', count = 0;
  for (let i = 0; i < statement.length; i++) {
    const c = statement[i], n = statement[i + 1];
    if (state === 'code') {
      if (c === "'") { state='single'; out+=c; }
      else if (c === '"') { state='double'; out+=c; }
      else if (c === String.fromCharCode(96)) { state='backtick'; out+='"'; }
      else if (c === '-' && n === '-') { state='line'; out+='--'; i++; }
      else if (c === '/' && n === '*') { state='block'; out+='/*'; i++; }
      else if (c === '?') out+='$'+(++count);
      else out+=c;
    } else if (state === 'single') {
      out+=c;
      if (c === "'" && n === "'") { out+=n; i++; }
      else if (c === "'" && statement[i-1] !== '\\') state='code';
    } else if (state === 'double' || state === 'backtick') {
      if (state === 'backtick' && c === String.fromCharCode(96)) { out+='"'; state='code'; }
      else { out+=c; if (state === 'double' && c === '"') { if (n==='"') {out+=n;i++;} else state='code'; } }
    } else if (state === 'line') { out+=c; if(c==='\n') state='code'; }
    else if (state === 'block') { out+=c; if(c==='*'&&n==='/') {out+='/';i++;state='code';} }
  }
  if (count !== params.length) throw new Error('Marcadores SQL ('+count+') no coinciden con parámetros ('+params.length+').');
  return out;
}

const mysqlOnly = /\b(?:DATE_FORMAT|DATE_ADD|DATE_SUB|WEEKDAY|CURDATE|CONVERT_TZ|UTC_TIMESTAMP|GROUP_CONCAT|TIMESTAMPDIFF|INSERT\s+IGNORE|REPLACE\s+INTO|ON\s+DUPLICATE\s+KEY|IFNULL|LAST_INSERT_ID)\b|\bUPDATE\s+\w+\s+(?:INNER\s+|LEFT\s+)?JOIN\b/i;
function prepare(statement, params = []) {
  if (mysqlOnly.test(statement)) throw Object.assign(new Error('La consulta MySQL requiere migración explícita a PostgreSQL.'), { code:'SBSS_SQL_NOT_MIGRATED' });
  let query=placeholders(statement,params);
  if (/^\s*INSERT\s+INTO\s+/i.test(query) && !/\bRETURNING\b/i.test(query)) query=query.replace(/;\s*$/,'')+' RETURNING id';
  return query;
}

function mysqlResult(result) {
  if (result.command==='SELECT' || result.command==='SHOW') return [result.rows,result.fields];
  return [{ affectedRows:result.rowCount||0, changedRows:result.rowCount||0,
    insertId:result.rows?.[0]?.id == null ? 0 : Number(result.rows[0].id) },result.fields];
}

function createPostgresPool({connectionString=process.env.DATABASE_URL,pgModule}={}) {
  if(!/^postgres(?:ql)?:\/\//.test(connectionString||'')) throw new Error('DATABASE_URL debe ser PostgreSQL.');
  const pg=pgModule || require('pg');
  const pool=new pg.Pool({...pgTlsOptions(connectionString),max:3,connectionTimeoutMillis:12000,idleTimeoutMillis:15000});
  if(pg.types?.setTypeParser) pg.types.setTypeParser(1082,value=>value);
  const storage=new AsyncLocalStorage();
  const wrap=(client,release)=>({
    query:async (sql,params=[])=>mysqlResult(await client.query(prepare(sql,params),params)),
    execute:async (sql,params=[])=>mysqlResult(await client.query(prepare(sql,params),params)),
    beginTransaction:async()=>{await client.query('BEGIN');},
    commit:async()=>{await client.query('COMMIT');},
    rollback:async()=>{await client.query('ROLLBACK');},
    release
  });
  async function acquire(){
    // No modificar el estado de sesión: Supabase Transaction Pooler (6543)
    // no garantiza la misma sesión entre transacciones.
    const client=await pool.connect();
    return wrap(client,()=>client.release());
  }
  async function standalone(method,args){
    const active=storage.getStore();
    if(active)return active.connection[method](...args);
    const connection=await acquire();
    try{return await connection[method](...args);}finally{connection.release();}
  }
  return {
    query:(...args)=>standalone('query',args),
    execute:(...args)=>standalone('execute',args),
    getConnection:async()=>{
      const active=storage.getStore();
      if(!active)return acquire();
      return {query:(...args)=>active.connection.query(...args),execute:(...args)=>active.connection.execute(...args),
        beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{active.rollbackOnly=true;},release(){}};
    },
    beginRequestTransaction:async()=>{
      const connection=await acquire();
      try{await connection.beginTransaction();}catch(e){connection.release();throw e;}
      const context={connection,rollbackOnly:false};let done=false;
      const transaction={
        run:callback=>storage.run(context,callback),
        complete:async success=>{
          if(done)return;done=true;
          try{if(success&&!context.rollbackOnly)await connection.commit();else await connection.rollback();}
          catch(e){await connection.rollback().catch(()=>{});throw e;}
          finally{connection.release();}
        }
      };
      context.rollback=()=>transaction.complete(false);
      return transaction;
    },
    rollbackRequestTransaction:()=>storage.getStore()?.rollback(),
    withoutRequestTransaction:callback=>storage.run(undefined,callback),
    end:()=>pool.end()
  };
}
module.exports={placeholders,prepare,mysqlResult,createPostgresPool,pgTlsOptions};
