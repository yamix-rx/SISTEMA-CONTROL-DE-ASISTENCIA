# Migración SBSS a Supabase + Vercel (rama de trabajo)

**Estado: FASE 2 EN PROGRESO; NO LISTO PARA PRODUCCIÓN.** No fusionar con `main` ni conectar datos reales hasta portar y probar las consultas MySQL, la API Express y el almacenamiento de archivos. La rama se creó desde `main` del 2026-10-26 y conserva los nuevos documentos y módulos.

## Objetivo

- **Supabase PostgreSQL:** esquema nuevo, sin empleados, horarios ni asistencias de demostración.
- **Cuenta inicial:** una persona en `empleados` vinculada a un único `usuarios` con rol `Administrador General`; tres roles de sistema y catálogos mínimos.
- **Supabase Storage:** bucket **privado** para adjuntos; no enlazar archivos públicos.
- **Vercel:** frontend y API Express con credenciales del servidor; mantener JWT y bcryptjs hasta completar la migración.

## 1. Crear un proyecto Supabase nuevo

1. **Ya realizado en este proyecto:** https://supabase.com/dashboard/project/roddgujtsdudromjufux (us-east-1). Para otra instalación, crear un proyecto nuevo y usar una contraseña fuerte almacenada en gestor privado.
2. **Ya ejecutado en sbss-asistencia.** Para reproducirlo en otro proyecto, abrir **SQL Editor** del proyecto nuevo. Revisar `supabase/schema.sql` y ejecutar su contenido: crea las 18 tablas, restricciones, índices, triggers de `updated_at` y habilita RLS sin políticas. **No ejecutar `backend/base-actualizada.sql`**: es MySQL y contiene datos ficticios.
3. Nunca desactivar RLS para facilitar el acceso. Las rutas web deben llamar al backend; el navegador **no** debe conectarse directamente a tablas de personal o asistencia. Las claves de servicio y `DATABASE_URL` son solo del servidor.
4. **Ya creado y verificado:** bucket privado `sbss-documentos`, 5 MB y formatos admitidos mediante `supabase/storage.sql`. No tiene políticas abiertas de acceso a objetos. La integración con la API y el frontend continúa pendiente.

## 2. Crear el único administrador inicial (en equipo local seguro)

1. Abrir una terminal en la carpeta `supabase/` de esta rama.
2. Ejecutar `npm install` (genera `package-lock.json` que debe conservarse cuando se cierre la migración).
3. Copiar `.env.example` a `.env` (excluido de Git). Poner `DATABASE_URL` exacta del diálogo **Connect → Session pooler (5432)** del proyecto. La URL debe incluir `sslmode=require`. Si se necesita verificación estricta del certificado, configurar `sslmode=verify-full` y CA adecuada.
4. Completar `ADMIN_EMAIL`, `ADMIN_PASSWORD` (>= 10 caracteres, <= 72 bytes, usar frase aleatoria), `ADMIN_NOMBRES`, `ADMIN_APELLIDOS` y `ADMIN_DOCUMENTO` (8 dígitos). No publicar ni enviar esos valores por chat.
5. Ejecutar **una sola vez** `npm run instalar`. El script valida que todas las tablas estén vacías, crea en una transacción el único administrador y los catálogos, y no imprime la contraseña.
6. Ejecutar `supabase/verificar.sql` desde SQL Editor. Debe haber **1 usuario**, **1 empleado**, **1 empresa** y **0 asistencias** y **0 horarios**. Eliminar `ADMIN_PASSWORD` de `.env` y guardar sus credenciales en un gestor privado.

**Nota:** No ejecutar en una base con información real. El esquema y la inicialización se proporcionan para una base nueva, no migran datos del MySQL usado localmente.

## 3. Pendiente antes del despliegue

