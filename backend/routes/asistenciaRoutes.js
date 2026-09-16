const express = require('express');
const router = express.Router();
const asistenciaController = require('../controllers/asistenciaController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));

router.get('/', asistenciaController.listarAsistencias);
router.post('/marcar', asistenciaController.registrarMarcacion);
router.get('/tardanzas', asistenciaController.acumuladoTardanzas);
router.get('/permisos', asistenciaController.listarPermisos);
router.post('/permisos', asistenciaController.crearPermiso);
router.patch('/permisos/:id/estado', asistenciaController.actualizarEstadoPermiso);

module.exports = router;
