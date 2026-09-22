// Ejecutar desde backend: npm run migrar:documentos
// Solo ajusta el esquema existente: no elimina tablas, registros ni archivos.
const NECESARIAS = {
  empleados: ['id', 'nombres', 'apellidos', 'numero_documento', 'empresa_id'],
  empresas: ['id', 'razon_social'],
  usuarios: ['id'],
  tipo_documentos: ['id', 'nombre', 'es_obligatorio'],
  documentos_empleado: ['id', 'empleado_id', 'tipo_documento_id', 'nombre_archivo', 'estado', 'fecha_subida']
};

async function migrar(pool, informar = console.log) {
  const [bases] = await pool.query('SELECT DATABASE() AS base_actual');
  if (!bases[0]?.base_actual) throw new Error('Configure DB_NAME con la base de datos existente antes de migrar.');
  const [columnas] = await pool.query(`SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('empleados', 'empresas', 'usuarios', 'tipo_documentos', 'documentos_empleado')`);
  const porTabla = new Map();
  for (const fila of columnas) {
    if (!porTabla.has(fila.tabla)) porTabla.set(fila.tabla, new Set());
    porTabla.get(fila.tabla).add(fila.columna);
  }
  for (const [tabla, requeridas] of Object.entries(NECESARIAS)) {
    const actuales = porTabla.get(tabla);
    if (!actuales) throw new Error(`No existe la tabla ${tabla}. Seleccione la base del proyecto antes de migrar.`);
    const faltantes = requeridas.filter(columna => !actuales.has(columna));
    if (faltantes.length) throw new Error(`La tabla ${tabla} no tiene las columnas requeridas: ${faltantes.join(', ')}.`);
  }
  const documentos = porTabla.get('documentos_empleado');
  if (!documentos.has('ruta_archivo') && !documentos.has('ruta_almacenamiento')) {
    throw new Error('documentos_empleado no tiene ruta_archivo ni ruta_almacenamiento. Revise el esquema existente.');
  }
  if (!documentos.has('ruta_archivo')) {
    await pool.query('ALTER TABLE documentos_empleado CHANGE COLUMN ruta_almacenamiento ruta_archivo VARCHAR(255) NOT NULL');
    informar('Nombre de columna actualizado: ruta_archivo.');
  }
  const nuevas = {
    observacion: 'TEXT NULL',
    revisado_por: 'INT NULL',
    fecha_revision: 'DATETIME NULL',
    mime_type: 'VARCHAR(100) NULL'
  };
  for (const [nombre, definicion] of Object.entries(nuevas)) {
    if (!documentos.has(nombre)) {
      await pool.query(`ALTER TABLE documentos_empleado ADD COLUMN ${nombre} ${definicion}`);
      informar(`Columna agregada: ${nombre}.`);
    }
  }
  const [indices] = await pool.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentos_empleado' AND INDEX_NAME = 'idx_documento_version'");
  if (!indices.length) {
    await pool.query('ALTER TABLE documentos_empleado ADD INDEX idx_documento_version (empleado_id, tipo_documento_id, id)');
    informar('Índice para versiones de documentos creado.');
  }
  informar('Migración de Documentos completada. Se conservaron los datos existentes.');
}

if (require.main === module) {
  const pool = require('../config/database');
  migrar(pool).catch(error => {
    console.error('No se pudo completar la migración:', error.code || error.message);
    process.exitCode = 1;
  }).finally(() => pool.end());
}

module.exports = { migrar };
