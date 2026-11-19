'use strict';
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });

// En el despliegue PostgreSQL DATABASE_URL es una credencial PRIVADA del servidor.
// En desarrollo local sin DATABASE_URL se conserva MySQL (no afecta a main).
if (process.env.DATABASE_URL) {
  module.exports = require('./postgresPool').createPostgresPool();
} else {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    dateStrings: true, waitForConnections: true, connectionLimit: 10, queueLimit: 0
  });
  pool.on('connection', connection => {
    connection.query('SET time_zone = ?', [process.env.DB_TIMEZONE || '-05:00'], err => {
      if(err) console.error('No se pudo configurar la zona horaria de MySQL:',err.code);
    });
  });
  module.exports = require('./transactionPool')(pool);
}
