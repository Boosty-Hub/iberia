/**
 * Matricular desde el padrón a alguien que ya tiene cuenta, de punta a punta.
 *
 *   node --env-file=.env.local scripts/mirar-padron-cuentas.mjs                       # producción
 *   node --env-file=.env.local scripts/mirar-padron-cuentas.mjs --base http://localhost:3001
 *
 * El 27 de septiembre de 2026 Gabriel creó la cuenta de Martha Fuentes en Usuarios,
 * la matriculó en el padrón y ella seguía sin entrar: había matriculado la ficha de
 * muestra de agosto, que la repetía, y su cuenta seguía sin ficha. Esto arma ese
 * mismo caso con gente de prueba —una ficha de Capital Humano, su copia de muestra
 * y una cuenta de Iberia sin ficha— y lo recorre como lo haría Gabriel: la copia
 * sale marcada y sin casilla, la ficha real ofrece enlazar la cuenta, se enlaza,
 * se matricula, y la persona entra al canal y al curso. Al salir borra todo.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}
const BASE = args.base ?? 'https://iberiavenezuela.netlify.app'
const EDITOR = args.email ?? 'gmontiel@spatiumgroup.com'
const SALIDA = 'capturas/padron-cuentas'
const CEDULA = 'PRUEBA-PADRON-'
const CORREO = 'prueba-padron-cuenta@iberia.invalid'
// Un nombre que no está en el padrón de verdad, para que el cruce no tropiece con nadie.
const REAL = 'Zoraida Pruebaviva Quintal'
const MUESTRA = 'Zoraida Pruebaviva'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

async function limpiar() {
  await admin.from('empleados').delete().like('cedula', `${CEDULA}%`)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users.filter((u) => u.email === CORREO)) await admin.auth.admin.deleteUser(u.id)
}

async function cookiesDe(correo) {
  const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: correo })
  const { data: v } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(v.session)).toString('base64url')
  const trozos = []
  for (let i = 0; i < valor.length; i += 3180) {
    trozos.push({ name: valor.length <= 3180 ? `sb-${ref}-auth-token` : `sb-${ref}-auth-token.${trozos.length}`, value: valor.slice(i, i + 3180) })
  }
  return trozos.map((c) => ({ ...c, domain: new URL(BASE).hostname, path: '/', secure: BASE.startsWith('https'), sameSite: 'Lax' }))
}

const fallos = []
const ver = (c, m, d = '') => {
  console.log(`  ${c ? '✓' : '✖'} ${m}${!c && d ? ` · ${d}` : ''}`)
  if (!c) fallos.push(m)
}

await limpiar()
await mkdir(SALIDA, { recursive: true })

const comun = { cargo: 'ANALISTA DE PRUEBAS', nivel: 'administrativo', tipo_nomina: 'mensual', familia_oficio: 'generico' }
const { data: real } = await admin
  .from('empleados')
  .insert({ ...comun, cedula: `${CEDULA}1`, ficha: '99001', nombre_completo: REAL })
  .select('id')
  .single()
const { data: muestra } = await admin
  .from('empleados')
  .insert({ ...comun, cedula: `${CEDULA}2`, nombre_completo: MUESTRA })
  .select('id')
  .single()
// La cuenta, como la crea Usuarios: con su correo, sin ficha.
const { data: cuenta } = await admin.auth.admin.createUser({
  email: CORREO,
  email_confirm: true,
  user_metadata: { nombre_completo: MUESTRA, organizacion: 'iberia', rol: 'lector', rol_clave: 'lector' },
})

const nav = await chromium.launch()
try {
  console.log('\nEn el padrón')
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-VE' })
  await ctx.addCookies(await cookiesDe(EDITOR))
  const p = await ctx.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error') fallos.push(`[consola] ${m.text()}`)
  })
  // Sin tilde, a propósito: la búsqueda no las distingue.
  await p.goto(`${BASE}/dashboard/empleados?q=pruebaviva`, { waitUntil: 'networkidle' })
  // Por el número de ficha: la copia también nombra a la real en su aviso.
  const filaReal = p.locator('tbody tr').filter({ has: p.locator('p', { hasText: /^Ficha 99001/ }) })
  const filaMuestra = p.locator('tbody tr', { hasText: 'Cargada a mano' })
  ver((await p.locator('tbody tr').count()) === 2, 'la búsqueda trae las dos')
  ver((await filaMuestra.locator('[data-duplicada]').count()) === 1, 'la copia sale como ficha de muestra repetida')
  ver(await filaMuestra.locator('input[type="checkbox"]').isDisabled(), 'y no se puede marcar')
  const propuesta = filaReal.locator('[data-cuenta-propuesta]')
  ver((await propuesta.count()) === 1 && (await propuesta.innerText()).includes(CORREO), 'la ficha real ofrece enlazar su cuenta')
  await p.screenshot({ path: `${SALIDA}/1-antes.png`, fullPage: true })

  await propuesta.getByRole('button', { name: 'Enlazar' }).click()
  await filaReal.locator('[data-cuenta]', { hasText: CORREO }).waitFor({ timeout: 20000 }).catch(() => {})
  ver((await filaReal.locator('[data-cuenta]').innerText()).includes(CORREO), 'enlazada: la fila dice su cuenta')

  await filaReal.locator('input[type="checkbox"]').check()
  await p.getByRole('button', { name: /^Matricular/ }).click()
  await filaReal.getByText('0 de 9').waitFor({ timeout: 20000 }).catch(() => {})
  ver((await filaReal.getByText('0 de 9').count()) === 1, 'y matriculada')
  await p.screenshot({ path: `${SALIDA}/2-despues.png`, fullPage: true })

  const { data: fila } = await admin.from('empleados').select('perfil_id').eq('id', real.id).single()
  ver(fila.perfil_id === cuenta.user.id, 'en la base, la ficha real cuelga de su cuenta')
  const { count: deLaMuestra } = await admin.from('matriculas').select('id', { count: 'exact', head: true }).eq('empleado_id', muestra.id)
  ver(deLaMuestra === 0, 'y la copia no quedó matriculada')
  await ctx.close()

  console.log('\nLa persona')
  const suyo = await nav.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
  await suyo.addCookies(await cookiesDe(CORREO))
  const q = await suyo.newPage()
  await q.goto(`${BASE}/canal`, { waitUntil: 'networkidle' })
  ver(new URL(q.url()).pathname === '/canal', 'entra al canal', q.url())
  await q.goto(`${BASE}/canal/adiestramiento`, { waitUntil: 'networkidle' })
  ver((await q.locator('a[href="/canal/adiestramiento/0"]').count()) >= 1, 'y el curso le abre sus lecciones')
  await q.goto(`${BASE}/canal/adiestramiento/0`, { waitUntil: 'networkidle' })
  ver((await q.getByText(/Lección 0/).count()) >= 1, 'la lección 0 abre')
  await q.screenshot({ path: `${SALIDA}/3-curso.png` })
  await suyo.close()
} finally {
  await nav.close()
  await limpiar()
  console.log('\n  · limpieza: fichas y cuenta de prueba borradas')
}

if (fallos.length) {
  console.log(`\n✖ ${fallos.length} problema(s):`)
  for (const f of fallos) console.log(`  · ${f}`)
  process.exit(1)
}
console.log(`\nSin fallos. Capturas en ${SALIDA}/ — ahora hay que abrirlas.\n`)
