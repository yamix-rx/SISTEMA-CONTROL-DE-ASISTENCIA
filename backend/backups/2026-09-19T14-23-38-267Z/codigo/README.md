Sistema Web de Gestión de Personal SBSS

Aplicación con Node.js, Express y MySQL para personal, prácticas, horarios, asistencia, permisos, documentos, reportes y control de accesos.

La aplicación se abre desde el servidor (`http://localhost:3000` en la instalación local). El backend entrega también el frontend; las llamadas a la API utilizan el mismo origen y funcionan al acceder desde otro equipo mediante la dirección del servidor.

- [Instalación, actualización, respaldo y restauración](docs/INSTALACION.md)
- [Manual de usuario por perfil](docs/MANUAL_USUARIO.md)
- [Validación técnica V1: alcance, comprobaciones y evidencia](docs/VALIDACION_V1.md)
- [Diagrama de la base de datos](Diagramas/DiagramaBD.mmd)

Requisitos de la instalación validada: Node.js 24 y MySQL 8. Desde `backend`, ejecutar `npm ci`, preparar `.env` siguiendo `.env.example` y consultar el manual antes de elegir `npm run instalar` (base nueva) o `npm run migrar` (base existente, con respaldo previo). Iniciar con `npm start`.

`npm test` ejecuta pruebas aisladas con datos simulados. El script `backend/scripts/verificar-integracion.js` solo acepta una base separada cuyo nombre comience con `sbss_validacion_`; crea datos de prueba y nunca debe ejecutarse contra la base de trabajo. Las comprobaciones de navegador requieren Chrome con un perfil temporal separado y la configuración privada generada por ese script.

Las credenciales, documentos y respaldos quedan fuera del control de versiones y del directorio público. La cuenta administradora inicial se configura por variables de entorno; no se incluye una contraseña compartida de instalación.
