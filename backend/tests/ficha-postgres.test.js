'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../services/fichaService.js'),'utf8');

function buildFicha(dbUrl){
  const queries=[];
  const pool={query:async(sql,params=[])=>{
    queries.push({sql,params});
    if(sql.includes('FROM asistencias WHERE empleado_id = ?')&&sql.includes('AS asistencias'))
      return [[{total:'3',asistencias:'2',faltas:'1',tardanzas:'1',minutos_tardanza:'5',horas:'16.50'}]];
    if(sql.includes('FROM permisos WHERE empleado_id = ?')&&sql.includes('AS solicitados'))
      return [[{total:'2',solicitados:'1',aprobados:'1'}]];
    return [[]];
  }};
  const module={exports:{}};
  const fakeProcess={env: dbUrl ? {DATABASE_URL:dbUrl} : {}};
  new Function('require','module','exports','process',source)((name)=>{
    if(name==='../config/database')return pool;
    if(name==='./documentoArchivoService')return {disponible:async()=>false};
    throw Error('Módulo inesperado: '+name);
  },module,module.exports,fakeProcess);
  return {...module.exports,queries};
}

test('PostgreSQL cuenta los estados con FILTER en vez de SUM(boolean)',async()=>{
  const service=buildFicha('postgresql://mock');
  const result=await service.obtenerHistorial(7);
  const [asistencia,permiso]=service.queries.slice(0,2).map(q=>q.sql);
  assert.match(asistencia,/COUNT\(\*\) FILTER \(WHERE estado IN \('presente','tardanza'\)\)/);
  assert.match(asistencia,/COUNT\(\*\) FILTER \(WHERE estado='falta'\)/);
  assert.match(asistencia,/COUNT\(\*\) FILTER \(WHERE minutos_tardanza > 0\)/);
  assert.match(permiso,/COUNT\(\*\) FILTER \(WHERE LOWER\(estado\)='solicitado'\)/);
  assert.match(permiso,/COUNT\(\*\) FILTER \(WHERE LOWER\(estado\)='aprobado'\)/);
  assert.doesNotMatch(asistencia,/SUM\(estado|SUM\(minutos_tardanza > 0\)/);
  assert.doesNotMatch(permiso,/SUM\(LOWER\(estado\)/);
  assert.equal(result.paginacion.asistencias.total,3);
  assert.equal(result.paginacion.permisos.total,2);
  assert.deepEqual(result.resumenHistorial,{total:3,asistencias:2,faltas:1,tardanzas:1,
    minutos_tardanza:5,horas:16.5,permisos:2,permisosSolicitados:1,permisosAprobados:1});
});

test('MySQL de desarrollo conserva las expresiones anteriores para evitar regresiones',async()=>{
  const service=buildFicha(undefined);
  await service.obtenerHistorial(7);
  const [asistencia,permiso]=service.queries.slice(0,2).map(q=>q.sql);
  assert.match(asistencia,/COALESCE\(SUM\(estado IN \('presente','tardanza'\)\),0\)/);
  assert.match(permiso,/COALESCE\(SUM\(LOWER\(estado\)='aprobado'\),0\)/);
  assert.doesNotMatch(asistencia,/FILTER/);
});
