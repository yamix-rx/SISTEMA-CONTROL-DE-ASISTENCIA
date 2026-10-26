'use strict';
// Vercel detecta Express por este punto de entrada raíz.
// Se exporta la aplicación existente, sin listener ni archivos secretos estáticos.
const express=require('express');
const app=require('./backend/server');
module.exports=app;
