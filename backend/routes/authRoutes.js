const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Permite identificar el servidor antes de habilitar el envío de credenciales.
// Sondeo temporal únicamente para el despliegue Preview. No consulta datos ni crea archivos.
router.get('/diagnostico-pdf-preview', async (_req, res) => {
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).end();
  try {
    const { generarPdf } = require('../services/documentoPdfService');
    const buffer = await generarPdf({
      estilo:'formal', codigo:'aceptacion', diseno:'carta', titulo:'PRUEBA TÉCNICA SBSS',
      empresa:'Empresa ficticia', trabajador:'Persona ficticia',
      fecha:'2026-10-28', cuerpo:'Documento de prueba sin datos de usuarios.', logo:'sbss',
      firmante_empresa:''
    });
    return res.status(Buffer.isBuffer(buffer) && buffer.subarray(0,5).toString('ascii') === '%PDF-' ? 200 : 503)
      .json({ok:Buffer.isBuffer(buffer)&&buffer.subarray(0,5).toString('ascii')==='%PDF-',pdfBytes:buffer.length});
  } catch (error) {
    const message = String(error.message||'');
    // Mostrar solamente el nombre de la dependencia faltante (sin datos internos).
    const missing = error.code==='MODULE_NOT_FOUND' ? message.match(/Cannot find module ['"]([^'"]+)['"]/)?.[1] : undefined;
    console.error('Diagnóstico PDF Preview:',error.code||error.name, missing||'no-disponible');
    return res.status(503).json({ok:false,code:error.code||error.name,missing:missing||null});
  }
});
router.get('/disponibilidad', (req, res) => res.json({ ok: true, servicio: 'sbss-auth' }));

// Comprobación técnica read-only, limitada a Preview; no expone datos, credenciales ni detalles SQL.
router.get('/salud-base', async (req,res) => {
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).json({ok:false});
  try {
    await require('../config/database').query('SELECT 1 AS disponible');
    return res.json({ok:true,base:'conectada'});
  } catch (error) {
    console.error('No se pudo validar la conexión PostgreSQL:', error.code || error.name);
    return res.status(503).json({ok:false,base:'no_disponible'});
  }
});
router.post('/login', require('../middlewares/loginLimiter').crearLimitador(), authController.login);
router.post('/cambiar-clave-inicial', verificarToken, express.json({limit:'4kb'}), require('../middlewares/loginLimiter').crearLimitador(), authController.cambiarClaveInicial);
router.post('/logout', verificarToken, require('../middlewares/auditoriaMiddleware'), authController.logout);

// Ruta para verificar sesión activa al cargar cualquier pantalla
router.get('/perfil', verificarToken, authController.perfil);

module.exports = router;
