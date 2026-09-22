# Instalación y operación de SBSS

Esta guía corresponde al código V1 de este repositorio. Los comandos se ejecutan desde `backend`. La aplicación sirve el frontend y la API desde el mismo proceso Node.js.

## Requisitos

- Node.js 24.x y npm.
- MySQL 8.x, con una cuenta que pueda crear la base para la instalación inicial y modificar su esquema para las migraciones.
- Un navegador actual. Estilos, iconos, fuentes y bibliotecas de exportación se distribuyen localmente en `frontend/vendor`; no necesitan Internet durante el uso del sistema.
- Espacio de disco para la base de datos, los adjuntos y las copias de seguridad.

El usuario del proceso Node.js debe poder leer el proyecto y escribir en `backend/uploads/documentos` y `backend/backups`. Los PDF generados por el módulo Documentos se producen en el backend sin un ejecutable PDF externo.

El servidor y MySQL deben permanecer disponibles en el equipo o la red local. Los recursos del frontend ya están compilados en el repositorio. Después de cambiar HTML o JavaScript, reconstruye y verifica esos recursos siguiendo [RECURSOS_LOCALES.md](RECURSOS_LOCALES.md); la compilación reemplaza el antiguo CDN de Tailwind y fija las versiones de las bibliotecas. Las herramientas y `node_modules` del frontend no se publican por HTTP.

## Preparar el código y la configuración

En PowerShell, sustituye la ruta por la ubicación real del proyecto:

```powershell
Set-Location 'C:\ruta\SISTEMA-CONTROL-DE-ASISTENCIA\backend'
npm ci
```

Para una instalación nueva, copia `.env.example` a `.env` y completa los valores. Si ya existe `.env`, conserva su contenido y actualiza solo lo necesario.

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
```

| Variable | Uso |
| --- | --- |
| `DB_HOST` | Dirección de MySQL, por ejemplo `localhost`. |
| `DB_PORT` | Puerto de MySQL; normalmente `3306`. |
| `DB_USER` / `DB_PASSWORD` | Cuenta y contraseña de conexión. |
| `DB_NAME` | Nombre de la base. Los scripts admiten letras, números y guion bajo, hasta 64 caracteres. |
| `DB_TIMEZONE` | Zona de las conexiones MySQL de la aplicación; por defecto `-05:00`. |
| `TZ` | Zona horaria del proceso; la configuración de ejemplo utiliza `America/Lima`. |
| `JWT_SECRET` | Secreto aleatorio y privado usado para las sesiones. |
| `JWT_EXPIRES_IN` | Duración de sesión; por defecto `8h`. |
| `PORT` | Puerto HTTP; por defecto `3000`. |
| `DOCUMENTOS_DIR` | Opcional: ruta absoluta para almacenar documentos y sustentos de permisos. Por defecto se usa `backend/uploads/documentos`. |
| `MYSQLDUMP_PATH` | Opcional: ruta al ejecutable `mysqldump` para respaldos. |

Puedes generar un valor para `JWT_SECRET` con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Guarda el valor en `.env`. Las credenciales de MySQL, del administrador y del servidor deben quedar en el registro privado de credenciales de SBSS. No forman parte del código compartido.

## Instalación nueva, sin datos de demostración

Selecciona en `DB_NAME` una base nueva o vacía. Configura temporalmente estas variables en `.env` o en el entorno del proceso:

| Variable | Dato requerido |
| --- | --- |
| `ADMIN_EMAIL` | Correo de acceso del administrador de SBSS. |
| `ADMIN_PASSWORD` | Contraseña inicial de al menos 10 caracteres y hasta 72 bytes UTF-8. |
| `ADMIN_NOMBRES` | Nombres reales del administrador. |
| `ADMIN_APELLIDOS` | Apellidos reales del administrador. |
| `ADMIN_DOCUMENTO` | Número de documento del administrador. |

```powershell
npm run instalar
```

El instalador crea el esquema actualizado, los tres perfiles, las siete organizaciones del requerimiento, un área y cargo iniciales de administración, los tipos iniciales de documento y la cuenta administradora. No carga personal ni asistencias de demostración. La cuenta inicial queda vinculada a su ficha en SBSS Outsourcing.

El instalador rechaza bases con tablas existentes. Si un intento falla después de crear el esquema, conserva esa base para revisar la causa y utiliza otra base nueva vacía para reintentar; no ejecutes borrados sobre una base con información de trabajo.

Después de guardar las credenciales en el registro privado de SBSS, retira `ADMIN_PASSWORD` de `.env` o de la variable de entorno temporal. No se necesita para iniciar el sistema.

`base-actualizada.sql` contiene también datos de demostración históricos. La instalación operativa se realiza con `npm run instalar`, que toma únicamente las definiciones de tablas y configura los datos iniciales indicados arriba.

## Actualizar una instalación existente

Detén temporalmente la captura de información, verifica que `DB_NAME` corresponde a la instalación que vas a actualizar y ejecuta:

```powershell
npm run migrar
```

El comando crea un respaldo antes de modificar el esquema. Después añade tablas, columnas e índices ausentes y conserva los usuarios y registros. Puede volver a ejecutarse sin cargar datos de demostración ni duplicar los perfiles.

También completa las siete organizaciones del requerimiento, reconociendo los nombres equivalentes ya registrados. Conserva las organizaciones adicionales y sus relaciones; los nuevos registros quedan en auditoría como configuración del sistema.

Para tareas de recuperación controladas en las que ya existe un respaldo verificado, está disponible:

```powershell
npm run migrar -- --sin-respaldo
```

Los comandos antiguos `migrar:documentos` y `migrar:rrhh` atienden módulos concretos. Para preparar la V1 completa utiliza `migrar`.

## Iniciar y abrir el sistema

```powershell
npm start
```

Abre `http://localhost:3000/` o el puerto configurado en `PORT`. El servidor entrega también `login.html`, las pantallas y `/api`.

