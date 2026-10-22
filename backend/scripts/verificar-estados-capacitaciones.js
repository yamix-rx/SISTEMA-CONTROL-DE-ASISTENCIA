'use strict';

// Verifica la expresión real de MySQL con datos sintéticos, sin escribir registros.
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { ESTADO_HORARIO_SQL } = require('../services/capacitacionService')._internals;

async function main() {
  const base = { estado: 'programada', inicio: '2026-10-22', fin: '2026-10-22', desde: '09:00:00', hasta: '11:00:00' };
  const casos = [
    ['antes del inicio', '2026-10-22 13:59:59', {}, 'programada'],
    ['inicio exacto en Perú', '2026-10-22 14:00:00', {}, 'en_curso'],
    ['durante la capacitación', '2026-10-22 15:59:59', {}, 'en_curso'],
    ['fin exacto en Perú', '2026-10-22 16:00:00', {}, 'finalizada'],
    ['capacitación pasada sin abrir la pantalla', '2026-10-23 10:00:00', {}, 'finalizada'],
    ['fecha futura', '2026-10-21 20:00:00', {}, 'programada'],
    ['varios días: no finalizar al acabar el primer día', '2026-10-22 22:00:00', { fin: '2026-10-23' }, 'en_curso'],
    ['varios días: fin exacto del último día', '2026-10-23 16:00:00', { fin: '2026-10-23' }, 'finalizada'],
    ['sin horas: antes de medianoche local', '2026-10-22 04:59:59', { desde: null, hasta: null }, 'programada'],
    ['sin horas: inicio del día local', '2026-10-22 05:00:00', { desde: null, hasta: null }, 'en_curso'],
    ['sin horas: incluir todo el último día', '2026-10-23 04:59:59', { desde: null, hasta: null }, 'en_curso'],
    ['sin horas: terminar al día siguiente', '2026-10-23 05:00:00', { desde: null, hasta: null }, 'finalizada'],
    ['conservar borrador', '2026-10-23 16:00:00', { estado: 'borrador' }, 'borrador'],
    ['conservar cancelación', '2026-10-22 14:30:00', { estado: 'cancelada' }, 'cancelada'],
    ['conservar finalización manual', '2026-10-21 20:00:00', { estado: 'finalizada' }, 'finalizada'],
    ['conservar inicio manual anticipado', '2026-10-22 13:00:00', { estado: 'en_curso' }, 'en_curso'],
    ['finalizar una capacitación iniciada manualmente', '2026-10-22 16:00:00', { estado: 'en_curso' }, 'finalizada']
  ];
  const expression = ESTADO_HORARIO_SQL.replaceAll('UTC_TIMESTAMP()', 'TIMESTAMP(?)');
  const connection = await pool.getConnection();
  try {
    // Una zona distinta en la conexión no debe alterar el horario de Perú.
    await connection.query("SET time_zone = '+09:00'");
    for (const [nombre, ahoraUtc, cambios, esperado] of casos) {
      const cap = { ...base, ...cambios };
      const [[row]] = await connection.query(`SELECT ${expression} AS estado FROM (
        SELECT ? AS estado, CAST(? AS DATE) AS fecha_inicio, CAST(? AS DATE) AS fecha_fin,
               CAST(? AS TIME) AS hora_inicio, CAST(? AS TIME) AS hora_fin
      ) cap`, [ahoraUtc, ahoraUtc, cap.estado, cap.inicio, cap.fin, cap.desde, cap.hasta]);
      assert.equal(row.estado, esperado, nombre);
    }
    console.log(`${casos.length} comprobaciones correctas: inicio, fin, varios días, días completos, estados manuales y zona horaria de Perú.`);
  } finally {
    await connection.query('SET time_zone = ?', [process.env.DB_TIMEZONE || '-05:00']);
    connection.release();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
