(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let catalogs = { empleados:[], roles:[], empresas:[], areas:[], cargos:[] };
  let users = [];
  let current;
  const node = (tag,text) => { const e=document.createElement(tag); if(text!=null)e.textContent=text; return e; };
  function message(text,failed=false) { $('adminStatus').textContent=text; $('adminStatus').classList.toggle('error',failed); }
  async function api(path, options={}) {
    const response=await window.SBSSSession.fetch(`${window.SBSSSession.API_BASE}/administracion${path}`,options);
    const result=await response.json();
    if(!response.ok || !result.ok) throw new Error(result.mensaje || 'No se pudo completar la operación.');
    return result;
  }
  const save=(path,body,method='POST')=>api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  function options(id,rows,label,selected='') {
    const select=$(id); select.replaceChildren(new Option('Selecciona una opción',''));
    for(const row of rows) select.add(new Option(label(row),row.id));
    select.value=String(selected);
  }
  function action(text,callback) {const b=node('button',text);b.type='button';b.className='secondary';b.addEventListener('click',callback);return b;}
  function table(id,rows,render,columns) {
    const body=$(id);body.replaceChildren();
    if(!rows.length){const tr=node('tr'),td=node('td','No hay registros.');td.colSpan=columns;tr.append(td);body.append(tr);return;}
    for(const row of rows){const tr=node('tr');tr.append(...render(row));body.append(tr);}
  }
  const cell=text=>node('td',text);
  function resetUser() {
    $('userForm').reset();$('userId').value='';$('userTitle').textContent='Crear cuenta';
    $('userEmployee').disabled=false;$('userActive').disabled=true;
    $('newPasswordField').hidden=false;$('userPassword').required=true;
    options('userEmployee',catalogs.empleados.filter(e=>!e.usuario_id),e=>`${e.nombre} · ${e.numero_documento}`);
  }
  function editUser(u) {
    $('userId').value=u.id;$('userTitle').textContent='Editar cuenta';
    options('userEmployee',catalogs.empleados,e=>`${e.nombre} · ${e.numero_documento}`,u.empleado_id);
    $('userEmployee').disabled=true;$('userEmail').value=u.email;$('userRole').value=u.rol_id;
    $('userActive').disabled=Number(u.id)===Number(current.usuario.id);$('userActive').value=String(Number(u.activo));
    $('newPasswordField').hidden=true;$('userPassword').required=false;$('userPassword').value='';
    $('userEmail').focus();$('userForm').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function renderUsers() {
    const q=$('searchUsers').value.trim().toLowerCase();
    table('usersBody',users.filter(u=>`${u.colaborador} ${u.email} ${u.rol}`.toLowerCase().includes(q)),u=>{
      const person=cell();person.append(node('strong',u.colaborador));const email=node('div',u.email);email.className='email';person.append(email);
      const actions=cell();actions.append(action('Editar',()=>editUser(u)),action('Contraseña',()=>{
        $('passwordForm').reset();$('passwordError').textContent='';$('passwordUserId').value=u.id;$('passwordAccount').textContent=`${u.colaborador} · ${u.email}`;$('passwordDialog').showModal();
      }));
      return [person,cell(u.rol),cell(Number(u.activo)?'Activo':'Inactivo'),actions];
    },4);
  }
  function renderCatalogs() {
    options('userRole',catalogs.roles,r=>r.nombre);
    options('areaCompany',catalogs.empresas,e=>`${e.razon_social}${e.estado==='inactivo'?' (inactiva)':''}`);
    options('positionArea',catalogs.areas,a=>`${a.nombre} · ${a.empresa}`);
    table('areasBody',catalogs.areas,a=>{
      const actions=cell();actions.append(action('Editar',()=>{$('areaId').value=a.id;$('areaCompany').value=a.empresa_id;$('areaName').value=a.nombre;$('areaTitle').textContent='Editar área';$('areaName').focus();}));
      return [cell(a.nombre),cell(a.empresa),actions];
    },3);
    table('positionsBody',catalogs.cargos,c=>{
      const a=catalogs.areas.find(a=>Number(a.id)===Number(c.area_id));const actions=cell();
      actions.append(action('Editar',()=>{$('positionId').value=c.id;$('positionArea').value=c.area_id;$('positionName').value=c.nombre;$('positionTitle').textContent='Editar cargo';$('positionName').focus();}));
      return [cell(c.nombre),cell(`${c.area} · ${a?.empresa||''}`),actions];
    },3);
  }
  async function load() {
    const [data,accounts]=await Promise.all([api('/catalogos'),api('/usuarios')]);catalogs=data.data;users=accounts.data;
    renderCatalogs();renderUsers();resetUser();
    for(const id of ['userFields','areaFields','positionFields'])$(id).disabled=false;
  }
  function submit(formId,work) {$(formId).addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await work();}catch(e){message(e.message,true);}finally{button.disabled=false;}});}
  submit('userForm',async()=>{
    const id=$('userId').value;const data={empleado_id:$('userEmployee').value,email:$('userEmail').value,rol_id:$('userRole').value,activo:$('userActive').value};
    if(!id)data.password=$('userPassword').value;
    const result=await save(`/usuarios${id?`/${id}`:''}`,data,id?'PUT':'POST');
    $('userPassword').value='';message(result.mensaje);
    if(Number(id)===Number(current.usuario.id)){window.SBSSSession.logout();return;}
    await load();
  });
  submit('areaForm',async()=>{
    const id=$('areaId').value;const result=await save(`/areas${id?`/${id}`:''}`,{nombre:$('areaName').value,empresa_id:$('areaCompany').value},id?'PUT':'POST');
    $('areaForm').reset();$('areaId').value='';$('areaTitle').textContent='Crear área';await load();message(result.mensaje);
  });
  submit('positionForm',async()=>{
    const id=$('positionId').value;const result=await save(`/cargos${id?`/${id}`:''}`,{nombre:$('positionName').value,area_id:$('positionArea').value},id?'PUT':'POST');
    $('positionForm').reset();$('positionId').value='';$('positionTitle').textContent='Crear cargo';await load();message(result.mensaje);
  });
  $('passwordForm').addEventListener('submit',async event=>{
    event.preventDefault();event.submitter.disabled=true;
    try{const id=$('passwordUserId').value;const result=await save(`/usuarios/${id}/clave`,{password:$('resetPassword').value});$('resetPassword').value='';$('passwordDialog').close();message(result.mensaje);if(Number(id)===Number(current.usuario.id))window.SBSSSession.logout();}
    catch(e){$('passwordError').textContent=e.message;}finally{event.submitter.disabled=false;}
  });
  $('cancelUser').onclick=resetUser;$('closePassword').onclick=()=>{$('resetPassword').value='';$('passwordDialog').close();};
  $('cancelArea').onclick=()=>{$('areaForm').reset();$('areaId').value='';$('areaTitle').textContent='Crear área';};
  $('cancelPosition').onclick=()=>{$('positionForm').reset();$('positionId').value='';$('positionTitle').textContent='Crear cargo';};
  $('searchUsers').addEventListener('input',renderUsers);
  window.SBSSSession.ready.then(async session=>{if(!session)return;current=session;try{await load();message('Configuración lista.');}catch(e){message(e.message,true);}});
})();
