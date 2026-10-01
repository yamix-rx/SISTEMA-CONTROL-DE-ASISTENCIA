const router = require('express').Router();
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const { obtenerMiPanel } = require('../controllers/miPanelController');

router.get('/', verificarToken, autorizarRoles(ROLES.COLABORADOR), obtenerMiPanel);

module.exports = router;
