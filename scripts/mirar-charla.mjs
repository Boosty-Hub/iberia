/**
 * La conversación con Ajito recorrida en un iPhone 14.
 *
 *   node --env-file=.env.local scripts/mirar-charla.mjs                 # producción
 *   node --env-file=.env.local scripts/mirar-charla.mjs --base http://localhost:3001
 *
 * Es lo que abre «Preguntarle algo a Ajito» al final del curso. Crea una cuenta
 * de prueba del equipo —con el interruptor apagado solo entran los editores— y
 * comprueba lo que no se ve leyendo el código: que el botón del índice lleve al
 * chat, que Ajito conteste y lo diga hablado, que se acuerde de lo anterior, que
 * dibuje si se le pide, que al recargar la conversación siga ahí, que «Nueva»
 * empiece otra, y que **otra persona no lea ni escriba en la conversación
 * ajena**. Al salir borra las cuentas, las fichas y los archivos de su carpeta.
 *
 * Gasta de verdad: tres respuestas del modelo y un dibujo, unos centavos.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { barrerCarpeta } from './barrer-carpeta.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}
const BASE = args.base ?? 'https://iberiavenezuela.netlify.app'
const SALIDA = 'capturas/charla'
const PREFIJO = 'prueba-charla-'
const CEDULA = 'PRUEBA-CHARLA-'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const { data: fichas } = await admin.from('empleados').select('id').like('cedula', `${CEDULA}%`)
  for (const f of fichas ?? []) {
    await barrerCarpeta(admin, f.id)
    await admin.from('empleados').delete().eq('id', f.id)
  }
  for (const u of (data?.users ?? []).filter((u) => (u.email ?? '').startsWith(PREFIJO))) {
    await admin.auth.admin.deleteUser(u.id)
  }
}

function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const out = []
  if (valor.length <= L) out.push({ name: nombre, value: valor })
  else for (let i = 0; i < valor.length; i += L) out.push({ name: `${nombre}.${out.length}`, value: valor.slice(i, i + L) })
  return out.map((c) => ({ ...c, domain: new URL(BASE).hostname, path: '/', httpOnly: false, secure: BASE.startsWith('https'), sameSite: 'Lax' }))
}

async function sesion(correo) {
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: correo })
  const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
  const { data } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  return data.session
}

const problemas = []
const exigir = (cond, msg, detalle = '') => {
  console.log(`  ${cond ? '✓' : '✖'} ${msg}${!cond && detalle ? ` · ${detalle}` : ''}`)
  if (!cond) problemas.push(msg)
}

/** Una persona del padrón con matrícula y sesión. */
async function persona(id, nombre, rol) {
  const { data: curso } = await admin.from('cursos').select('id').eq('clave', 'ajito').single()
  const correo = `${PREFIJO}${id}@iberia.invalid`
  const { data: creado } = await admin.auth.admin.createUser({
    email: correo,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre, organizacion: rol === 'consultor' ? 'boosty' : 'iberia', rol },
  })
  const { data: ficha, error } = await admin
    .from('empleados')
    .insert({
      cedula: `${CEDULA}${id}`, nombre_completo: nombre, cargo: 'OPERADOR DE ENVASADO',
      nivel: 'planta', tipo_nomina: 'diaria', sede: 'cagua', familia_oficio: 'linea', perfil_id: creado.user.id,
    })
    .select('id')
    .single()
  if (error) throw error
  const { data: matricula } = await admin
    .from('matriculas')
    .insert({ curso_id: curso.id, empleado_id: ficha.id, familia_oficio: 'linea', nombre_corto: nombre.split(' ')[0] })
    .select('id')
    .single()
  const s = await sesion(correo)
  const cliente = createClient(URL_SUPA, CLAVE_PUB, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${s.access_token}` } },
  })
  return { ficha, matricula, sesion: s, cliente }
}

await limpiar()
await mkdir(SALIDA, { recursive: true })

const yo = await persona('equipo', 'Carlos Medina', 'consultor')
const otro = await persona('otro', 'Luisa Pinto', 'lector')

const nav = await chromium.launch()
try {
  const ctx = await nav.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
  await ctx.addCookies(cookies(yo.sesion))
  const p = await ctx.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error') problemas.push(`[consola] ${m.text()}`)
  })

  console.log('\nLa entrada\n')
  await p.goto(`${BASE}/canal/adiestramiento`, { waitUntil: 'networkidle' })
  const boton = p.getByRole('link', { name: 'Pregúntale a Ajito' })
  exigir((await boton.count()) === 1, 'el índice del curso tiene «Pregúntale a Ajito»')
  await boton.click()
  await p.waitForURL(/\/canal\/adiestramiento\/ajito/)
  await p.locator('[data-charla]').waitFor()
  exigir((await p.getByText('Aquí estoy. ¿Qué quieres saber?').count()) === 1, 'sin conversación, sale el saludo y las sugerencias')
  await p.screenshot({ path: `${SALIDA}/1-vacia.png` })

  /** Escribe, manda y espera la respuesta número `n` de Ajito. */
  async function decir(texto, n, espera = 90_000) {
    await p.getByLabel('Mensaje para Ajito').fill(texto)
    await p.getByRole('button', { name: 'Mandar', exact: true }).click()
    await p.waitForFunction(
      (k) => document.querySelectorAll('[data-mensaje="ajito"]').length >= k && !document.querySelector('[data-pensando]'),
      n,
      { timeout: espera }
    )
    return p.locator('[data-mensaje="ajito"]').nth(n - 1)
  }

  console.log('\nLa conversación\n')
  const primera = await decir('Hola Ajito, ¿qué día es hoy?', 1)
  const dicho1 = await primera.innerText()
  console.log(`    «${dicho1.replace(/\s+/g, ' ').slice(0, 220)}»`)
  const dia = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long' }).format(new Date())
  exigir(new RegExp(dia, 'i').test(dicho1), `sabe qué día es (${dia})`, dicho1.slice(0, 120))
  exigir(/\/ajito\?c=[0-9a-f-]{36}/.test(p.url()), 'la dirección ya apunta a esta conversación')

  // La voz llega después del texto.
  await p.locator('[data-oir]').first().waitFor({ timeout: 30_000 }).catch(() => {})
  exigir((await p.locator('[data-oir]').count()) >= 1, 'y lo dice hablado: sale «Oír a Ajito»')
  const { data: charlas } = await admin.from('charlas_ajito').select('id').eq('matricula_id', yo.matricula.id)
  const charla = charlas?.[0]?.id
  const { data: primeraFila } = await admin
    .from('charla_mensajes')
    .select('id, audio')
    .eq('charla_id', charla)
    .eq('de', 'ajito')
    .limit(1)
    .single()
  const audio = await p.request.get(`${BASE}/canal/adiestramiento/ajito/media/${primeraFila.id}?que=audio`)
  exigir(audio.ok() && (audio.headers()['content-type'] ?? '').includes('audio'), 'el audio se oye', `${audio.status()} ${audio.headers()['content-type']}`)

  const segunda = await decir('¿Y mañana qué día va a ser?', 2)
  const dicho2 = await segunda.innerText()
  console.log(`    «${dicho2.replace(/\s+/g, ' ').slice(0, 220)}»`)
  const manana = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long' }).format(new Date(Date.now() + 86_400_000))
  exigir(new RegExp(manana, 'i').test(dicho2), `se acuerda de lo anterior y dice ${manana}`, dicho2.slice(0, 120))

  console.log('\nEl dibujo\n')
  await p.getByLabel('Mensaje para Ajito').fill('Dibújame a Ajito comiendo arepas en la playa')
  await p.getByRole('button', { name: 'Mandar', exact: true }).click()
  await p.locator('[data-pensando="dibujando"]').waitFor({ timeout: 60_000 }).catch(() => {})
  exigir((await p.locator('[data-pensando="dibujando"]').count()) === 1, 'dice que está dibujando mientras dibuja')
  await p.waitForFunction(
    () => {
      const img = document.querySelector('[data-dibujo]')
      return img && img.complete && img.naturalWidth > 0 && !document.querySelector('[data-pensando]')
    },
    null,
    { timeout: 150_000 }
  ).catch(() => {})
  exigir((await p.locator('[data-dibujo]').count()) === 1, 'el dibujo sale en la conversación')
  const dicho3 = await p.locator('[data-mensaje="ajito"]').last().innerText()
  console.log(`    «${dicho3.replace(/\s+/g, ' ').slice(0, 220)}»`)
  exigir(dicho3.trim().length > 20, 'y Ajito lo comenta')
  await p.screenshot({ path: `${SALIDA}/2-conversacion.png`, fullPage: true })

  console.log('\nLo que queda\n')
  await p.reload({ waitUntil: 'networkidle' })
  exigir((await p.locator('[data-mensaje]').count()) === 6, 'al recargar, la conversación sigue: tres y tres', String(await p.locator('[data-mensaje]').count()))
  exigir((await p.locator('[data-dibujo]').count()) === 1, 'con su dibujo')

  await p.getByRole('link', { name: 'Conversación nueva' }).click()
  await p.waitForURL(/nueva=1/)
  await p.getByText('Aquí estoy. ¿Qué quieres saber?').waitFor()
  exigir((await p.locator('[data-mensaje]').count()) === 0, '«Nueva» empieza una conversación en blanco')
  await p.locator('summary[aria-label="Conversaciones anteriores"]').click()
  exigir((await p.getByText('Hola Ajito, ¿qué día es hoy?').count()) >= 1, 'y la anterior queda en la lista, con su título')

  // Lo que una captura no enseña.
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  exigir(ancho <= 1, 'sin desborde horizontal', `${ancho}px`)
  const chicos = await p.evaluate(() =>
    [...document.querySelectorAll('[data-charla] button, [data-charla] a, [data-charla] summary, [data-charla] label')]
      .filter((e) => e.offsetParent)
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height < 43.5 || r.width < 43.5).length
  )
  exigir(chicos === 0, 'todo lo que se toca mide al menos 44 px', `${chicos} chicos`)
  await p.screenshot({ path: `${SALIDA}/3-nueva.png` })

  console.log('\nLo ajeno\n')
  const { data: ajenos } = await otro.cliente.from('charla_mensajes').select('id').eq('charla_id', charla)
  exigir((ajenos ?? []).length === 0, 'otra persona no lee la conversación ajena')
  const { data: ajenas } = await otro.cliente.from('charlas_ajito').select('id').eq('id', charla)
  exigir((ajenas ?? []).length === 0, 'ni la ve en su lista')
  const { error: colado } = await otro.cliente.from('charla_mensajes').insert({
    charla_id: charla, matricula_id: otro.matricula.id, de: 'persona', texto: 'me colé',
  })
  exigir(Boolean(colado), 'ni puede colgar un mensaje en ella')
  const { data: suya } = await otro.cliente.storage.from('adiestramiento-respuestas').list(`respuestas/${yo.ficha.id}/charla`)
  exigir((suya ?? []).length === 0, 'ni ve sus archivos')

  // Con el interruptor apagado, alguien de planta no entra.
  const ctx2 = await nav.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
  await ctx2.addCookies(cookies(otro.sesion))
  const p2 = await ctx2.newPage()
  const { data: interruptor } = await admin.from('cursos').select('asistente_libre_activo').eq('clave', 'ajito').single()
  const r = await p2.goto(`${BASE}/canal/adiestramiento/ajito`)
  if (!interruptor.asistente_libre_activo) {
    exigir(r?.status() === 404, 'con el interruptor apagado, quien no es del equipo no entra', String(r?.status()))
  } else {
    exigir(r?.status() === 200, 'con el interruptor encendido, entra cualquiera con matrícula', String(r?.status()))
  }
  await ctx2.close()
  await ctx.close()
} finally {
  await nav.close()
  await limpiar()
  console.log('\n  · limpieza: cuentas, fichas, conversaciones y archivos de prueba borrados')
}

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} problema(s):`)
  for (const x of problemas) console.log(`  · ${x}`)
  process.exit(1)
}
console.log(`\nSin fallos. Capturas en ${SALIDA}/ — ahora hay que abrirlas.\n`)
