const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Permite identificar el servidor antes de habilitar el envío de credenciales.
// Diagnóstico transitorio: PDF ficticio, sin datos personales ni cambios de BD.
// Retirar inmediatamente después de comprobar Storage privado.
router.get('/diagnostico-storage-temporal',async (_req,res)=>{
  if(process.env.VERCEL_ENV!=='preview')return res.status(404).end();
  const storage=require('../services/storagePrivadoService');
  const id=require('node:crypto').randomUUID()+'.pdf';
  let uploaded=false;
  try {
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF','ascii');
    await storage.subirObjeto(id,pdf,'application/pdf');
    uploaded=true;
    const checked=await storage.verificarContenido(id);
    const link=await storage.urlDescarga(id,{download:true,filename:'prueba.pdf'});
    return res.status(checked.equals(pdf)&&link.startsWith('https://')?200:503)
      .json({ok:checked.equals(pdf)&&link.startsWith('https://')});
  }catch(err){
    console.error('Storage test:',err.code||err.storageStatus||err.name);
    return res.status(503).json({ok:false,storageStatus:err.storageStatus||null});
  }finally{
    if(uploaded)await storage.eliminarObjeto(id).catch(()=>{});
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
