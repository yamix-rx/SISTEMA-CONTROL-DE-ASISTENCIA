const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditoriaController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN));
router.get('/resumen', controller.resumen);
router.get('/', controller.listar);

module.exports = router;
