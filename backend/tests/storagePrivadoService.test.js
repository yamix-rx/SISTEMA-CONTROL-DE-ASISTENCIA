'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const storage=require('../services/storagePrivadoService');
const NAME='91f3421a-7f9c-4a47-8f51-bb2d409a1f77.pdf';

test('URLs de Storage se firman con la clave solo en solicitudes de servidor',async()=>{
  const old={fetch:global.fetch,url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
  process.env.SUPABASE_URL='https://roddgujtsdudromjufux.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='TEST-ONLY-NEVER-PRODUCTION';
  const calls=[];
  global.fetch=async (url,opts)=>{
    calls.push({url,opts});
    return {ok:true,json:async()=>({url:'/object/upload/sign/sbss-documentos/'+NAME+'?token=TESTSIGNED'})};
  };
  try{
    const signed=await storage.firmarSubida(NAME);
    assert.match(signed,/https:\/\/roddgujtsdudromjufux\.supabase\.co\/storage\/v1\/object\/upload\/sign/);
    assert.ok(!signed.includes('TEST-ONLY-NEVER-PRODUCTION'));
    assert.equal(calls[0].opts.headers.Authorization,'Bearer TEST-ONLY-NEVER-PRODUCTION');
    assert.equal(calls[0].opts.method,'POST');
    await assert.rejects(storage.firmarSubida('../private.pdf'),{status:400});
  }finally{
    global.fetch=old.fetch;
    if(old.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=old.url;
    if(old.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old.key;
  }
});

test('Las descargas privadas caducan y nunca generan URLs públicas',async()=>{
  const old={fetch:global.fetch,url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
  process.env.SUPABASE_URL='https://roddgujtsdudromjufux.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='TEST-ONLY-NEVER-PRODUCTION';
  global.fetch=async()=>({ok:true,json:async()=>({signedURL:'/object/sign/sbss-documentos/'+NAME+'?token=TEST'})});
  try{
    const url=await storage.urlDescarga(NAME,{download:true,filename:'CV.pdf'});
    assert.match(url,/\/object\/sign\/sbss-documentos\//);
    assert.ok(url.includes('download=CV.pdf'));
    assert.ok(!url.includes('/object/public/'));
  }finally{
    global.fetch=old.fetch;
    if(old.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=old.url;
    if(old.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old.key;
  }
});
