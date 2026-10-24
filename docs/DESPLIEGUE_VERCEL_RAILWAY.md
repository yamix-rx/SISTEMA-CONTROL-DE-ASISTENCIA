# Despliegue SBSS: Vercel + Railway + MySQL

> Guía para una instalación **nueva**. No importar `backend/base-actualizada.sql`: contiene registros de demostración. No usar datos personales reales hasta contar con autorización de la institución y controles de privacidad adecuados.

## Resultado inicial

- MySQL: 18 tablas creadas por el instalador, sin asistencias, horarios, contratos, documentos ni empleados de demostración.
- Se crean solamente una organización (`SBSS Outsourcing`), el empleado asociado a la cuenta administradora, una cuenta de acceso con rol **Administrador General** y los roles y catálogos mínimos que requiere el sistema.
- El administrador puede registrar personas, horarios y asistencias a partir de ese momento.
- `npm run migrar` conserva la información y **no agrega empresas predeterminadas**. Si se necesita el catálogo histórico de siete empresas, ejecutar deliberadamente `npm run migrar -- --incluir-organizaciones` después de obtener y comprobar un respaldo.

## 1. Railway: dos servicios, mismo proyecto

En [Railway](https://railway.com/), crear un proyecto SBSS con:
1. Servicio `MySQL` desde **New → Database**. Mantenerlo en red privada; NO habilitar acceso público.
2. Servicio `sbss-api` desde el repositorio de GitHub `yamix-rx/SISTEMA-CONTROL-DE-ASISTENCIA`, seleccionando la rama aprobada. En la configuración del backend:
   - **Root Directory:** `/backend`
   - **Build:** `npm ci`
   - **Start:** `npm start`
   - **Runtime:** Node.js 24 o posterior, según `package.json`.
   - **Networking:** Generate Domain. Este dominio público debe servir solo la API.
3. Crear un volumen persistente asociado a `sbss-api`, montado en `/data`. Usar `DOCUMENTOS_DIR=/data/documentos` y `BACKUPS_DIR=/data/backups`. Conservar copia de respaldos **fuera del mismo volumen y del proveedor**. No adjuntar múltiples instancias que escriban simultáneamente el mismo volumen sin diseñar coordinación.

### Variables privadas de `sbss-api`

Configurar desde **Variables**, usando referencias del servicio MySQL (ajustar el nombre real del servicio):

```dotenv
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_TIMEZONE=-05:00
JWT_EXPIRES_IN=8h
DOCUMENTOS_DIR=/data/documentos
BACKUPS_DIR=/data/backups
```

En el panel crear **también**:
- `JWT_SECRET`: valor aleatorio secreto (el configurador local `npm run configurar` genera un valor seguro).
- `LOGO_ENCRYPTION_KEY`: 64 caracteres hexadecimales aleatorios (generada también con `npm run configurar`).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRES`, `ADMIN_APELLIDOS`, `ADMIN_DOCUMENTO`: credenciales y datos **privados** del primer administrador. El documento debe tener 8 dígitos; contraseña entre 10 caracteres y 72 bytes.

No copiar claves, contraseñas, datos personales ni archivos `.env` a GitHub, PR, tickets o chats. La variable `PORT` la administra Railway cuando corresponda. Asegurarse de que `JWT_SECRET` y `LOGO_ENCRYPTION_KEY` sean valores **distintos**.

### Inicializar una sola vez

Desplegar el backend y conectar las variables primero. El servidor API puede iniciar aunque aún no estén creadas las tablas; no abrir el login antes de la instalación.

En una terminal con [Railway CLI](https://docs.railway.com/cli) vinculada al proyecto:

```bash
railway ssh --service sbss-api -- npm run instalar
```

Se necesita disponer de acceso a Railway y autenticar SSH según el procedimiento actual de Railway. Es un comando **único y manual**; nunca agregar `npm run instalar` al Start Command ni a un predeploy automático. Exige una base vacía. La instalación genera el esquema y la cuenta inicial, sin importar el SQL de demostración.

Al terminar: retirar `ADMIN_PASSWORD` de las variables de Railway, volver a desplegar el backend si aplica, y conservar las credenciales en un gestor seguro. Mantener las otras variables `ADMIN_*` solo si hacen falta; no son requeridas para el arranque habitual.

### Verificación de la instalación

En la consola de consultas de MySQL (solo para revisar, **sin modificar**):

```sql
SELECT COUNT(*) AS cuentas FROM usuarios;       -- 1
SELECT COUNT(*) AS personas FROM empleados;     -- 1 (ficha del administrador)
SELECT COUNT(*) AS empresas FROM empresas;      -- 1
SELECT COUNT(*) AS asistencias FROM asistencias; -- 0
SELECT COUNT(*) AS horarios FROM horarios;      -- 0
SELECT COUNT(*) AS contratos FROM contratos;    -- 0
```

La ruta `https://DOMINIO-RAILWAY/api/auth/disponibilidad` debe responder JSON con `{"ok":true,"servicio":"sbss-auth"}`. Esta comprobación no verifica por sí sola que la base de datos esté lista: comprobar las consultas y un login controlado.

## 2. Vercel: frontend estático

Importar el **mismo repositorio** a [Vercel](https://vercel.com/new). Seleccionar:
- **Root Directory:** `frontend`
- **Framework Preset:** Other
- **Node.js:** 24.x
- **Build Command:** `npm run build:vercel` (configurado en `frontend/vercel.json`)
- **Output Directory:** `dist`.

El comando primero reconstruye los assets y luego coloca en `dist` únicamente las páginas `.html`, favicon y directorios `assets/`, `css/`, `js/`, `vendor/`. No publica `backend/`, `tests/`, `scripts/`, `.env` ni `node_modules/`. La web no puede iniciar sesión hasta configurar el proxy que se describe a continuación.

### Conectar `/api` con Railway

Cuando Railway haya asignado un dominio HTTPS a `sbss-api`, editar `frontend/vercel.json` y **añadir** la propiedad siguiente a nivel raíz (sin eliminar `buildCommand`, `outputDirectory` ni `headers`):

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "https://DOMINIO-REAL.up.railway.app/api/:path*"
  }
]
```

**Sustituir** `DOMINIO-REAL.up.railway.app` por el dominio real asignado por Railway. Hay un fragmento copiable en `frontend/vercel.proxy.example.json`, que es solo un ejemplo, NO la configuración activa. Publicar a Vercel después de guardar el dominio verificado.

La reescritura mantiene las peticiones del navegador en `https://TU-PROYECTO.vercel.app/api/...`, conserva el login y evita tener que modificar las URLs `/api` del frontend. No crear una API serverless adicional en Vercel para reenviar adjuntos grandes.

