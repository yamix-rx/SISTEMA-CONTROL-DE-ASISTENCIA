# Publicación SBSS en Vercel + Supabase

ESTADO: preparación técnica, publicación BLOQUEADA hasta validar despliegue y archivos.
Repositorio: yamix-rx/SISTEMA-CONTROL-DE-ASISTENCIA.
Rama: feat/supabase-postgres-sbss-20261026.
Proyecto de datos: https://supabase.com/dashboard/project/roddgujtsdudromjufux

## Ya realizado
- PostgreSQL: 19 tablas (18 del sistema más subidas_pendientes); RLS sin políticas públicas.
- Un administrador; identidad administrativa inactiva para marcaciones.
- Cambio obligatorio de contraseña inicial antes de usar otras funciones.
- Bucket privado sbss-documentos de 5 MB.
- API Express y frontend preparados para un solo proyecto de Vercel, Node 24.
- Carga directa vía URL firmada, ticket de 20 minutos y verificación del archivo en backend.
- Ninguna clave de servidor está en GitHub.

## Variables privadas para Vercel
Configurar desde Settings > Environment Variables:
- DATABASE_URL: Supabase > Connect > Transaction pooler, puerto 6543 con TLS.
- SUPABASE_URL: https://roddgujtsdudromjufux.supabase.co
- SUPABASE_SECRET_KEY: Supabase > Project Settings > API Keys, clave secreta sb_secret_, jamás clave pública.
- JWT_SECRET: cadena aleatoria de al menos 32 caracteres.
- LOGO_ENCRYPTION_KEY: cadena aleatoria de 64 caracteres hexadecimales, distinta de JWT_SECRET.
- JWT_EXPIRES_IN: 8h
- NODE_ENV: production

Jamás compartir DATABASE_URL, SUPABASE_SECRET_KEY ni las claves de JWT/cifrado en chats o GitHub.
Para generar claves al azar ejecutar localmente:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
Ejecutar dos veces, una para cada clave.

## Despliegue
1. Autorizar acceso al equipo Vercel; requiere consentimiento del propietario.
2. Importar el repositorio completo, Root Directory vacío (raíz).
3. Framework Other / Express detectado; Node 24.x.
4. Build Command: npm run build.
5. El build genera public/ con los archivos estáticos permitidos y server.js exporta Express.
6. Crear primero Preview de esta rama; NO fusionar main hasta que todas las pruebas pasen.
7. Verificar GET /api/auth/disponibilidad y login con cambio obligatorio de clave.
8. Probar módulos: administración, RRHH, personal, horarios, asistencia, informes, documentos, contratos, capacitaciones, auditoría.
9. Probar subir archivo de 5 MiB directamente a Storage y descargar usando URL firmada.
10. Comprobar controles de acceso a expedientes, backup, privacidad, plan para uso de empresa y errores del servidor.

## Estado de verificaciones
- Pruebas de adaptador pg con simulación: correctas.
- SQL de lecturas y cálculos evaluado directamente en Supabase mediante EXPLAIN.
- Esquema y roles confirmados en Supabase.
- Pruebas E2E de escritura, cargado de archivos y despliegue Vercel: AÚN PENDIENTES.
- GitHub Actions contiene pipeline de npm ci, compilación y tests.

## Restricciones
- Vercel Hobby tiene restricciones para aplicaciones comerciales; confirmar un plan adecuado al uso laboral.
- El administrador debe cambiar la contraseña inicial antes de realizar operaciones.
- Los documentos no deben ser públicos y la clave sb_secret_ nunca debe llegar al navegador.
- NO importar backend/base-actualizada.sql en Supabase; contiene MySQL y registros demo.
