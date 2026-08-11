/**
 * Extrae la identidad visual de un sitio: tipografías computadas y los colores
 * que realmente se pintan, ordenados por superficie ocupada.
 *
 *   node scripts/extraer-identidad-web.mjs https://www.industriasiberia.com/
 *
 * Sirve para tomar la paleta de una marca sin adivinarla de una captura.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const url = process.argv[2]
const salida = process.argv[3] ?? 'capturas/identidad'

if (!url) {
  console.error('\n✖ Uso: node scripts/extraer-identidad-web.mjs <url> [carpeta]\n')
  process.exit(1)
}

await mkdir(salida, { recursive: true })

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

try {
  await pagina.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
} catch (e) {
  console.log('aviso:', e.message.split('\n')[0])
}
await pagina.waitForTimeout(2500)

const datos = await pagina.evaluate(() => {
  const aHex = (rgb) => {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (!m) return null
    if (m[4] !== undefined && Number(m[4]) === 0) return null
    const h = (n) => Number(n).toString(16).padStart(2, '0')
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`.toUpperCase()
  }

  const superficie = new Map() // color de fondo → píxeles cubiertos
  const textos = new Map() // color de texto → cuántos elementos
  const fuentes = new Map()

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    const caja = el.getBoundingClientRect()
    const area = Math.max(0, caja.width) * Math.max(0, caja.height)

    const fondo = aHex(cs.backgroundColor)
    if (fondo && area > 0) superficie.set(fondo, (superficie.get(fondo) ?? 0) + area)

    if (el.textContent?.trim()) {
      const color = aHex(cs.color)
      if (color) textos.set(color, (textos.get(color) ?? 0) + 1)
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()
      if (fam) fuentes.set(fam, (fuentes.get(fam) ?? 0) + 1)
    }
  }

  const top = (m, n) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)

  return {
    titulo: document.title,
    fondos: top(superficie, 12),
    textos: top(textos, 10),
    fuentes: top(fuentes, 6),
  }
})

console.log(`\n=== ${datos.titulo} ===`)
console.log(`    ${url}\n`)

console.log('--- Tipografías (por número de elementos) ---')
for (const [f, n] of datos.fuentes) console.log(`  ${String(n).padStart(5)}  ${f}`)

console.log('\n--- Colores de fondo (por superficie pintada) ---')
for (const [c, a] of datos.fondos) {
  console.log(`  ${c}   ${Math.round(a).toLocaleString('es')} px²`)
}

console.log('\n--- Colores de texto ---')
for (const [c, n] of datos.textos) console.log(`  ${c}   ${n} elementos`)

const captura = join(salida, new URL(url).hostname.replace(/\W+/g, '-') + '.png')
await pagina.screenshot({ path: captura, fullPage: false })
console.log(`\n  captura: ${captura}\n`)

await navegador.close()
