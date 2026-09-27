// La foto se manda sola, sin nota: lección 3, la selfie. iPhone 14, trabajador de prueba que se borra al salir.
// node --env-file=.env.local scripts/mirar-foto.mjs [--base http://localhost:3001]
import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { barrerCarpeta } from './barrer-carpeta.mjs'
import { oirLoQueFalta } from './oir-lo-que-falta.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}
const BASE = args.base ?? 'https://iberiavenezuela.netlify.app'
const SALIDA = 'capturas/foto'
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
const correo = `${PREFIJO}foto@iberia.invalid`
const { data: creado } = await admin.auth.admin.createUser({
  email: correo, email_confirm: true,
  user_metadata: { nombre_completo: 'Rosa Delgado', organizacion: 'iberia', rol: 'lector' },
})
const { data: ficha, error: eF } = await admin.from('empleados').insert({
  cedula: `${CEDULA}foto`, nombre_completo: 'Rosa Delgado', cargo: 'OPERADORA DE ENVASADO',
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

  await p.goto(`${BASE}/canal/adiestramiento/3`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /empezar la lecci/i }).click()

  // Se avanza con el botón que late hasta que aparezca el ejercicio de la selfie.
  const selfie = p.locator('[data-ejercicio="selfie"]')
  for (let i = 0; i < 8 && !(await selfie.count()); i++) {
    await oirLoQueFalta(p)
    if (await selfie.count()) break
    const sigue = p.locator('button.btn-canal-sigue:not([disabled])').last()
    await sigue.waitFor({ timeout: 20000 })
    const turnos = await p.locator('section').count()
    await sigue.click()
    // Se espera el turno nuevo: si no, no hay manito que oír todavía.
    await p.waitForFunction((n) => document.querySelectorAll('section').length > n, turnos, { timeout: 20000 }).catch(() => {})
  }
  await oirLoQueFalta(p)
  await selfie.waitFor({ timeout: 20000 })
  exigir(await selfie.locator('textarea').count() === 0, 'la selfie no pide escribir nada')

  const t0 = Date.now()
  await selfie.locator('input[type="file"]').setInputFiles('public/marca/ajito.png')
  await p.getByText(/Mandándole la foto a Ajito|Ajito está viendo lo que le mandaste/).waitFor({ timeout: 5000 })
  exigir(Date.now() - t0 < 2000, `al elegir la foto, sale mandándose en el acto (${Date.now() - t0} ms)`)
  exigir(await selfie.locator('img[alt="La foto que mandaste"]').count() === 1, 'mientras se manda, se ve la foto')
  await p.screenshot({ path: `${SALIDA}/01-mandando.png` })

  await p.locator('[data-devolucion="selfie"]').waitFor({ timeout: 90000 })
  const dicho = await p.locator('[data-devolucion="selfie"] [data-devolucion-texto]').innerText()
  exigir(dicho.length > 40, `Ajito contestó sobre la foto: ${dicho.slice(0, 160)}…`)
  const foto = p.locator('[data-foto-enviada]')
  await foto.waitFor({ timeout: 15000 })
  await p.waitForFunction(() => {
    const img = document.querySelector('[data-foto-enviada]')
    return img && img.complete && img.naturalWidth > 0
  }, null, { timeout: 15000 })
  exigir(true, 'la foto enviada queda a la vista arriba de la devolución')
  await selfie.scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${SALIDA}/02-contestada.png` })

  const { data: fila } = await admin
    .from('respuestas')
    .select('entrada, texto, media_url, devolucion')
    .eq('matricula_id', matricula.id)
    .eq('clave_paso', 'selfie')
    .single()
  exigir(fila?.entrada === 'foto' && fila?.texto === null && Boolean(fila?.media_url) && Boolean(fila?.devolucion),
    `quedó como foto sin nota, con su devolución: ${JSON.stringify({ ...fila, devolucion: fila?.devolucion?.slice(0, 30) })}`)
  exigir((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'sin desborde horizontal')
} finally {
  await nav.close()
  await limpiar()
}
console.log(problemas.length ? `\n✖ ${problemas.length} problema(s):\n  · ${problemas.join('\n  · ')}` : '\n✓ Todo en orden')
