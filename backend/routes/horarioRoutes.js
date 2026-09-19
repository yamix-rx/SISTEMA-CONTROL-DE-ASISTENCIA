const express = require('express');
const router = express.Router();
const horarioController = require('../controllers/horarioController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);

router.get('/', horarioController.listarHorarios);
router.post('/asignar', horarioController.guardarHorarioSemanal);
router.delete('/:id', horarioController.eliminarHorarioDia);

module.exports = router;
