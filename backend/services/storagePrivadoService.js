'use strict';
// Acceso solamente del servidor. La clave de servicio nunca llega al navegador.
const BUCKET='sbss-documentos';
const PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g|docx|doc)$/i;
function config(){
  const origin=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(origin||'')||!key)
    throw Object.assign(new Error('Falta configurar Storage privado SBSS.'),{code:'SBSS_STORAGE_NOT_CONFIGURED'});
  return {base:origin.replace(/\/$/,'')+'/storage/v1',key};
}
function objectPath(name){
  if(typeof name!=='string'||!PATTERN.test(name))
    throw Object.assign(new Error('Nombre de objeto no permitido'),{status:400});
  return encodeURIComponent(name);
}
async function request(method,path,{body,headers={},expect='json'}={}){
  const {base,key}=config();
  // Las claves sb_secret_ se envían en apikey (no son JWT Bearer).
  const h={apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),...headers};
  const opts={method,headers:h,redirect:'error',signal:AbortSignal.timeout(30000)};
  if(body!==undefined) {
    opts.body=typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body);
    if(!(body instanceof Uint8Array))h['Content-Type']='application/json';
  }
  const res=await fetch(base+path,opts);
  if(!res.ok)throw Object.assign(new Error('Storage privado: HTTP '+res.status),{
    status:res.status===404?404:503,storageStatus:res.status
  });
  if(expect==='response')return res;
  if(expect==='none')return undefined;
  return await res.json();
}
async function firmarSubida(name){
  const data=await request('POST','/object/upload/sign/'+BUCKET+'/'+objectPath(name),{body:{}});
  if(typeof data.url!=='string'||!data.url.startsWith('/object/upload/sign/'))
    throw new Error('Supabase no devolvió una URL de subida válida');
  return config().base+data.url;
}
async function verificarContenido(name){
  const resp=await request('GET','/object/authenticated/'+BUCKET+'/'+objectPath(name),{expect:'response'});
  const size=Number(resp.headers.get('content-length')||0);
  if(size>5242880)throw Object.assign(new Error('Archivo demasiado grande'),{status:413});
  const buf=Buffer.from(await resp.arrayBuffer());
  if(!buf.length||buf.length>5242880)throw Object.assign(new Error('Archivo inválido o demasiado grande'),{status:413});
  return buf;
}
async function subirObjeto(name,buffer,mime){
  if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>5242880)throw new Error('Archivo inválido');
  await request('POST','/object/'+BUCKET+'/'+objectPath(name),{
    body:buffer,headers:{'Content-Type':mime,'x-upsert':'false'}});
}
async function eliminarObjeto(name){
  await request('DELETE','/object/'+BUCKET,{body:{prefixes:[name]}});
}
async function existeObjeto(name){
  try{await request('HEAD','/object/authenticated/'+BUCKET+'/'+objectPath(name),{expect:'none'});return true;}
  catch(e){if(e.storageStatus===404)return false;throw e;}
}
async function urlDescarga(name,{download=false,filename='documento'}={}){
  const data=await request('POST','/object/sign/'+BUCKET+'/'+objectPath(name),{body:{expiresIn:60}});
  if(typeof data.signedURL!=='string'||!data.signedURL.startsWith('/object/sign/'))throw new Error('URL de descarga no disponible');
  const u=new URL(config().base+data.signedURL);
  if(download)u.searchParams.set('download',String(filename).slice(0,200));
  return u.href;
}
module.exports={BUCKET,firmarSubida,verificarContenido,subirObjeto,eliminarObjeto,existeObjeto,urlDescarga};
