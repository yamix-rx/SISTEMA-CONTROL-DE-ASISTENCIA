# Instalación, actualización y recuperación

## Requisitos

- Node.js 24 o superior y npm.
- MySQL 8 con una cuenta para la aplicación. La instalación necesita permiso para crear la base y sus tablas; el uso diario no necesita permisos globales de administración.
- Navegador actualizado. El servidor entrega interfaz y API desde el mismo origen.

## Instalación nueva

1. En `backend`, ejecutar `npm ci` y `npm run configurar`. Se crea `.env` con claves aleatorias; no se imprimen ni se sobrescriben claves existentes.
2. Editar **privadamente** `backend/.env`: completar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. Conservar `DB_TIMEZONE=-05:00` para Perú.
3. Completar `ADMIN_EMAIL`, `ADMIN_PASSWORD` (al menos 10 caracteres, máximo 72 bytes), `ADMIN_NOMBRES`, `ADMIN_APELLIDOS` y `ADMIN_DOCUMENTO` (DNI de 8 dígitos). No usar credenciales de demostración.
4. Ejecutar `npm run instalar`. La base debe estar vacía. El instalador crea el esquema, siete organizaciones, los tres perfiles, los tipos documentales y de permiso, y la cuenta administradora.
5. Entregar las credenciales al responsable de SBSS por un canal privado. Retirar `ADMIN_PASSWORD` de `.env` después de guardarla de forma segura.
6. En `frontend`, ejecutar `npm ci`, `npm run build` y `npm test`.
7. En `backend`, ejecutar `npm test` y `npm start`. Abrir `http://localhost:3000`. No utilizar Live Server para operar el sistema.

`PORT` cambia el puerto del servidor. `JWT_SECRET` firma las sesiones y debe ser una clave privada aleatoria. `JWT_EXPIRES_IN` vale `8h` por defecto. `LOGO_ENCRYPTION_KEY` contiene 64 caracteres hexadecimales y permite recuperar los logos cifrados: **no cambiarla si existen logos sin conservar primero la clave anterior**. `DOCUMENTOS_DIR` es opcional y debe señalar una carpeta privada, fuera de los recursos web públicos.

## Actualizar una base existente

1. Detener el servidor de la instalación que se va a actualizar.
2. Guardar un respaldo completo con `npm run backup -- --incluir-configuracion` en `backend`. Contiene credenciales: mantenerlo privado y fuera de Git.
3. Actualizar el código, ejecutar `npm ci` en ambas carpetas y `npm run migrar` en `backend`. La migración crea tablas o columnas ausentes y conserva los registros; realiza un respaldo previo.
4. Ejecutar `npm run build` y `npm test` en `frontend`, y `npm test` en `backend`.
5. Ejecutar `npm run revisar:documentos`. El informe privado se guarda en `backend/backups/revision-documentos.json`. `npm run revisar:documentos -- --recuperar` restaura solamente copias exactas y válidas encontradas en respaldos locales. Nunca inventa archivos ni borra registros antiguos.
6. Reiniciar el servidor. Los vínculos antiguos `practicante` se conservan; RR. HH. puede clasificarlos como profesional o preprofesional al editar la ficha.

## Respaldos

`npm run backup` guarda SQL, código y archivos privados en `backend/backups/<fecha>`. No incluye `.env` salvo que se añada `--incluir-configuracion`. Todo respaldo puede contener datos personales y debe mantenerse privado. Copiar periódicamente una versión a almacenamiento controlado por SBSS. El directorio de respaldos está excluido de Git.

El manifiesto contiene la fecha, el origen y la suma SHA-256 del SQL. Conservar junto al respaldo la clave de cifrado de logos; sin ella no podrán descifrarse. La cuenta MySQL debe poder leer todas las tablas. Si existen rutinas o eventos adicionales se requiere `mysqldump`; el exportador alternativo rechaza respaldos que no pueda conservar completamente.

## Restaurar sin sobrescribir la instalación actual

1. Conservar una copia del respaldo completo y de su configuración privada.
2. En `backend`, ejecutar `npm run restaurar -- "ruta/al/respaldo" sbss_recuperacion_nueva`. Se comprueba SHA-256 y se exige una base de destino vacía, distinta de `DB_NAME`.
3. El comando restaura la **base de datos**. Copiar `uploads/documentos` del respaldo a una carpeta privada nueva y configurar `DOCUMENTOS_DIR` con su ruta absoluta. No mezclar archivos ni sobrescribir la carpeta en uso.
4. Preparar una instalación separada del código respaldado. Configurar su base restaurada, un puerto diferente y la misma `LOGO_ENCRYPTION_KEY` del respaldo. Generar un `JWT_SECRET` nuevo para invalidar sesiones previas.
5. Iniciar esa instalación, revisar fichas, asistencia, reportes, logos y descargas. Ejecutar `npm run revisar:documentos`.
6. Cambiar a la instalación recuperada únicamente después de comprobarla; conservar la anterior hasta que SBSS apruebe la recuperación.

## Seguridad y entrega

Cerrar sesión invalida los tokens anteriores de la cuenta. También se invalidan al desactivarla o cambiar sus permisos o contraseña. El login limita intentos por dirección y cuenta; en varias instancias debe usarse además un límite compartido en el proxy de entrada. Si se publica en Internet, servir por HTTPS y configurar correctamente el proxy; no confiar indiscriminadamente en cabeceras de IP.

`npm run seguridad:rotar-jwt` genera una nueva clave de sesión. Reiniciar todos los procesos del servidor para aplicarla. Si un secreto fue publicado, retirarlo del código actual no lo elimina del historial de Git: la limpieza del historial remoto requiere coordinar todas las ramas y copias con sus responsables. No publicar respaldos, `.env`, sesiones de prueba ni archivos de usuarios.

Entregar a SBSS: código, diagrama `Diagramas/DiagramaBD.mmd`, este manual, `docs/MANUAL_USUARIO.md`, respaldo reciente comprobado y las credenciales privadas del administrador, MySQL, hosting y repositorio. Documentar quién custodia cada acceso sin incluir sus contraseñas en estos manuales.
