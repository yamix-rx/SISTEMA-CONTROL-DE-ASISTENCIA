const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
pool.on('connection', connection => {
  connection.query('SET time_zone = ?', [process.env.DB_TIMEZONE || '-05:00'], error => {
    if (error) console.error('No se pudo configurar la zona horaria de MySQL:', error.code);
  });
});

// Prueba de verificación de conexión
pool.getConnection()
  .then(connection => {
    console.log('✓ Conectado exitosamente a la base de datos MySQL');
    connection.release();
  })
  .catch(err => {
    console.error('✗ Error al conectar a la base de datos:', err.message);
  });

module.exports = pool;
