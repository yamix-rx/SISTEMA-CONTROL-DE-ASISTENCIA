# Validación técnica de SBSS V1

Fecha de referencia: 19 de septiembre de 2026.

Este registro resume los cambios derivados de la comparación del proyecto con el requerimiento funcional y las comprobaciones realizadas sobre la implementación. Distingue las funciones desarrolladas de los recorridos efectivamente probados. La validación técnica no sustituye la aceptación de los responsables de SBSS sobre sus datos, documentos y procedimientos de trabajo.

## Del diagnóstico a la implementación

| Necesidad detectada | Implementación disponible | Comprobación realizada |
| --- | --- | --- |
| Completar la gestión del expediente y la consulta de personal | Registro y edición de datos, vínculos, estados, metas de prácticas, filtros y ficha con historial. | Pruebas aisladas de expediente y consultas de personal suspendido en MySQL de validación. |
| Unificar horas, tardanzas y correcciones de asistencia | Validación de jornadas, cálculo de horas/minutos, actualización sin duplicar la jornada y conservación de la programación histórica. Confirmación explícita de datos históricos faltantes con motivo y auditoría en la misma transacción. | Pruebas de reglas y recorrido MySQL con ingreso, salida, corrección y cambio posterior del horario; rechazo de sobrescritura y auditoría sin duplicados. |
| Seguimiento de practicantes desde RRHH | Horas realizadas, pendientes, progreso, estado de culminación y alertas de seguimiento en los dashboards. | Recorrido con meta cumplida, consulta de seguimiento y carga de las pantallas de ambos perfiles gestores. |
| Permisos con archivo sustentatorio real | Fechas, horas, observaciones, estados, carga y acceso autorizado al archivo, incluido su titular. | Creación, aprobación y recuperación del sustento en MySQL de validación; pruebas aisladas de permisos. |
| Acceso del colaborador a sus documentos | Vista y descarga de archivos limitadas a su identidad autenticada. | Pruebas de archivos propios y ajenos, además de carga y descarga sobre la base de validación. |
| Documentos exigidos y plantillas modificables | Aceptación, constancia de prácticas y culminación; selección de datos; edición de plantillas con campos permitidos; vista previa y PDF directo. Se conservan los tipos anteriores. | Pruebas HTTP, validación de estructura y paginación del PDF, tres generaciones con MySQL y tres descargas desde la interfaz. |
| Administración operativa de cuentas | Alta, edición, perfiles, estado, restablecimiento de contraseña y revocación de sesiones. Áreas y cargos administrables. | Pruebas de roles, bcrypt, validación de claves/correos, protección del administrador y sesiones revocadas; recorridos MySQL e interfaz. |
| Proteger las anotaciones internas | La respuesta del panel del trabajador excluye las observaciones internas de RRHH. | Aserciones de privacidad en pruebas aisladas y en el recorrido con MySQL. |
| Historial de cambios identificable | Módulo, registro, actor, estados anteriores/posteriores y acciones de éxito, error o denegación; ocultación de claves y archivos binarios. | Pruebas de auditoría y revisión de operaciones persistidas en la base de validación. |
| Reportes consistentes y filtrables | Filtros de personal y fechas, indicadores, explicación del criterio de porcentaje y acciones de exportación PDF/Excel. | Pruebas de cálculo, consulta filtrada en MySQL, carga responsive y descargas reales desde Reportes: PDF válido y Excel de cuatro hojas, limitado al colaborador y periodo seleccionados. |
| Usar la aplicación desde la dirección del servidor | Frontend y API servidos por el backend, con rutas relativas al mismo origen. | Recorridos HTTP y pruebas de navegador sobre la instancia de validación. |
| Entregar instalación, documentación y recuperación | Instalador sin demostración, migración V1 repetible, respaldo/restauración, manuales y diagrama ER. | Instalación vacía, migración repetida y restauración de un respaldo a una base separada. |

## Resultado de las comprobaciones

El siguiente cuadro contiene el conteo de la ejecución registrada. Si se añaden pruebas o se modifica la implementación, debe actualizarse con una nueva ejecución y conservar su evidencia correspondiente.

