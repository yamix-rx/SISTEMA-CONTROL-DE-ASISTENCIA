# Manual de usuario — SBSS V1

SBSS centraliza las fichas, horarios, asistencias, permisos, horas de prácticas y documentos del personal. Abre la dirección proporcionada por el administrador e inicia sesión con tu correo y contraseña.

## Perfiles de acceso

| Perfil | Operaciones |
| --- | --- |
| Administrador General | Gestión del sistema, empresas, cuentas, áreas, cargos y consulta de auditoría; también las funciones de RRHH. |
| Recursos Humanos | Gestión de personal, horarios, asistencias, permisos, documentos, plantillas, seguimiento de horas y reportes. |
| Trabajador/Practicante | Consulta de su propio expediente, horario, historial, horas, permisos y documentos; descarga de sus archivos. |

El menú muestra los módulos habilitados para la cuenta. Los trabajadores no pueden modificar asistencias ni acceder a expedientes ajenos. Las observaciones internas de RRHH quedan reservadas a la gestión del personal.

Usa **Salir** al terminar. Si no recuerdas tu contraseña, solicita al administrador de SBSS que la restablezca. Al cambiar el perfil, estado o contraseña de una cuenta, sus sesiones anteriores dejan de funcionar y deberá iniciar sesión nuevamente.

## Empresas, áreas, cargos y usuarios

Como administrador, comprueba las organizaciones en **Empresas**. En **Usuarios y configuración** puedes crear y editar las áreas de cada empresa y los cargos de cada área. Si un área o cargo ya tiene personal asignado, no puede trasladarse a otra organización; crea uno nuevo y actualiza las fichas correspondientes.

Para crear una cuenta:

1. Registra primero la ficha del colaborador.
2. En **Usuarios y configuración**, selecciona al colaborador que aún no tiene cuenta.
3. Indica el correo, el perfil y una contraseña inicial de al menos 10 caracteres. El límite es 72 bytes UTF-8; los caracteres como tildes o emoji pueden ocupar más de un byte.
4. Guarda y entrega el acceso directamente a su titular.

Cada ficha admite una cuenta y cada correo identifica una sola cuenta. En la lista puedes editar correo, perfil y estado o utilizar **Contraseña** para restablecer el acceso. El sistema impide desactivar o quitar el perfil administrador a la propia cuenta y exige conservar un administrador activo.

## Registro y expediente del personal

En **Personal**, registra la identificación, datos de contacto, formación, empresa, área, cargo, fechas de ingreso y finalización, vínculo y estado. Las opciones de empresa, área y cargo deben corresponder entre sí.

Los vínculos son trabajador, practicante preprofesional, practicante profesional, voluntario u otro. Los estados son activo, inactivo, finalizado y suspendido. Utiliza las observaciones internas para anotaciones de RRHH.

Para un practicante, configura su meta de horas. Se puede utilizar 320 horas o una cantidad diferente. La ficha muestra horas realizadas, pendientes y porcentaje de avance. Al cumplir la meta aparece **HORAS DE PRÁCTICAS COMPLETADAS**. Cambiar la meta ajusta el progreso; no modifica las asistencias ya registradas.

Abre la ficha individual para revisar sus datos, horario, registros de asistencia, tardanzas, permisos, documentos y seguimiento de horas. Los enlaces de documentos conservan el colaborador seleccionado.

## Horarios

En **Horarios**, selecciona al colaborador, los días de trabajo, hora de entrada, hora de salida y tolerancia. La V1 administra un horario por colaborador y día de la semana. Puedes modificarlo o dejarlo inactivo según corresponda.

La tolerancia inicial es cero minutos. Si se configura una tolerancia, solo se considera tardanza cuando la diferencia supera ese valor; entonces los minutos contabilizados corresponden a toda la diferencia respecto a la hora programada. Ejemplo: ingreso 08:17 frente a horario 08:00, con tolerancia cero, produce 17 minutos.

Para jornadas que terminan al día siguiente, asigna un horario nocturno con salida anterior a entrada en el reloj. La aplicación necesita esa programación para interpretar el cruce de medianoche.

## Asistencia diaria y tardanzas

En **Asistencia**, selecciona fecha y colaborador y pulsa **Registrar Asistencia**. Completa el ingreso, la salida, el estado y la observación cuando corresponda.

Los estados disponibles son presente, falta, tardanza, permiso, descanso, feriado, vacaciones y justificado. Las horas y los minutos de tardanza se calculan desde la marcación y el horario. Una salida sin ingreso no se admite. Para estados sin trabajo efectivo, como falta o descanso, no se acumulan horas de trabajo.

