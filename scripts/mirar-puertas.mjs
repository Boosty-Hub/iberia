/**
 * Las puertas entre el canal y el panel, recorridas con el rol que se indique.
 *
 *   node --env-file=.env.local scripts/mirar-puertas.mjs                       # producción, rol marketing
 *   node --env-file=.env.local scripts/mirar-puertas.mjs --base http://localhost:3001 --rol marketing
 *   node --env-file=.env.local scripts/mirar-puertas.mjs --rol administrador --como 4774   # como lo vería Alberto
 *
 * `--como <ficha>` copia en la ficha de prueba el nombre, el cargo, el nivel y el área
 * de esa ficha del padrón: se ve lo que vería esa persona sin entrar con su cuenta.
 *
 * Un rol puede tener módulos del panel sin tener su portada —el de Marketing, el
 * 27 de septiembre de 2026—, y hasta ese día esos módulos no se podían abrir
 * desde ninguna parte: `/dashboard` lo devolvía al canal. Esto crea una cuenta de
 * Iberia con ese rol y su ficha del padrón, y comprueba que el canal lleve un
 * botón al panel, que ese botón caiga en una pantalla que su rol abre, que la
 * portada que no le toca lo mande ahí, y que desde el panel se vuelva al canal.
 * Al salir borra la cuenta y la ficha.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}
const BASE = args.base ?? 'https://iberiavenezuela.netlify.app'
const ROL = args.rol ?? 'marketing'
const SALIDA = 'capturas/puertas'
const CORREO = 'prueba-puertas@iberia.invalid'
const CEDULA = 'PRUEBA-PUERTAS-1'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  await admin.from('empleados').delete().eq('cedula', CEDULA)
  for (const u of data.users.filter((u) => u.email === CORREO)) await admin.auth.admin.deleteUser(u.id)
}

const fallos = []
const ver = (c, m, d = '') => {
  console.log(`  ${c ? '✓' : '✖'} ${m}${!c && d ? ` · ${d}` : ''}`)
  if (!c) fallos.push(m)
}

await limpiar()
await mkdir(SALIDA, { recursive: true })

const { data: rol } = await admin.from('roles').select('id, nombre, nivel').eq('clave', ROL).single()
const { data: permisos } = await admin.from('rol_permisos').select('recurso').eq('rol_id', rol.id).eq('ver', true)
// El nivel administrador no tiene matriz: lo puede todo.
const tiene = new Set(
  rol.nivel === 'admin'
    ? ['modulo:panel', 'modulo:adiestramiento', 'modulo:certificados', 'modulo:canal', ...Array.from({ length: 9 }, (_, i) => `leccion:${i}`)]
    : (permisos ?? []).map((p) => p.recurso)
)
const { data: como } = args.como
  ? await admin.from('empleados').select('nombre_completo, cargo, nivel, area_id, familia_oficio').eq('ficha', args.como).single()
  : { data: null }
const NOMBRE = como?.nombre_completo ?? 'Prueba Puertas'
console.log(`\nRol ${rol.nombre} · ${[...tiene].filter((r) => r.startsWith('modulo:')).join(' ')}`)

const { data: creado } = await admin.auth.admin.createUser({
  email: CORREO,
  email_confirm: true,
  user_metadata: { nombre_completo: NOMBRE, organizacion: 'iberia', rol: rol.nivel, rol_clave: ROL },
})
await admin.from('empleados').insert({
  cedula: CEDULA, nombre_completo: NOMBRE, cargo: como?.cargo ?? 'GERENTE DE MERCADEO', nivel: como?.nivel ?? 'gerencia',
  area_id: como?.area_id ?? null, tipo_nomina: 'mensual', familia_oficio: como?.familia_oficio ?? 'generico',
  perfil_id: creado.user.id,
})
const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: CORREO })
const { data: v } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(v.session)).toString('base64url')
const cookies = []
for (let i = 0; i < valor.length; i += 3180) {
  cookies.push({ name: valor.length <= 3180 ? `sb-${ref}-auth-token` : `sb-${ref}-auth-token.${cookies.length}`, value: valor.slice(i, i + 3180) })
}
const conCookies = (c) =>
  c.addCookies(cookies.map((x) => ({ ...x, domain: new URL(BASE).hostname, path: '/', secure: BASE.startsWith('https'), sameSite: 'Lax' })))

const nav = await chromium.launch()
try {
  for (const [nombre, dispositivo] of [
    ['telefono', { ...devices['iPhone 14'] }],
    ['escritorio', { viewport: { width: 1440, height: 900 } }],
  ]) {
    console.log(`\nEn el ${nombre === 'telefono' ? 'teléfono' : 'escritorio'}`)
    const ctx = await nav.newContext({ ...dispositivo, locale: 'es-VE' })
    await conCookies(ctx)
    const p = await ctx.newPage()
    p.on('console', (m) => {
      if (m.type() === 'error') fallos.push(`[consola] ${m.text()}`)
    })

    await p.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
    ver(new URL(p.url()).pathname === '/canal', 'entra al canal', p.url())

    // Lo de Ajito, con las casillas de su rol (27 de septiembre de 2026: Martha
    // tenía las nueve lecciones y el curso le decía «no es para tu nivel»).
    const conLecciones = [...tiene].some((r) => r.startsWith('leccion:'))
    if (conLecciones && nombre === 'telefono') {
      ver((await p.locator('a[href="/canal/adiestramiento"]').count()) >= 1, 'el feed trae la tarjeta de Ajito')
      await p.goto(`${BASE}/canal/adiestramiento`, { waitUntil: 'networkidle' })
      const recorrer = p.getByRole('button', { name: 'Recorrer el curso' })
      ver((await recorrer.count()) === 1, 'sin matrícula, el curso ofrece «Recorrer el curso»')
      await p.screenshot({ path: `${SALIDA}/${nombre}-recorrer.png` })
      await recorrer.click()
      await p.locator('a[href="/canal/adiestramiento/0"]').first().waitFor({ timeout: 20000 }).catch(() => {})
      ver((await p.locator('a[href^="/canal/adiestramiento/"]').count()) >= 9, 'y al tocarlo salen las lecciones')
      await p.goto(`${BASE}/canal/adiestramiento/0`, { waitUntil: 'networkidle' })
      ver((await p.getByText(/Lección 0/).count()) >= 1, 'la lección 0 abre')
      await p.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
    }

    const alPanel = p.getByRole('link', { name: 'Panel' })
    ver((await alPanel.count()) === 1, 'el canal tiene el botón «Panel»')
    await p.screenshot({ path: `${SALIDA}/${nombre}-canal.png` })
    // Lo que el canal dice de esta persona: su nombre y su cargo, como los lee ella.
    if (nombre === 'telefono') {
      await p.goto(`${BASE}/canal/yo`, { waitUntil: 'networkidle' })
      const yo = await p.locator('main').innerText()
      console.log(`    «${yo.replace(/\s+/g, ' ').slice(0, 160)}»`)
      ver(yo.includes(NOMBRE), 'su perfil del canal trae su nombre')
      await p.screenshot({ path: `${SALIDA}/${nombre}-yo.png` })
      await p.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
    }
    await alPanel.click()
    await p.waitForURL(/\/dashboard/, { timeout: 20000 })
    // La página entera, no el esqueleto de carga que Next pinta al instante.
    await p.locator('h1').first().waitFor({ timeout: 20000 })
    await p.waitForLoadState('networkidle')
    const destino = new URL(p.url()).pathname
    ver(
      tiene.has('modulo:panel') ? destino === '/dashboard' : destino !== '/dashboard',
      `«Panel» cae en una pantalla que su rol abre (${destino})`
    )
    ver(!(await p.getByText('No tienes permiso').count()), 'sin aviso de permiso')
    await p.screenshot({ path: `${SALIDA}/${nombre}-panel.png` })

    // Lo que su rol abre del curso en el panel tiene que traer datos, no ceros.
    if (nombre === 'escritorio' && tiene.has('modulo:adiestramiento')) {
      await p.goto(`${BASE}/dashboard/adiestramiento`, { waitUntil: 'networkidle' })
      const matriculados = await p.evaluate(() => {
        const rotulo = [...document.querySelectorAll('*')].find((e) => e.textContent?.trim() === 'Con matrícula')
        return Number(rotulo?.parentElement?.textContent?.match(/\d+/)?.[0] ?? 0)
      })
      ver(matriculados > 0, `el tablero de Adiestramiento trae cifras (${matriculados} con matrícula)`)
      ver((await p.getByRole('link', { name: /El curso de Ajito/ }).count()) >= 1, 'la barra trae «El curso de Ajito»')
      await p.screenshot({ path: `${SALIDA}/${nombre}-adiestramiento.png` })
    }
    if (nombre === 'escritorio' && tiene.has('modulo:certificados')) {
      await p.goto(`${BASE}/dashboard/adiestramiento/certificados`, { waitUntil: 'networkidle' })
      const hojas = await p.locator('[data-certificado]').count()
      ver(hojas >= 1, `Certificados trae los emitidos (${hojas})`)
    }
    // El administrador ve el panel entero, la administración y el informe.
    if (nombre === 'escritorio' && rol.nivel === 'admin') {
      await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
      for (const destino of ['Panel', 'Entrevistas', 'Archivos', 'Consumos', 'Adiestramiento', 'Empleados · padrón', 'El curso de Ajito', 'Usuarios', 'Roles y permisos']) {
        ver((await p.locator('aside').getByRole('link', { name: destino }).count()) >= 1, `la barra trae «${destino}»`)
      }
      ver((await p.getByRole('link', { name: /Ver el informe/ }).count()) >= 1, 'la cabecera trae «Ver el informe»')
      await p.screenshot({ path: `${SALIDA}/${nombre}-portada.png` })
      for (const ruta of ['/dashboard/entrevistas', '/dashboard/usuarios', '/dashboard/roles', '/dashboard/empleados', '/informe']) {
        const r = await p.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
        ver(r?.ok() && new URL(p.url()).pathname.startsWith(ruta.split('?')[0]), `abre ${ruta}`, `${r?.status()} ${p.url()}`)
      }
    }

    // La portada, pedida a mano: si no la tiene, lo manda a su primera pantalla.
    await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
    ver(new URL(p.url()).pathname.startsWith('/dashboard'), 'la portada que no le toca lo deja en el panel', p.url())

    const alCanal = p.getByRole('link', { name: /El canal|Ir al canal/ }).first()
    ver((await alCanal.count()) === 1, 'el panel tiene el botón al canal')
    await alCanal.click()
    await p.waitForURL((u) => new URL(u).pathname === '/canal', { timeout: 20000 })
    ver(true, 'y vuelve al canal')

    const ancho = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ver(ancho <= 1, 'sin desborde horizontal en el canal', `${ancho}px`)
    await ctx.close()
  }

  // Y al revés: sin esas casillas, la base no lo abre. El personal de planta no
  // tiene Adiestramiento ni Certificados en su rol.
  console.log('\nSin las casillas')
  const correoPlanta = 'prueba-puertas-planta@iberia.invalid'
  const { data: planta } = await admin.auth.admin.createUser({
    email: correoPlanta,
    email_confirm: true,
    user_metadata: { nombre_completo: 'Prueba Planta', organizacion: 'iberia', rol: 'lector', rol_clave: 'personal-planta' },
  })
  try {
    const { data: e2 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: correoPlanta })
    const { data: s2 } = await anon.auth.verifyOtp({ token_hash: e2.properties.hashed_token, type: 'magiclink' })
    const suyo = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${s2.session.access_token}` } },
    })
    const { data: tablero } = await suyo.from('adiestramiento_avance').select('matriculados')
    ver((tablero ?? []).length === 0, 'el tablero del curso no le responde')
    const { data: certs } = await suyo.from('certificados').select('codigo')
    ver((certs ?? []).length === 0, 'ni los certificados de otros')
  } finally {
    await admin.auth.admin.deleteUser(planta.user.id)
  }
} finally {
  await nav.close()
  await limpiar()
  console.log('\n  · limpieza: cuenta y ficha de prueba borradas')
}

if (fallos.length) {
  console.log(`\n✖ ${fallos.length} problema(s):`)
  for (const f of fallos) console.log(`  · ${f}`)
  process.exit(1)
}
console.log(`\nSin fallos. Capturas en ${SALIDA}/ — ahora hay que abrirlas.\n`)
