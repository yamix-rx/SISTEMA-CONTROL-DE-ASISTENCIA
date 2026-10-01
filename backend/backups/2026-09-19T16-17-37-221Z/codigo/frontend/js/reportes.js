(async()=>{
 'use strict';
 const u=window.AsistenciaUI,{$,api,options,table,toast}=u;
 let catalogos,reporte=null,sequence=0;
 const headers=['Colaborador','DNI','Empresa','Área','Cargo','Vínculo','Puntual','Tardanza','Falta','Min. tardanza','Horas periodo','Horas acumuladas','Horas pendientes','Permisos','% asistencia','Avance horas %'];
 const values=e=>[e.colaborador,e.numero_documento,e.empresa,e.area,e.cargo,e.tipo_vinculo,e.dias_puntual,e.dias_tardanza,e.dias_falta,e.total_minutos_tardanza,e.total_horas_laboradas,e.horas_acumuladas,e.horas_pendientes,e.total_permisos,e.porcentaje_asistencia??'',e.porcentaje_avance??''];
 function dirty(){sequence++;reporte=null;$('btnExportarExcel').disabled=$('btnExportarPDF').disabled=true;$('lblConteoResultados').textContent='Filtros modificados. Pulse Filtrar para actualizar.';}
 function period(){const p=$('fPeriodo').value;if(p==='personalizado')return;const d=new Date(($('fInicio').value||u.today())+'T12:00:00Z'),end=new Date(d);
   if(p==='semanal'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));end.setTime(d.getTime());end.setUTCDate(d.getUTCDate()+6);}
   if(p==='mensual'||p==='trimestral'){d.setUTCDate(1);if(p==='trimestral')d.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3);end.setTime(d.getTime());end.setUTCMonth(d.getUTCMonth()+(p==='trimestral'?3:1));end.setUTCDate(0);}
   $('fInicio').value=d.toISOString().slice(0,10);$('fFin').value=end.toISOString().slice(0,10);
 }
 async function generate(){
   const request=++sequence;$('btnFiltrar').disabled=true;$('btnExportarExcel').disabled=$('btnExportarPDF').disabled=true;
   const q=u.filters('f');q.set('fecha_inicio',$('fInicio').value);q.set('fecha_fin',$('fFin').value);if($('fVinculo').value)q.set('tipo_vinculo',$('fVinculo').value);
   try{const result=await api('/api/reportes/consolidado?'+q);if(request!==sequence)return;reporte=result.data;
     reporte.descripcionFiltros=['Empresa','Area','Cargo','Trabajador','Estado','Vinculo'].map(s=>`${s}: ${$('f'+s).selectedOptions[0]?.textContent||'Todos'}`).join(' | ');
     const k=reporte.kpis;for(const [id,value]of Object.entries({kpiPuntuales:k.total_presentes,kpiTardanzas:k.total_tardanzas,kpiMinutos:k.minutos_tardanza_acumulados+' min',kpiHoras:k.horas_trabajadas_acumuladas+' h',kpiFaltas:k.total_faltas,kpiPermisos:k.total_permisos,kpiPendientes:k.horas_pendientes+' h',kpiAsistencia:k.porcentaje_asistencia==null?'—':k.porcentaje_asistencia+'%'}))$(id).textContent=value;
     $('criterioReporte').textContent=reporte.criterio_porcentaje+' '+reporte.criterio_horas;
     table('tbodyReportes',reporte.detalles,headers.length,(e)=>values(e));$('lblConteoResultados').textContent=`Mostrando ${reporte.detalles.length} colaboradores`;
     $('btnExportarExcel').disabled=$('btnExportarPDF').disabled=!reporte.detalles.length;
   }catch(error){if(request===sequence){reporte=null;table('tbodyReportes',[],headers.length,()=>[]);toast(error.message);}}
   finally{$('btnFiltrar').disabled=false;}
 }
 function excel(){
   if(!reporte)return;try{
     const wb=XLSX.utils.book_new(),border={top:{style:'thin',color:{rgb:'CBD5E1'}},bottom:{style:'thin',color:{rgb:'CBD5E1'}},left:{style:'thin',color:{rgb:'CBD5E1'}},right:{style:'thin',color:{rgb:'CBD5E1'}}};
     const blue={fill:{fgColor:{rgb:'075D91'}},font:{bold:true,color:{rgb:'FFFFFF'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border};
     const gold={...blue,fill:{fgColor:{rgb:'B58900'}}},dayStyle={...blue,fill:{fgColor:{rgb:'F6D77B'}},font:{bold:true,color:{rgb:'172554'}}};
     const dates=[];for(let d=new Date(reporte.fecha_inicio+'T12:00:00Z');d<=new Date(reporte.fecha_fin+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
     const weeks=new Map();for(const day of dates){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=d.toISOString().slice(0,10);if(!weeks.has(key))weeks.set(key,[]);weeks.get(key).push(day);}
     const rows=[['SEMANAS'],['COLABORADOR'],['']],merges=[{s:{r:1,c:0},e:{r:2,c:0}}],cols=[{wch:34}],hourColumns=[];let col=1;
     for(const days of weeks.values()){
       const start=col;rows[0][col]=`SEMANA: ${days[0]} AL ${days.at(-1)}`;
       for(const day of days){rows[1][col]=day;rows[2][col]='ENTRADA / ESTADO';rows[2][col+1]='SALIDA';merges.push({s:{r:1,c:col},e:{r:1,c:col+1}});cols.push({wch:17},{wch:12});col+=2;}
       rows[1][col]='HORAS SEMANA';merges.push({s:{r:1,c:col},e:{r:2,c:col}});hourColumns.push(col);cols.push({wch:15});col++;
       merges.push({s:{r:0,c:start},e:{r:0,c:col-1}});
     }
     const daily=new Map(reporte.marcaciones.map(a=>[`${a.empleado_id}|${u.date(a.fecha)}`,a]));
     for(const e of reporte.detalles){const row=[e.colaborador];for(const days of weeks.values()){let hours=0;for(const date of days){const a=daily.get(`${e.empleado_id}|${date}`);row.push(a?.hora_ingreso?u.time(a.hora_ingreso):a?.estado||'',a?.hora_salida?u.time(a.hora_salida):'');hours+=Number(a?.horas_trabajadas||0);}row.push(Math.round(hours*100)/100/24);}rows.push(row);}
     const ws=XLSX.utils.aoa_to_sheet(rows);ws['!merges']=merges;ws['!cols']=cols;ws['!rows']=[{hpt:25},{hpt:25},{hpt:30}];ws['!freeze']={xSplit:1,ySplit:3};
     for(let row=0;row<rows.length;row++)for(let c=0;c<col;c++){const key=XLSX.utils.encode_cell({r:row,c});if(!ws[key])continue;ws[key].s=row===0?gold:row<3?dayStyle:{border,alignment:{vertical:'center',horizontal:c?'center':'left'},fill:{fgColor:{rgb:c===0?(String(reporte.detalles[row-3]?.tipo_vinculo).startsWith('practicante')?'DDD6FE':'FEE2E2'):row%2?'FFFFFF':'F0F9FF'}},font:{sz:10}};if(row>=3&&hourColumns.includes(c))ws[key].z='[h]:mm';}
     XLSX.utils.book_append_sheet(wb,ws,'CONTROL ASISTENCIA');
     const summary=[['REPORTE CONSOLIDADO'],['Desde',reporte.fecha_inicio,'Hasta',reporte.fecha_fin],[reporte.descripcionFiltros],[],headers,...reporte.detalles.map(values)];
     const resumen=XLSX.utils.aoa_to_sheet(summary);resumen['!cols']=headers.map((_,i)=>({wch:i===0?34:i<6?24:17}));for(let c=0;c<headers.length;c++){const key=XLSX.utils.encode_cell({r:4,c});resumen[key].s=blue;}resumen['!autofilter']={ref:`A5:${XLSX.utils.encode_col(headers.length-1)}${summary.length}`};XLSX.utils.book_append_sheet(wb,resumen,'RESUMEN');
     const people=new Map(reporte.detalles.map(e=>[Number(e.empleado_id),e]));
     const detail=[['Colaborador','DNI','Fecha','Entrada programada','Salida programada','Ingreso','Salida','Estado','Minutos tardanza','Horas','Observación'],...reporte.marcaciones.map(a=>[people.get(Number(a.empleado_id))?.colaborador,people.get(Number(a.empleado_id))?.numero_documento,u.date(a.fecha),u.time(a.hora_programada_entrada),u.time(a.hora_programada_salida),u.time(a.hora_ingreso),u.time(a.hora_salida),a.estado,Number(a.minutos_tardanza),Number(a.horas_trabajadas),a.observacion||''])];
     const detalles=XLSX.utils.aoa_to_sheet(detail);detalles['!cols']=detail[0].map((_,i)=>({wch:i===0||i===10?35:20}));for(let c=0;c<detail[0].length;c++)detalles[XLSX.utils.encode_cell({r:0,c})].s=blue;XLSX.utils.book_append_sheet(wb,detalles,'DETALLE');
     XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Criterios del reporte'],[reporte.criterio_porcentaje],[reporte.criterio_horas],['Las horas no incluyen una clasificación de horas extras.'],['El archivo corresponde a los mismos datos y filtros mostrados en pantalla.']]),'CRITERIOS');
     XLSX.writeFile(wb,`CONTROL_DE_ASISTENCIA_${reporte.fecha_inicio}_al_${reporte.fecha_fin}.xlsx`);toast('Excel descargado.');
   }catch(error){console.error(error);toast('No se pudo generar el Excel.');}
 }
 function pdf(){if(!reporte)return;try{const doc=new window.jspdf.jsPDF('l','mm','a3');doc.setFontSize(14);doc.text('SBSS - Reporte consolidado de asistencia',12,15);doc.setFontSize(8);doc.text(`Periodo: ${reporte.fecha_inicio} al ${reporte.fecha_fin}`,12,22);doc.text(doc.splitTextToSize(reporte.descripcionFiltros,390),12,28);
   doc.autoTable({startY:40,head:[headers],body:reporte.detalles.map(values),theme:'striped',headStyles:{fillColor:[7,93,145]},styles:{fontSize:7,cellPadding:2},margin:{left:12,right:12}});
   doc.addPage();doc.setFontSize(11);doc.text('Criterios y filtros',12,16);doc.setFontSize(9);doc.text(doc.splitTextToSize(reporte.criterio_porcentaje+'\n\n'+reporte.criterio_horas+'\n\n'+reporte.descripcionFiltros,390),12,25);doc.save(`Reporte_Consolidado_${reporte.fecha_inicio}_${reporte.fecha_fin}.pdf`);toast('PDF descargado.');
 }catch(error){console.error(error);toast('No se pudo generar el PDF.');}}
 $('btnFiltrar').onclick=generate;$('btnExportarExcel').onclick=excel;$('btnExportarPDF').onclick=pdf;
 $('fInicio').value=u.today();$('fPeriodo').value='mensual';period();dirty();
 try{catalogos=await u.catalogs();options('fEmpresa',catalogos.empresas,'razon_social','Todas las empresas');u.cascade(catalogos,'f');const empleado=new URLSearchParams(location.search).get('empleado_id');if(empleado)$('fTrabajador').value=empleado;
   for(const suffix of ['Empresa','Area','Cargo','Trabajador','Estado','Vinculo','Inicio','Fin','Periodo'])$('f'+suffix).onchange=()=>{if(['Empresa','Area','Cargo'].includes(suffix))u.cascade(catalogos,'f');if(suffix==='Periodo')period();if(suffix==='Inicio'||suffix==='Fin')$('fPeriodo').value='personalizado';dirty();};
   await generate();
 }catch(error){toast(error.message);}
 window.lucide?.createIcons();
})();