| Grupo | Resultado registrado | Alcance |
| --- | --- | --- |
| Pruebas automatizadas aisladas | **87 de 87 correctas; 0 fallidas** | Ocho archivos de pruebas con datos simulados, incluidos los escenarios de apertura del login. Las pruebas de archivos utilizan almacenamiento temporal y limpieza de sus cargas. |
| Recorridos HTTP con MySQL real | **10 comprobaciones completas** | Base separada restaurada, cuentas y registros de validación. |
| Navegador: carga y disposición | **42 de 42 vistas correctas** | 14 pantallas en anchos de 1440, 768 y 390 píxeles. |
| Navegador: interacciones | **5 recorridos correctos** | Edición/cancelación de cuenta, editor de plantilla y generación de los tres documentos requeridos. |
| Respuestas PDF desde la interfaz | **3 respuestas correctas** | HTTP 200 y tipo `application/pdf`, con archivos descargados. |
| Navegador: corrección histórica y exportaciones | **3 formularios y 2 descargas correctos** | Confirmación histórica a 390, 768 y 1440 píxeles, con campos originales vacíos, validación y cancelación; exportación real PDF/Excel de septiembre de 2026 para un colaborador. |
| Instalación limpia | **Completada** | Siete empresas, una cuenta administradora y tres roles, sin cargar personal de demostración. |
| Migración | **Repetible y aplicada a la base local** | Conservó las cuentas y registros existentes; completó las organizaciones sin eliminar las adicionales. |
| Respaldo y restauración | **Restauración completada en base aislada** | Se utilizó un respaldo real y un destino diferente de la base de trabajo. |

Las suites aisladas cubren administración/auditoría, contratos/capacitaciones, reglas principales, generación documental, archivos, expediente y roles. Se ejecutaron individualmente con `node --test --test-isolation=none tests/<archivo>.test.js` porque el entorno de ejecución restringía la creación de subprocesos del ejecutor `npm test`. El script normal del proyecto sigue siendo `npm test`.

Los diez recorridos con MySQL abarcaron:

1. Inicio de sesión con la base real de validación.
2. Cuentas y aislamiento de los tres perfiles.
3. Horas, tardanzas, corrección sin duplicados e historial del horario.
4. Progreso de prácticas completo y privacidad de notas internas.
5. Tres documentos PDF, carga y descarga privada.
6. Permisos, aprobación y archivo sustentatorio.
7. Reportes filtrados y seguimiento de RRHH.
8. Auditoría con entidad, registro y estados anteriores/posteriores.
9. Consulta de personal suspendido y revocación por cambio de contraseña.
10. Confirmación del horario original de una asistencia antigua, recálculo y auditoría única; rechazo de posteriores sobrescrituras.

Las pantallas comprobadas fueron login, Dashboard, Empresas, Auditoría, Usuarios y configuración, Recursos Humanos, Ficha individual, Documentos, Contratos, Capacitaciones, Horarios, Asistencia, Reportes y Mi panel. Las comprobaciones registraron carga de datos, errores JavaScript, respuestas HTTP, fallos de red y desbordamientos detectables. En la ejecución documentada no aparecieron errores en esos criterios.

La comprobación focalizada del formulario histórico detectó casillas demasiado anchas en móvil; se corrigió su tamaño y la superposición del botón de navegación. Tras el ajuste, los tres tamaños de pantalla pasaron sin desbordamiento horizontal ni errores JavaScript/HTTP. Se comprobó que el horario vigente no precarga los campos originales faltantes, que la confirmación activa los campos obligatorios y que es posible cancelar sin guardar. El guardado, recálculo y auditoría se validaron en los recorridos HTTP con MySQL.

Las dos descargas de Reportes utilizaron el mismo filtro individual del 1 al 30 de septiembre de 2026. El archivo PDF tiene firma `%PDF-` y conserva ese periodo. El Excel tiene firma ZIP `PK0304`; se volvió a leer con la biblioteca del navegador y contiene las hojas `CONTROL ASISTENCIA`, `RESUMEN`, `DETALLE` y `CRITERIOS`, una sola persona en el resumen y únicamente sus marcaciones en el detalle.

