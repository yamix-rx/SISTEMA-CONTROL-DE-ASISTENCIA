const path = require('node:path');
require('dotenv').config({ path:path.resolve(__dirname,'../.env'), quiet:true });
function options(database = process.env.DB_NAME) {
  return { host:process.env.DB_HOST || 'localhost', port:Number(process.env.DB_PORT || 3306),
    user:process.env.DB_USER, password:process.env.DB_PASSWORD, ...(database ? {database} : {}),
    charset:'utf8mb4', dateStrings:true, connectTimeout:10000 };
}
function databaseName(name) {
  if(!/^[a-zA-Z0-9_]{1,64}$/.test(name || '')) throw new Error('DB_NAME debe contener solo letras, números y guion bajo (máximo 64).');
  return name;
}
module.exports = { options, databaseName };
