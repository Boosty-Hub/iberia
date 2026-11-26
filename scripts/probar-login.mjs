/**
 * El login antes de salir en vivo (26-nov-2026, pedido de Gabriel): sin «las cuentas las provisiona Boosty» ni «Boosty
 * International LLC», el ojito de la contraseña, el correo que no se borra al refrescar ni tras un intento fallido, y
 * «Salir» que cierra la sesión de ESE navegador y no la de los demás dispositivos de la persona.
 *
 *   node --env-file=.env.local scripts/probar-login.mjs [--base https://iberiavenezuela.netlify.app]
 *   RECORRIDO_CLAVE=… node --env-file=.env.local scripts/probar-login.mjs --base … --email <cuenta>   # con «Salir»
 *
 * Sin --email no entra con ninguna cuenta: el intento fallido usa un correo que no existe.
 */
import { chromium } from 'playwright'

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const BASE = arg('--base', 'http://localhost:3001')
const EMAIL = arg('--email', null)
const CLAVE = process.env.RECORRIDO_CLAVE
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

const nav = await chromium.launch()
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const texto = await p.locator('body').innerText()
  ok(!/provisiona/i.test(texto), 'sin «Las cuentas las provisiona el equipo de Boosty»')
  ok(!/International/i.test(texto), 'sin «Boosty International LLC» al pie')

  // El ojito.
  await p.locator('#password').fill('una-clave-cualquiera')
  ok((await p.locator('#password').getAttribute('type')) === 'password', 'la contraseña sale oculta')
  await p.getByRole('button', { name: 'Mostrar la contraseña' }).click()
  ok((await p.locator('#password').getAttribute('type')) === 'text' && (await p.locator('#password').inputValue()) === 'una-clave-cualquiera', 'el ojito la muestra')
  await p.getByRole('button', { name: 'Ocultar la contraseña' }).click()
  ok((await p.locator('#password').getAttribute('type')) === 'password', 'y la vuelve a ocultar')
  await p.screenshot({ path: 'capturas/login-telefono.png' })

  // El correo no se borra al refrescar.
  const correo = 'nadie.existe@ejemplo-iberia.test'
  await p.locator('#email').fill(correo)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(300)
  ok((await p.locator('#email').inputValue()) === correo, 'al refrescar, el correo escrito sigue ahí')

  // Ni tras un intento fallido.
  await p.locator('#password').fill('clave-equivocada-123')
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.locator('form [role=alert]').waitFor({ timeout: 20_000 })
  ok((await p.locator('#email').inputValue()) === correo, `tras un intento fallido, el correo sigue («${(await p.locator('form [role=alert]').innerText()).slice(0, 60)}»)`)
  await p.locator('#email').fill('')
  await ctx.close()

  // «Salir»: cierra este navegador y no los demás.
  if (EMAIL && CLAVE) {
    const entrar = async () => {
      const c = await nav.newContext({ viewport: { width: 1440, height: 900 } })
      const q = await c.newPage()
      await q.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await q.locator('#email').fill(EMAIL)
      await q.locator('#password').fill(CLAVE)
      await q.getByRole('button', { name: 'Entrar' }).click()
      await q.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 })
      return q
    }
    const otro = await entrar()
    const este = await entrar()
    await este.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
    await este.getByRole('button', { name: /tu cuenta/ }).click()
    await este.getByRole('button', { name: 'Salir' }).click()
    await este.waitForURL(/\/login/, { timeout: 30_000 })
    ok(true, '«Salir» lleva al login')
    await este.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
    ok(/\/login/.test(este.url()), 'después de salir, /sistema pide entrar otra vez')
    await otro.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
    ok(!/\/login/.test(otro.url()), 'la sesión del otro dispositivo sigue abierta')
  }
} finally {
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