Puedes registrar primero el ingreso y completar después la salida. Registrar otra vez al mismo colaborador en la misma fecha actualiza esa jornada; no crea una segunda jornada. Revisa el trabajador y la fecha antes de guardar una corrección. El historial identifica al usuario que efectuó los cambios.

Las horas calculadas son la diferencia entre ingreso y salida: no hay una deducción automática de refrigerio. El horario aplicado a una asistencia registrada se conserva para no recalcular su historial al cambiar la programación futura.

Si al editar una asistencia antigua aparece el aviso **La programación original de este registro está incompleta**, puedes completar la salida manteniendo el ingreso y la tardanza ya registrada. Para corregir el ingreso o completar la programación original:

1. Selecciona la fecha y pulsa **Editar** en la fila del colaborador.
2. Comprueba el horario que correspondía a esa fecha en la fuente disponible, por ejemplo, un horario firmado o una constancia validada por RRHH.
3. Marca **He verificado la programación original y deseo completar los datos faltantes**.
4. Completa la entrada programada original, la salida programada original y la tolerancia en minutos. Si la jornada termina al día siguiente, marca **La salida corresponde al día siguiente**. Los valores que ya estaban registrados se muestran sin permitir modificarlos.
5. Escribe el **Motivo y fuente de la confirmación**, corrige la marcación y pulsa **Guardar**.

El sistema completa la programación faltante y recalcula horas y tardanzas en la misma operación. La auditoría conserva el responsable, el motivo y los valores anteriores. El horario vigente no se copia automáticamente al registro antiguo. Sin confirmar la programación original, un cambio de ingreso que necesite recalcular la tardanza se rechaza; revisar otra fecha o cerrar el formulario no guarda cambios.

En el bloque de tardanzas puedes consultar número de incidencias y minutos acumulados para los periodos disponibles y combinar filtros de personal. Los días sin asistencia registrada no se convierten automáticamente en faltas: RRHH debe registrarlos con el estado correcto.

## Permisos y sustentos

En **Asistencia**, utiliza el bloque **Permisos** y pulsa **Nuevo Permiso**.

1. Selecciona al colaborador y el rango de fechas.
2. Completa las horas desde/hasta cuando el permiso cubra una parte del día.
3. Indica tipo, motivo y observaciones.
4. Adjunta el sustento si corresponde: PDF, Word DOC/DOCX, JPG/JPEG o PNG, hasta 5 MiB.
5. Guarda. El registro queda **Solicitado**; RRHH puede aprobarlo o rechazarlo.

El historial mantiene trabajador, fechas, motivo, observaciones, estado y archivo real. El trabajador puede consultar sus permisos y abrir su propio sustento desde **Mi panel**. Las solicitudes creadas directamente por el trabajador desde su perfil no forman parte de esta V1.

El permiso y la asistencia son registros distintos. Revisa también el estado de asistencia de la jornada afectada; aprobar un permiso no reemplaza la marcación diaria de RRHH.

## Carpeta digital

En **Documentos**, busca por nombre/DNI y combina los filtros de empresa, tipo y estado. Puedes entrar también desde la ficha de una persona.

- **Sin entregar:** falta un tipo de documento marcado como obligatorio.
- **Por revisar:** existe un archivo pendiente de validación.
- **Validado:** RRHH confirmó el documento.
- **Observado:** debe corregirse; el motivo queda visible en el detalle.

Usa **Subir documento**, selecciona colaborador, tipo y archivo. Se admiten PDF, DOC, DOCX, JPG/JPEG y PNG de hasta 5 MiB. El sistema comprueba el formato del contenido además de la extensión.

Al subir otra versión del mismo tipo, la anterior se conserva y la nueva queda pendiente. La lista y las revisiones trabajan sobre la versión más reciente. Para observar un archivo, escribe un motivo antes de guardar. Si otra persona carga una versión mientras revisas, actualiza la pantalla antes de intentar validar de nuevo.

Los documentos pueden visualizarse o descargarse. Los archivos Word se descargan para abrirlos en una aplicación compatible cuando el navegador no ofrece una vista propia. La descarga desde **Mi panel** está limitada al titular del expediente.

## Generar documentos y editar plantillas

En **Documentos**, pulsa **Generar documento** o una de las tarjetas:

- Carta de aceptación.
- Constancia de prácticas.
- Carta de culminación de prácticas.

El selector conserva también carta de presentación, constancia de horas y certificado de trabajo. El certificado de trabajo requiere vínculo de trabajador.