- Sustituir la capa `mysql2` en `backend/config/database.js` y `transactionPool.js` por PostgreSQL, preservando transacciones y auditoría. El código actual usa respuesta de MySQL (`[rows]`, `insertId`) y marcadores `?`.
- Portar consultas SQL de servicios y controladores: `CURDATE()`, `WEEKDAY()`, `DATE_ADD()`, `TIMESTAMP(fecha,hora)`, `CONVERT_TZ()`, `DATE_FORMAT()`, `UPDATE ... JOIN`, `ON DUPLICATE KEY`, `INSERT IGNORE`, `GROUP_CONCAT`, etc. **No aplicar reemplazos globales no comprobados**; validar lógica de jornadas, permisos, contratos, auditoría y límites.
- Sustituir almacenamiento local de `documentoArchivoService.js` por Supabase Storage privado y adaptar la descarga autenticada desde controladores de documentos y sustentos. La clave `service_role` nunca sale al navegador. Prever el límite de cuerpo de peticiones en Vercel para archivos grandes y diseñar un flujo de subida segura.
- Empaquetar frontend como archivos estáticos de Vercel (`public/`) y servir API Node/Express como función. La documentación oficial indica que `express.static()` no sirve archivos en Vercel: https://vercel.com/docs/frameworks/backend/express
- Para Vercel Functions usar **Supabase Transaction pooler** (puerto 6543) y tamaño de pool reducido; obtener la URL exacta desde **Connect** del proyecto: https://supabase.com/docs/guides/database/connecting-to-postgres
- Añadir pruebas con una base PostgreSQL separada y verificar login, roles, empresa, fichas, marcaciones, horas/tardanzas, turnos nocturnos, documentos, permisos y reportes. No marcar como completado sin resultados.
- Confirmar un plan de hosting compatible con el uso empresarial y con los datos personales del personal, así como política de copias de seguridad y accesos.

## Estado de esta rama

| Pieza | Estado |
|---|---|
| DDL PostgreSQL de 18 tablas (sin datos de demostración) | Aplicado y validado en sbss-asistencia; RLS activado |
| Instalación inicial con un solo administrador | Script preparado; ejecución pendiente |
| Storage privado | Bucket creado y verificado; API y frontend aún no adaptados |
| Backend PostgreSQL y tests de integración | Adaptador PostgreSQL y módulos principales migrados; consultas SELECT validadas con EXPLAIN; pruebas completas y escrituras pendientes |
| Despliegue de Vercel | Pendiente, no liberar |

## Referencias oficiales

- https://supabase.com/docs/guides/platform/migrating-to-supabase/mysql
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/storage/security/access-control
- https://vercel.com/docs/frameworks/backend/express


## Fase 2: trabajos ya realizados sobre la rama (2026-10-26)

- El backend incorpora `backend/config/postgresPool.js` (driver `pg`), con marcadores `$1`, semántica temporal mysql2 y transacciones HTTP mediante `AsyncLocalStorage`. Una consulta que use funciones MySQL no portadas genera `SBSS_SQL_NOT_MIGRATED` en vez de ejecutarse incorrectamente.
- `backend/config/database.js` usa PostgreSQL cuando existe `DATABASE_URL`; sin ella sigue usando MySQL, preservando la ejecución local. Para Vercel, la URL de Supabase se configura solo en **Environment Variables**, nunca en archivos web.
- Se portaron consultas de dashboard, contratos, capacitaciones, asistencia diaria, horario, personal, fichas, empresa, revisión documental y plantillas. Los estados booleanos, `ON CONFLICT`, `EXTRACT(ISODOW)`, funciones de tiempo Perú y `GROUP BY` se probaron mediante `EXPLAIN` en la base vacía. **EXPLAIN no verifica las operaciones de escritura ni los resultados con datos reales.**
- El bucket privado `sbss-documentos` ya se creó y se comprobó que `public = false`, su límite es 5 MB y no existen políticas de acceso directo a `storage.objects`. La autorización y transferencias desde el backend y el navegador **no están implementadas**.
- La función de actualización `sbss_touch_updated_at` tiene search_path fijo y EXECUTE revocado a roles de cliente; se añadió también al esquema reproducible.
- La base real sigue sin usuarios ni asistencias de prueba. **No se ha creado el administrador** porque faltan credenciales iniciales seguras introducidas por canal privado. El email planeado es el que indicó el responsable; no guardarlo en scripts.
- No se desplegó en Vercel; todavía requieren implementación el flujo seguro de carga de documentos de hasta 5 MB, las pruebas funcionales de escritura (login, personal, asistencia, capacitaciones, contratos, reportes y auditoría), y la configuración del hosting empresarial.

**Seguridad:** El bucket privado no es equivalente a un flujo completo de gestión de documentos. No habilitar reglas genéricas para `anon` o `authenticated`. La futura subida directa deberá generar un permiso de carga por un backend que valide el token, rol, empleado y tipo de documento; no exponer claves privilegiadas al navegador.

