const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const asistenciaRoutes = require('./routes/asistenciaRoutes');
const empresaRoutes = require('./routes/empresaRoutes'); 
const reporteRoutes = require('./routes/reporteRoutes');
const personalRoutes = require('./routes/personalRoutes'); 
const horarioRoutes = require('./routes/horarioRoutes');
const miPanelRoutes = require('./routes/miPanelRoutes');
const documentoRoutes = require('./routes/documentoRoutes');
const contratoRoutes = require('./routes/contratoRoutes');
const capacitacionRoutes = require('./routes/capacitacionRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const administracionRoutes = require('./routes/administracionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'private, no-store');
  next();
});
// La carga de documentos tiene su propio límite y autentica antes de leer archivos.
app.use('/api/documentos', documentoRoutes);
app.use('/api/asistencias', asistenciaRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/administracion', administracionRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/personal', personalRoutes); 
app.use('/api/horarios', horarioRoutes);
app.use('/api/mi-panel', miPanelRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/capacitaciones', capacitacionRoutes);

// Abrir http://localhost:3000: el mismo servidor entrega el frontend.
const frontendDir = path.resolve(__dirname, '../frontend');
// Instalación local: Express sirve las pantallas. En Railway se despliega solo backend/;
// Vercel sirve los recursos estáticos y reenvía las peticiones /api.
if (fs.existsSync(path.join(frontendDir, 'index.html'))) {
  app.get('/favicon.ico', (req, res) => res.sendFile(path.join(frontendDir, 'favicon.svg')));
  for (const carpeta of ['assets', 'css', 'js', 'vendor']) {
    app.use(`/${carpeta}`, express.static(path.join(frontendDir, carpeta)));
  }
  app.get(['/', /^\/[A-Za-z0-9_-]+\.html$/, '/favicon.svg'], express.static(frontendDir));
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ ok: false, mensaje: 'El logo no puede superar los 2 MB.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, mensaje: 'El archivo supera el tamaño permitido.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ ok: false, mensaje: 'El cuerpo de la solicitud no es JSON válido.' });
  console.error('Error de solicitud:', error.code || error.name);
  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la solicitud.' });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

if (require.main === module) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !/^[a-f0-9]{64}$/i.test(process.env.LOGO_ENCRYPTION_KEY || '')) {
    console.error('Faltan claves de seguridad válidas. Ejecute npm run configurar y reinicie.');
    require('./config/database').end().finally(() => { process.exitCode = 1; });
  } else app.listen(PORT, () => {
    console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
