const express = require('express');
const router = express.Router();
const asistenciaController = require('../controllers/asistenciaController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(verificarToken);
router.get('/permisos/:id/sustento', autorizarRoles(ROLES.ADMIN, ROLES.RRHH, ROLES.COLABORADOR), asistenciaController.sustentoPermiso);
router.use(autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(express.json({ limit: '8mb' }));
router.use(auditoriaMiddleware);

router.get('/', asistenciaController.listarAsistencias);
router.post('/marcar', asistenciaController.registrarMarcacion);
router.get('/tardanzas', asistenciaController.acumuladoTardanzas);
router.get('/permisos', asistenciaController.listarPermisos);
router.post('/permisos', asistenciaController.crearPermiso);
router.patch('/permisos/:id/estado', asistenciaController.actualizarEstadoPermiso);

module.exports = router;