## Corrección posterior del inicio de sesión

Las tres cuentas de la base de trabajo conservan el correo, hash de contraseña, estado y rol del respaldo anterior. Se verificaron las relaciones de sus fichas y la configuración de firma de sesiones. La revisión encontró dos fallos en el frontend: una dependencia obligatoria de los iconos externos podía impedir registrar el manejador del formulario; abrir la pantalla con Live Server enviaba la solicitud a un servidor sin API SBSS.

El login ahora utiliza iconos SVG locales, verifica la identidad del servidor mediante `GET /api/auth/disponibilidad` y habilita los campos después de esa comprobación. Si se abre desde un archivo o servidor de desarrollo, verifica la instalación en el puerto 3000 del mismo equipo/servidor y redirige al formulario correcto. Las pruebas nuevas cubren ausencia de CDN, archivo local, Live Server, red local, puerto personalizado, servidor apagado, reintento y respuestas de error. Se repitieron también las once pruebas de roles. No se restablecieron contraseñas.

En Chrome se comprobaron cuatro recorridos adicionales: login directo a 390 y 1440 píxeles, apertura desde archivo local y apertura desde un servidor estático en el puerto 5500. Las dos últimas rutas redirigieron al login del servidor 3000. Los campos quedaron habilitados, Mostrar/Ocultar funcionó y no aparecieron errores JavaScript ni desbordamientos horizontales. Esta comprobación no envió credenciales de las cuentas reales. La evidencia se conserva en `backend/backups/login/resultados.json` y sus cuatro capturas; `validacion-acceso-local.json` registra la comprobación de las cuentas originales.

## Scripts y evidencia

| Recurso | Función |
| --- | --- |
| [`backend/tests/`](../backend/tests/) | Pruebas aisladas; no se conectan a la base de trabajo. |
| [`verificar-integracion.js`](../backend/scripts/verificar-integracion.js) | Crea datos y ejecuta los recorridos HTTP sobre una base cuyo nombre empieza por `sbss_validacion_`. |
| [`verificar-navegador.js`](../backend/scripts/verificar-navegador.js) | Comprueba pantallas mediante Chrome DevTools Protocol y guarda resultados y capturas. |
| [`verificar-interacciones-navegador.js`](../backend/scripts/verificar-interacciones-navegador.js) | Comprueba los formularios y las tres generaciones PDF desde el navegador. |
| [`verificar-reportes-historico-navegador.js`](../backend/scripts/verificar-reportes-historico-navegador.js) | Descarga y comprueba PDF/Excel filtrados y prueba el formulario histórico en tres anchos. `SBSS_FOCUSED_SCOPE=reportes` o `historico` permite repetir únicamente ese bloque. |
| [`instalar.js`](../backend/scripts/instalar.js) / [`migrar-v1.js`](../backend/scripts/migrar-v1.js) | Preparación nueva y actualización del esquema. |
| [`backup.js`](../backend/scripts/backup.js) / [`restaurar.js`](../backend/scripts/restaurar.js) | Respaldo completo y restauración del SQL en una base vacía distinta. |

La evidencia generada localmente se conserva bajo `backend/backups/`:

- `pruebas-unitarias.txt`: salida de las suites aisladas.
- `validacion-unitarias.json`: conteos por suite.
- `validacion-integracion.json`: fecha, base utilizada y recorridos terminados.
- `validacion-instalacion.json`: instalación limpia y migración repetible.
- `validacion-migracion-local.json`: respaldo previo y conteos antes/después de la actualización local.
- `validacion-servicio-local.json`: comprobación del servidor local y rechazo de accesos a la API sin sesión.
- `validacion-visual/resultados.json`: resultados de las 42 vistas y nombres de sus capturas.
- `validacion-visual/interacciones.json`: cinco interacciones, respuestas PDF y errores JavaScript detectados.
- [`validacion-visual/reportes-historico-1789827611768/reportes-exportacion.json`](../backend/backups/validacion-visual/reportes-historico-1789827611768/reportes-exportacion.json): dos exportaciones comprobadas; la misma carpeta contiene el PDF, el Excel y la captura del reporte filtrado.
- [`validacion-visual/reportes-historico-1789827686100/resultados.json`](../backend/backups/validacion-visual/reportes-historico-1789827686100/resultados.json): tres formularios históricos correctos después del ajuste; incluye capturas de los campos y botones finales en cada ancho.
- `validacion-visual/`: capturas y archivos PDF descargados.
- Carpetas fechadas de respaldo: SQL, manifiesto y componentes incluidos en la copia.

