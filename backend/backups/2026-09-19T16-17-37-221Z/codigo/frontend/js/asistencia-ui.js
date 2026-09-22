(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  async function api(url, options = {}) {
    const response = await fetch(url, {...options, headers:{Authorization:`Bearer ${localStorage.getItem('sbss_token')}`, ...(options.body ? {'Content-Type':'application/json'} : {}),...options.headers}});
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo completar la solicitud.');
    return data;
  }
  function options(id, rows, label, placeholder = 'Todos') {
    const select=$(id), selected=select.value;
    select.replaceChildren(new Option(placeholder,''),...rows.map(row=>new Option(row[label],row.id)));
    if([...select.options].some(x=>x.value===selected))select.value=selected;
  }
  function cell(value) { const td=document.createElement('td'); if(value instanceof Node)td.append(value);else td.textContent=value==null||value===''?'—':String(value); return td; }
  function table(id, rows, cols, render) {
    const body=$(id);body.replaceChildren();
    if(!rows.length){const tr=document.createElement('tr'),td=cell('No hay registros con los filtros seleccionados.');td.colSpan=cols;tr.append(td);body.append(tr);return;}
    rows.forEach((row,i)=>{const tr=document.createElement('tr');tr.append(...render(row,i).map(cell));body.append(tr);});
  }
  function button(label, action) {const b=document.createElement('button');b.type='button';b.textContent=label;b.className='text-sky-700 font-bold px-2 py-1';b.onclick=()=>Promise.resolve(action()).catch(error=>toast(error.message));return b;}
  function toast(message){let node=$('toast');if(!node){node=document.createElement('div');node.className='fixed right-5 bottom-5 z-[100] bg-slate-900 text-white p-4 rounded-lg shadow text-sm';document.body.append(node);setTimeout(()=>node.remove(),5500);}else{node.classList.remove('hidden');setTimeout(()=>node.classList.add('hidden'),5500);}node.textContent=message;node.setAttribute('role','status');}
  const date=value=>value?String(value).slice(0,10):'—';
  const time=value=>value?String(value).slice(0,5):'—';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function show(id,visible){$(id).classList.toggle('hidden',!visible);$(id).classList.toggle('flex',visible);}
  async function catalogs(){const [c,e]=await Promise.all([api('/api/personal/catalogos'),api('/api/personal?estado=todos')]);return {...c.data,empleados:e.data};}
  function cascade(data,prefix,worker='Trabajador'){
    const empresa=$(prefix+'Empresa')?.value,area=$(prefix+'Area')?.value;
    if($(prefix+'Area'))options(prefix+'Area',data.areas.filter(x=>!empresa||String(x.empresa_id)===empresa),'nombre','Todas las áreas');
    const areaActual=$(prefix+'Area')?.value;
    if($(prefix+'Cargo'))options(prefix+'Cargo',data.cargos.filter(x=>!areaActual||String(x.area_id)===areaActual),'nombre','Todos los cargos');
    const cargo=$(prefix+'Cargo')?.value;
    if($(prefix+worker))options(prefix+worker,data.empleados.filter(x=>(!empresa||String(x.empresa_id)===empresa)&&(!areaActual||String(x.area_id)===areaActual)&&(!cargo||String(x.cargo_id)===cargo)),'colaborador','Todos los trabajadores');
  }
  function filters(prefix){const q=new URLSearchParams();for(const [suffix,key]of Object.entries({Empresa:'empresa_id',Area:'area_id',Cargo:'cargo_id',Trabajador:'empleado_id',Estado:'estado',Buscar:'buscar'})){const value=$(prefix+suffix)?.value;if(value)q.set(key,value);}return q;}
  async function file(file){if(!file)return null;if(file.size>5*1024*1024)throw new Error('El archivo supera el máximo de 5 MB.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({nombre:file.name,base64:String(reader.result).split(',')[1]});reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(file);});}
  async function downloadPermission(permission,download=false){
    const response=await fetch(`/api/asistencias/permisos/${permission.id}/sustento${download?'?descargar=1':''}`,{headers:{Authorization:`Bearer ${localStorage.getItem('sbss_token')}`}});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.mensaje||'No se pudo abrir el sustento.');}
    const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;
    if(download)a.download=permission.archivo_sustento_nombre||'sustento';else{a.target='_blank';a.rel='noopener';}
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  window.AsistenciaUI={$,api,options,cell,table,button,toast,date,time,today,show,catalogs,cascade,filters,file,downloadPermission};
})();
