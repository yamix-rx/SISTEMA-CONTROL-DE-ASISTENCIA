const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);

router.get('/catalogos', contratoController.catalogos);
router.get('/resumen', contratoController.resumen);
router.get('/', contratoController.listar);
router.get('/:id', contratoController.detalle);
router.post('/', contratoController.crear);
router.put('/:id', contratoController.actualizar);
router.patch('/:id/estado', contratoController.cambiarEstado);
router.delete('/:id', contratoController.eliminar);

module.exports = router;
