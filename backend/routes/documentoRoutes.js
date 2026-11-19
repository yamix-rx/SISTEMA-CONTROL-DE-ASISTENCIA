const express = require('express');
const multer = require('multer');
const controller = require('../controllers/documentoController');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { ROLES } = require('../config/accessPolicy');
const auditoriaMiddleware = require('../middlewares/auditoriaMiddleware');
const router = express.Router();
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/png', 'image/jpeg'].includes(file.mimetype))
});

// Autenticar y autorizar antes de leer el cuerpo de cargas grandes.
router.use(verificarToken);
router.get('/mios/:id/archivo', autorizarRoles(ROLES.COLABORADOR), controller.archivoPropio);
router.get('/mios/:id/descargar', autorizarRoles(ROLES.COLABORADOR), controller.descargarPropio);
router.use(autorizarRoles(ROLES.ADMIN, ROLES.RRHH));
router.use(express.json({ limit: '8mb' }));
router.use(auditoriaMiddleware);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/generacion/catalogos', controller.catalogosGeneracion);
router.post('/logos', uploadLogo.single('logo'), controller.subirLogo);
router.put('/plantillas/:codigo', controller.guardarPlantilla);
router.post('/generar/vista-previa', controller.vistaGenerada);
router.post('/generar/pdf', controller.pdfGenerado);
router.get('/generados/recientes',controller.listarGenerados);
router.get('/generados/:id/descarga',controller.enlaceGenerado);
router.get('/catalogos', controller.catalogos);
router.get('/', controller.listar);
router.post('/preparar-subida',controller.prepararSubida);
router.post('/confirmar-subida',controller.confirmarSubida);
router.post('/', controller.subir);
router.get('/:id/archivo', controller.archivo);
router.get('/:id/descargar', controller.descargar);
router.patch('/:id/revision', controller.revisar);
router.delete('/:id', controller.eliminar);

router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, mensaje: 'El archivo supera el tamaño permitido. El máximo es 5 MB.' });
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ ok: false, mensaje: 'El logo supera el tamaño permitido. El máximo es 2 MB.' });
  if (error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ ok: false, mensaje: 'Envía una sola imagen en el campo logo.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ ok: false, mensaje: 'El contenido enviado no es un JSON válido.' });
  return next(error);
});

module.exports = router;
