/**
 * Extrae el texto de un PDF conservando la disposición espacial, para poder
 * leer documentos como organigramas donde la posición ES la información.
 *
 *   node scripts/extraer-pdf.mjs <archivo.pdf>
 *
 * Agrupa los fragmentos por fila (coordenada Y) y los ordena por X, de modo
 * que las cajas de un mismo nivel jerárquico salen en la misma línea.
 */

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const entrada = process.argv[2]
if (!entrada) {
  console.error('\n✖ Uso: node scripts/extraer-pdf.mjs <archivo.pdf>\n')
  process.exit(1)
}

/** Tolerancia vertical para considerar que dos fragmentos van en la misma fila. */
const TOLERANCIA_Y = 6

const datos = new Uint8Array(await readFile(resolve(entrada)))
const documento = await getDocument({ data: datos, useSystemFonts: true }).promise

console.log(`\n=== ${entrada} · ${documento.numPages} página(s) ===`)

for (let n = 1; n <= documento.numPages; n++) {
  const pagina = await documento.getPage(n)
  const contenido = await pagina.getTextContent()

  const filas = []
  for (const item of contenido.items) {
    const texto = (item.str ?? '').trim()
    if (!texto) continue
    const x = item.transform[4]
    const y = item.transform[5]

    const fila = filas.find((f) => Math.abs(f.y - y) <= TOLERANCIA_Y)
    if (fila) fila.piezas.push({ x, texto })
    else filas.push({ y, piezas: [{ x, texto }] })
  }

  // De arriba abajo (Y decrece hacia abajo en PDF) y de izquierda a derecha.
  filas.sort((a, b) => b.y - a.y)

  console.log(`\n--- Página ${n} ---`)
  for (const fila of filas) {
    fila.piezas.sort((a, b) => a.x - b.x)
    console.log(fila.piezas.map((p) => p.texto).join('  |  '))
  }
}
