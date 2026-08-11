/**
 * Convierte un documento HTML en PDF con Chromium, para entregables a Iberia.
 *
 *   node scripts/generar-pdf.mjs documentos/mi-documento.html [salida.pdf]
 *
 * Usa Playwright, que ya está instalado para las verificaciones de UI, así que
 * no hace falta ninguna dependencia adicional. Las rutas relativas del HTML
 * (logo, hojas de estilo) se resuelven porque se abre como file://.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const entrada = process.argv[2]
if (!entrada) {
  console.error('\n✖ Uso: node scripts/generar-pdf.mjs <archivo.html> [salida.pdf]\n')
  process.exit(1)
}

const salida = process.argv[3] ?? entrada.replace(/\.html?$/i, '.pdf')
await mkdir(dirname(resolve(salida)), { recursive: true })

const navegador = await chromium.launch()
const pagina = await navegador.newPage()

await pagina.goto(pathToFileURL(resolve(entrada)).href, { waitUntil: 'networkidle' })
// Las fuentes web tardan un instante en asentarse; sin esto el PDF sale con la
// tipografía de respaldo.
await pagina.waitForTimeout(800)

const MARGEN = { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' }

await pagina.pdf({
  path: salida,
  format: 'A4',
  printBackground: true,
  margin: MARGEN,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;font-family:system-ui,sans-serif;font-size:8px;color:#8d8785;
                padding:0 16mm;display:flex;justify-content:space-between;">
      <span>Programa de Adopción de IA · Industrias Iberia</span>
      <span>Boosty Digital · <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`,
})

// Vista previa en PNG: Chromium en headless no abre PDF, así que la única forma
// de revisar el resultado antes de entregarlo es capturar el HTML en medio de
// impresión, que es exactamente lo que el PDF rasteriza.
if (process.argv.includes('--vista')) {
  await pagina.emulateMedia({ media: 'print' })
  await pagina.setViewportSize({ width: 794, height: 1123 }) // A4 a 96 ppp
  // Se replican los márgenes del PDF; sin esto el contenido aparece pegado al
  // borde y la revisión engaña.
  await pagina.addStyleTag({
    content: `body { padding: ${MARGEN.top} ${MARGEN.right} ${MARGEN.bottom} ${MARGEN.left}; }`,
  })
  const previa = salida.replace(/\.pdf$/i, '-vista.png')
  await pagina.screenshot({ path: previa, fullPage: true })
  console.log(`  vista previa: ${previa}`)
}

await navegador.close()
console.log(`\n✔ ${salida}\n`)
