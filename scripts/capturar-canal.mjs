/**
 * Verificación por vista del canal de comunicación, en teléfono.
 *
 *   node --env-file=.env.local scripts/capturar-canal.mjs --password "<clave>"
 *
 * El canal es mobile first, así que se mira donde se va a usar: un teléfono
 * de 390 px con dedo, no un escritorio. Además de capturar, comprueba lo que
 * no se ve en una imagen:
 *   · que ninguna página desborde a lo ancho,
 *   · que todo lo que se toca mida al menos 44 px,
 *   · que la consola esté limpia.
 *
 * Opciones: --password (obligatoria), --email, --salida, --solo, --flujo
 */

import { chromium, devices } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const CLAVE = args.password
const SALIDA = args.salida ?? 'capturas/canal'
const SOLO = args.solo ?? null
const CON_FLUJO = 'flujo' in args

if (!CLAVE) {
  console.error('\n✖ Falta --password con la clave del usuario.\n')
  process.exit(1)
}

const PAGINAS = [
  { nombre: '01-inicio', ruta: '/canal' },
  { nombre: '02-gente', ruta: '/canal/gente' },
  { nombre: '03-mensajes', ruta: '/canal/mensajes' },
  { nombre: '04-grupos', ruta: '/canal/grupos' },
  { nombre: '05-avisos', ruta: '/canal/avisos' },
  { nombre: '06-yo', ruta: '/canal/yo' },
  { nombre: '07-publicar', ruta: '/canal/publicar' },
]

await mkdir(SALIDA, { recursive: true })

const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  ...devices['iPhone 14'],
  locale: 'es-VE',
})

const problemas = []
const pagina = await contexto.newPage()

pagina.on('console', (msg) => {
  if (msg.type() !== 'error' && msg.type() !== 'warning') return
  const texto = msg.text()
  if (/React DevTools|\[HMR\]|was preloaded using link preload|Download the React/.test(texto)) return
  problemas.push({ ruta: pagina.url().replace(BASE, ''), tipo: msg.type(), texto })
})
pagina.on('pageerror', (e) => {
  problemas.push({ ruta: pagina.url().replace(BASE, ''), tipo: 'pageerror', texto: e.message })
})

/** Lo que una captura no muestra: desbordes y objetivos táctiles pequeños. */
async function auditar(nombre) {
  const medida = await pagina.evaluate(() => {
    const desborde = document.documentElement.scrollWidth - window.innerWidth
    const chicos = []
    for (const el of document.querySelectorAll('a, button, input, select, textarea, summary')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (getComputedStyle(el).visibility === 'hidden') continue
      // Un control dentro de su <label> no es el objetivo: lo es la etiqueta,
      // que sí se mide aparte.
      if (el.closest('label')) continue
      if (r.height < 44 || r.width < 44) {
        chicos.push({
          etiqueta: el.tagName.toLowerCase(),
          texto: (el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label') || '',
          w: Math.round(r.width),
          h: Math.round(r.height),
        })
      }
    }
    return { desborde, chicos }
  })

  if (medida.desborde > 0) {
    console.log(`     ⚠ desborda ${medida.desborde}px a lo ancho`)
    problemas.push({ ruta: nombre, tipo: 'desborde', texto: `${medida.desborde}px` })
  }
  for (const c of medida.chicos) {
    console.log(`     ⚠ objetivo táctil ${c.w}×${c.h}: <${c.etiqueta}> «${c.texto}»`)
    problemas.push({
      ruta: nombre,
      tipo: 'táctil',
      texto: `${c.w}×${c.h} <${c.etiqueta}> ${c.texto}`,
    })
  }
}

// --- Entrar -------------------------------------------------------------------
console.log(`\nAbriendo ${BASE}/login  (iPhone 14 · 390×844)`)
await pagina.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await pagina.fill('#email', EMAIL)
await pagina.fill('#password', CLAVE)
await pagina.click('button[type="submit"]')
await pagina.waitForURL(/\/dashboard/, { timeout: 60000 })
console.log('  sesión iniciada\n')

// --- Páginas ------------------------------------------------------------------
for (const { nombre, ruta } of PAGINAS) {
  if (SOLO && !nombre.includes(SOLO)) continue

  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: join(SALIDA, `${nombre}.png`), fullPage: true })
  console.log(`  ${nombre}.png  ← ${ruta}`)
  await auditar(nombre)
}

// --- La primera publicación del feed, abierta ---------------------------------
if (!SOLO) {
  await pagina.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
  const primera = pagina.locator('article a[href^="/canal/publicacion/"]').first()
  if (await primera.count()) {
    await primera.click()
    await pagina.waitForURL(/\/canal\/publicacion\//, { timeout: 30000 })
    await pagina.waitForTimeout(600)
    await pagina.screenshot({ path: join(SALIDA, '08-publicacion.png'), fullPage: true })
    console.log('  08-publicacion.png  ← detalle de la publicación')
    await auditar('08-publicacion')
  }
}

// --- Flujo real: escribirle a alguien y ver el hilo ----------------------------
if (CON_FLUJO) {
  console.log('\n  Flujo: escribir a un compañero')
  await pagina.goto(`${BASE}/canal/gente`, { waitUntil: 'networkidle' })

  const escribir = pagina.locator('button:has-text("Escribir")').first()
  if (await escribir.count()) {
    await escribir.click()
    try {
      await pagina.waitForURL(/\/canal\/mensajes\/[0-9a-f-]{36}/, { timeout: 30000 })
    } catch {
      await pagina.screenshot({ path: join(SALIDA, 'fallo-escribir.png'), fullPage: true })
      console.log(`  ✖ «Escribir» no abrió la conversación; se quedó en ${pagina.url()}`)
      problemas.push({ ruta: '/canal/gente', tipo: 'flujo', texto: 'Escribir no navegó' })
      await navegador.close()
      process.exit(1)
    }

    const texto = `Prueba de canal · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
    await pagina.fill('input[name="texto"]', texto)
    await pagina.click('button[aria-label="Enviar"]')
    await pagina.waitForTimeout(1500)
    await pagina.screenshot({ path: join(SALIDA, '09-conversacion.png'), fullPage: true })

    const llego = await pagina.locator(`text=${texto}`).count()
    console.log(`  09-conversacion.png  ← mensaje ${llego ? 'visible en el hilo' : 'NO visible'}`)
    if (!llego) problemas.push({ ruta: '/canal/mensajes/[id]', tipo: 'flujo', texto: 'el mensaje no apareció' })
    await auditar('09-conversacion')

    await pagina.goto(`${BASE}/canal/mensajes`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(400)
    await pagina.screenshot({ path: join(SALIDA, '10-mensajes-con-hilo.png'), fullPage: true })
    console.log('  10-mensajes-con-hilo.png')
  } else {
    console.log('  ⚠ no había ningún botón «Escribir» en el directorio')
  }
}

await navegador.close()

// --- Informe ------------------------------------------------------------------
if (problemas.length === 0) {
  console.log('\n✔ Sin desbordes, sin objetivos táctiles pequeños y consola limpia\n')
} else {
  console.log(`\n⚠ ${problemas.length} observación(es):\n`)
  const vistos = new Set()
  for (const p of problemas) {
    const clave = `${p.tipo}:${p.texto.slice(0, 100)}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    console.log(`  [${p.tipo}] ${p.ruta}`)
    console.log(`     ${p.texto.split('\n')[0].slice(0, 200)}`)
  }
  await writeFile(join(SALIDA, 'observaciones.json'), JSON.stringify(problemas, null, 2))
  console.log(`\n  detalle en ${join(SALIDA, 'observaciones.json')}\n`)
}
