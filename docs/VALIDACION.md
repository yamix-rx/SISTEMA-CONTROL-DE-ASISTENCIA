# Validación de las correcciones

Fecha: 19 de octubre de 2026. Base del código revisado: commit `24938dd`; correcciones preparadas en el directorio de trabajo.

## Comprobaciones realizadas

| Comprobación | Resultado |
| --- | --- |
| Backend: reglas, autorización, documentos, auditoría y regresiones | 142 pruebas aprobadas, sin fallos |
| Frontend: integridad, recursos locales y bibliotecas de exportación | 8 pruebas aprobadas, sin fallos |
| Instalación nueva y restauración en bases aisladas | 18 tablas, siete organizaciones, tres perfiles y administrador verificados |
| Integración con MySQL real | 11 recorridos originales aprobados |
| Nuevos formularios con Chrome, API y MySQL reales | Cuatro recorridos aprobados: tipos documentales, tipos de permiso, uso del catálogo y validación del personal |
| Seguridad con MySQL real | Tres comprobaciones aprobadas: reversión ante fallo real de auditoría, revocación de sesión y detección de archivos ausentes |
| Interacciones de documentos | Cinco comprobaciones aprobadas; aceptación, constancia y culminación descargadas como PDF válido |
| Reportes e historial | Cinco comprobaciones aprobadas; exportación PDF/Excel y corrección de programación histórica |
| Navegador con red externa bloqueada | 51 vistas revisadas a 1440, 768 y 390 píxeles; tras los últimos ajustes se repitieron las nueve vistas afectadas de Administración y Documentos |
| Formularios de prácticas con API simulada | Siete comprobaciones de interfaz aprobadas; no se usó la base real para estos casos |
| Botones de horario, asistencia y permisos | Nueve recorridos con clics reales: formularios visibles en tres tamaños, apertura y cierre, guardado de horario y asistencia en la base aislada, edición y programación histórica |

Las pruebas unitarias usan SQL simulado y archivos temporales. Los recorridos que crean datos utilizan exclusivamente bases con prefijo `sbss_validacion_`. Sus credenciales y sesiones no se publican. Las evidencias privadas están en `backend/backups/`; los scripts reproducibles están en `backend/scripts/`.

Se corrigió además la migración de instalaciones antiguas que no tenían `tipo_documentos.descripcion`. Tras un respaldo se añadió esa columna nullable, conservando los datos. Se comprobó Administración contra la base principal real y en Chrome a 1440, 768 y 390 píxeles: cuatro usuarios, seis áreas, ocho cargos, seis tipos documentales y cinco tipos de permiso cargaron correctamente. Las consultas HTTP devolvieron 200 y no hubo errores de JavaScript ni desbordamientos. Evidencias privadas: `backend/backups/validacion-configuracion-real/`.

Se corrigió la apertura de formularios de horario, asistencia y permiso: el JavaScript conservaba `d-none` de Bootstrap y alternaba clases antiguas que no mostraban el contenido. También se corrigieron los campos históricos, el botón de eliminación de horarios y los mensajes de resultado. Las comprobaciones anteriores de carga de pantalla no cubrían esta interacción; la nueva prueba exige dimensiones reales mayores que cero, verifica que los controles no estén tapados y utiliza eventos de ratón. El guardado de prueba confirmó ocho horas y 17 minutos de tardanza. Evidencias privadas: `backend/backups/validacion-botones/`; reproducción: `backend/scripts/verificar-botones-registro.js` con su sesión aislada de validación.

La migración de la base principal se aplicó después de crear un respaldo. Se conservó la información existente y se amplió el tamaño de la meta de horas. Se retiraron del índice de Git los respaldos, conservando sus archivos locales. Se cambió la clave JWT expuesta; la clave de cifrado de los logos se conservó.

## Datos que requieren originales

De los nueve documentos existentes en la base principal, dos archivos están disponibles y siete necesitan volver a cargarse. Se buscaron copias exactas en los archivos privados, los respaldos y las referencias de `Documentos/`. Esa carpeta contiene modelos de cartas, certificados y convenios; no proporciona los siete originales ausentes. No se fabricaron documentos ni se sustituyeron identidades. Los registros históricos se conservan y la interfaz explica cómo subir una nueva versión.

El detalle por registro está en el informe privado `backend/backups/revision-documentos.json`. Ejecutar `npm run revisar:documentos` después de cargar los originales para actualizarlo.

## Publicación e historial

Los cambios están preparados localmente. El repositorio remoto todavía conserva su historial anterior. Publicar las correcciones y retirar respaldos del último estado no elimina copias en commits antiguos. La purga histórica requiere autorización para reescribir las ramas remotas y coordinación con quienes tengan clones. La entrega no se considera completamente saneada en GitHub hasta resolver ese paso.
