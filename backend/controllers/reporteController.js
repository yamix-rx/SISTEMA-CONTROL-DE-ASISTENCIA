const pool = require('../config/database');
const r = require('../services/asistenciaReglas');
exports.obtenerConsolidado = async (req, res) => {
  try {
    const [inicio, fin] = r.rango(req.query.fecha_inicio, req.query.fecha_fin);
    const f = r.filtrosPersonal(req.query), estado = req.query.estado;
    if (estado && !r.ESTADOS.includes(estado)) throw r.error('Estado de asistencia no válido.');
    const filtroEstado = estado ? 'AND a.estado=?' : '';
    const params = [inicio,fin,...f.params,...(estado ? [estado] : [])];
    const [empleados] = await pool.query(`SELECT e.id AS empleado_id,e.empresa_id,e.area_id,e.cargo_id,
      CONCAT(e.nombres,' ',e.apellidos) AS colaborador,e.numero_documento,e.tipo_vinculo,e.estado AS estado_personal,
      emp.razon_social AS empresa,ar.nombre AS area,c.nombre AS cargo,
      CASE WHEN LOWER(e.tipo_vinculo) LIKE 'practicante%' THEN COALESCE(pd.horas_meta,e.horas_totales_asignadas,320) ELSE 0 END AS horas_meta
      FROM empleados e JOIN empresas emp ON emp.id=e.empresa_id JOIN areas ar ON ar.id=e.area_id JOIN cargos c ON c.id=e.cargo_id
      LEFT JOIN practicante_detalles pd ON pd.empleado_id=e.id WHERE ${f.where}
      ${estado ? 'AND EXISTS (SELECT 1 FROM asistencias ax WHERE ax.empleado_id=e.id AND ax.fecha BETWEEN ? AND ? AND ax.estado=?)' : ''}
      ORDER BY e.apellidos,e.nombres,e.id`, [...f.params,...(estado ? [inicio,fin,estado] : [])]);
    const [[marcaciones],[totales],[permisos]] = await Promise.all([
      pool.query(`SELECT a.* FROM asistencias a JOIN empleados e ON e.id=a.empleado_id WHERE a.fecha BETWEEN ? AND ? AND ${f.where} ${filtroEstado} ORDER BY a.fecha,a.empleado_id`,params),
      pool.query(`SELECT a.empleado_id,COALESCE(SUM(a.horas_trabajadas),0) AS horas_acumuladas FROM asistencias a JOIN empleados e ON e.id=a.empleado_id WHERE a.fecha<=? AND ${f.where} GROUP BY a.empleado_id`,[fin,...f.params]),
      pool.query(`SELECT p.empleado_id,p.estado,COUNT(*) AS cantidad FROM permisos p JOIN empleados e ON e.id=p.empleado_id WHERE p.fecha_inicio<=? AND p.fecha_fin>=? AND ${f.where} GROUP BY p.empleado_id,p.estado`,[fin,inicio,...f.params])
    ]);
    const data = construirReporte(empleados,marcaciones,totales,permisos);
    return res.json({ok:true,data:{...data,fecha_inicio:inicio,fecha_fin:fin,
      criterio_porcentaje:'Asistencias presentes, tardanzas y justificadas con ingreso / días registrados como presente, tardanza, falta o justificado. No incluye días sin registrar ni permisos, descansos, feriados o vacaciones.',
      criterio_horas:'Horas del periodo según filtros; horas acumuladas y pendientes hasta la fecha final, incluyendo todos los estados.'}});
  } catch (error) {
    if (!error.status) console.error('Error de reporte:',error.code||error.name);
    return res.status(error.status||500).json({ok:false,mensaje:error.status?error.message:'No se pudo generar el reporte.'});
  }
};
function construirReporte(empleados,marcaciones,totales,permisos) {
  const acumuladas = new Map(totales.map(x=>[Number(x.empleado_id),Number(x.horas_acumuladas)]));
  const porEmpleado = new Map(empleados.map(e=>[Number(e.empleado_id),{...e,horas_meta:Number(e.horas_meta||0),
    dias_registrados:0,dias_asistencia:0,dias_evaluables:0,dias_puntual:0,dias_tardanza:0,dias_falta:0,
    total_minutos_tardanza:0,total_horas_laboradas:0,total_permisos:0,permisos_aprobados:0,
    horas_acumuladas:acumuladas.get(Number(e.empleado_id))||0}]));
  const seleccionadas = marcaciones.filter(a=>porEmpleado.has(Number(a.empleado_id)));
  for(const a of seleccionadas){
    const e=porEmpleado.get(Number(a.empleado_id)); e.dias_registrados++;
    if(a.estado==='presente')e.dias_puntual++;
    if(a.estado==='tardanza')e.dias_tardanza++;
    if(a.estado==='falta')e.dias_falta++;
    if(['presente','tardanza','justificado'].includes(a.estado)&&a.hora_ingreso)e.dias_asistencia++;
    if(['presente','tardanza','falta','justificado'].includes(a.estado))e.dias_evaluables++;
    e.total_minutos_tardanza+=Number(a.minutos_tardanza||0);e.total_horas_laboradas+=Number(a.horas_trabajadas||0);
  }
  for(const p of permisos){const e=porEmpleado.get(Number(p.empleado_id));if(e){e.total_permisos+=Number(p.cantidad);if(p.estado==='Aprobado')e.permisos_aprobados+=Number(p.cantidad);}}
  const detalles=[...porEmpleado.values()].map(e=>({...e,total_horas_laboradas:Math.round(e.total_horas_laboradas*100)/100,
    horas_pendientes:e.horas_meta>0?Math.round(Math.max(0,e.horas_meta-e.horas_acumuladas)*100)/100:0,
    porcentaje_avance:e.horas_meta>0?Math.min(100,Math.round(e.horas_acumuladas/e.horas_meta*1000)/10):null,
    porcentaje_asistencia:e.dias_evaluables?Math.round(e.dias_asistencia/e.dias_evaluables*1000)/10:null}));
  const sumar=key=>Math.round(detalles.reduce((n,e)=>n+Number(e[key]||0),0)*100)/100;
  const evaluables=sumar('dias_evaluables');
  return {detalles,marcaciones:seleccionadas,kpis:{total_marcaciones:sumar('dias_registrados'),total_presentes:sumar('dias_asistencia'),total_tardanzas:sumar('dias_tardanza'),total_faltas:sumar('dias_falta'),minutos_tardanza_acumulados:sumar('total_minutos_tardanza'),horas_trabajadas_acumuladas:sumar('total_horas_laboradas'),horas_pendientes:sumar('horas_pendientes'),total_permisos:sumar('total_permisos'),permisos_aprobados:sumar('permisos_aprobados'),porcentaje_asistencia:evaluables?Math.round(sumar('dias_asistencia')/evaluables*1000)/10:null}};
}
exports.construirReporte=construirReporte;
