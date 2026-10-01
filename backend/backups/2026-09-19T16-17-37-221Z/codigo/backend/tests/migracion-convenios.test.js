const test = require('node:test');
const assert = require('node:assert/strict');
const { migrar } = require('../scripts/migrar-v1');

test('migración agrega campos nullable sin inferir fechas y una segunda ejecución no duplica columnas ni índices', async () => {
  const columnas = [{ TABLE_NAME: 'documentos_empleado', COLUMN_NAME: 'ruta_archivo' }];
  const indices = [];
  const consultas = [];
  const empresas = ['Droguería Silsan', 'Importadora Silsan', 'SBSS Outsourcing', 'Nanas & Amas',
    'Centro de Conciliación SBSS', 'Estudio Jurídico SBSS', 'ONG MESPO'].map((razon_social, id) => ({ id: id + 1, razon_social }));
  const connection = {
    async query(sql) {
      consultas.push(sql);
      if (/information_schema.columns/.test(sql)) return [[...columnas]];
      if (/information_schema.statistics/.test(sql)) return [[...indices]];
      if (/SELECT id,razon_social FROM empresas/.test(sql)) return [empresas];
      const columna = sql.match(/ALTER TABLE `(\w+)` ADD COLUMN `(\w+)`/);
      if (columna) {
        assert.ok(!columnas.some(c => c.TABLE_NAME === columna[1] && c.COLUMN_NAME === columna[2]), sql);
        columnas.push({ TABLE_NAME: columna[1], COLUMN_NAME: columna[2] });
      }
      const indice = sql.match(/CREATE INDEX (\w+) ON (\w+)/);
      if (indice) {
        assert.ok(!indices.some(i => i.TABLE_NAME === indice[2] && i.INDEX_NAME === indice[1]), sql);
        indices.push({ TABLE_NAME: indice[2], INDEX_NAME: indice[1] });
      }
      return [{ affectedRows: 0 }];
    },
    async beginTransaction() {}, async commit() {}, async rollback() {}
  };
  await migrar(connection);
  assert.ok(consultas.includes('ALTER TABLE `empleados` ADD COLUMN `puesto` VARCHAR(150) NULL'));
  assert.ok(consultas.includes('ALTER TABLE `practicante_detalles` ADD COLUMN `fecha_vencimiento_convenio` DATE NULL'));
  assert.ok(consultas.includes('CREATE INDEX idx_practicante_vencimiento ON practicante_detalles (fecha_vencimiento_convenio)'));
  assert.ok(!consultas.some(sql => /^\s*(?:DELETE|DROP TABLE|UPDATE empleados|UPDATE practicante_detalles)\b/.test(sql)));
  const inicioSegunda = consultas.length;
  await migrar(connection);
  assert.ok(!consultas.slice(inicioSegunda).some(sql => /ADD COLUMN|CREATE INDEX/.test(sql)));
});
