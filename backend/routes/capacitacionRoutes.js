const express = require('express');
const router = express.Router();
const capacitacionController = require('../controllers/capacitacionController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);

router.get('/catalogos', capacitacionController.catalogos);
router.get('/resumen', capacitacionController.resumen);
router.get('/empleados/:empleadoId/historial', capacitacionController.historialEmpleado);
router.get('/', capacitacionController.listar);
router.get('/:id', capacitacionController.detalle);
router.post('/', capacitacionController.crear);
router.put('/:id', capacitacionController.actualizar);
router.patch('/:id/estado', capacitacionController.cambiarEstado);
router.post('/:id/participantes', capacitacionController.agregarParticipantes);
router.patch('/:id/participantes/:empleadoId', capacitacionController.actualizarParticipante);
router.delete('/:id/participantes/:empleadoId', capacitacionController.retirarParticipante);
router.delete('/:id', capacitacionController.eliminar);

module.exports = router;