Selecciona el colaborador, tipo de documento, empresa, fecha de emisión, área, cargo y horas. Los datos se completan desde el expediente. En aceptación se propone la meta de horas; en los demás documentos se proponen las horas registradas. Puedes ajustar el número de horas del documento antes de emitirlo. Este ajuste no cambia la meta ni la asistencia de la persona.

Pulsa **Abrir vista previa**, revisa el contenido y utiliza **Descargar PDF**. La descarga entrega un archivo PDF directamente. **Editar datos** permite volver al formulario. El documento incluye espacio para la firma del responsable; no incorpora una firma digital automática.

Para cambiar textos, pulsa **Editar plantillas**. Selecciona el tipo, modifica título y contenido y guarda. Los cambios afectan a los documentos que se generen después. No alteran archivos previamente descargados.

Los botones de campos insertan marcadores como `{{trabajador}}`, `{{empresa}}`, `{{documento}}`, `{{fecha}}`, `{{cargo}}`, `{{area}}` o `{{horas}}`. Se reemplazan por los datos seleccionados al generar. El editor acepta texto y saltos de línea; no admite etiquetas HTML ni campos desconocidos.

Si la plantilla cambia después de abrir la vista previa, el sistema solicita generar una nueva vista antes de descargar. Para conservar el PDF emitido dentro del expediente, súbelo desde **Subir documento** con su tipo correspondiente.

## Reportes

En **Reportes**, selecciona el periodo diario, semanal, mensual o trimestral, o ajusta las fechas. Combina empresa, trabajador, área, cargo y estado de asistencia según la consulta necesaria. Genera el reporte y utiliza las acciones **PDF** o **Excel**.

Los resultados incluyen asistencias, faltas, tardanzas, minutos, horas del periodo, horas pendientes, permisos y porcentaje de asistencia. Los archivos exportados utilizan los datos y filtros de la consulta.

El porcentaje de asistencia se calcula así:

> Registros presentes, con tardanza o justificados que tienen hora de ingreso, divididos entre los días registrados como presente, tardanza, falta o justificado, multiplicado por 100.

No entran en ese denominador los días sin registrar, permisos, descansos, feriados o vacaciones. Sin días evaluables, el porcentaje queda sin dato. Si filtras un estado, también reduces el conjunto con el que se calcula el porcentaje. Consulta la explicación del criterio que acompaña el reporte para interpretarlo correctamente.

Las horas del periodo responden a las fechas y filtros elegidos. Las horas acumuladas y pendientes consideran el historial hasta la fecha final del reporte. El conteo de permisos considera los permisos que se cruzan con el rango consultado; se muestran además los aprobados.

## Dashboard y alertas

El dashboard permite revisar personal activo y programado hoy, asistencias, faltas, tardanzas, permisos y documentos obligatorios pendientes. El bloque de prácticas muestra las barras de avance individual y enlaces al expediente.

En esta versión se utilizan estos criterios de seguimiento:

| Alerta | Criterio |
| --- | --- |
| Próximo a completar prácticas | Desde 80 % de avance, con horas aún pendientes. |
| Prácticas completadas | Horas registradas iguales o superiores a la meta. |
| Vencimiento próximo | Contrato o convenio vigente registrado en Contratos con fecha de fin dentro de los próximos 30 días. |
| Acumulación de tardanzas | Tres o más tardanzas con minutos positivos en el mes actual. |
| Documentación pendiente | Tipo obligatorio sin archivo cargado. |

Las alertas son consultas de la información registrada: utiliza los enlaces para revisar y corregir el expediente. La V1 no envía notificaciones por WhatsApp o correo.

## Mi panel

El perfil Trabajador/Practicante entra a **Mi panel**. Allí consulta sus datos, horario, avance de horas, asistencia, tardanzas, permisos y documentos. Puede refrescar la información y descargar sus archivos o sustentos disponibles.

Si un dato es incorrecto, solicita su revisión a RRHH. El panel personal no permite editar asistencia, autorizar permisos ni ver observaciones internas o registros de otras personas.

## Auditoría y soporte

El Administrador General puede consultar **Auditoría** y filtrar por usuario, acción, módulo y fechas. Se registran accesos y cambios relevantes, con los estados anteriores y posteriores cuando corresponden. Las contraseñas, tokens y contenidos binarios se ocultan del detalle.

Si una operación falla, conserva el mensaje mostrado y la fecha/hora para que el responsable pueda revisarlo. Un respaldo y una restauración verificada son parte de la operación del sistema; el administrador dispone de los pasos en [INSTALACION.md](INSTALACION.md).
