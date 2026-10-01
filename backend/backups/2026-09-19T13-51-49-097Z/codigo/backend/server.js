const express = require('express');
const cors = require('cors');
const path = require('node:path');
require('dotenv').config();

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
app.use(express.static(path.resolve(__dirname, '../frontend')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, mensaje: 'El archivo supera el tamaño permitido.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ ok: false, mensaje: 'El cuerpo de la solicitud no es JSON válido.' });
  console.error('Error de solicitud:', error.code || error.name);
  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la solicitud.' });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

if (require.main === module) app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
