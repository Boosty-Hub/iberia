/**
 * Las fichas de bolsillo del curso.
 *
 *   node --experimental-strip-types scripts/generar-fichas.mjs
 *   node --experimental-strip-types scripts/generar-fichas.mjs --leccion 3
 *
 * Una por lección: vertical, letra grande, tres o cuatro líneas. Lo que la
 * persona se guarda en la galería del teléfono y vuelve a mirar en el bus dos
 * semanas después, cuando ya no se acuerda de qué era lo de la nota de voz.
 *
 * ── Del guion, no de una lista aparte ────────────────────────────────────────
 *
 * Misma regla que los audios: el texto de cada ficha está escrito en el bloque
 * 🖼 **Ficha de bolsillo** de `contenido/adiestramiento/leccion-*.md`, y de ahí
 * sale. Cambiar una línea de la ficha es cambiar el guion y volver a correr
 * esto. Nunca al revés.
 *
 * ── Por qué Playwright y no GDI+ como la marca ───────────────────────────────
 *
 * `generar-marca.ps1` recorta y compone imágenes: para eso GDI+ sirve. Esto es
 * tipografía —cuatro líneas que tienen que caber, respirar y leerse a un brazo
 * de distancia—, y componer eso a mano en PowerShell es pelear con el
 * interlínea a ciegas. Chromium ya sabe hacerlo, ya está instalado para las
 * capturas, y además corre en cualquier sistema; los `.ps1` solo en Windows.
 *
 * Sale 1080×1920 —la pantalla de un teléfono— para que se vea entera sin hacer
 * zoom y quepa como fondo de pantalla si a alguien le provoca.
 *
 * Opciones: --leccion N · --salida
 */

import { chromium } from 'playwright'
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { leerLeccion, fichasDe } from '../lib/guion.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const GUION = 'contenido/adiestramiento'
const SALIDA = args.salida ?? join(GUION, 'fichas')
const SOLO = args.leccion ?? null

const ANCHO = 1080
const ALTO = 1920

// La paleta sale de `app/globals.css`. Está copiada y no importada porque un
// PNG no puede leer variables CSS de Tailwind, pero si allá cambia el rojo,
// aquí también.
const ROJO = '#d4332c'
const CARBON = '#2f2c2b'
const GRIS = '#575251'
const FONDO = '#f6f7f9'
const ORO = '#ffd036'

const ajito = await readFile('public/marca/ajito.png').then((b) => b.toString('base64'))
const logo = await readFile('public/marca/iberia.png').then((b) => b.toString('base64'))

/**
 * El HTML de una ficha, a una escala dada.
 *
 * El tamaño no se decide por el número de líneas sino midiendo: el guion se
 * reescribe y una ficha de tres líneas se puede volver de cinco sin que nadie
 * se acuerde de venir aquí a subir un número. Quien decide es `medir()`, que
 * baja la escala hasta que cabe. La primera versión de esto tenía los tamaños a
 * mano y la ficha de la lección 8 salió con Ajito cortado por abajo.
 *
 * El contenido va centrado en la tarjeta y el pie anclado: así una ficha de tres
 * líneas no deja medio metro de blanco debajo del texto.
 */
