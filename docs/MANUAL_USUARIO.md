# Manual de usuario SBSS

## Acceso y perfiles

Abrir la dirección proporcionada por SBSS e iniciar sesión con correo y contraseña. El perfil determina el menú. El Administrador General gestiona empresas, usuarios y configuración; Recursos Humanos gestiona personal, horarios, asistencia, permisos, documentos y reportes. Trabajadores y practicantes consultan solamente su información en **Mi panel**.

**Cerrar sesión** invalida los accesos anteriores de la cuenta. Si se pierde la conexión, volver a intentar el cierre hasta recibir confirmación. El administrador puede restablecer contraseñas y desactivar cuentas. Tras varios intentos de login rechazados, esperar el tiempo indicado antes de volver a intentar.

## Preparación inicial

En **Empresas**, comprobar las organizaciones y completar sus datos. En **Usuarios y configuración**, crear las áreas y cargos asociados a cada empresa. Un área o cargo con personal asociado no puede trasladarse a otra organización.

Los tipos de documento se administran en **Usuarios y configuración → Documentos**: nombre, descripción y entrega obligatoria u opcional. Marcar un documento como obligatorio lo incluye en el seguimiento de todos los expedientes. Los tipos de permiso se administran en **Permisos** dentro de esa misma pantalla. Cambiar su nombre conserva el texto de los permisos históricos.

## Personal y practicantes

En **Registro Personal**, elegir **Nuevo personal**, completar identificación, empresa, área, cargo y fecha de ingreso. El DNI debe tener 8 dígitos. CE o pasaporte admiten entre 6 y 15 letras o dígitos. El puesto es un campo separado del cargo. Se pueden registrar datos de contacto, formación, finalización y observaciones internas; el trabajador no ve las observaciones de RR. HH.

Elegir el vínculo y estado correspondientes: activo, inactivo, finalizado o suspendido. Para practicantes se asignan 320 horas por defecto o una meta positiva distinta, con hasta dos decimales. El vencimiento del convenio es independiente de la fecha de finalización de la ficha.

La ficha muestra horas realizadas, pendientes, porcentaje y barra de progreso. Solo alcanza 100 % cuando se cumple la meta. El estado cambia a **HORAS DE PRÁCTICAS COMPLETADAS**. Los datos antiguos con vínculo **Practicante (registro anterior)** pueden conservarse o clasificarse expresamente como profesionales o preprofesionales.

El buscador combina nombre, apellido, documento, empresa, área, cargo y puesto con filtros de organización y estado. **Practicantes** abre la vista específica. El expediente reúne datos, horarios, asistencias, tardanzas, permisos y documentos, con acceso a reportes.

## Horarios y asistencia

En **Horarios**, seleccionar a la persona, los días, entrada, salida y tolerancia. Indicar turno nocturno si la salida corresponde al día siguiente. Un día puede marcarse como descanso. Cambiar el horario conserva la programación guardada con las asistencias anteriores.

En **Asistencia**, seleccionar una fecha y registrar manualmente ingreso, salida, estado y observación. Estados: presente, falta, tardanza, permiso, descanso, feriado, vacaciones y justificado. Las horas y tardanzas se calculan automáticamente. Los estados administrativos sin trabajo no suman horas. No se permiten fechas futuras.

Una corrección actualiza el registro diario sin duplicarlo y queda auditada. Si un registro antiguo no conserva su horario original, para cambiar el cálculo se debe confirmar esa programación y explicar el motivo. No deducirla del horario actual. Una observación puede corregirse conservando los cálculos históricos.

Consultar tardanzas diarias, semanales, mensuales o trimestrales. La tolerancia de cada horario determina cuándo se considera tardanza; una vez excedida, se cuenta la diferencia completa respecto de la entrada programada.

## Permisos

En **Permisos**, seleccionar trabajador, tipo, fechas, horas cuando correspondan, motivo y observaciones. Adjuntar sustento si existe. El permiso inicia como **Solicitado**; RR. HH. puede aprobarlo o rechazarlo. Se conservan el historial y sus archivos. El permiso y el estado diario de asistencia son registros separados: RR. HH. debe registrar también el estado de asistencia que corresponda.

## Documentos

En **Documentos**, filtrar por persona, empresa, tipo, búsqueda y estado. Subir PDF, DOC, DOCX, PNG o JPG/JPEG de hasta 5 MB. La carga crea una versión pendiente y conserva la anterior. Revisar el archivo y validarlo u observarlo; una observación requiere motivo.

Si aparece **Archivo no disponible: volver a cargar**, el registro histórico existe pero falta su archivo. Elegir **Subir nueva versión** y adjuntar el original. El sistema no elimina ni reconstruye documentos ausentes. El trabajador recibe una indicación para contactar a RR. HH. y solo puede descargar sus propios archivos disponibles.

En **Generar documentos**, elegir aceptación, constancia o culminación, persona, empresa, área, cargo, fecha y horas. Revisar la vista previa y descargar PDF. Las plantillas son editables. Si cambian después de la vista previa, se exige regenerarla. Para incorporar el PDF generado al expediente, cargarlo en Documentos con el tipo correspondiente.

- **Constancia de prácticas:** genera el convenio de pasantía UPN con su plan de capacitación. El modelo se selecciona por carrera; están disponibles Sistemas, Industrial, Administración de Empresas, Administración y Marketing, Comunicación Audiovisual, Comunicación y Periodismo, Derecho y Administración y Negocios Internacionales. Completar horario, representantes y condiciones que falten. Utiliza la fecha de vencimiento del convenio registrada en la ficha, si existe.
- **Carta de culminación:** genera el certificado de la empresa (SBSS, ONG, Nanas y Amas, Silsan o Cámara). Completa fechas de inicio y finalización, horas realizadas, carrera e institución. Revisar las actividades sugeridas y ajustarlas a las efectivamente realizadas. El lema institucional es opcional. ONG conserva el formato A4 horizontal del modelo.

Los ajustes realizados antes de generar se aplican únicamente al documento. **Editar datos** permite volver al formulario; **Descargar PDF** e **Imprimir** usan el mismo archivo de la vista previa.

## Dashboard y reportes

El inicio de RR. HH. muestra personal, asistencia y seguimiento de prácticas. Las alertas incluyen metas desde el 80 %, prácticas completadas, convenios próximos a vencer en 30 días, acumulación de al menos tres tardanzas mensuales y documentación pendiente. Los umbrales son reglas de seguimiento del sistema.

En **Reportes**, elegir periodo diario, semanal, mensual, trimestral o personalizado. Combinar empresa, persona, área, cargo, vínculo, fechas y estado. Pulsar **Filtrar** y descargar PDF o Excel. Al modificar un filtro se debe actualizar el reporte antes de exportarlo.

El porcentaje de asistencia usa los días registrados evaluables; no convierte automáticamente los días sin registrar en faltas. Las horas del periodo respetan filtros; las acumuladas y pendientes consideran el historial hasta la fecha final. Los criterios se muestran en pantalla y en la exportación.

## Auditoría e incidencias

El administrador consulta **Auditoría** por usuario, entidad, acción y fechas. Las escrituras HTTP de gestión se confirman junto con su historial; si no se puede guardar la auditoría, la operación no se confirma. Reintentar después de resolver la conexión, comprobando primero el resultado mostrado.

Ante un error, conservar el mensaje, módulo, fecha y acción realizada y comunicarlo al responsable técnico. Nunca enviar contraseñas, tokens ni respaldos por un canal público. Consultar `docs/INSTALACION.md` para respaldo y recuperación.
