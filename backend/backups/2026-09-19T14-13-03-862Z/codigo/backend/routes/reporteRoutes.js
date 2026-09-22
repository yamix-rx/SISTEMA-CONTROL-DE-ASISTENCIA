const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));

router.get('/consolidado', reporteController.obtenerConsolidado);

module.exports = router;
