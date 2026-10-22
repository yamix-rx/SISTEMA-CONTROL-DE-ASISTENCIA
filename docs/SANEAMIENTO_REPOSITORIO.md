# Saneamiento de secretos del repositorio

## Preparado localmente

- La clave JWT anterior se sustituyó por una clave aleatoria nueva. Los procesos deben usar la configuración actual al iniciarse.
- La contraseña MySQL actual no coincide con las contraseñas de los respaldos antiguos revisados. La clave para descifrar los logos no se cambió.
- Se retiraron del índice 1.030 archivos de `backend/backups/`, sin eliminarlos del disco. La eliminación de seguimiento está preparada en Git para su revisión.
- `.gitignore` excluye respaldos, sesiones, archivos subidos, configuraciones privadas y los PDF de referencia de `Documentos/`. `.env.example` se conserva como plantilla pública sin secretos.
- Los respaldos nuevos omiten `.env` por defecto. La opción `--incluir-configuracion` queda reservada a respaldos completos privados.

## Alcance remoto pendiente de autorización

Las ramas consultadas antes de publicar cambios son:

| Rama | Commit remoto observado |
| --- | --- |
| `main` | `24938ddca16ffa508258279237a0a5e4170333bc` |
| `yenci` | `57453751acb5af61ffc69332420f403b94a85485` |

La operación propuesta es preservar una copia privada recuperable del repositorio, publicar las correcciones y retirar `backend/backups/` de todos los commits alcanzables de las ramas remotas. Antes de escribir se deben volver a consultar las referencias y detenerse si alguien ha publicado cambios nuevos. Revisar también otros archivos de entorno privados que aparezcan en el historial; conservar las plantillas `.env.example` sin secretos.

La publicación de una historia saneada requiere actualizar las ramas remotas con protección frente a cambios concurrentes. Cambiará los identificadores de los commits afectados y quienes tengan clones deberán sincronizarlos o clonarlos de nuevo. No se debe realizar una actualización forzada sin autorización del propietario. GitHub puede conservar referencias adicionales, forks o cachés; retirar los secretos del historial no reemplaza su rotación ni la coordinación con colaboradores.
