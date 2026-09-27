/**
 * El turno se abre a medida que se oye, y la manito señala el play. iPhone 14.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/mirar-progresivo.mjs
 *   … scripts/mirar-progresivo.mjs --base http://localhost:3001
 *
 * Mira lo que prometen `TurnoProgresivo` y `AudioAjito`:
 *  · al empezar la lección 0, el primer audio lleva la manito y «Vamos» no sale;
 *  · arrastrar la barra hasta el final no lo abre: la mitad cuenta lo que sonó;
 *  · oír la mitad sí lo abre, y al recargar sigue abierto;
 *  · en el cierre de la lección 5 —dos audios seguidos—, el segundo sale al oír
 *    la mitad del primero, y «Sigo ahora» al oír la mitad del segundo.
 *
 * Para no esperar minutos suena a 4×: la mitad se sigue midiendo en tiempo del
 * audio, así que cuenta igual. Crea un trabajador de prueba y lo borra al salir.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { barrerCarpeta } from './barrer-carpeta.mjs'
import { turnosDe } from '../lib/guion.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}
const BASE = args.base ?? 'https://iberiavenezuela.netlify.app'
const SALIDA = 'capturas/progresivo'
const PREFIJO = 'prueba-progresivo-'
const CEDULA = 'PRUEBA-PROGRESIVO-'
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

// El cierre de la lección 5 es su último turno: se deja la matrícula parada ahí.
const guion = JSON.parse(await readFile('contenido/adiestramiento/guion.json', 'utf8'))
const cinco = guion.lecciones.find((l) => l.numero === 5)
const ultimoTurno = turnosDe(cinco).length - 1
const { data: leccion5 } = await admin.from('lecciones').select('id').eq('curso_id', curso.id).eq('numero', 5).single()
await admin.from('avances').insert({ matricula_id: matricula.id, leccion_id: leccion5.id, estado: 'en_curso', paso: ultimoTurno })

const nav = await chromium.launch()
try {
  const ctx = await nav.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
  await ctx.addCookies(cookies(await sesion(correo)))
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error') problemas.push(`[consola] ${m.text()}`) })

  /** Pone a sonar el audio n de la página a 4× desde donde diga `desde`. */
  async function sonar(n, desde = 0) {
    await p.locator('[data-estado]').nth(n).locator('button').first().click()
    await p.waitForFunction((i) => {
      const a = document.querySelectorAll('audio')[i]
      return a && !a.paused && a.currentTime > 0
    }, n, { timeout: 30000 })
    await p.evaluate(([i, t]) => {
      const a = document.querySelectorAll('audio')[i]
      a.playbackRate = 4
      if (t) a.currentTime = t
    }, [n, desde])
  }
  const pausarTodo = () => p.evaluate(() => document.querySelectorAll('audio').forEach((a) => a.pause()))

  // --- lección 0: un audio y su botón ---------------------------------------------
  await p.goto(`${BASE}/canal/adiestramiento/0`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /empezar la lecci/i }).click()
  await p.locator('[data-estado]').first().waitFor()
  await p.waitForTimeout(800)
  exigir(await p.locator('[data-manito]').isVisible(), 'el primer audio lleva la manito')
  exigir((await p.getByRole('button', { name: 'Vamos' }).count()) === 0, '«Vamos» no sale antes de oír')
  await p.screenshot({ path: `${SALIDA}/01-manito.png` })

  // Saltarse el audio no cuenta: se lleva al final y termina sin haber sonado la mitad.
  await sonar(0, 32)
  await p.waitForFunction(() => document.querySelector('audio')?.ended, null, { timeout: 30000 })
  exigir((await p.getByRole('button', { name: 'Vamos' }).count()) === 0, 'saltar hasta el final no lo abre')
  exigir((await p.locator('[data-manito]').count()) === 0, 'la manito se va apenas sonó')

  // Oírlo de verdad sí.
  await sonar(0)
  await p.getByRole('button', { name: 'Vamos' }).waitFor({ timeout: 30000 })
  exigir(true, 'oída la mitad, sale «Vamos»')
  await pausarTodo()
  await p.waitForTimeout(1500)
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.locator('[data-estado]').first().waitFor()
  exigir(await p.getByRole('button', { name: 'Vamos' }).isVisible(), 'al recargar sigue abierto: la mitad quedó guardada')

  // --- lección 5: el cierre, dos audios seguidos -------------------------------------
  await p.goto(`${BASE}/canal/adiestramiento/5`, { waitUntil: 'domcontentloaded' })
  await p.locator('[data-estado]').first().waitFor()
  await p.waitForTimeout(800)
  // Los turnos de antes salen enteros; el actual, de a poco. Se cuentan los audios del actual.
  const total = await p.locator('[data-estado]').count()
  // El cierre de la 5 termina en «Sigo ahora» · «Sigo después»: «Sigo ahora» es terminar.
  const terminar = p.getByRole('button', { name: 'Sigo ahora' })
  exigir((await terminar.count()) === 0, '«Sigo ahora» no sale antes de oír el cierre')
  await p.locator('[data-estado]').nth(total - 1).scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/02-cierre-uno.png` })

  await sonar(total - 1)
  await p.waitForFunction((n) => document.querySelectorAll('[data-estado]').length > n, total, { timeout: 30000 })
  exigir(true, 'oída la mitad del primero, sale el segundo')
  exigir((await terminar.count()) === 0, 'y «Sigo ahora» todavía no')
  await pausarTodo()
  exigir(await p.locator('[data-estado]').nth(total).locator('[data-manito]').isVisible(), 'con la manito ahora en el segundo')
  await p.locator('[data-estado]').nth(total).scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/03-cierre-dos.png` })

  await sonar(total)
  await terminar.waitFor({ timeout: 30000 })
  exigir(true, 'oída la mitad del segundo, salen «Sigo ahora» y «Sigo después»')
  await pausarTodo()
  await terminar.scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/04-terminar.png` })
  exigir((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'sin desborde horizontal')
} finally {
  await nav.close()
  await limpiar()
}
console.log(problemas.length ? `\n✖ ${problemas.length} problema(s):\n  · ${problemas.join('\n  · ')}` : '\n✓ Todo en orden')
