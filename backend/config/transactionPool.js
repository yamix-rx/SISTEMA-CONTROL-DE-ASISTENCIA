const { AsyncLocalStorage } = require('node:async_hooks');

// Una escritura HTTP y su auditoría comparten conexión y confirmación.
// Los servicios conservan sus transacciones propias cuando se usan fuera de HTTP.
function transactionPool(pool) {
  const storage = new AsyncLocalStorage();
  const database = Object.create(pool);
  database.query = (...args) => (storage.getStore()?.connection || pool).query(...args);
  database.execute = (...args) => (storage.getStore()?.connection || pool).execute(...args);
  database.getConnection = async () => {
    const context = storage.getStore();
    if (!context) return pool.getConnection();
    return {
      query: (...args) => context.connection.query(...args),
      execute: (...args) => context.connection.execute(...args),
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => { context.rollbackOnly = true; },
      release() {}
    };
  };
  database.beginRequestTransaction = async () => {
    const connection = await pool.getConnection();
    try { await connection.beginTransaction(); }
    catch (error) { connection.release(); throw error; }
    const context = { connection, rollbackOnly: false };
    let completed = false;
    const transaction = {
      run: callback => storage.run(context, callback),
      async complete(success) {
        if (completed) return;
        completed = true;
        try {
          if (success && !context.rollbackOnly) await connection.commit();
          else await connection.rollback();
        } catch (error) {
          await connection.rollback().catch(() => {});
          throw error;
        } finally { connection.release(); }
      }
    };
    context.rollback = () => transaction.complete(false);
    return transaction;
  };
  database.end = () => pool.end();
  database.withoutRequestTransaction = callback => storage.run(undefined, callback);
  database.rollbackRequestTransaction = () => storage.getStore()?.rollback();
  return database;
}

module.exports = transactionPool;
