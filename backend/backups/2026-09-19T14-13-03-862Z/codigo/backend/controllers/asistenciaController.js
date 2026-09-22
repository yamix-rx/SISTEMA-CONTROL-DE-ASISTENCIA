const pool = require('../config/database');
const r = require('../services/asistenciaReglas');
const archivos = require('../services/documentoArchivoService');
const { ROLES } = require('../config/accessPolicy');
function fallo(res, error) {
  if (!error.status) console.error('Error de asistencia:', error.code || error.name);
  return res.status(error.status || 500).json({ ok: false, mensaje: error.status ? error.message : 'No se pudo completar la operación.' });
}
function auditar(res, tabla, registroId, accion, anterior, nuevos) {
  res.locals ||= {};
  res.locals.auditoria = { tabla, registroId, accion, anterior, nuevos };
}
exports.listarAsistencias = async (req, res) => {
  try {
    const fecha = r.fecha(req.query.fecha || r.hoy()), f = r.filtrosPersonal(req.query), estado = req.query.estado;
    if (estado && !r.ESTADOS.includes(estado)) throw r.error('Estado no válido.');
    const [rows] = await pool.query(`SELECT a.id AS asistencia_id,e.id AS empleado_id,COALESCE(a.fecha,?) AS fecha,
      a.hora_ingreso,a.hora_salida,
      CASE WHEN a.id IS NULL THEN h.hora_entrada ELSE a.hora_programada_entrada END AS hora_programada,
      CASE WHEN a.id IS NULL THEN h.hora_entrada ELSE a.hora_programada_entrada END AS hora_programada_entrada,
      CASE WHEN a.id IS NULL THEN h.hora_salida ELSE a.hora_programada_salida END AS hora_programada_salida,
      a.minutos_tardanza,a.horas_trabajadas,a.estado,a.observacion,
      CONCAT(e.nombres,' ',e.apellidos) AS colaborador,e.numero_documento,e.empresa_id,e.area_id,e.cargo_id,
      emp.razon_social AS empresa,ar.nombre AS area,c.nombre AS cargo
      FROM empleados e JOIN empresas emp ON emp.id=e.empresa_id JOIN areas ar ON ar.id=e.area_id JOIN cargos c ON c.id=e.cargo_id
      LEFT JOIN horarios h ON h.empleado_id=e.id AND h.dia_semana=WEEKDAY(?)+1 AND h.activo=TRUE
      LEFT JOIN asistencias a ON a.empleado_id=e.id AND a.fecha=?
      WHERE (e.estado='activo' OR a.id IS NOT NULL) AND ${f.where} ${estado ? 'AND a.estado=?' : ''}
      ORDER BY e.apellidos,e.nombres,e.id`, [fecha,fecha,fecha,...f.params,...(estado ? [estado] : [])]);
    return res.json({ ok:true,fecha,data:rows });
  } catch (error) { return fallo(res,error); }
};
exports.registrarMarcacion = async (req,res) => {
  let connection;
  try {
    const empleadoId=r.entero(req.body.empleado_id,'Trabajador'),fecha=r.fecha(req.body.fecha);
    if (fecha>r.hoy()) throw r.error('No puede registrar asistencia de una fecha futura.');
    const observacion=r.texto(req.body.observacion,'Observación',255);
    connection=await pool.getConnection(); await connection.beginTransaction();
    // Serializa las altas diarias del mismo empleado, incluida la primera marcación.
    const [[empleado]]=await connection.query('SELECT id,estado FROM empleados WHERE id=? FOR UPDATE',[empleadoId]);
    if (!empleado) throw Object.assign(r.error('Trabajador no encontrado.'),{status:404});
    const [[anterior]]=await connection.query('SELECT * FROM asistencias WHERE empleado_id=? AND fecha=? FOR UPDATE',[empleadoId,fecha]);
    if (!anterior && empleado.estado!=='activo') throw r.error('Solo puede agregar asistencia a un trabajador activo.');
    const [[horario]]=await connection.query('SELECT hora_entrada,hora_salida,tolerancia_minutos FROM horarios WHERE empleado_id=? AND dia_semana=WEEKDAY(?)+1 AND activo=TRUE',[empleadoId,fecha]);
    const programacion=anterior ? {hora_entrada:anterior.hora_programada_entrada,hora_salida:anterior.hora_programada_salida,tolerancia_minutos:anterior.tolerancia_minutos??0} : horario||null;
    const datos=r.calcularMarcacion(req.body,programacion,anterior);
    const guardado={...datos,empleado_id:empleadoId,fecha,observacion,hora_programada_entrada:programacion?.hora_entrada||null,hora_programada_salida:programacion?.hora_salida||null,tolerancia_minutos:anterior?anterior.tolerancia_minutos:Number(programacion?.tolerancia_minutos||0),registrado_por_usuario_id:req.usuario.id};
    let id=anterior?.id;
    if (anterior) {
      await connection.query('UPDATE asistencias SET hora_ingreso=?,hora_salida=?,minutos_tardanza=?,horas_trabajadas=?,estado=?,observacion=?,registrado_por_usuario_id=? WHERE id=?',[datos.hora_ingreso,datos.hora_salida,datos.minutos_tardanza,datos.horas_trabajadas,datos.estado,observacion,req.usuario.id,id]);
    } else {
      const [result]=await connection.query(`INSERT INTO asistencias (empleado_id,fecha,hora_programada_entrada,hora_programada_salida,tolerancia_minutos,hora_ingreso,hora_salida,minutos_tardanza,horas_trabajadas,estado,observacion,registrado_por_usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[empleadoId,fecha,guardado.hora_programada_entrada,guardado.hora_programada_salida,guardado.tolerancia_minutos,datos.hora_ingreso,datos.hora_salida,datos.minutos_tardanza,datos.horas_trabajadas,datos.estado,observacion,req.usuario.id]);
      id=result.insertId;
    }
    await connection.commit(); auditar(res,'asistencias',id,anterior?'UPDATE':'INSERT',anterior||null,{id,...guardado});
    return res.json({ok:true,id,mensaje:'Asistencia registrada correctamente.',data:{...guardado,minutosTardanza:datos.minutos_tardanza,horasTrabajadas:datos.horas_trabajadas}});
  } catch(error) {if(connection) await connection.rollback(); return fallo(res,error);} finally {if(connection) connection.release();}
};
exports.acumuladoTardanzas=async(req,res)=>{
  try {
    const periodo=req.query.periodo||'diario';
    if(!['diario','semanal','mensual','trimestral'].includes(periodo)) throw r.error('Periodo no válido.');
    const referencia=r.fecha(req.query.fecha||r.hoy()),d=new Date(referencia+'T12:00:00Z'),fin=new Date(d);
    if(periodo==='semanal'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));fin.setTime(d.getTime());fin.setUTCDate(d.getUTCDate()+6);}
    if(periodo==='mensual'||periodo==='trimestral'){d.setUTCDate(1);if(periodo==='trimestral')d.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3);fin.setTime(d.getTime());fin.setUTCMonth(d.getUTCMonth()+(periodo==='trimestral'?3:1));fin.setUTCDate(0);}
    const desde=d.toISOString().slice(0,10),hasta=fin.toISOString().slice(0,10),f=r.filtrosPersonal(req.query);
    const [rows]=await pool.query(`SELECT e.id,CONCAT(e.nombres,' ',e.apellidos) AS colaborador,ar.nombre AS area,
      COUNT(CASE WHEN a.estado='tardanza' THEN 1 END) AS total_tardanzas,COALESCE(SUM(a.minutos_tardanza),0) AS minutos_acumulados,
      MAX(CASE WHEN a.estado='tardanza' THEN a.fecha END) AS ultima_tardanza
      FROM empleados e JOIN areas ar ON ar.id=e.area_id LEFT JOIN asistencias a ON a.empleado_id=e.id AND a.fecha BETWEEN ? AND ?
      WHERE ${f.where} AND (e.estado='activo' OR a.id IS NOT NULL) GROUP BY e.id,e.nombres,e.apellidos,ar.nombre ORDER BY minutos_acumulados DESC,e.apellidos`,[desde,hasta,...f.params]);
    return res.json({ok:true,fecha_inicio:desde,fecha_fin:hasta,data:rows,kpis:{totalTardanzas:rows.reduce((n,x)=>n+Number(x.total_tardanzas),0),minutosAcumulados:rows.reduce((n,x)=>n+Number(x.minutos_acumulados),0),porcentajeConTardanzas:`${rows.length?(rows.filter(x=>Number(x.total_tardanzas)>0).length/rows.length*100).toFixed(1):0}%`}});
  }catch(error){return fallo(res,error);}
};
exports.listarPermisos=async(req,res)=>{
  try {
    const f=r.filtrosPersonal(req.query),condiciones=[f.where],params=[...f.params];
    if(req.query.fecha_desde){condiciones.push('p.fecha_fin>=?');params.push(r.fecha(req.query.fecha_desde));}
    if(req.query.fecha_hasta){condiciones.push('p.fecha_inicio<=?');params.push(r.fecha(req.query.fecha_hasta));}
    if(req.query.fecha_desde&&req.query.fecha_hasta&&req.query.fecha_desde>req.query.fecha_hasta)throw r.error('La fecha inicial no puede ser posterior a la final.');
    if(req.query.estado){if(!['Solicitado','Aprobado','Rechazado'].includes(req.query.estado))throw r.error('Estado no válido.');condiciones.push('p.estado=?');params.push(req.query.estado);}
    const [rows]=await pool.query(`SELECT p.*,CONCAT(e.nombres,' ',e.apellidos) AS colaborador FROM permisos p JOIN empleados e ON e.id=p.empleado_id WHERE ${condiciones.join(' AND ')} ORDER BY p.fecha_inicio DESC,p.id DESC`,params);
    return res.json({ok:true,data:rows.map(({archivo_sustento,...x})=>({...x,archivo_sustento:x.archivo_sustento_nombre||archivo_sustento,tiene_sustento:Boolean(x.archivo_sustento_nombre&&archivo_sustento)}))});
  }catch(error){return fallo(res,error);}
};
exports.crearPermiso=async(req,res)=>{
  let privado;
  try {
    const b=req.body,empleadoId=r.entero(b.empleado_id,'Trabajador'),inicio=r.fecha(b.fecha_inicio),fin=r.fecha(b.fecha_fin);
    if(fin<inicio)throw r.error('La fecha final no puede ser anterior a la inicial.');
    const desde=r.hora(b.hora_desde,'Hora desde',true),hasta=r.hora(b.hora_hasta,'Hora hasta',true);
    if(Boolean(desde)!==Boolean(hasta)||inicio===fin&&desde&&hasta<=desde)throw r.error('Complete ambas horas y coloque una hora final posterior a la inicial.');
    const tipo=r.texto(b.tipo_permiso||'Personal','Tipo',50,true),motivo=r.texto(b.motivo,'Motivo',4000,true),observaciones=r.texto(b.observaciones,'Observaciones',4000);
    const [[empleado]]=await pool.query("SELECT id FROM empleados WHERE id=? AND estado='activo'",[empleadoId]);
    if(!empleado)throw Object.assign(r.error('Trabajador activo no encontrado.'),{status:404});
    let nombre=null;
    if(b.sustento){const archivo=archivos.validarArchivo(b.sustento.nombre,b.sustento.base64);nombre=archivo.nombre_archivo;privado=await archivos.guardarArchivo(archivo);}
    if(b.archivo_sustento&&!b.sustento)throw r.error('Adjunte el archivo sustentatorio; un nombre por sí solo no carga el documento.');
    const [result]=await pool.query(`INSERT INTO permisos (empleado_id,tipo_permiso,fecha_inicio,fecha_fin,hora_desde,hora_hasta,motivo,observaciones,estado,archivo_sustento,archivo_sustento_nombre) VALUES (?,?,?,?,?,?,?,?,'Solicitado',?,?)`,[empleadoId,tipo,inicio,fin,desde,hasta,motivo,observaciones,privado||null,nombre]);
    auditar(res,'permisos',result.insertId,'INSERT',null,{empleado_id:empleadoId,tipo_permiso:tipo,fecha_inicio:inicio,fecha_fin:fin,estado:'Solicitado',archivo_sustento_nombre:nombre});
    return res.status(201).json({ok:true,id:result.insertId,mensaje:'Permiso registrado correctamente.'});
  }catch(error){if(privado)await archivos.eliminarArchivo(privado).catch(()=>{});return fallo(res,error);}
};
exports.actualizarEstadoPermiso=async(req,res)=>{
  try {
    const id=r.entero(req.params.id,'Permiso'),estado=req.body.estado;
    if(!['Solicitado','Aprobado','Rechazado'].includes(estado))throw r.error('Estado no válido.');
    const [[anterior]]=await pool.query('SELECT * FROM permisos WHERE id=?',[id]);
    if(!anterior)throw Object.assign(r.error('Permiso no encontrado.'),{status:404});
    await pool.query('UPDATE permisos SET estado=? WHERE id=?',[estado,id]);
    auditar(res,'permisos',id,'UPDATE',anterior,{...anterior,estado});
    return res.json({ok:true,mensaje:'Estado del permiso actualizado.'});
  }catch(error){return fallo(res,error);}
};
exports.sustentoPermiso=async(req,res)=>{
  try {
    const id=r.entero(req.params.id,'Permiso'),propio=req.usuario.rol===ROLES.COLABORADOR;
    const [[permiso]]=await pool.query(`SELECT empleado_id,archivo_sustento,archivo_sustento_nombre FROM permisos WHERE id=? ${propio?'AND empleado_id=?':''}`,propio?[id,req.usuario.empleado_id]:[id]);
    if(!permiso||!permiso.archivo_sustento_nombre)throw Object.assign(r.error('No existe un archivo adjunto disponible para este permiso.'),{status:404});
    const archivo=await archivos.obtenerArchivo(permiso.archivo_sustento);
    res.set({'Content-Type':archivo.mime_type,'Content-Disposition':archivos.disposicionArchivo(permiso.archivo_sustento_nombre,req.query.descargar==='1'),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"});
    return res.sendFile(archivo.ruta);
  }catch(error){return fallo(res,error);}
};
