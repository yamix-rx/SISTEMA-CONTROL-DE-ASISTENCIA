# Recursos locales y compilación del frontend

El frontend sirve estilos, iconos, bibliotecas de exportación y fuentes desde el mismo servidor SBSS. No necesita Tailwind CDN, unpkg, jsDelivr ni Google Fonts al abrir las páginas. El navegador sí debe poder conectarse al backend y este a MySQL; esto no convierte el sistema en una aplicación que opere sin servidor.

`frontend/vendor/` forma parte de la entrega. Sus archivos ya están preparados: iniciar el backend con `npm start` no requiere ejecutar herramientas de frontend ni descargar recursos de internet. Los paquetes de `frontend/node_modules/` solo se utilizan para reconstruir los archivos distribuidos y no se publican como recursos web.

## Versiones y procedencia

Versiones fijadas en `frontend/package.json` y `frontend/package-lock.json`, verificadas en el registro npm y los proyectos oficiales el 19 de septiembre de 2026:

| Componente | Versión | Recurso distribuido | Licencia y fuente oficial |
| --- | --- | --- | --- |
| Tailwind CSS | 3.4.19 | `vendor/tailwind/tailwind.min.css` | MIT; [versión 3.4.19](https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.19) |
| Lucide | 1.47.0 | `vendor/lucide/lucide.min.js` | ISC; [proyecto Lucide](https://github.com/lucide-icons/lucide/releases/tag/1.47.0) |
| jsPDF | 4.2.1 | `vendor/jspdf/jspdf.umd.min.js` | MIT; [versión 4.2.1](https://github.com/parallax/jsPDF/releases/tag/v4.2.1) |
| jsPDF AutoTable | 5.0.8 | `vendor/jspdf-autotable/jspdf.plugin.autotable.min.js` | MIT; [proyecto AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) |
| xlsx-js-style | 1.2.0 | `vendor/xlsx-js-style/xlsx.bundle.js` | Apache-2.0; [proyecto xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) |
| Fontsource Inter Variable | 5.3.0 | `vendor/fonts/fonts.css` y archivos WOFF2 | SIL OFL-1.1; [Inter en Fontsource](https://fontsource.org/fonts/inter) |
| Fontsource Fraunces Variable | 5.3.0 | `vendor/fonts/fonts.css` y archivos WOFF2 | SIL OFL-1.1; [Fraunces en Fontsource](https://fontsource.org/fonts/fraunces) |

Se conserva la rama 3 de Tailwind para mantener las utilidades y estilos existentes. El CSS se compila durante la preparación de la entrega, según el [flujo de compilación de Tailwind 3](https://v3.tailwindcss.com/docs/installation); el navegador no ejecuta un compilador de Tailwind.

jsPDF sustituye la antigua versión 2.5.2 por 4.2.1, cuya publicación incluye correcciones de seguridad. AutoTable 5.0.8 admite jsPDF 4. Las distribuciones de navegador conservan las llamadas `window.jspdf.jsPDF` y `doc.autoTable()` utilizadas por Reportes. [Cambios de jsPDF 4.2.1](https://github.com/parallax/jsPDF/releases/tag/v4.2.1), [uso del complemento AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable).

xlsx-js-style 1.2.0 conserva los colores, bordes, formatos de horas y API `XLSX` existentes. El proyecto solo lo utiliza para exportar datos del sistema; no ofrece importación de archivos Excel. Es la versión publicada del proyecto, que incorpora SheetJS 0.18.5. [API y motor del proyecto](https://github.com/gitbrent/xlsx-js-style).

Las fuentes incluyen latín y latín extendido, con tildes y ñ, pesos variables y el tamaño óptico de Fraunces. Se mantienen los nombres CSS `Inter` y `Fraunces` para conservar la interfaz. No se distribuyen estilos cursivos porque la pantalla de acceso no los utiliza. [Instalación local de Fontsource](https://fontsource.org/docs/getting-started/install).

Las licencias completas están en `frontend/vendor/licenses/`; no deben eliminarse de la distribución. El manifiesto `frontend/vendor/manifest.json` identifica versiones, origen, integridad de paquetes npm y SHA-256 de cada archivo distribuido. Los UMD se copian de los paquetes oficiales quitando únicamente los comentarios `sourceMappingURL`, porque no se distribuyen mapas de depuración. Los avisos de licencia incluidos en los archivos se conservan.

`frontend/.gitattributes` conserva los bytes de `vendor/` al clonar en Windows o Linux, evitando que la conversión automática de finales de línea altere los hashes.

## Reconstrucción reproducible

Requiere Node.js 24 o posterior. Desde la raíz del proyecto:

```powershell
cd frontend
npm ci --ignore-scripts
npm run build
npm run verify:assets
npm test
```

La primera instalación necesita internet o una caché npm previamente preparada. El archivo lock fija también las dependencias transitivas. La compilación usa PostCSS 8.5.28 y cssnano 9.0.5, declarados como herramientas de desarrollo; no se modifica el paquete del backend. `--ignore-scripts` evita ejecutar scripts de instalación de las dependencias.

`scripts/build-assets.js` compila `styles/tailwind.css`, analiza las clases de todas las páginas y de `js/**/*.js`, y copia las bibliotecas, fuentes y licencias. `tailwind.config.js` contiene la configuración de estilos. Las rutas de análisis son absolutas durante la compilación, por lo que no dependen de la carpeta desde la que se invoque el script. El manifiesto no incluye una fecha variable: los mismos archivos y dependencias producen los mismos recursos.

Después de cambiar HTML, JavaScript o la configuración Tailwind, ejecutar de nuevo `npm run build` y distribuir también los cambios en `vendor/`. Las clases de utilidades que se utilicen desde JavaScript deben aparecer completas en el código; si se construyen con fragmentos variables, añadir las clases necesarias a `safelist` en `tailwind.config.js`.

Para actualizar bibliotecas, cambiar versiones exactas de forma deliberada, actualizar el lock, reconstruir y verificar Reportes, iconos y tamaños de pantalla. No introducir `@latest` en páginas ni restablecer CDN. La instalación de estas versiones informó cero vulnerabilidades en `npm audit`; ese resultado corresponde a la consulta efectuada y no sustituye las revisiones futuras.

## Comprobación sin internet

Con el repositorio y `vendor/` disponibles, estos comandos no necesitan descargar dependencias ni consultar servicios externos:

```powershell
cd frontend
node scripts/verify-assets.js
node --test --test-isolation=none tests/assets.test.js
```

La comprobación verifica SHA-256, recursos presentes, coincidencia de mayúsculas para despliegues Linux, ausencia de CDN en etiquetas de recursos y referencias CSS, y que la compilación corresponda al HTML/JavaScript actual. Las siete pruebas comprueban además las APIs reales de los archivos distribuidos: tablas PDF con múltiples páginas sin perder filas, Excel con estilos/combinaciones/120 horas, conversión de todos los iconos usados a SVG, fuentes WOFF2 y utilidades CSS necesarias para estados y tamaños adaptables. Las pruebas ejecutan las bibliotecas en un contexto aislado de Node, sin proporcionar acceso a la red.

Para comprobar también el navegador, iniciar el backend y abrir su URL con la caché desactivada. Bloquear las solicitudes a orígenes externos manteniendo disponible el origen del sistema: acceso, menús, Reportes y fuentes deben cargar sin peticiones a dominios de terceros. Exportar un PDF y un Excel desde Reportes confirma el flujo de descarga. El modo completamente offline de las herramientas del navegador bloquearía también la API local, por lo que no representa esta prueba de independencia de CDN.

Las comprobaciones de archivos no sustituyen la revisión visual ni la aceptación funcional con datos de trabajo. La evidencia adicional de navegador se registra por separado en el informe de validación y en los respaldos de prueba ignorados por Git.
