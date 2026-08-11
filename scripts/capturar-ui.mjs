/**
 * Capturas de la UI real con Chromium, para verificar por vista y no por
 * suposición.
 *
 *   node --env-file=.env.local scripts/capturar-ui.mjs --password "<clave>"
 *
 * Opciones:
 *   --password   contraseña del usuario admin (obligatoria)
 *   --email      correo del admin (por defecto gmontiel@spatiumgroup.com)
 *   --salida     carpeta destino (por defecto ./capturas)
 *   --escala     deviceScaleFactor, 1 o 2 (por defecto 2)
 *   --solo       captura solo las rutas cuyo nombre contenga este texto
 *
 * Además de las páginas completas, recorta los detalles que se juzgan de cerca
 * (el logo en claro y en oscuro) y reporta los errores de consola de cada página.
 */

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const CLAVE = args.password
const SALIDA = args.salida ?? 'capturas'
const ESCALA = Number(args.escala ?? 2)
const SOLO = args.solo ?? null

if (!CLAVE) {
  console.error('\n✖ Falta --password con la clave del admin.\n')
  process.exit(1)
}

const PAGINAS = [
  { nombre: '01-login', ruta: '/login', publica: true },
  { nombre: '02-dashboard', ruta: '/dashboard' },
  { nombre: '03-entrevistas', ruta: '/dashboard/entrevistas' },
  { nombre: '04-entrevistas-importar', ruta: '/dashboard/entrevistas/importar' },
  { nombre: '04b-entrevista-nueva', ruta: '/dashboard/entrevistas/nueva' },
  { nombre: '05-archivos', ruta: '/dashboard/archivos' },
  { nombre: '06-hallazgos', ruta: '/dashboard/hallazgos' },
  { nombre: '07-hallazgo-nuevo', ruta: '/dashboard/hallazgos/nuevo' },
  { nombre: '08-informe-editor', ruta: '/dashboard/informe' },
  { nombre: '09-informe-seccion', ruta: '/dashboard/informe/resumen-ejecutivo' },
  { nombre: '10-usuarios', ruta: '/dashboard/usuarios' },
  { nombre: '11-informe', ruta: '/informe' },
]

await mkdir(SALIDA, { recursive: true })

const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: ESCALA,
  locale: 'es-VE',
})

const problemas = []
const pagina = await contexto.newPage()

pagina.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    const texto = msg.text()
    // Ruido del servidor de desarrollo, no de la app.
    if (/React DevTools|\[HMR\]|was preloaded using link preload/.test(texto)) return
    problemas.push({ ruta: pagina.url().replace(BASE, ''), tipo: msg.type(), texto })
  }
})
pagina.on('pageerror', (e) => {
  problemas.push({ ruta: pagina.url().replace(BASE, ''), tipo: 'pageerror', texto: e.message })
})

// --- Login real, no cookie inyectada ----------------------------------------
console.log(`\nAbriendo ${BASE}/login`)
await pagina.goto(`${BASE}/login`, { waitUntil: 'networkidle' })

if (!SOLO || '01-login'.includes(SOLO)) {
  await pagina.screenshot({ path: join(SALIDA, '01-login.png'), fullPage: true })
  // Detalle del logo sobre fondo oscuro, ampliado.
  const logoOscuro = pagina.locator('img[alt="Industrias Iberia"]').first()
  if (await logoOscuro.count()) {
    await logoOscuro.screenshot({ path: join(SALIDA, 'detalle-logo-oscuro.png') })
    const caja = await logoOscuro.boundingBox()
    console.log(`  logo en /login: ${Math.round(caja.width)}x${Math.round(caja.height)} px CSS`)
  }
  console.log('  01-login.png')
}

await pagina.fill('#email', EMAIL)
await pagina.fill('#password', CLAVE)
await pagina.click('button[type="submit"]')
await pagina.waitForURL(/\/dashboard/, { timeout: 30000 })
console.log('  sesión iniciada')

// --- Resto de páginas --------------------------------------------------------
for (const { nombre, ruta, publica } of PAGINAS) {
  if (publica) continue
  if (SOLO && !nombre.includes(SOLO)) continue

  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await pagina.screenshot({ path: join(SALIDA, `${nombre}.png`), fullPage: true })
  console.log(`  ${nombre}.png`)

  if (nombre === '02-dashboard') {
    const logoClaro = pagina.locator('aside img[alt="Industrias Iberia"]').first()
    if (await logoClaro.count()) {
      await logoClaro.screenshot({ path: join(SALIDA, 'detalle-logo-lateral.png') })
      const caja = await logoClaro.boundingBox()
      console.log(`  logo en la barra lateral: ${Math.round(caja.width)}x${Math.round(caja.height)} px CSS`)
    }
    // Barra lateral completa: es donde se juzga la navegación de marca.
    const aside = pagina.locator('aside').first()
    if (await aside.count()) {
      await aside.screenshot({ path: join(SALIDA, 'detalle-barra-lateral.png') })
    }
  }
}

await navegador.close()

// --- Informe de consola ------------------------------------------------------
if (problemas.length === 0) {
  console.log('\n✔ Sin errores ni advertencias de consola (descartado el ruido de dev)\n')
} else {
  console.log(`\n⚠ ${problemas.length} mensaje(s) de consola:\n`)
  const vistos = new Set()
  for (const p of problemas) {
    const clave = p.texto.slice(0, 120)
    if (vistos.has(clave)) continue
    vistos.add(clave)
    console.log(`  [${p.tipo}] ${p.ruta}`)
    console.log(`     ${p.texto.split('\n')[0].slice(0, 200)}`)
  }
  await writeFile(join(SALIDA, 'consola.json'), JSON.stringify(problemas, null, 2))
  console.log(`\n  detalle completo en ${join(SALIDA, 'consola.json')}\n`)
}
