const bcrypt = require('bcryptjs');

async function generarHash(password) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log(`Hash para '${password}':`, hash);
}

generarHash('123456');