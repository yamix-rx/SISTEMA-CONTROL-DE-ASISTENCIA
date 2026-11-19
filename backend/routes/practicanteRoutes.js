const express = require('express');
const router = express.Router();
const practicanteController = require('../controllers/practicanteController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');

// Solo lectura, con la misma política de acceso que el módulo de personal.
router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));

router.get('/', practicanteController.listar);
router.get('/resumen', practicanteController.resumen);
router.get('/catalogos', practicanteController.catalogos);

module.exports = router;
