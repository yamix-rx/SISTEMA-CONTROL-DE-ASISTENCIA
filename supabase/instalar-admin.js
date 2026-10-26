'use strict';
// Inicializa solamente un Supabase PostgreSQL NUEVO con schema.sql ya aplicado.
// No importa base-actualizada.sql: contiene usuarios y asistencias de prueba.
require('dotenv').config({ path: require('node:path').join(__dirname, '.env'), quiet: true });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) throw Error('Falta DATABASE_URL PostgreSQL en supabase/.env.');
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: pass, ADMIN_NOMBRES: nombres,
    ADMIN_APELLIDOS: apellidos, ADMIN_DOCUMENTO: dni } = process.env;
  if (!email || !/^[^\s@]+@[^\s@]+\\.[^\s@]+$/.test(email) || email.length > 120) throw Error('ADMIN_EMAIL inválido.');
  if (!pass || pass.length < 10 || Buffer.byteLength(pass) > 72) throw Error('ADMIN_PASSWORD debe tener de 10 caracteres a 72 bytes.');
  if (!nombres?.trim() || nombres.length > 100 || !apellidos?.trim() || apellidos.length > 100 || !/^\d{8}$/.test(dni || '')) throw Error('Complete nombres, apellidos y DNI de 8 dígitos.');
  if (!new URL(url).searchParams.has('sslmode')) throw Error('DATABASE_URL debe incluir sslmode=require o verify-full para cifrar la conexión.');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    // PostgreSQL no permite recrear una instalación sobre datos reales.
    const nombresTablas = ['roles','empresas','areas','cargos','empleados','usuarios','practicante_detalles',
      'horarios','asistencias','tipo_permisos','permisos','tipo_documentos','documentos_empleado',
      'plantillas_documentos','contratos','capacitaciones','capacitacion_participantes','historial_cambios'];
    for (const tabla of nombresTablas) {
      const { rows } = await client.query('SELECT COUNT(*)::integer AS total FROM public.' + tabla);
      if (rows[0].total) throw Error('La tabla ' + tabla + ' ya tiene registros. No se modificó ningún dato.');
    }
    const roles = [
      ['Administrador General', 'Acceso total al sistema'],
      ['Recursos Humanos', 'Gestión de personal y asistencia'],
      ['Trabajador/Practicante', 'Consulta de su información']
    ];
    for (const item of roles) await client.query('INSERT INTO public.roles (nombre, descripcion) VALUES ($1,$2)', item);
    const empresa = (await client.query('INSERT INTO public.empresas (razon_social) VALUES ($1) RETURNING id', ['SBSS Outsourcing'])).rows[0].id;
    const area = (await client.query('INSERT INTO public.areas (nombre,empresa_id) VALUES ($1,$2) RETURNING id', ['Administración',empresa])).rows[0].id;
    const cargo = (await client.query('INSERT INTO public.cargos (nombre,area_id) VALUES ($1,$2) RETURNING id', ['Administrador del sistema',area])).rows[0].id;
    const empleado = (await client.query(
      `INSERT INTO public.empleados (numero_documento,nombres,apellidos,empresa_id,area_id,cargo_id,fecha_ingreso,tipo_vinculo)
       VALUES ($1,$2,$3,$4,$5,$6,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,'trabajador') RETURNING id`,
      [dni,nombres.trim(),apellidos.trim(),empresa,area,cargo])).rows[0].id;
    const roleId = (await client.query('SELECT id FROM public.roles WHERE nombre=$1',['Administrador General'])).rows[0].id;
    await client.query('INSERT INTO public.usuarios (empleado_id,rol_id,email,password,activo) VALUES ($1,$2,$3,$4,true)',
      [empleado,roleId,email.trim().toLowerCase(),await bcrypt.hash(pass,12)]);
    for (const nombre of ['Personal','Salud','Estudios','Familiar','Otro']) await client.query('INSERT INTO public.tipo_permisos (nombre) VALUES ($1)',[nombre]);
    for (const [tipo,obligatorio] of [['DNI',true],['Currículum Vitae',true],['Carta de presentación',false],
      ['Carta de aceptación',false],['Convenio de prácticas',false],['Certificados',false],
      ['Constancia de prácticas',false],['Carta de culminación',false],['Otros documentos',false]])
      await client.query('INSERT INTO public.tipo_documentos (nombre,es_obligatorio) VALUES ($1,$2)',[tipo,obligatorio]);
    await client.query('COMMIT');
    console.log('Instalación inicial completa: 1 usuario administrador, 1 ficha asociada, 0 asistencias y 0 horarios.');
    console.log('Elimine ADMIN_PASSWORD de supabase/.env tras guardar la credencial en un gestor privado.');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { await client.end(); }
}
main().catch(e => { console.error('No se completó la instalación:',e.code || e.message);process.exitCode=1; });
