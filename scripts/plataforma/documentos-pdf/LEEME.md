# Archivos de origen → PDF optimizado

Las herramientas que convierten el repositorio documental de Iberia (`Procesos Iberia/`, fuera de git) en los PDF que
sube `scripts/plataforma/cargar-documentos.mjs`. Los datos y los PDF viven en `plataforma/_trabajo/documentos-pdf/`
(fuera de git, material bajo NDA). Cómo funciona y por qué, en AGENTS.md › «Los archivos de origen de los documentos».

1. La lista de documentos con sus archivos, de producción y en solo lectura:
   `select json_agg(json_build_object('id',id,'c',codigo,'e',estado,'p',perimetro,'s',datos_sensibles,'a',archivos)) from sgc.documento where cardinality(archivos) > 0;` → `docs.json`
2. `python -P -X utf8 inventario.py docs.json "Procesos Iberia" inventario.json` (huella y peso de cada archivo).
3. `python -P -X utf8 manifiesto.py docs.json inventario.json <carpeta de trabajo>` (deja `manifiesto.json` y las tres tandas).
4. Copiar `word-pdf.ps1`, `vigilante.ps1`, `comprimir.py` y `comprimir-todo.py` a la carpeta de trabajo y lanzar las tres
   tandas con **pwsh** (no `powershell.exe`) más el vigilante, desligados de la terminal:
   `Start-Process pwsh -ArgumentList '-NoProfile','-File','word-pdf.ps1','-Lista','tanda-0.tsv','-Base','<Procesos Iberia>','-Salida','pdf-office' -WindowStyle Hidden`
   (igual con tanda-1 y tanda-2) y `Start-Process pwsh -ArgumentList '-NoProfile','-File','vigilante.ps1','-Salida','pdf-office' -WindowStyle Hidden`.
5. `python -P -X utf8 comprimir-todo.py "<Procesos Iberia>"` (incremental: se puede correr mientras convierte).
6. `node --env-file=.env.local scripts/plataforma/cargar-documentos.mjs --revisar` y luego sin `--revisar`.