Estas evidencias y respaldos están excluidos de Git. Las referencias a ellos describen archivos de la ejecución local; no implican que se distribuyan con el repositorio. `validacion-sesion.json` contiene sesiones de prueba para automatizar Chrome y es privado: no debe incorporarse a informes públicos ni al control de versiones.

Para reproducir las comprobaciones con datos reales, primero restaura un respaldo en una base separada y aplica la migración allí. El verificador de integración escribe registros de prueba y rechaza nombres de base sin el prefijo `sbss_validacion_`. La opción `--servir` mantiene la instancia de validación en `127.0.0.1:3101` para los recorridos de navegador. Chrome debe utilizar un perfil temporal separado; los scripts consultan su puerto de depuración, por defecto 9224.

La actualización de la base de trabajo conservó las 3 cuentas, 8 fichas, 11 asistencias, 3 permisos y 7 documentos registrados. Se agregaron cuatro organizaciones requeridas: quedaron las siete del documento y la organización adicional que ya existía. No se modificaron las contraseñas existentes. La evidencia de la migración identifica el respaldo completo creado antes de realizarla.

## Alcance pendiente de aceptación

### Documentos de demostración en la base existente

La comprobación de los siete registros documentales de la base local encontró dos archivos privados disponibles y cinco referencias de demostración sin archivo físico. Los registros 1 a 5 coinciden con los datos de ejemplo de `backend/base-actualizada.sql`; sus PDF no aparecen en el proyecto ni en sus respaldos. La migración conservó esos registros y no creó documentos ficticios.

| Registro | Referencia existente que necesita un archivo real |
| --- | --- |
| 1 | `DNI_Agreda_Yenci.pdf` |
| 2 | `CV_Agreda_Yenci.pdf` |
| 3 | `DNI_Paredes_Carlos.pdf` |
| 4 | `Convenio_Paredes_Carlos.pdf` |
| 5 | `DNI_Yamanaka_Luciana.pdf` |

Desde **Documentos**, se debe seleccionar la persona y el tipo correspondiente y cargar el documento real como nueva versión. El responsable debe revisar también la correspondencia del tipo documental del registro antiguo. Los nombres de ejemplo no acreditan que se disponga de esos documentos; este pendiente requiere los archivos originales de SBSS.

### Alcance de las pruebas

- Los tamaños de pantalla se emularon en Chrome; no equivalen a una prueba física en cada teléfono o tablet ni cubren todos los navegadores.
- Las vistas, cinco interacciones iniciales y cinco comprobaciones focalizadas comprueban recorridos concretos, no cada combinación posible de campos, volumen de datos o concurrencia.
- Los recorridos con MySQL utilizaron una copia y datos de validación. SBSS debe revisar datos operativos, metas, tolerancias, indicadores, textos de documentos y asignación de perfiles antes de aceptar su uso habitual.
- Los PDF incluyen espacio para firma. No incorporan firma digital; su contenido y emisión necesitan la revisión del responsable.
- No se solicitó publicación en un alojamiento externo. La comprobación local no certifica una infraestructura externa, su dominio, HTTPS, disponibilidad ni política operativa de respaldos.
- Algunas pantallas utilizan recursos CDN; las comprobaciones se realizaron con esos recursos disponibles.
- La restauración descrita corresponde al esquema de la aplicación. Extensiones ajenas, como rutinas o eventos SQL añadidos a otra instalación, requieren validación adicional.

Los procedimientos de operación están en [MANUAL_USUARIO.md](MANUAL_USUARIO.md). Este registro no expresa una garantía de ausencia de defectos ni una aprobación de negocio: documenta qué se implementó, qué se comprobó y dónde se conserva la evidencia.
