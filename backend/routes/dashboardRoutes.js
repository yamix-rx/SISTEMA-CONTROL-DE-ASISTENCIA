const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(auditoriaMiddleware);

// Solo usuarios autenticados pueden consultar el dashboard
router.get('/', verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH), dashboardController.obtenerDatosDashboard);

module.exports = router;
