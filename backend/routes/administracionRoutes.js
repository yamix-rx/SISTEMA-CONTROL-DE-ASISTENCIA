const router = require('express').Router();
const servicio = require('../services/administracionService');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const auditoria = require('../middlewares/auditoriaMiddleware');
const { ROLES } = require('../config/accessPolicy');
router.use(verificarToken, auditoria, autorizarRoles(ROLES.ADMIN));
const atender = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    const duplicado = e.code === 'ER_DUP_ENTRY';
    const faltaEsquema = ['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(e.code);
    if (!duplicado && !e.status) console.error('Error de administración:', req.method, req.path, e.code || e.name);
    const mensaje = duplicado ? 'Ya existe un registro con ese correo, colaborador o nombre.'
      : e.status ? e.message
      : faltaEsquema ? 'Falta actualizar la base de datos para cargar la configuración. Contacte al responsable del sistema.'
      : req.method === 'GET' ? 'No se pudo cargar la configuración. Intente nuevamente.' : 'No se pudo guardar la configuración.';
    res.status(duplicado ? 409 : faltaEsquema ? 503 : e.status || 500).json({ ok: false, mensaje });
  }
};
router.get('/catalogos', atender(async (req, res) => res.json({ ok:true, data:await servicio.catalogos() })));
router.get('/usuarios', atender(async (req, res) => res.json({ ok:true, data:await servicio.listarUsuarios() })));
router.post('/usuarios', atender(async (req, res) => res.status(201).json({ ok:true, id:await servicio.crearUsuario(req.body), mensaje:'Cuenta creada.' })));
router.put('/usuarios/:id', atender(async (req, res) => res.json({ ok:true, id:await servicio.actualizarUsuario(req.params.id,req.body,req.usuario.id), mensaje:'Cuenta actualizada. Debe volver a iniciar sesión.' })));
router.post('/usuarios/:id/clave', atender(async (req, res) => {
  const id = await servicio.restablecerClave(req.params.id,req.body.password);
  res.locals.auditoria = { tabla:'usuarios', registroId:id, accion:'UPDATE' };
  res.json({ ok:true, id, mensaje:'Contraseña actualizada. Las sesiones anteriores han finalizado.' });
}));
for (const [recurso,guardar] of [['areas',servicio.guardarArea],['cargos',servicio.guardarCargo],['tipos-documento',servicio.guardarTipoDocumento],['tipos-permiso',servicio.guardarTipoPermiso]]) {
  router.post(`/${recurso}`, atender(async (req, res) => res.status(201).json({ ok:true, id:await guardar(null,req.body), mensaje:'Registro creado.' })));
  router.put(`/${recurso}/:id`, atender(async (req, res) => res.json({ ok:true, id:await guardar(req.params.id,req.body), mensaje:'Registro actualizado.' })));
}
module.exports = router;
