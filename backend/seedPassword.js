const bcrypt = require('bcryptjs');

async function generarHash(password) {
  if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Configure HASH_PASSWORD de forma privada (entre 10 caracteres y 72 bytes).');
  return bcrypt.hash(password, 12);
}

if (require.main === module) generarHash(process.env.HASH_PASSWORD).then(hash => console.log(hash)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { generarHash };