El acceso directo al formulario es `http://localhost:3000/login.html`. El login verifica que está conectado al servicio de autenticación SBSS antes de habilitar las credenciales. Si se abre el archivo HTML directamente o desde un servidor de desarrollo, busca la instalación en el puerto local 3000 y redirige al formulario servido por Node.js; si el servicio no responde, muestra un enlace y una opción para reintentar. Si configuraste otro puerto, utiliza directamente su dirección. La carga de iconos no debe impedir iniciar sesión.

No abras los HTML con `file://` ni con un servidor independiente de “Live Server”: las llamadas de la aplicación usan `/api` en el mismo origen. Para otro equipo de la red, utiliza la dirección del servidor y su puerto autorizado. Para un acceso publicado, configura la dirección HTTPS de la instalación y un proceso que reinicie Node.js si el servidor se reinicia; este repositorio no incluye una cuenta de alojamiento ni publica el sistema automáticamente.

Conserva `TZ=America/Lima` y `DB_TIMEZONE=-05:00` para la operación de Perú. El backend configura la zona de sus conexiones MySQL con `DB_TIMEZONE`; las consultas diarias usan esa fecha y la aplicación utiliza `America/Lima` para las fechas operativas.

## Preparación operativa

1. Inicia sesión con el administrador configurado.
2. En **Empresas**, verifica las organizaciones y completa su información.
3. En **Usuarios y configuración**, registra las áreas y cargos de cada organización.
4. Registra las fichas del personal y sus metas de prácticas.
5. Crea las cuentas de RRHH y colaboradores, asociándolas a las fichas existentes.
6. Asigna horarios, revisa las plantillas documentales y carga los documentos iniciales.
7. Verifica con SBSS un registro de asistencia, su acumulación de horas, un reporte y la descarga de un documento propio desde el perfil del trabajador.

Consulta [MANUAL_USUARIO.md](MANUAL_USUARIO.md) para los procedimientos de cada pantalla y [DiagramaBD.mmd](../Diagramas/DiagramaBD.mmd) para las relaciones de la base.

## Copia de seguridad completa

```powershell
npm run backup
```

El comando imprime la carpeta creada bajo `backend/backups/<fecha>/`. El respaldo reúne:

