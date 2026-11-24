/**
 * El Portal planta (24-nov-2026) recorrido en pantalla, contra el PROYECTO DE PRUEBAS:
 *   - a dónde entra cada quien: la operaria (Personal de planta) al portal, el administrador al admin;
 *   - Tareas en la barra; anotar una tarea y verla en la lista;
 *   - apagar una sección desde el admin: sale de la barra y su página vuelve al inicio; y prenderla otra vez;
 *   - comentar una publicación, y que quien modera lo oculte.
 *
 *   node --env-file=.env.local scripts/plataforma/probar-portal-planta.mjs [--base http://localhost:3005]
 *
 * Necesita las cuentas que siembra `sembrar-canal-pruebas.mjs`. Escribe en pruebas y deja todo como estaba
 * (la tarea y el comentario de la prueba se borran al final).
 */
import { chromium, devices } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
if (!URL_SUPA || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })

let fallos = 0
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✔' : '✘'} ${texto}`)
  if (!ok) fallos++
}

async function cookies(email) {
  const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`${email}: ${error.message}`)
  const { data, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (e2) throw e2
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url')
  const L = 3180
  const partes =
    valor.length <= L
      ? [{ name: `sb-${ref}-auth-token`, value: valor }]
      : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

const nav = await chromium.launch()
const contexto = async (email, telefono) => {
  const c = await nav.newContext(telefono ? devices['iPhone 14'] : { viewport: { width: 1440, height: 900 } })
  await c.addCookies(await cookies(email))
  return c.newPage()
}
const MARCA = `Prueba portal ${Date.now()} (demo)`

try {
  const planta = await contexto('canal.pruebas@plataforma.local', true)
  const jefe = await contexto('admin.pruebas@plataforma.local', false)
  const modera = await contexto('comunica.pruebas@plataforma.local', true)

  // 1) A dónde entra cada quien
  await planta.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  comprobar(new URL(planta.url()).pathname.startsWith('/canal'), `la operaria entra al portal (${new URL(planta.url()).pathname})`)
  await jefe.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  comprobar(new URL(jefe.url()).pathname.startsWith('/sistema'), `el administrador entra al admin (${new URL(jefe.url()).pathname})`)
  comprobar(await jefe.getByRole('link', { name: /Portal planta/ }).first().isVisible(), 'el admin tiene el botón «Portal planta»')
  await jefe.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
  comprobar(await jefe.getByRole('link', { name: 'Admin' }).isVisible(), 'en el portal, el administrador tiene «Admin» para volver')

  // 2) Tareas en la barra y anotar una
  await planta.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
  const barra = planta.getByRole('navigation', { name: 'Navegación principal' })
  comprobar(await barra.getByRole('link', { name: 'Tareas' }).isVisible(), 'Tareas está en la barra de abajo')
  await barra.getByRole('link', { name: 'Tareas' }).click()
  await planta.waitForURL('**/canal/tareas')
  await planta.getByText('Nueva tarea').click()
  await planta.getByLabel('Qué hay que hacer').fill(MARCA)
  await planta.getByRole('button', { name: 'Anotar tarea' }).click()
  await planta.getByText(MARCA).first().waitFor({ timeout: 20000 }).catch(() => {})
  comprobar(await planta.getByText(MARCA).first().isVisible(), 'la tarea anotada sale en la lista')
  await planta.getByRole('link', { name: 'Calendario' }).click()
  await planta.waitForURL('**vista=calendario**')
  comprobar(await planta.getByRole('region', { name: /Calendario de/ }).isVisible(), 'el calendario del mes se ve')

  // 3) Apagar «Gente» desde el admin
  await jefe.goto(`${BASE}/sistema/nucleo/canal/secciones`, { waitUntil: 'networkidle' })
  const filaGente = jefe.locator('li', { hasText: 'El directorio y las conexiones' })
  await filaGente.getByRole('button', { name: 'Apagar' }).click()
  await filaGente.getByText('Apagada').waitFor({ timeout: 20000 })
  await planta.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
  comprobar(!(await barra.getByRole('link', { name: 'Gente' }).isVisible()), 'apagada, «Gente» sale de la barra')
  await planta.goto(`${BASE}/canal/gente`, { waitUntil: 'networkidle' })
  comprobar(new URL(planta.url()).pathname === '/canal', 'apagada, /canal/gente vuelve al inicio')
  await jefe.reload({ waitUntil: 'networkidle' })
  await jefe.locator('li', { hasText: 'El directorio y las conexiones' }).getByRole('button', { name: 'Encender' }).click()
  await jefe.locator('li', { hasText: 'El directorio y las conexiones' }).getByText('Encendida').waitFor({ timeout: 20000 })
  await planta.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
  comprobar(await barra.getByRole('link', { name: 'Gente' }).isVisible(), 'encendida otra vez, «Gente» vuelve')

  // 4) Comentar y ocultar
  const { data: pub } = await admin.from('publicaciones').select('id').eq('estado', 'publicado').eq('permite_comentarios', true).limit(1).single()
  await planta.goto(`${BASE}/canal/publicacion/${pub.id}`, { waitUntil: 'networkidle' })
  await planta.getByLabel('Escribe un comentario').fill(MARCA)
  await planta.getByRole('button', { name: 'Comentar' }).click()
  await planta.getByText(MARCA).waitFor({ timeout: 20000 }).catch(() => {})
  comprobar(await planta.getByText(MARCA).isVisible(), 'el comentario sale debajo de la publicación')
  await modera.goto(`${BASE}/canal/publicacion/${pub.id}`, { waitUntil: 'networkidle' })
  const suyo = modera.locator('li', { hasText: MARCA })
  await suyo.getByRole('button', { name: 'Ocultar' }).click()
  await suyo.getByText(/Oculto/).waitFor({ timeout: 20000 }).catch(() => {})
  comprobar(await suyo.getByText(/Oculto/).isVisible(), 'quien modera lo oculta')
  await planta.reload({ waitUntil: 'networkidle' })
  comprobar(await planta.locator('li', { hasText: MARCA }).getByText(/solo lo ves tú/).isVisible(), 'quien lo escribió lo sigue viendo, marcado oculto')
} finally {
  // Limpieza: la tarea y el comentario de la prueba, y «Gente» encendida.
  await admin.schema('nucleo').from('tarea').delete().like('titulo', 'Prueba portal %(demo)')
  await admin.from('comentarios').delete().like('texto', 'Prueba portal %(demo)')
  await admin.from('canal_modulos').update({ activo: true }).eq('clave', 'gente')
  await nav.close()
}

console.log(fallos ? `\n${fallos} fallos` : '\nsin fallos')
process.exit(fallos ? 1 : 0)
