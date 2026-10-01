Activos extraídos de las cinco cartas PDF facilitadas por el usuario. Cada clave identifica una empresa y solo debe utilizarse con esa empresa.

| Clave | Fuente original | Membrete | Firma y sello | Dimensiones de firma (píxeles) |
| --- | --- | --- | --- | --- |
| `sbss` | `_CARTA DE ACEPTACION-SBSS.pdf` | `sbss.png` | `firma-sbss.png` | 486 × 204 |
| `nanas` | `CARTA DE ACEPTACIÓN - NANAS Y AMAS (1).pdf` | `nanas.png` | `firma-nanas.png` | 579 × 294 |
| `silsan` | `CARTA DE ACEPTACIÓN - SILSAN.pdf` | `silsan.png` | `firma-silsan.png` | 453 × 225 |
| `ong` | `CARTA DE ACEPTACION ONG.pdf` | `ong.png` | `firma-ong.png` | 504 × 240 |
| `camara` | `CARTA DE ACEPTACION-CÁMARA DE CONCILIACIÓN (1).pdf` | `camara.png` | `firma-camara.png` | 474 × 198 |

El usuario autorizó explícitamente en esta conversación (23 de septiembre de 2026): «Reutilizar la firma y el sello del PDF de cada empresa».

Los membretes contienen la identidad visual de la cabecera. Las firmas y sellos son recortes deterministas de la primera página de su respectivo PDF, renderizada al 300 % (216 ppp), sin recreación gráfica. No incluyen los nombres, DNI ni fechas de los estudiantes de ejemplo. Se conservaron la firma, el sello, el cargo impreso y, en el caso de Nanas y Amas, la línea original bajo la firma. La carta de Cámara de Conciliación contiene originalmente un sello SBSS; `firma-camara.png` procede de ese mismo PDF, no de la carta SBSS.

Para reproducir el tamaño original en puntos PDF, dividir las dimensiones en píxeles entre tres. Los rectángulos de extracción, expresados en puntos PDF desde la esquina superior izquierda como `(x, y, ancho, alto)`, son:

- `sbss`: `(284, 622, 162, 68)`.
- `nanas`: `(213, 548, 193, 98)`.
- `silsan`: `(339, 677, 151, 75)`.
- `ong`: `(311, 628, 168, 80)`.
- `camara`: `(225, 613, 158, 66)`.

Las cinco páginas originales y los cinco recortes se revisaron visualmente. La nitidez de las firmas depende de las imágenes incrustadas en los PDF fuente. El servicio PDF accede a estos activos mediante una lista cerrada de claves.
