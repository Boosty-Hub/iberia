/**
 * `/auth/continuar` contra PRUEBAS: que abrir el enlace (lo que hace Safe Links de Microsoft) no lo gaste,
 * que el botón abra la sesión y lleve a donde dice, y que un enlace usado o inventado no entre.
 *
 *   node --env-file=.env.local scripts/correo/probar-continuar.mjs [--base http://localhost:3005] [--email lector.pruebas@plataforma.local]
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const valor = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d)
const base = valor('--base', 'http://localhost:3005')
const email = valor('--email', 'lector.pruebas@plataforma.local')
const admin = createClient(process.env.SUPABASE_PRUEBAS_URL, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })

let fallas = 0
const ok = (cond, texto) => {
  console.log(`${cond ? '✓' : '✗'} ${texto}`)
  if (!cond) fallas++
}

async function enlace(tipo) {
  const { data, error } = await admin.auth.admin.generateLink({ type: tipo, email })
  if (error) throw error
  return data.properties.hashed_token
}

const nav = await chromium.launch()
try {
  // 1. Recuperar: un «escáner» abre el enlace (GET, sigue redirecciones) y después la persona toca el botón.
  const hash = await enlace('recovery')
  const url = `${base}/auth/continuar?token_hash=${hash}&type=recovery&siguiente=%2Flogin%2Fnueva-clave`
  const escaneo = await fetch(url, { redirect: 'follow' })
  ok(escaneo.status === 200, `el escáner abre la página sin gastar nada (${escaneo.status})`)
  const ctx = await nav.newContext()
  const pag = await ctx.newPage()
  await pag.goto(url)
  ok(await pag.getByRole('heading', { name: 'Crea tu contraseña nueva' }).isVisible(), 'la página dice qué va a pasar')
  await pag.getByRole('button', { name: 'Continuar' }).click()
  await pag.waitForURL('**/login/nueva-clave', { timeout: 20000 })
  ok(await pag.getByText(email).isVisible(), 'el botón abre la sesión y lleva a crear la contraseña (con el correo de la cuenta)')
  await pag.screenshot({ path: 'capturas/correos/continuar-nueva-clave.png' })

  // 2. El mismo enlace otra vez: ya no sirve.
  const pag2 = await (await nav.newContext()).newPage()
  await pag2.goto(url)
  await pag2.getByRole('button', { name: 'Continuar' }).click()
  await pag2.waitForURL('**/login/recuperar?aviso=vencido', { timeout: 20000 })
  ok(true, 'un enlace usado manda a pedir otro')

  // 3. Enlace de acceso (magic link) → a su casa.
  const hash3 = await enlace('magiclink')
  const pag3 = await (await nav.newContext()).newPage()
  await pag3.goto(`${base}/auth/continuar?token_hash=${hash3}&type=magiclink&siguiente=%2F`)
  await pag3.screenshot({ path: 'capturas/correos/continuar-pagina.png' })
  await pag3.getByRole('button', { name: 'Entrar' }).click()
  await pag3.waitForURL((u) => !u.pathname.startsWith('/auth') && u.pathname !== '/', { timeout: 60000 })
  ok(!new URL(pag3.url()).pathname.startsWith('/login'), `el enlace de acceso entra y lleva a su casa (${new URL(pag3.url()).pathname})`)

  // 4. Inventado, tipo raro y «siguiente» hacia afuera.
  const pag4 = await (await nav.newContext()).newPage()
  await pag4.goto(`${base}/auth/continuar?token_hash=inventado&type=recovery`)
  await pag4.getByRole('button', { name: 'Continuar' }).click()
  await pag4.waitForURL('**/login/recuperar?aviso=vencido', { timeout: 20000 })
  ok(true, 'un enlace inventado no entra')
  await pag4.goto(`${base}/auth/continuar?token_hash=x&type=otro`)
  ok(pag4.url().includes('/login/recuperar?aviso=vencido'), 'un tipo desconocido no muestra el botón')
  const hash5 = await enlace('magiclink')
  await pag4.goto(`${base}/auth/continuar?token_hash=${hash5}&type=magiclink&siguiente=%2F%2Fejemplo.com`)
  await pag4.getByRole('button', { name: 'Entrar' }).click()
  await pag4.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30000 })
  ok(new URL(pag4.url()).host === new URL(base).host, `«siguiente» hacia otro sitio se queda en casa (${new URL(pag4.url()).host})`)
} finally {
  await nav.close()
}
console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo bien')
process.exit(fallas ? 1 : 0)