## 3. Pruebas antes de registrar asistencia real

1. Entrar a `/login.html` desde Vercel. Debe indicar servidor conectado.
2. Iniciar sesión con la única cuenta administradora; verificar Dashboard y permisos.
3. Crear **un trabajador de prueba autorizado** y un horario, marcar una asistencia de prueba y comprobar su reporte. Retirarla después si se usaron datos simulados y conservar evidencias sin información sensible.
4. Subir y descargar un documento de prueba, reiniciar el backend y verificar que sigue disponible en `/data/documentos`.
5. Revisar auditoría, permisos, protección de rutas sin sesión, recuperación de contraseña y el límite de intentos.
6. Comprobar una copia de seguridad de MySQL + volumen y **una restauración en ambiente aislado** antes del uso real.

## Consideraciones de seguridad y costos

- **No desplegar todavía en producción** hasta que la institución confirme autorización, responsables, políticas de acceso y respaldos. El sistema contiene datos personales y potencialmente sensibles.
- Vercel Hobby es solo para uso personal no comercial; si el centro de prácticas lo usa operativamente, revisar un plan que permita uso empresarial.
- El proxy /api no reemplaza autenticación ni control de permisos. El backend usa JWT y necesita HTTPS en su dominio público.
- `BACKUPS_DIR=/data/backups` protege los respaldos frente a reinicios; **no los protege de la pérdida o eliminación del volumen**. Exportar copias cifradas fuera del proveedor periódicamente y probar su restauración.
- No colocar `ADMIN_PASSWORD` en el repositorio, ni exponer la base MySQL mediante un dominio público. Mantener Vercel y Railway sin despliegues productivos automáticos hasta aprobar las pruebas.
