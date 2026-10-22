const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const mysql = require('mysql2/promise');
const { options } = require('./db-options');
const archivos = require('../services/documentoArchivoService');
async function revisar({ recuperar = false } = {}) {
  const root = path.resolve(__dirname, '..'), candidates = [];
  async function walk(folder) {
    let entries;
    try { entries = await fs.readdir(folder, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const item of entries) {
      if (item.isSymbolicLink() || ['codigo', 'node_modules'].includes(item.name)) continue;
      const file = path.join(folder, item.name);
      if (item.isDirectory()) await walk(file);
      else if (/\.(pdf|docx?|png|jpe?g)$/i.test(item.name)) candidates.push(file);
    }
  }
  await walk(path.join(root, 'backups')); await walk(path.join(root, 'uploads'));
  await walk(path.resolve(root, '../Documentos'));
  const connection = await mysql.createConnection(options());
  const report = { fecha: new Date().toISOString(), total: 0, disponibles: 0, recuperados: 0, pendientes: [] };
  try {
    const [rows] = await connection.query('SELECT id,nombre_archivo,ruta_archivo FROM documentos_empleado ORDER BY id');
    report.total = rows.length;
    for (const row of rows) {
      if (await archivos.disponible(row.ruta_archivo)) { report.disponibles++; continue; }
      const reference = String(row.ruta_archivo).replaceAll('\\', '/'), tail = reference.replace(/^\/?uploads\//, '');
      const matches = candidates.filter(file => reference.includes('/') ? file.replaceAll('\\', '/').endsWith('/uploads/' + tail) : path.basename(file) === reference);
      const versions = new Map();
      for (const file of matches) {
        try {
          const bytes = await fs.readFile(file), validated = archivos.validarArchivo(row.nombre_archivo, bytes.toString('base64'));
          versions.set(createHash('sha256').update(bytes).digest('hex'), validated);
        } catch (error) { if (!error.status) throw error; }
      }
      if (recuperar && versions.size === 1) {
        const validated = [...versions.values()][0], archivo = await archivos.guardarArchivo(validated);
        try {
          await connection.beginTransaction();
          const [updated] = await connection.query('UPDATE documentos_empleado SET ruta_archivo=?,mime_type=? WHERE id=? AND ruta_archivo=?', [archivo, validated.mime_type, row.id, row.ruta_archivo]);
          if (!updated.affectedRows) throw new Error('El registro cambió durante la recuperación.');
          await connection.query("INSERT INTO historial_cambios (tabla_afectada,registro_id,accion,datos_nuevos) VALUES ('documentos_empleado',?,'UPDATE',?)", [row.id, JSON.stringify({ origen: 'Recuperación de copia exacta desde respaldo local', archivo_restaurado: true })]);
          await connection.commit(); report.recuperados++;
        } catch (error) { await connection.rollback(); await archivos.eliminarArchivo(archivo); throw error; }
      } else report.pendientes.push({ documento_id: row.id, nombre_archivo: row.nombre_archivo, copias_exactas: versions.size, accion: versions.size === 1 ? 'Ejecutar con --recuperar' : versions.size > 1 ? 'Revisar copias diferentes' : 'Volver a cargar el archivo original desde Documentos' });
    }
  } finally { await connection.end(); }
  await fs.mkdir(path.join(root, 'backups'), { recursive: true });
  await fs.writeFile(path.join(root, 'backups/revision-documentos.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Documentos: ${report.disponibles} disponibles, ${report.recuperados} recuperados, ${report.pendientes.length} pendientes. Detalle privado: backend/backups/revision-documentos.json`);
  return report;
}
if (require.main === module) revisar({ recuperar: process.argv.includes('--recuperar') }).catch(e => { console.error('Revisión no completada:', e.code || e.name); process.exitCode = 1; });
module.exports = { revisar };
