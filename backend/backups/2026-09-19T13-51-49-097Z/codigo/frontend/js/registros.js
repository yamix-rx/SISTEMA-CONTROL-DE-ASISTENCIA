(async () => {
  'use strict';
  const u=window.AsistenciaUI,{$,api,options,table,button,toast,date,time,show}=u;
  let data,asistencias=[],periodo='diario',versionA=0,versionT=0,versionP=0;
  const loadA=async()=>{
    const version=++versionA,q=u.filters('f');q.set('fecha',$('fFecha').value);if(!q.has('empresa_id')&&$('empresaGlobal').value)q.set('empresa_id',$('empresaGlobal').value);
    try{const result=await api('/api/asistencias?'+q);if(version!==versionA)return;asistencias=result.data;$('fechaGrupo').textContent=date(result.fecha);
      table('tbodyAsistencia',asistencias,14,(x,i)=>['',i+1,x.colaborador,x.empresa,x.area,x.cargo,time(x.hora_programada),time(x.hora_ingreso),time(x.hora_salida),Number(x.horas_trabajadas||0).toFixed(2),x.estado||'Sin registrar',`${Number(x.minutos_tardanza||0)} min`,x.observacion,button('Editar',()=>openAttendance(x))]);
    }catch(error){toast(error.message);table('tbodyAsistencia',[],14,()=>[]);}
  };
  const loadT=async()=>{
    const version=++versionT,q=u.filters('t');q.set('periodo',periodo);q.set('fecha',$('tFecha').value);
    try{const result=await api('/api/asistencias/tardanzas?'+q);if(version!==versionT)return;
      $('kTard').textContent=result.kpis.totalTardanzas;$('kMin').textContent=result.kpis.minutosAcumulados+' min';$('kPct').textContent=result.kpis.porcentajeConTardanzas;
      table('tbodyTardanzas',result.data,6,x=>[x.colaborador,x.area,x.total_tardanzas,x.minutos_acumulados+' min',date(x.ultima_tardanza),Number(x.total_tardanzas)>=3?'Alerta':Number(x.total_tardanzas)>0?'Con tardanzas':'Sin tardanzas']);
    }catch(error){toast(error.message);}
  };
  const loadP=async()=>{
    const version=++versionP,q=u.filters('p');q.delete('empleado_id');if($('pEmpleado').value)q.set('empleado_id',$('pEmpleado').value);if($('pDesde').value)q.set('fecha_desde',$('pDesde').value);if($('pHasta').value)q.set('fecha_hasta',$('pHasta').value);
    try{const result=await api('/api/asistencias/permisos?'+q);if(version!==versionP)return;$('pCount').textContent=`Mostrando ${result.data.length} registros`;
      table('tbodyPermisos',result.data,11,(p,i)=>{
        const files=document.createElement('div'),actions=document.createElement('div');
        if(p.tiene_sustento){files.append(button('Ver',()=>u.downloadPermission(p)),button('Descargar',()=>u.downloadPermission(p,true)));files.title=p.archivo_sustento_nombre;}else files.textContent=p.archivo_sustento?'Referencia antigua: '+p.archivo_sustento:'Sin sustento';
        for(const estado of ['Solicitado','Aprobado','Rechazado'].filter(e=>e!==p.estado))actions.append(button(estado,async()=>{if(!confirm(`¿Cambiar el permiso a ${estado.toLowerCase()}?`))return;await api(`/api/asistencias/permisos/${p.id}/estado`,{method:'PATCH',body:JSON.stringify({estado})});await loadP();}));
        return[i+1,p.colaborador,date(p.fecha_inicio)+' al '+date(p.fecha_fin),time(p.hora_desde),time(p.hora_hasta),p.tipo_permiso,p.motivo,p.observaciones,p.estado,files,actions];
      });
    }catch(error){toast(error.message);}
  };
  function toggleTimes(){const administrative=['falta','permiso','descanso','feriado','vacaciones'].includes($('aEstado').value);for(const id of ['aIngreso','aSalida']){$(id).disabled=administrative;if(administrative)$(id).value='';}$('aIngreso').required=['presente','tardanza'].includes($('aEstado').value);}
  function openAttendance(item){
    $('formAsistencia').reset();options('aTrabajador',data.empleados.filter(x=>x.estado==='activo'||item&&Number(x.id)===Number(item.empleado_id)),'colaborador','Seleccione trabajador');
    $('aTrabajador').disabled=Boolean(item);if(item)$('aTrabajador').value=item.empleado_id;
    $('aFecha').value=item?date(item.fecha):$('fFecha').value;$('aFecha').disabled=Boolean(item);$('aFecha').max=u.today();
    $('aIngreso').value=item?.hora_ingreso?.slice(0,5)||'';$('aSalida').value=item?.hora_salida?.slice(0,5)||'';$('aEstado').value=item?.estado||'presente';$('aObs').value=item?.observacion||'';toggleTimes();show('modalAsistencia',true);
  }
  $('aEstado').onchange=toggleTimes;
  $('btnNuevaAsistencia').onclick=()=>openAttendance();
  $('btnNuevoPermiso').onclick=()=>{$('formPermiso').reset();options('pTrabajador',data.empleados.filter(x=>x.estado==='activo'),'colaborador','Seleccione trabajador');$('pInicio').value=u.today();$('pFin').value=u.today();show('modalPermiso',true);};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>show(b.dataset.close,false));
  for(const id of ['modalAsistencia','modalPermiso'])$(id).onclick=e=>{if(e.target===$(id))show(id,false);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){show('modalAsistencia',false);show('modalPermiso',false);}});
  $('formAsistencia').onsubmit=async event=>{
    event.preventDefault();$('btnGuardarAsist').disabled=true;
    try{const payload={empleado_id:$('aTrabajador').value,fecha:$('aFecha').value,hora_ingreso:$('aIngreso').value,hora_salida:$('aSalida').value,estado:$('aEstado').value,observacion:$('aObs').value};
      await api('/api/asistencias/marcar',{method:'POST',body:JSON.stringify(payload)});show('modalAsistencia',false);toast('Asistencia guardada.');await Promise.all([loadA(),loadT()]);
    }catch(error){toast(error.message);}finally{$('btnGuardarAsist').disabled=false;}
  };
  $('formPermiso').onsubmit=async event=>{
    event.preventDefault();$('btnGuardarPermiso').disabled=true;
    try{const payload={empleado_id:$('pTrabajador').value,tipo_permiso:$('pTipo').value,fecha_inicio:$('pInicio').value,fecha_fin:$('pFin').value,hora_desde:$('pHoraDesde').value,hora_hasta:$('pHoraHasta').value,motivo:$('pMotivo').value,observaciones:$('pObservaciones').value,sustento:await u.file($('pDocumento').files[0])};
      await api('/api/asistencias/permisos',{method:'POST',body:JSON.stringify(payload)});show('modalPermiso',false);toast('Permiso guardado.');await loadP();
    }catch(error){toast(error.message);}finally{$('btnGuardarPermiso').disabled=false;}
  };
  $('fFecha').value=u.today();$('fFecha').max=u.today();$('tFecha').value=u.today();
  document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{periodo=b.dataset.period;document.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('on',x===b));loadT();});
  $('btnVerReporte').onclick=loadT;
  try{
    data=await u.catalogs();
    for(const id of ['empresaGlobal','fEmpresa','tEmpresa','pEmpresa'])options(id,data.empresas,'razon_social','Todas las empresas');
    for(const [prefix,load]of [['f',loadA],['t',loadT],['p',loadP]]){
      // pTrabajador belongs to the creation dialog; filters use pEmpleado.
      u.cascade(data,prefix,prefix==='p'?'Empleado':'Trabajador');
      for(const suffix of ['Empresa','Area','Cargo',prefix==='p'?'Empleado':'Trabajador','Estado','Fecha','Buscar','Desde','Hasta']){const el=$(prefix+suffix);if(el)el.addEventListener('change',()=>{if(['Empresa','Area','Cargo'].includes(suffix))u.cascade(data,prefix,prefix==='p'?'Empleado':'Trabajador');load();});}
    }
    $('empresaGlobal').onchange=()=>{$('fEmpresa').value=$('empresaGlobal').value;u.cascade(data,'f');loadA();};
    await Promise.all([loadA(),loadT(),loadP()]);
  }catch(error){toast(error.message);$('btnNuevaAsistencia').disabled=true;$('btnNuevoPermiso').disabled=true;}
  window.lucide?.createIcons();
})();
