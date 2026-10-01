(async()=>{
 'use strict';
 const u=window.AsistenciaUI,{$,api,options,toast,show}=u;
 const chips=['chip-green','chip-blue','chip-purple','chip-pink','chip-red','chip-cyan','chip-yellow','chip-slate'];
 let data,rows=[],sequence=0;
 const minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
 const employees=()=>data.empleados.filter(x=>x.estado==='activo');
 function populateFilters(){
   const company=$('filtroEmpresa').value;
   options('filtroArea',data.areas.filter(x=>!company||String(x.empresa_id)===company),'nombre','Todas las áreas');
   const area=$('filtroArea').value;
   options('filtroCargo',data.cargos.filter(x=>!area||String(x.area_id)===area),'nombre','Todos los cargos');
   const cargo=$('filtroCargo').value;
   options('filtroTrabajador',employees().filter(x=>(!company||String(x.empresa_id)===company)&&(!area||String(x.area_id)===area)&&(!cargo||String(x.cargo_id)===cargo)),'colaborador','Todos los trabajadores');
   $('areaTabs').replaceChildren();
   for(const a of [{id:'',nombre:'General'},...data.areas.filter(x=>!company||String(x.empresa_id)===company)]){
     const b=u.button(a.nombre,()=>{$('filtroArea').value=a.id;populateFilters();load();});b.className='area-btn h-10 rounded-md panel-border px-2 text-[10px] font-bold'+(String(a.id)===area?' active':'');$('areaTabs').append(b);
   }
 }
 async function load(){
   const request=++sequence,q=new URLSearchParams();for(const [id,key]of [['filtroEmpresa','empresa_id'],['filtroArea','area_id'],['filtroCargo','cargo_id'],['filtroTrabajador','empleado_id']])if($(id).value)q.set(key,$(id).value);
   try{const result=await api('/api/horarios?'+q);if(request!==sequence)return;rows=result.data;render();}catch(error){toast(error.message);}
 }
 function render(){
   const schedules=rows.flatMap((e,index)=>e.malla_horarios.map(h=>({...h,empleado:e,color:chips[index%chips.length]})));
   const body=$('scheduleBody');body.replaceChildren();
   function chip(s){const b=u.button(s.empleado.colaborador,()=>edit(s));b.className='person-chip '+(s.activo?s.color:'chip-slate');b.title=`${s.empleado.colaborador} · ${u.time(s.hora_entrada)}–${u.time(s.hora_salida)} · tolerancia ${s.tolerancia_minutos} min`;return b;}
   const descansos=schedules.filter(s=>!s.activo);
   if(descansos.length){const tr=document.createElement('tr');tr.append(u.cell('Descanso'));for(let day=1;day<=7;day++){const td=u.cell('');td.replaceChildren(...descansos.filter(s=>Number(s.dia_semana)===day).map(chip));tr.append(td);}body.append(tr);}
   const view=$('filtroVista').value;
   for(let hour=0;hour<24;hour++){
     if(view==='manana'&&hour>=14||view==='tarde'&&hour<14)continue;
     const matches=day=>schedules.filter(s=>{
       if(!s.activo)return false;const start=minute(s.hora_entrada),end=minute(s.hora_salida),h=hour*60,own=Number(s.dia_semana)===day;
       return end>start?own&&h<end&&h+60>start:own&&h+60>start||s.activo&&((Number(s.dia_semana)%7)+1)===day&&h<end;
     });
     if(view==='semanal'&&(hour<7||hour>19)&&![1,2,3,4,5,6,7].some(day=>matches(day).length))continue;
     const tr=document.createElement('tr'),label=u.cell(`${String(hour).padStart(2,'0')}:00`);label.className='hour-cell h-10 text-center';tr.append(label);
     for(let day=1;day<=7;day++){const td=document.createElement('td');td.className='slot-cell px-3 py-1 text-center';const items=matches(day);if(items.length)td.append(...items.map(chip));else td.textContent='—';tr.append(td);}body.append(tr);
   }
   $('tituloHorario').textContent='HORARIO SEMANAL — '+($('filtroArea').selectedOptions[0]?.textContent||'GENERAL');
   const monday=new Date(u.today()+'T12:00:00');monday.setDate(monday.getDate()-((monday.getDay()+6)%7)+Number($('filtroSemana').value)*7);const sunday=new Date(monday);sunday.setDate(sunday.getDate()+6);
   $('rangoSemana').textContent=monday.toLocaleDateString('es-PE')+' — '+sunday.toLocaleDateString('es-PE')+' · plantilla semanal vigente';
   $('kpiPersonal').textContent=new Set(schedules.filter(s=>s.activo).map(s=>s.empleado.empleado_id)).size;$('kpiAreas').textContent=new Set(rows.map(e=>e.area_id)).size;
 }
 function metadata(){const e=employees().find(e=>Number(e.id)===Number($('empleadoSelect').value));$('modalEmpresa').value=e?.empresa||'';$('modalArea').value=e?.area||'';}
 function open(){
   $('formHorario').reset();$('editHorarioId').value='';options('empleadoSelect',employees(),'colaborador','Seleccione trabajador');$('empleadoSelect').disabled=false;$('modalDia').disabled=false;$('modalTolerancia').value='0';$('btnEliminar').classList.add('hidden');metadata();show('modalHorario',true);
 }
 function edit(s){open();$('editHorarioId').value=s.id;$('empleadoSelect').value=s.empleado.empleado_id;$('empleadoSelect').disabled=true;$('modalDia').value=s.dia_semana;$('modalDia').disabled=true;$('modalEntrada').value=u.time(s.hora_entrada);$('modalSalida').value=u.time(s.hora_salida);$('modalTolerancia').value=s.tolerancia_minutos;$('modalEstado').value=s.activo?'asignado':'descanso';$('modalNocturno').checked=s.hora_salida<s.hora_entrada;$('btnEliminar').classList.remove('hidden');metadata();}
 $('formHorario').onsubmit=async event=>{
   event.preventDefault();$('btnSubmitForm').disabled=true;
   try{await api('/api/horarios/asignar',{method:'POST',body:JSON.stringify({id:$('editHorarioId').value||undefined,empleado_id:Number($('empleadoSelect').value),dias:[Number($('modalDia').value)],hora_entrada:$('modalEntrada').value,hora_salida:$('modalSalida').value,tolerancia_minutos:Number($('modalTolerancia').value),estado:$('modalEstado').value,cruza_medianoche:$('modalNocturno').checked})});show('modalHorario',false);await load();toast('Horario guardado.');}catch(error){toast(error.message);}finally{$('btnSubmitForm').disabled=false;}
 };
 $('btnEliminar').onclick=async()=>{if(!confirm('¿Eliminar este horario? Las asistencias anteriores se conservan.'))return;try{await api('/api/horarios/'+$('editHorarioId').value,{method:'DELETE'});show('modalHorario',false);await load();}catch(error){toast(error.message);}};
 $('btnAbrirModal').onclick=open;$('btnCerrarModal').onclick=$('btnCancelar').onclick=()=>show('modalHorario',false);$('modalHorario').onclick=e=>{if(e.target===$('modalHorario'))show('modalHorario',false);};$('empleadoSelect').onchange=metadata;
 document.addEventListener('keydown',e=>{if(e.key==='Escape')show('modalHorario',false);});
 $('filtroVista').onchange=$('filtroSemana').onchange=render;
 try{data=await u.catalogs();for(const id of ['filtroEmpresa','empresaGlobal'])options(id,data.empresas,'razon_social','Todas las empresas');populateFilters();
   for(const id of ['filtroEmpresa','filtroArea','filtroCargo','filtroTrabajador'])$(id).onchange=()=>{$('empresaGlobal').value=$('filtroEmpresa').value;populateFilters();load();};
   $('empresaGlobal').onchange=()=>{$('filtroEmpresa').value=$('empresaGlobal').value;populateFilters();load();};await load();
 }catch(error){toast(error.message);$('btnAbrirModal').disabled=true;}
 window.lucide?.createIcons();
})();
