const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');
const multer = require('multer');

const uploadLogo = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 2 * 1024 * 1024 },
	fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);

router.get('/', empresaController.listarEmpresas);
router.get('/:id/logo', empresaController.obtenerLogo);
router.post('/', autorizarRoles(ROLES.ADMIN), empresaController.guardarEmpresa);
router.post('/:id/logo', uploadLogo.single('logo'), autorizarRoles(ROLES.ADMIN), empresaController.subirLogo);
router.patch('/:id/estado', autorizarRoles(ROLES.ADMIN), empresaController.cambiarEstado);

module.exports = router;
