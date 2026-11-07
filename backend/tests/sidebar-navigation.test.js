'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../../frontend');
const sidebarSource=readFileSync(path.join(root,'js/sidebar.js'),'utf8');
const navigationSource=readFileSync(path.join(root,'js/navigation.js'),'utf8');
const navigationCSS=readFileSync(path.join(root,'css/navigation.css'),'utf8');
const modules=[
  'Dashboard.html','RecursosHumanos.html','Administracion.html',
  'Auditoria.html','Capacitaciones.html','Contratos.html',
  'Documentos.html','FichaIndividual.html','Horarios.html',
  'Registros.html','Reportes.html','empresas.html'
];

for(const moduleName of modules)test(moduleName+' permite reabrir el menú sin depender de d-none',()=>{
  const html=readFileSync(path.join(root,moduleName),'utf8');
  const button=html.match(/<button\b[^>]*\bid="btnAbrirSidebar"[^>]*>/)?.[0];
  assert.ok(button,'No existe el control btnAbrirSidebar');
  assert.match(button,/\bsbss-sidebar-open\b/);
  assert.match(button,/\bhidden\b/);
  assert.doesNotMatch(button,/\bd-none\b/);
  assert.match(html,/id="sidebarMenu"/);
  assert.match(html,/js\/sidebar\.js/);
  assert.match(html,/js\/navigation\.js/);
  assert.match(html,/css\/navigation\.css/);
});

test('El menú común normaliza las dos clases Bootstrap/diseño y evita botones perdidos',()=>{
  assert.match(navigationSource,/open\.classList\.remove\('d-none'\)/);
  assert.match(navigationSource,/if \(!open\) \{[\s\S]*?document\.createElement\('button'\)/);
  assert.match(sidebarSource,/open\.classList\.remove\('d-none'\)/);
  assert.match(navigationCSS,/#btnAbrirSidebar\.hidden/);
  assert.match(navigationCSS,/#btnAbrirSidebar\.d-none/);
  const dashboard=readFileSync(path.join(root,'Dashboard.html'),'utf8');
  assert.match(dashboard,/#btnAbrirSidebar:not\(\.hidden\):not\(\.d-none\)/);
});

function classSet(initial=[]){
  const set=new Set(initial);
  return {
    add:(x)=>set.add(x),
    remove:(x)=>set.delete(x),
    contains:(x)=>set.has(x),
    toggle:(x,force)=>{
      const add=force===undefined?!set.has(x):!!force;
      if(add)set.add(x);else set.delete(x);
      return add;
    }
  };
}
function setup(mobile=false){
  const documentListeners={};
  const body={classList:classSet()};
  const doc={readyState:'complete',body,activeElement:null,
    addEventListener:(type,cb)=>documentListeners[type]=cb};
  const events=()=>({listeners:{},addEventListener(type,cb){this.listeners[type]=cb;},
    emit(type,payload={}){return this.listeners[type]?.({preventDefault(){},...payload});}});
  const main={inert:false},header={inert:false};
  function element(classes=[]){
    const item={classList:classSet(classes),attrs:{},inert:false,hidden:false,
      ...events(),setAttribute(k,v){this.attrs[k]=v;},
      getAttribute(k){return this.attrs[k];},
      removeAttribute(k){delete this.attrs[k];},
      focus(){doc.activeElement=this;},contains(el){return this===el;}};
    return item;
  }
  const open=element(['sbss-sidebar-open','d-none','hidden']);
  const close=element();
  const sidebar=element(['sbss-sidebar','sidebar-oculto']);
  sidebar.dataset={sbssRendered:'true'};
  sidebar.parentElement={querySelector:()=>main};
  sidebar.after=x=>{doc.backdrop=x;};
  const controls={sidebarMenu:sidebar,btnAbrirSidebar:open,btnCerrarSidebar:close};
  doc.getElementById=id=>controls[id];
  doc.createElement=()=>element();
  doc.querySelector=()=>header;
  const media={matches:mobile,...events()};
  const stored={};
  const win={SBSSSession:{ready:Promise.resolve({acceso:{}})},
    SBSSNavigation:{render(){throw new Error('El menú ya está renderizado');},desktopHidden(){return false;}},
    matchMedia:()=>media};
  new Function('window','document','localStorage',sidebarSource)(win,doc,
    {setItem(k,v){stored[k]=v;}});
  return {doc,sidebar,open,close,media,main,header,stored};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('En escritorio ocultar y volver a mostrar el menú deja accesibles los módulos',async()=>{
  const ui=setup(false);await tick();
  assert.equal(ui.open.classList.contains('d-none'),false,'Bootstrap no debe ocultar el control');
  assert.equal(ui.open.classList.contains('hidden'),false);
  ui.open.emit('click');
  assert.equal(ui.sidebar.classList.contains('sidebar-oculto'),false);
  assert.equal(ui.open.classList.contains('hidden'),true);
  assert.equal(ui.sidebar.inert,false);
  ui.close.emit('click');
  assert.equal(ui.sidebar.classList.contains('sidebar-oculto'),true);
  assert.equal(ui.open.classList.contains('hidden'),false);
  assert.equal(ui.stored.sbss_sidebar,'oculto');
  ui.open.emit('click');
  assert.equal(ui.sidebar.classList.contains('sidebar-oculto'),false);
  assert.equal(ui.stored.sbss_sidebar,'visible');
});
test('En móvil el menú se abre con foco y se cierra restaurando interacción',async()=>{
  const ui=setup(true);await tick();
  assert.equal(ui.open.classList.contains('hidden'),false);
  ui.open.emit('click');
  assert.equal(ui.sidebar.inert,false);
  assert.equal(ui.main.inert,true);
  assert.equal(ui.header.inert,true);
  assert.equal(ui.doc.backdrop.hidden,false);
  assert.equal(ui.sidebar.attrs['aria-modal'],'true');
  ui.doc.backdrop.emit('click');
  assert.equal(ui.sidebar.inert,true);
  assert.equal(ui.main.inert,false);
  assert.equal(ui.header.inert,false);
  assert.equal(ui.doc.activeElement,ui.open);
  assert.equal(ui.doc.backdrop.hidden,true);
});
test('Mi panel personal mantiene un botón separado para abrir su navegación móvil',()=>{
  const html=readFileSync(path.join(root,'MiPanel.html'),'utf8');
  const script=readFileSync(path.join(root,'js/mi-panel.js'),'utf8');
  assert.match(html,/id="menuToggle"/);
  assert.match(html,/id="personalSidebar"/);
  assert.match(script,/menuToggle'\)\.addEventListener\('click'/);
});
