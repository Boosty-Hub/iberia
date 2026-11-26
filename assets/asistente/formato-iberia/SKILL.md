---
name: formato-iberia
description: Formato corporativo de Industrias Iberia para todo documento que se genere (Word, Excel, PowerPoint, PDF): colores, tipografía, logo, portada, encabezados y pies. Úsala siempre que generes un archivo para el usuario, salvo que pida expresamente «sin formato».
---

# Formato Industrias Iberia

Todo archivo que generes para el usuario sale con la identidad de Industrias Iberia, listo para circular dentro de la empresa. Sobrio, limpio, sin adornos.

## Identidad

- Rojo Iberia `#D4332C`: solo para acentos (una línea, el encabezado de una tabla, una cifra clave). Nunca como fondo de párrafos.
- Carbón `#2B2A28` para el texto; gris `#706A67` para notas y pies.
- Fondo de tablas alternado `#F6F7F9`; bordes `#E4E6EA`.
- Tipografía: DM Sans si está instalada; si no, Arial. Títulos en negrita, nunca en mayúsculas sostenidas.
- Logo: `iberia.png` (en la carpeta de esta habilidad), arriba a la izquierda, alto aproximado de 1 cm en Word y PDF.
- Idioma: español de Venezuela. Fechas como «26 de noviembre de 2026». Montos con separador de miles con punto y decimales con coma (US$ 1.234,56; Bs 1.234,56).

## Cómo usarla

Importa el módulo de esta carpeta: copia la ruta de la habilidad y haz `sys.path.insert(0, RUTA)` antes de `import estilo_iberia`.

- **Excel** (`openpyxl`): crea el libro como siempre y al final llama `estilo_iberia.aplicar_excel(wb)`: pone el encabezado en rojo con letra blanca, congela la primera fila, ajusta anchos, alterna el fondo de las filas y formatea números y fechas. Para un resumen, una hoja «Resumen» primero.
- **Word** (`python-docx`): `doc = estilo_iberia.documento_word('Título', 'Subtítulo opcional')` devuelve un documento con el logo, el título, la fecha, la línea roja, los estilos y el pie con la página (no vuelvas a escribir ni el título ni la fecha); sigue agregando párrafos y tablas, y para cada tabla llama `estilo_iberia.tabla_word(tabla)`.
- **PowerPoint** (`python-pptx`): `prs = estilo_iberia.presentacion('Título', 'Subtítulo')` devuelve una presentación 16:9 con la portada hecha; agrega láminas con `estilo_iberia.lamina(prs, 'Título de la lámina')`.
- **PDF**: genera el Word con `documento_word` y conviértelo con LibreOffice si está disponible (`soffice --headless --convert-to pdf`); si no, usa reportlab con los mismos colores, la tipografía y el logo.

## Reglas

- Portada o encabezado con el logo, el título y la fecha. Pie con «Industrias Iberia · Uso interno» y el número de página.
- Una idea por lámina; tablas cortas en el cuerpo, las largas como anexo o en Excel.
- No inventes cifras para llenar un formato. Si falta un dato, déjalo indicado.
- Nombre de archivo claro en español, sin espacios dobles ni caracteres raros (por ejemplo `Resumen de ventas noviembre 2026.xlsx`).
