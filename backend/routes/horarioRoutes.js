const express = require('express');
const router = express.Router();
const horarioController = require('../controllers/horarioController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));

router.get('/', horarioController.listarHorarios);
router.post('/asignar', horarioController.guardarHorarioSemanal);
router.delete('/:id', horarioController.eliminarHorarioDia);

module.exports = router;
