const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Permite identificar el servidor antes de habilitar el envío de credenciales.
router.get('/disponibilidad', (req, res) => res.json({ ok: true, servicio: 'sbss-auth' }));
router.post('/login', require('../middlewares/loginLimiter').crearLimitador(), authController.login);
router.post('/logout', verificarToken, require('../middlewares/auditoriaMiddleware'), authController.logout);

// Ruta para verificar sesión activa al cargar cualquier pantalla
router.get('/perfil', verificarToken, authController.perfil);

module.exports = router;
