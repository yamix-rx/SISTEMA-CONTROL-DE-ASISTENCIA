const express = require('express');
const router = express.Router();
const personalController = require('../controllers/personalController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);

router.get('/', personalController.listarColaboradores);
router.get('/catalogos', personalController.obtenerCatalogos);
router.post('/', personalController.crearColaborador);
router.put('/:id/horas-practicas', personalController.actualizarHorasPracticas);
router.put('/:id', personalController.actualizarColaborador);
router.get('/:id', personalController.obtenerFichaColaborador);

module.exports = router;
