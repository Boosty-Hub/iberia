/**
 * La lección 4 recorrida en un iPhone 14: Ajito dibuja de verdad.
 *
 *   node --env-file=.env.local scripts/mirar-dibujo.mjs                 # producción
 *   node --env-file=.env.local scripts/mirar-dibujo.mjs --base http://localhost:3001
 *
 * Crea un trabajador de prueba, recorre la lección y mira lo que no se ve
 * leyendo el código: que los tres ejemplos carguen, que un pedido que no va
 * reciba el texto aprobado del guion y deje pedir otro, que el dibujo aparezca
 * y que Ajito lo comente, que el escudo salga con su lema, y que «Publicarlo en
 * el canal» lo ponga en el feed con su imagen entera. Al salir borra la ficha,
 * la cuenta, **los archivos de su carpeta en el bucket** y la publicación: fotos,
 * dibujos y audios de una persona, aunque sea de prueba, no se dejan sueltos.
 *
 * ⚠️ La publicación de prueba está en el feed de producción mientras dura la
 * corrida —un minuto, más o menos— y se borra al salir.
 *
 * Gasta de verdad: dos dibujos y tres devoluciones, unos centavos.
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
const SALIDA = 'capturas/dibujo'
const PREFIJO = 'prueba-dibujo-'
const CEDULA = 'PRUEBA-DIBUJO-'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

/** Lo que dice Ajito cuando piden a una persona de verdad: texto del guion. */
const NO_VA_PERSONA = 'A las personas de verdad no las dibujo'

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const { data: fichas } = await admin.from('empleados').select('id').like('cedula', `${CEDULA}%`)
  for (const f of fichas ?? []) {
    // La publicación va antes que la ficha: al borrar la ficha, el autor queda
    // en nulo y la publicación seguiría en el feed sin nadie que la nombre.
    await admin.from('publicaciones').delete().eq('autor_id', f.id)
    const { data: escudos } = await admin.storage.from('canal').list(`escudos/${f.id}`)
    if (escudos?.length) await admin.storage.from('canal').remove(escudos.map((e) => `escudos/${f.id}/${e.name}`))
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
const exigir = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✖'} ${msg}`)
  if (!cond) problemas.push(msg)
}

await limpiar()
await mkdir(SALIDA, { recursive: true })
const { data: curso } = await admin.from('cursos').select('id').eq('clave', 'ajito').single()
const correo = `${PREFIJO}linea@iberia.invalid`
const { data: creado } = await admin.auth.admin.createUser({
  email: correo, email_confirm: true,
  user_metadata: { nombre_completo: 'Rosa Delgado', organizacion: 'iberia', rol: 'lector' },
})
const { data: ficha, error: eF } = await admin.from('empleados').insert({
  cedula: `${CEDULA}linea`, nombre_completo: 'Rosa Delgado', cargo: 'OPERADORA DE ENVASADO',
  nivel: 'planta', tipo_nomina: 'diaria', sede: 'cagua', familia_oficio: 'linea', perfil_id: creado.user.id,
}).select('id').single()
if (eF) throw eF
const { data: matricula } = await admin
  .from('matriculas')
  .insert({ curso_id: curso.id, empleado_id: ficha.id, familia_oficio: 'linea', nombre_corto: 'Rosa' })
  .select('id')
  .single()

