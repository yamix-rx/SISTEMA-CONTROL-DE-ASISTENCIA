const pool = require('../config/database');
const r = require('../services/asistenciaReglas');
function fallo(res,error){if(!error.status)console.error('Error de horarios:',error.code||error.name);return res.status(error.status||500).json({ok:false,mensaje:error.status?error.message:'No se pudo guardar el horario.'});}
exports.listarHorarios=async(req,res)=>{
  try {
    const f=r.filtrosPersonal(req.query);
    const [rows]=await pool.query(`SELECT e.id AS empleado_id,CONCAT(e.nombres,' ',e.apellidos) AS colaborador,e.numero_documento,e.tipo_vinculo,e.empresa_id,e.area_id,e.cargo_id,emp.razon_social AS empresa,ar.nombre AS area,c.nombre AS cargo,
      h.id AS horario_id,h.dia_semana,h.hora_entrada,h.hora_salida,h.tolerancia_minutos,h.activo
      FROM empleados e JOIN empresas emp ON emp.id=e.empresa_id JOIN areas ar ON ar.id=e.area_id JOIN cargos c ON c.id=e.cargo_id
      LEFT JOIN horarios h ON h.empleado_id=e.id WHERE e.estado='activo' AND ${f.where} ORDER BY e.apellidos,e.nombres,h.dia_semana`,f.params);
    const empleados=new Map();
    for(const row of rows){const {horario_id,dia_semana,hora_entrada,hora_salida,tolerancia_minutos,activo,...e}=row;
      if(!empleados.has(e.empleado_id))empleados.set(e.empleado_id,{...e,malla_horarios:[]});
      if(horario_id)empleados.get(e.empleado_id).malla_horarios.push({id:horario_id,dia_semana,hora_entrada,hora_salida,tolerancia_minutos:Number(tolerancia_minutos||0),activo:Boolean(activo)});
    }
    return res.json({ok:true,data:[...empleados.values()]});
  }catch(error){return fallo(res,error);}
};
exports.guardarHorarioSemanal=async(req,res)=>{
  let connection;
  try {
    const b=req.body,id=r.entero(b.empleado_id,'Trabajador');
    if(!Array.isArray(b.dias)||!b.dias.length||b.dias.length>7)throw r.error('Seleccione entre uno y siete días.');
    const dias=[...new Set(b.dias.map(x=>r.entero(x,'Día',1,7)))];
    const entrada=r.hora(b.hora_entrada,'Hora de entrada'),salida=r.hora(b.hora_salida,'Hora de salida');
    if(entrada===salida)throw r.error('La entrada y salida no pueden ser iguales.');
    if(salida<entrada&&b.cruza_medianoche!==true)throw r.error('Para una salida al día siguiente marque turno nocturno.');
    const tolerancia=r.entero(b.tolerancia_minutos??0,'Tolerancia',0,120);
    if(b.estado&&!['asignado','descanso'].includes(b.estado))throw r.error('Estado de horario no válido.');
    const activo=b.estado!=='descanso';
    const editId=b.id?r.entero(b.id,'Horario'):null;
    connection=await pool.getConnection();await connection.beginTransaction();
    const [[empleado]]=await connection.query("SELECT id FROM empleados WHERE id=? AND estado='activo' FOR UPDATE",[id]);
    if(!empleado)throw Object.assign(r.error('Trabajador activo no encontrado.'),{status:404});
    const [anteriores]=await connection.query('SELECT * FROM horarios WHERE empleado_id=? AND dia_semana IN (?) FOR UPDATE',[id,dias]);
    if(editId){
      const [[original]]=await connection.query('SELECT * FROM horarios WHERE id=? FOR UPDATE',[editId]);
      if(!original)throw Object.assign(r.error('Horario no encontrado.'),{status:404});
      if(Number(original.empleado_id)!==id||dias.length!==1||Number(original.dia_semana)!==dias[0])throw r.error('Para cambiar de persona o día, registre otro horario y retire el anterior.');
    }
    const nuevos=[];
    for(const dia of dias){
      const anterior=anteriores.find(x=>Number(x.dia_semana)===dia);
      if(anterior){await connection.query('UPDATE horarios SET hora_entrada=?,hora_salida=?,tolerancia_minutos=?,activo=? WHERE id=?',[entrada,salida,tolerancia,activo,anterior.id]);nuevos.push({id:anterior.id,empleado_id:id,dia_semana:dia,hora_entrada:entrada,hora_salida:salida,tolerancia_minutos:tolerancia,activo});}
      else {const [result]=await connection.query('INSERT INTO horarios (empleado_id,dia_semana,hora_entrada,hora_salida,tolerancia_minutos,activo) VALUES (?,?,?,?,?,?)',[id,dia,entrada,salida,tolerancia,activo]);nuevos.push({id:result.insertId,empleado_id:id,dia_semana:dia,hora_entrada:entrada,hora_salida:salida,tolerancia_minutos:tolerancia,activo});}
    }
    await connection.commit();res.locals||={};res.locals.auditoria={tabla:'horarios',registroId:nuevos[0].id,accion:anteriores.length?'UPDATE':'INSERT',anterior:anteriores,nuevos};
    return res.json({ok:true,mensaje:activo?'Horario guardado correctamente.':'Día de descanso guardado correctamente.',data:nuevos});
  }catch(error){if(connection)await connection.rollback();return fallo(res,error);}finally{if(connection)connection.release();}
};
exports.eliminarHorarioDia=async(req,res)=>{
  try {const id=r.entero(req.params.id,'Horario');const [[anterior]]=await pool.query('SELECT * FROM horarios WHERE id=?',[id]);
    if(!anterior)throw Object.assign(r.error('Horario no encontrado.'),{status:404});
    await pool.query('DELETE FROM horarios WHERE id=?',[id]);res.locals||={};res.locals.auditoria={tabla:'horarios',registroId:id,accion:'DELETE',anterior,nuevos:null};
    return res.json({ok:true,mensaje:'Horario eliminado; las asistencias anteriores se conservan.'});
  }catch(error){return fallo(res,error);}
};
