/**
 * Capturas de la UI real con Chromium, para verificar por vista y no por
 * suposición.
 *
 *   node --env-file=.env.local scripts/capturar-ui.mjs
 *   node --env-file=.env.local scripts/capturar-ui.mjs --password "<clave>"
 *
 * Opciones:
 *   --password   clave del admin. **Opcional**: sin ella la sesión se acuña con
 *                un enlace mágico emitido con la clave de servicio y se inyecta
 *                como cookie, igual que en `capturar:adiestramiento`. Con ella se
 *                pasa por el formulario de login de verdad, que es lo que hay que
 *                usar cuando lo que se está mirando es el login.
 *   --email      correo del admin (por defecto gmontiel@spatiumgroup.com)
 *   --salida     carpeta destino (por defecto ./capturas)
 *   --escala     deviceScaleFactor, 1 o 2 (por defecto 2)
 *   --solo       captura solo las rutas cuyo nombre contenga este texto
 *
 * **Por qué la clave dejó de ser obligatoria.** La verificación visual es
 * obligatoria en este proyecto, y una verificación que depende de que alguien
 * esté delante para teclear una contraseña es una verificación que se salta. La
 * página de login se captura igual: es ruta pública.
 *
 * Además de las páginas completas, recorta los detalles que se juzgan de cerca
 * (el logo en claro y en oscuro) y reporta los errores de consola de cada página.
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
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

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!CLAVE && !(URL_SUPA && CLAVE_PUB && SECRETO)) {
  console.error('\n✖ Sin --password hacen falta las variables de Supabase en .env.local.\n')
  process.exit(1)
}

const PAGINAS = [
  { nombre: '01-login', ruta: '/login', publica: true },
  { nombre: '02-dashboard', ruta: '/dashboard' },
  { nombre: '03-entrevistas', ruta: '/dashboard/entrevistas' },
  { nombre: '04-entrevistas-importar', ruta: '/dashboard/entrevistas/importar' },
  { nombre: '04b-entrevista-nueva', ruta: '/dashboard/entrevistas/nueva' },
  { nombre: '05-archivos', ruta: '/dashboard/archivos' },
  // Sin hallazgos ni editor del informe desde el 25 de septiembre: los hallazgos
  // se leen en el informe y el informe se escribe en las sesiones.
  { nombre: '10-usuarios', ruta: '/dashboard/usuarios' },
  { nombre: '10b-roles', ruta: '/dashboard/roles' },
  { nombre: '11-informe', ruta: '/informe' },
  // Las secciones con dibujo son las que más se rompen: el circuito, el mapa
  // —que es la sección del mapa de procesos— y el espejo de la arquitectura.
  { nombre: '11b-informe-hallazgos', ruta: '/informe/hallazgos' },
  { nombre: '11c-informe-mapa', ruta: '/informe/mapa-interactivo' },
  { nombre: '11d-informe-arquitectura', ruta: '/informe/arquitectura-ia' },
  { nombre: '12-programa', ruta: '/dashboard/programa' },
  { nombre: '13-empleados', ruta: '/dashboard/empleados' },
]

/**
 * El formato de cookie de @supabase/ssr: el JSON de la sesión en base64url con el
 * prefijo `base64-`, partido en trozos numerados cuando pasa del límite que
 * aguanta una cookie.
 */
function cookiesDeSesion(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const LIMITE = 3180

  const partes =
    valor.length <= LIMITE
      ? [{ name: nombre, value: valor }]
      : Array.from({ length: Math.ceil(valor.length / LIMITE) }, (_, i) => ({
          name: `${nombre}.${i}`,
          value: valor.slice(i * LIMITE, (i + 1) * LIMITE),
        }))

  const { hostname } = new URL(BASE)
  return partes.map((p) => ({ ...p, domain: hostname, path: '/' }))
}

/** Acuña la sesión sin contraseña, con la clave de servicio. */
async function sesionAcunada() {
  const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
  const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })

  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL,
  })
  if (errEnlace) throw new Error(`no se pudo emitir el enlace para ${EMAIL}: ${errEnlace.message}`)

  const { data: verificado, error: errSesion } = await anon.auth.verifyOtp({
    token_hash: enlace.properties.hashed_token,
    type: 'magiclink',
  })
  if (errSesion) throw new Error(`no se pudo canjear el enlace: ${errSesion.message}`)

  return cookiesDeSesion(verificado.session)
}

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

// --- El login, que es ruta pública -------------------------------------------
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

// --- La sesión ---------------------------------------------------------------
if (CLAVE) {
  await pagina.fill('#email', EMAIL)
  await pagina.fill('#password', CLAVE)
  await pagina.click('button[type="submit"]')
  await pagina.waitForURL(/\/dashboard/, { timeout: 30000 })
  console.log('  sesión iniciada por el formulario')
} else {
  await contexto.addCookies(await sesionAcunada())
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  if (!/\/dashboard/.test(pagina.url())) {
    console.error(`\n✖ La cookie no valió: quedamos en ${pagina.url()}\n`)
    process.exit(1)
  }
  console.log(`  sesión acuñada para ${EMAIL}, sin contraseña`)
}

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