const nav = await chromium.launch()
try {
  const ctx = await nav.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
  await ctx.addCookies(cookies(await sesion(correo)))
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error') problemas.push(`[consola] ${m.text()}`) })
  const cargada = (selector) =>
    p.waitForFunction((s) => {
      const imgs = [...document.querySelectorAll(s)]
      return imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0)
    }, selector, { timeout: 60000 })

  /** Toca el botón que late hasta que aparezca lo que se busca. */
  async function avanzarHasta(selector) {
    const destino = p.locator(selector)
    for (let i = 0; i < 10 && !(await destino.count()); i++) {
      const sigue = p.locator('button.btn-canal-sigue:not([disabled])').last()
      await sigue.waitFor({ timeout: 30000 })
      await sigue.click()
      // El turno que sigue puede no traer botón —termina en ejercicio—: se
      // espera a lo que se busca, no un rato fijo.
      await destino.first().waitFor({ timeout: 8000 }).catch(() => {})
    }
    await destino.first().waitFor({ timeout: 30000 })
  }

  async function pedir(clave, texto) {
    const tarjeta = p.locator(`[data-ejercicio="${clave}"]`)
    await tarjeta.locator('textarea').last().fill(texto)
    await tarjeta.getByRole('button', { name: 'Mandárselo a Ajito' }).click()
    await p.getByText('Ajito está dibujando').first().waitFor({ timeout: 5000 })
    return tarjeta
  }

  await p.goto(`${BASE}/canal/adiestramiento/4`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /empezar la lecci/i }).click()

  // --- 4.2 · los ejemplos ------------------------------------------------------
  await avanzarHasta('[data-ejemplos]')
  await cargada('[data-ejemplos] img')
  exigir((await p.locator('[data-ejemplos] img').count()) === 3, 'los tres ejemplos de Ajito cargan')
  await p.locator('[data-ejemplos]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/01-ejemplos.png` })
  exigir((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'el carrusel no desborda la página')

  // --- 4.3 · un pedido que no va, y otro que sí ---------------------------------
  await avanzarHasta('[data-ejercicio="libre"]')
  const libre = await pedir('libre', 'Dibuja a mi supervisor Carlos Pérez gritándole a todo el mundo')
  exigir(true, 'al mandar, sale «Ajito está dibujando…»')
  await p.locator('[data-devolucion="libre"]').waitFor({ timeout: 60000 })
  const negativa = await libre.locator('[data-devolucion-texto]').innerText()
  exigir(negativa.startsWith(NO_VA_PERSONA), `a una persona de verdad no la dibuja: «${negativa.slice(0, 60)}…»`)
  exigir((await libre.locator('[data-dibujo]').count()) === 0, 'y no hay dibujo')
  await libre.scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/02-no-va.png` })

  await libre.getByRole('button', { name: 'Pedir otro dibujo' }).click()
  await pedir('libre', 'Un perro criollo negro manejando una moto roja por una carretera de montaña al atardecer')
  await p.locator('[data-dibujo="libre"]').waitFor({ timeout: 60000 })
  await cargada('[data-dibujo="libre"]')
  exigir(true, 'pedido otro, el dibujo aparece')
  await p.locator('[data-devolucion="libre"] [data-devolucion-texto]').waitFor({ timeout: 60000 })
  const comentario = await p.locator('[data-devolucion="libre"] [data-devolucion-texto]').innerText()
  exigir(!/todav[ií]a no puedo/i.test(comentario), `Ajito comenta lo que dibujó: «${comentario.slice(0, 140)}…»`)
  await p.locator('[data-dibujo="libre"]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/03-dibujo.png` })

  // --- 4.5 · el escudo ----------------------------------------------------------
  await avanzarHasta('[data-ejercicio="escudo"]')
  await pedir('escudo', 'Un escudo con un toro rojo sobre fondo amarillo, con dos frascos de salsa cruzados y el lema Los del bache')
  await p.locator('[data-dibujo="escudo"]').waitFor({ timeout: 60000 })
  await cargada('[data-dibujo="escudo"]')
  await p.locator('[data-devolucion="escudo"] [data-devolucion-texto]').waitFor({ timeout: 60000 })
  const escudo = await p.locator('[data-devolucion="escudo"] [data-devolucion-texto]').innerText()
  exigir(/bache/i.test(escudo), `el escudo sale y Ajito nombra el lema: «${escudo.slice(0, 140)}…»`)
  await p.locator('[data-dibujo="escudo"]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/04-escudo.png` })

  const pesos = await p.evaluate(async () =>
    Promise.all([...document.querySelectorAll('[data-dibujo]')].map(async (i) => {
      const r = await fetch(i.src)
      return Math.round((await r.blob()).size / 1024)
    }))
  )
  exigir(pesos.length === 2 && pesos.every((kb) => kb < 400), `cada dibujo pesa poco para un plan de datos: ${pesos.join(' KB, ')} KB`)

  // --- «Publicarlo en el canal» -------------------------------------------------
  await p.getByRole('button', { name: 'Publicarlo en el canal' }).click()
  await p.locator('[data-publicado]').waitFor({ timeout: 30000 })
  exigir(true, 'publicado: la tarjeta del escudo dice que está en el canal')
  await p.locator('[data-publicado]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/05-publicado.png` })

  await p.goto(`${BASE}/canal`, { waitUntil: 'domcontentloaded' })
  const tarjeta = p.locator('article', { hasText: 'Este es el escudo que construí con Ajito' }).first()
  await tarjeta.waitFor({ timeout: 20000 })
  await p.waitForFunction(() => {
    const a = [...document.querySelectorAll('article')].find((x) => x.textContent.includes('Este es el escudo que construí con Ajito'))
    const img = a?.querySelector('img')
    return img && img.complete && img.naturalWidth > 0
  }, null, { timeout: 30000 })
  const caja = await tarjeta.locator('img').boundingBox()
  exigir(
    Boolean(caja) && Math.abs(caja.width - caja.height) < 4,
    `en el feed, con su nombre y el escudo entero: ${Math.round(caja?.width ?? 0)}×${Math.round(caja?.height ?? 0)}`
  )
  exigir(/Rosa Delgado/.test(await tarjeta.innerText()), 'firmado por quien lo hizo')
  await tarjeta.scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/06-feed.png` })

  const { data: filas } = await admin
    .from('respuestas')
    .select('clave_paso, dibujo, dibujo_veredicto')
    .eq('matricula_id', matricula.id)
    .order('created_at')
  exigir(
    JSON.stringify(filas?.map((f) => [f.clave_paso, f.dibujo_veredicto, Boolean(f.dibujo)])) ===
      JSON.stringify([['libre', 'persona', false], ['libre', 'va', true], ['escudo', 'va', true]]),
    `en la base, la negativa y los dos dibujos: ${JSON.stringify(filas?.map((f) => [f.clave_paso, f.dibujo_veredicto, Boolean(f.dibujo)]))}`
  )
} finally {
  await nav.close()
  await limpiar()
}
console.log(problemas.length ? `\n✖ ${problemas.length} problema(s):\n  · ${problemas.join('\n  · ')}` : '\n✓ Todo en orden')
