const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
async function configurar({ rotarJwt = false } = {}) {
  const target = path.resolve(__dirname, '../.env');
  let source;
  try { source = await fs.readFile(target, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; source = await fs.readFile(path.resolve(__dirname, '../.env.example'), 'utf8'); }
  const env = dotenv.parse(source), keys = [];
  for (const [key, bytes] of [['JWT_SECRET', 64], ['LOGO_ENCRYPTION_KEY', 32]]) {
    if (env[key] && !(rotarJwt && key === 'JWT_SECRET')) continue;
    const value = randomBytes(bytes).toString('hex'), line = new RegExp(`^${key}=.*$`, 'm');
    source = line.test(source) ? source.replace(line, `${key}=${value}`) : source + `\n${key}=${value}\n`;
    keys.push(key);
  }
  await fs.writeFile(target, source, { mode: 0o600 });
  console.log(keys.length ? `Claves privadas generadas: ${keys.join(', ')}. Reinicie el servidor para aplicarlas.` : 'Se conservó la configuración existente.');
  return keys;
}
if (require.main === module) configurar({ rotarJwt: process.argv.includes('--rotar-jwt') }).catch(e => { console.error('No se pudo configurar:', e.code || e.name); process.exitCode = 1; });
module.exports = { configurar };
