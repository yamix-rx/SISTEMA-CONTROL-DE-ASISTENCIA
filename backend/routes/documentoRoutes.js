const express = require('express');
const controller = require('../controllers/documentoController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');
const router = express.Router();

// Autenticar y autorizar antes de leer el cuerpo de cargas grandes.
router.use(verificarToken, autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(auditoriaMiddleware);
router.use(express.json({ limit: '8mb' }));
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/catalogos', controller.catalogos);
router.get('/', controller.listar);
router.post('/', controller.subir);
router.get('/:id/archivo', controller.archivo);
router.get('/:id/descargar', controller.descargar);
router.patch('/:id/revision', controller.revisar);

router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, mensaje: 'El archivo supera el tamaño permitido. El máximo es 5 MB.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ ok: false, mensaje: 'El contenido enviado no es un JSON válido.' });
  return next(error);
});

module.exports = router;
