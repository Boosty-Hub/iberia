/**
 * Las puertas entre el canal y el panel, recorridas con el rol que se indique.
 *
 *   node --env-file=.env.local scripts/mirar-puertas.mjs                       # producción, rol marketing
 *   node --env-file=.env.local scripts/mirar-puertas.mjs --base http://localhost:3001 --rol marketing
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
const tiene = new Set((permisos ?? []).map((p) => p.recurso))
console.log(`\nRol ${rol.nombre} · ${[...tiene].filter((r) => r.startsWith('modulo:')).join(' ')}`)

const { data: creado } = await admin.auth.admin.createUser({
  email: CORREO,
  email_confirm: true,
  user_metadata: { nombre_completo: 'Prueba Puertas', organizacion: 'iberia', rol: rol.nivel, rol_clave: ROL },
})
await admin.from('empleados').insert({
  cedula: CEDULA, nombre_completo: 'Prueba Puertas', cargo: 'GERENTE DE MERCADEO', nivel: 'gerencia',
  tipo_nomina: 'mensual', familia_oficio: 'generico', perfil_id: creado.user.id,
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
    const alPanel = p.getByRole('link', { name: 'Panel' })
    ver((await alPanel.count()) === 1, 'el canal tiene el botón «Panel»')
    await p.screenshot({ path: `${SALIDA}/${nombre}-canal.png` })
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
