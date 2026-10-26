'use strict';
// Vercel detecta Express por este punto de entrada raíz.
// Se exporta la aplicación existente, sin listener ni archivos secretos estáticos.
const express=require('express');
if (process.env.VERCEL) {
  const url=process.env.DATABASE_URL || '';
  if (!(url.startsWith('postgres://') || url.startsWith('postgresql://'))
      || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32
      || !/^[a-f0-9]{64}$/i.test(process.env.LOGO_ENCRYPTION_KEY || '')
      || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de producción privadas para SBSS.');
  }
}
const app=require('./backend/server');
module.exports=app;
