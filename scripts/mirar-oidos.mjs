// Los audios oídos siguen con su ✓ al recargar la lección. iPhone 14, trabajador de prueba que se borra al salir.
// node --env-file=.env.local scripts/mirar-oidos.mjs [--base http://localhost:3001]
import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { barrerCarpeta } from './barrer-carpeta.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}
const BASE = args.base ?? 'https://iberiavenezuela.netlify.app'
const SALIDA = 'capturas/oidos'
const PREFIJO = 'prueba-mirar-'
const CEDULA = 'PRUEBA-MIRAR-'
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

const log = (...a) => console.log(' ', ...a)
const problemas = []
const exigir = (cond, msg) => { if (cond) log('✓', msg); else { log('✖', msg); problemas.push(msg) } }

await limpiar()
await mkdir(SALIDA, { recursive: true })
const { data: curso } = await admin.from('cursos').select('id').eq('clave', 'ajito').single()
const correo = `${PREFIJO}oidos@iberia.invalid`
const { data: creado } = await admin.auth.admin.createUser({
  email: correo, email_confirm: true,
  user_metadata: { nombre_completo: 'Rosa Delgado', organizacion: 'iberia', rol: 'lector' },
})
const { data: ficha, error: eF } = await admin.from('empleados').insert({
  cedula: `${CEDULA}oidos`, nombre_completo: 'Rosa Delgado', cargo: 'OPERADORA DE ENVASADO',
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
  const estados = () => p.locator('[data-estado]').evaluateAll((els) => els.map((e) => e.getAttribute('data-estado')))

  await p.goto(`${BASE}/canal/adiestramiento/0`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /empezar la lecci/i }).click()
  await p.getByRole('button', { name: 'Vamos' }).waitFor()

  // Al final del primer audio: se arrastra a 0:33 de 0:35 y se le da play.
  const barra = p.locator('input.barra-audio').first()
  await barra.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, '33')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await p.getByRole('button', { name: /^Escuchar/ }).first().click()
  await p.locator('[data-estado="oido"]').first().waitFor({ timeout: 30000 })
  exigir(true, 'al terminar, el primer audio queda con su ✓')
  await p.waitForTimeout(2500)

  const { data: avance } = await admin.from('avances').select('oidos').eq('matricula_id', matricula.id).maybeSingle()
  exigir(JSON.stringify(avance?.oidos) === '["1"]', `quedó anotado en la base: ${JSON.stringify(avance?.oidos)}`)

  await p.getByRole('button', { name: 'Vamos' }).click()
  await p.locator('[data-padron]').waitFor()
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.locator('[data-padron]').waitFor()
  await p.waitForTimeout(800)
  const trasRecargar = await estados()
  exigir(
    trasRecargar[0] === 'oido' && trasRecargar[1] === 'quieto',
    `al recargar, el oído sigue oído y el que falta no: ${trasRecargar.join(', ')}`
  )
  await p.screenshot({ path: `${SALIDA}/01-recargado.png`, fullPage: true })
} finally {
  await nav.close()
  await limpiar()
}
console.log(problemas.length ? `\n✖ ${problemas.length} problema(s):\n  · ${problemas.join('\n  · ')}` : '\n✓ Todo en orden')
