/**
 * Renderiza un PDF a PNG usando el visor de Chromium (vía Playwright), porque
 * en esta máquina no hay poppler.
 *
 *   node scripts/ver-pdf.mjs <archivo.pdf> [carpeta-salida] [paginas]
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entrada, salida = 'capturas/pdf', paginas = '3'] = process.argv.slice(2)

if (!entrada) {
  console.error('\n✖ Uso: node scripts/ver-pdf.mjs <archivo.pdf> [salida] [paginas]\n')
  process.exit(1)
}

await mkdir(salida, { recursive: true })

const navegador = await chromium.launch()
const pagina = await navegador.newPage({
  viewport: { width: 1600, height: 2000 },
  deviceScaleFactor: 2,
})

await pagina.goto(pathToFileURL(resolve(entrada)).href)
// El visor de PDF de Chromium tarda en pintar la primera página.
await pagina.waitForTimeout(4000)

const nombre = basename(entrada).replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_')
const total = Number(paginas)

for (let i = 0; i < total; i++) {
  const ruta = join(salida, `${nombre}-p${i + 1}.png`)
  await pagina.screenshot({ path: ruta })
  console.log(`  ${ruta}`)
  // Avanza de página dentro del visor.
  await pagina.keyboard.press('PageDown')
  await pagina.waitForTimeout(1200)
}

await navegador.close()
