const fs = require('node:fs/promises');
const path = require('node:path');
async function generar() {
  const sql = await fs.readFile(path.resolve(__dirname, '../base-actualizada.sql'), 'utf8');
  const lines = ['erDiagram'], relations = [];
  const tables = [...sql.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\);/g)];
  for (const [, table, body] of tables) {
    lines.push(`    ${table} {`);
    for (const line of body.split(/\r?\n/)) {
      const match = /^\s*(\w+)\s+(\w+)(?:\([^)]*\))?(.*)/.exec(line);
      if (!match || /^(FOREIGN|INDEX|UNIQUE|PRIMARY|CONSTRAINT|CHECK|KEY)$/i.test(match[1])) continue;
      const [, name, type, rest] = match;
      const fk = new RegExp(`FOREIGN KEY \\(${name}\\)`).test(body);
      lines.push(`        ${type.toLowerCase()} ${name}${/PRIMARY KEY/.test(rest) ? ' PK' : fk ? ' FK' : /UNIQUE/.test(rest) ? ' UK' : ''}`);
    }
    lines.push('    }');
    for (const [, field, parent] of body.matchAll(/FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s*(\w+)\(/g)) relations.push(`    ${parent} ||--o{ ${table} : "${field}"`);
  }
  lines.push(...relations);
  const folder = path.resolve(__dirname, '../../Diagramas');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'DiagramaBD.mmd'), lines.join('\n') + '\n');
  console.log(`Diagrama: ${tables.length} tablas y ${relations.length} relaciones.`);
}
if (require.main === module) generar().catch(e => { console.error(e.code || e.name); process.exitCode = 1; });
module.exports = { generar };