function html(titulo, lineas, leccion, escala = 1) {
  const e = (px) => Math.round(px * escala)
  const cuerpo = e(56)
  const salto = 1.45

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${ANCHO}px; height: ${ALTO}px;
    font-family: 'DM Sans', system-ui, sans-serif;
    background: ${FONDO};
    display: flex; flex-direction: column;
    padding: 90px 84px;
  }
  .cabecera { display: flex; align-items: center; justify-content: space-between; }
  .cabecera img { height: 64px; }
  .sello {
    font-size: 24px; font-weight: 700; letter-spacing: 0.18em;
    text-transform: uppercase; color: ${ROJO};
  }
  .tarjeta {
    flex: 1; margin-top: 72px; min-height: 0;
    background: #fff; border-radius: 56px;
    border: 1px solid rgba(219,216,215,.7);
    box-shadow: 0 24px 60px rgba(47,44,43,.08);
    padding: ${e(80)}px 76px ${e(56)}px;
    display: flex; flex-direction: column;
  }
  /* El texto vive centrado en lo que sobra, no pegado arriba. */
  .centro { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
  h1 {
    font-size: ${e(76)}px; font-weight: 700; line-height: 1.05;
    color: ${CARBON}; letter-spacing: -0.02em;
  }
  .raya {
    width: 132px; height: 12px; border-radius: 6px; background: ${ROJO};
    margin: ${e(40)}px 0 ${e(52)}px;
  }
  ul { list-style: none; display: flex; flex-direction: column; gap: ${e(36)}px; }
  li {
    font-size: ${cuerpo}px; line-height: ${salto}; color: ${GRIS};
    display: flex; gap: ${e(26)}px; align-items: baseline;
  }
  li::before {
    content: ''; flex: 0 0 auto;
    width: ${e(18)}px; height: ${e(18)}px; border-radius: 50%;
    background: ${ORO}; transform: translateY(-4px);
  }
  .pie {
    flex: 0 0 auto; margin-top: ${e(48)}px;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 40px;
  }
  .pie img { height: ${e(200)}px; }
  .leccion { font-size: ${e(30)}px; font-weight: 500; color: #8d8785; padding-bottom: 14px; }
</style></head>
<body>
  <div class="cabecera">
    <img src="data:image/png;base64,${logo}" alt="">
    <span class="sello">Nuevo Sabor</span>
  </div>
  <div class="tarjeta">
    <div class="centro">
      <h1>${escapar(titulo)}</h1>
      <div class="raya"></div>
      <ul>${lineas.map((l) => `<li>${escapar(l)}</li>`).join('')}</ul>
    </div>
    <div class="pie">
      <span class="leccion">${leccion === 8 ? 'El curso completo' : `Lección ${leccion}`}</span>
      <img src="data:image/png;base64,${ajito}" alt="">
    </div>
  </div>
</body></html>`
}

/**
 * La escala más grande a la que la ficha cabe entera.
 *
 * Se mide en el navegador en vez de calcularlo: cuánto ocupan cuatro líneas de
 * DM Sans a 56 px con estos márgenes no se sabe de antemano, y adivinarlo es
 * como salió Ajito cortado la primera vez. Baja de 5 en 5 por ciento hasta que
 * el contenido deja de rebosar la tarjeta.
 */
async function medir(pagina, titulo, lineas, leccion) {
  for (let escala = 1; escala >= 0.5; escala -= 0.05) {
    await pagina.setContent(html(titulo, lineas, leccion, escala), { waitUntil: 'networkidle' })
    await pagina.evaluate(() => document.fonts.ready)

    const rebosa = await pagina.evaluate(() => {
      const centro = document.querySelector('.centro')
      const cuerpo = document.body
      return (
        centro.scrollHeight > centro.clientHeight + 1 ||
        cuerpo.scrollHeight > cuerpo.clientHeight + 1
      )
    })

    if (!rebosa) return escala
  }
  return null
}

function escapar(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// -----------------------------------------------------------------------------

const archivos = (await readdir(GUION)).filter((f) => /^leccion-\d+.*\.md$/.test(f)).sort()

await mkdir(SALIDA, { recursive: true })

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO } })

const problemas = []
let hechas = 0

console.log('')

try {
  for (const archivo of archivos) {
    const numero = Number(basename(archivo).match(/^leccion-(\d+)/)[1])
    if (SOLO !== null && Number(SOLO) !== numero) continue

    const leccion = leerLeccion(await readFile(join(GUION, archivo), 'utf8'), archivo)
    const fichas = fichasDe(leccion)

    if (!fichas.length) {
      problemas.push(`lección ${numero}: no tiene ficha escrita en el guion`)
      console.log(`✖ lección ${numero} · sin ficha en el guion`)
      continue
    }

    for (const ficha of fichas) {
      const [titulo, ...lineas] = ficha.lineas
      // La 8 trae dos: una por cada despedida. El sufijo lo hereda del audio que
      // acompaña —`-A` apagado, `-B` encendido—, no del orden en que salgan:
      // así el archivo y el interruptor siempre dicen lo mismo.
      const nombre = `leccion-${String(numero).padStart(2, '0')}${ficha.sufijo}.png`

      // `medir` deja la página ya pintada a la escala buena, así que la captura
      // sale de ahí sin volver a montarla.
      const escala = await medir(pagina, titulo, lineas, numero)

      if (escala === null) {
        problemas.push(`${nombre}: no cabe ni al 50% — hay que acortar el texto en el guion`)
        console.log(`✖ ${nombre.padEnd(20)} no cabe`)
        continue
      }

      const png = await pagina.screenshot({ type: 'png' })
      await writeFile(join(SALIDA, nombre), png)
      hechas++

      const porciento = Math.round(escala * 100)
      // Por debajo del 70% la letra deja de leerse a un brazo de distancia, que
      // es para lo que sirve una ficha de bolsillo. Ahí el arreglo no es
      // encoger más: es escribir menos en el guion.
      const aviso = porciento < 70 ? '  ⚠ la letra queda chica' : ''
      console.log(
        `· ${nombre.padEnd(20)} ${String(lineas.length).padStart(2)} líneas · ` +
          `${String(porciento).padStart(3)}% · ${String(Math.round(png.length / 1024)).padStart(3)} KB${aviso}`
      )
      console.log(`  ${titulo}`)
      if (porciento < 70) problemas.push(`${nombre}: al ${porciento}% la letra queda chica`)
    }
  }
} finally {
  await navegador.close()
}

console.log(`\n${hechas} fichas en ${SALIDA}/`)

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} cosa${problemas.length > 1 ? 's' : ''} que revisar:`)
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

console.log('Ahora hay que abrirlas.\n')
