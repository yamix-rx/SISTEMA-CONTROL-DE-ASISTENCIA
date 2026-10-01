const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);

router.get('/', empresaController.listarEmpresas);
router.post('/', autorizarRoles(ROLES.ADMIN), empresaController.guardarEmpresa);
router.patch('/:id/estado', autorizarRoles(ROLES.ADMIN), empresaController.cambiarEstado);

module.exports = router;