- `base-datos.sql`: esquema y datos.
- `codigo/`: código del proyecto, sin dependencias, repositorio Git ni respaldos anteriores.
- `uploads/`: archivos adjuntos; los documentos y sustentos se conservan en `uploads/documentos/`.
- `configuracion.env`: copia privada del archivo de configuración, cuando existe.
- `manifest.json`: fecha, base de origen y suma SHA-256 del SQL.

El mecanismo intenta usar `mysqldump`. En Windows busca por defecto `C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe`; en otros sistemas usa `mysqldump`. Si el ejecutable no está disponible o no puede lanzarse, utiliza el respaldo mediante `mysql2`. Un error de autenticación o de permisos de MySQL detiene el respaldo. El mecanismo alternativo rechaza bases con rutinas o eventos adicionales para evitar perderlos.

Durante la copia completa evita modificar registros o cargar archivos: el SQL tiene una instantánea consistente, pero copiar código y archivos es una operación posterior. La suma del manifiesto verifica el SQL; no sustituye una prueba de restauración ni verifica todos los adjuntos.

Conserva una copia fuera del equipo que aloja la aplicación, con acceso restringido a los responsables de SBSS. `configuracion.env`, la base y los adjuntos contienen información privada; no publiques la carpeta de respaldo ni la incluyas en un repositorio público.

## Restaurar y comprobar una copia

La restauración automatizada carga la base de datos. El destino debe estar vacío y tener un nombre diferente al `DB_NAME` del entorno actual.

```powershell
npm run restaurar -- 'C:\respaldos\SBSS\carpeta-del-respaldo' sbss_restauracion
```

El comando comprueba el hash del SQL, crea la base de destino si hace falta, rechaza destinos con tablas y carga el esquema y los datos. No sustituye la base actual ni copia automáticamente los adjuntos o el código a la aplicación.

Para recuperar también la aplicación:

1. Copia `codigo/` a una nueva carpeta de trabajo y ejecuta `npm ci` desde su `backend`.
2. Prepara el `.env` de esa copia utilizando `configuracion.env` como referencia privada. Ajusta `DB_NAME` a la base restaurada, la conexión y `PORT` si conviven dos instancias. No reutilices sin revisión la configuración de otra instalación.
3. Copia los archivos de `uploads/documentos/` del respaldo al directorio privado de la nueva instancia: `backend/uploads/documentos` o la ruta absoluta elegida en `DOCUMENTOS_DIR`. Conserva sus nombres; la base utiliza esos identificadores.
4. Si el respaldo es de una versión anterior, ejecuta `npm run migrar` en la copia restaurada antes de iniciar el servidor.
5. Abre la copia, comprueba las cuentas, el personal, las horas, las plantillas, los reportes y varios adjuntos. Solo después decide el cambio de la instalación operativa.

Estos comandos atienden el esquema de esta aplicación. Si una instalación incorpora procedimientos, eventos, triggers o vistas propios, verifica también su compatibilidad al restaurar antes de sustituir el servicio.

## Problemas frecuentes

| Situación | Comprobación |
| --- | --- |
| No se conecta a MySQL | Servicio MySQL activo y valores `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. |
| Faltan tablas o columnas | Ejecutar la migración V1 sobre la base correcta, con su respaldo previo. |
| La base ya contiene tablas al instalar | Usar `migrar` para una instalación existente; `instalar` requiere una base vacía. |
| La sesión expira o deja de funcionar al cambiar cuenta/clave | Volver a iniciar sesión; los cambios de acceso revocan sesiones anteriores. |
| No aparece un área o cargo | Configurarlo como administrador y comprobar su empresa o área asociada. |
| Un documento no se encuentra tras restaurar | Restaurar también los archivos y revisar `DOCUMENTOS_DIR`. |
| Una exportación de reportes no carga | Verificar que se distribuyó `frontend/vendor` completo y ejecutar `npm run verify:assets` desde `frontend`. |
| `spawn EPERM` al ejecutar pruebas | Restricción de creación de procesos del entorno; las suites pueden ejecutarse individualmente con `node tests/nombre.test.js`. |
