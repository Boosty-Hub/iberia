/**
 * Comprueba los tutoriales en pantalla: en cada pestaña con video sale «Ver tutorial», el popup abre y el video carga y
 * avanza. Por defecto contra pruebas (build del 3007); con `--produccion` contra el sitio, con la sesión de una cuenta
 * del equipo (enlace mágico con la clave de servicio, como `capturar`).
 *
 *   node --env-file=.env.local scripts/plataforma/tutoriales/probar.mjs [--base http://localhost:3007] [--produccion --email <correo>]
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { sesionDePrueba } from './grabacion.mjs'

const args = process.argv.slice(2)
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const PROD = args.includes('--produccion')
const BASE = opc('--base', PROD ? 'https://iberiavenezuela.netlify.app' : 'http://localhost:3007')

async function sesionProduccion(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data: e, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const { data: v } = await anon.auth.verifyOtp({ token_hash: e.properties.hashed_token, type: 'magiclink' })
  const nombre = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(v.session)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

const cookies = PROD ? await sesionProduccion(opc('--email')) : await sesionDePrueba(BASE)
const db = PROD
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  : createClient(process.env.SUPABASE_PRUEBAS_URL, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const { data: tutoriales } = await db.schema('ui').from('tutorial').select('ruta, titulo').order('modulo').order('orden')

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(cookies)
const p = await ctx.newPage()
let fallos = 0
for (const t of tutoriales) {
  await p.goto(BASE + t.ruta, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const b = p.getByRole('button', { name: 'Ver tutorial' })
  const hay = await b.waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
  if (!hay) {
    console.log(`✖ ${t.ruta}: sin botón`)
    fallos++
    continue
  }
  // En producción el clic puede llegar antes de que la página se hidrate: se espera y se reintenta una vez.
  await p.waitForLoadState('networkidle').catch(() => {})
  await b.click()
  const v = p.locator('dialog[open] video')
  if (!(await v.waitFor({ timeout: 6000 }).then(() => true).catch(() => false))) {
    await b.click()
    await v.waitFor({ timeout: 10000 })
  }
  const ok = await v
    .evaluate(
      (el) =>
        new Promise((res) => {
          const fin = setTimeout(() => res({ estado: el.readyState, t: el.currentTime, error: el.error?.code ?? null }), 12000)
          el.muted = true
          el.play().catch(() => {})
          el.addEventListener('timeupdate', function f() {
            if (el.currentTime > 1) {
              el.removeEventListener('timeupdate', f)
              clearTimeout(fin)
              res({ estado: el.readyState, t: el.currentTime, error: null })
            }
          })
        })
    )
    .catch((e) => ({ error: String(e) }))
  const bien = !ok.error && ok.t > 1
  console.log(`${bien ? '✓' : '✖'} ${t.titulo} (${t.ruta}) · ${JSON.stringify(ok)}`)
  if (!bien) fallos++
  if (t === tutoriales[0]) await p.screenshot({ path: 'capturas/tutoriales/popup.png' })
  await p.keyboard.press('Escape')
}
await nav.close()
console.log(fallos ? `\n${fallos} fallos` : `\nTodo bien: ${tutoriales.length} tutoriales`)
process.exit(fallos ? 1 : 0)
