/**
 * Recorre el calendario de la Fase 2 y New Iberia (`/dashboard/calendario`):
 *
 *   1. En escritorio, actualiza una actividad desde la agenda —estado, fecha
 *      confirmada y nota—, recarga y mira que quedó; después la devuelve a como
 *      estaba, por la base. ⚠️ Escribe en producción: la fila vuelve a su estado
 *      original al terminar, también si algo falla a mitad.
 *   2. En un iPhone 14, que la página no se desborde de lado —la línea de tiempo
 *      se desliza dentro de su tarjeta, la página no— y deja las capturas.
 *
 *   node --env-file=.env.local scripts/mirar-calendario.mjs [--base http://localhost:3001]
 *
 * La sesión se acuña con un enlace mágico, como `capturar`: sin contraseña.
 */
import { chromium, devices } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, a, i, todos) => {
    if (a.startsWith('--')) pares.push([a.slice(2), todos[i + 1]?.startsWith('--') ? true : (todos[i + 1] ?? true)])
    return pares
  }, [])
)
const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3001'
const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const ID = 'tarjeta'

const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

async function cookies() {
  const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
  if (error) throw new Error(`no se pudo emitir el enlace: ${error.message}`)
  const { data, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (e2) throw new Error(`no se pudo canjear el enlace: ${e2.message}`)
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url')
  const LIMITE = 3180
  const partes =
    valor.length <= LIMITE
      ? [{ name: `sb-${ref}-auth-token`, value: valor }]
      : Array.from({ length: Math.ceil(valor.length / LIMITE) }, (_, i) => ({
          name: `sb-${ref}-auth-token.${i}`,
          value: valor.slice(i * LIMITE, (i + 1) * LIMITE),
        }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

let fallos = 0
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✔' : '✘'} ${texto}`)
  if (!ok) fallos++
}

const { data: original, error: errOriginal } = await admin
  .from('calendario_actividades')
  .select('estado, fecha_confirmada, nota, updated_by')
  .eq('id', ID)
  .single()
if (errOriginal) throw new Error(`no se encontró la actividad «${ID}»: ${errOriginal.message}`)

await mkdir('capturas', { recursive: true })
const navegador = await chromium.launch()
const sesion = await cookies()

try {
  // --- 1) actualizar desde la agenda ------------------------------------------
  const escritorio = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-VE' })
  await escritorio.addCookies(sesion)
  const p = await escritorio.newPage()
  await p.goto(`${BASE}/dashboard/calendario`)
  await p.getByRole('heading', { name: 'Calendario del proyecto' }).waitFor()

  const fila = p.locator('li', { hasText: 'Iberia habilita la tarjeta de pago' }).last()
  await fila.getByRole('button', { name: 'Actualizar' }).click()
  await fila.locator('select[name="estado"]').selectOption('agendado')
  await fila.locator('input[name="fecha_confirmada"]').fill('2026-11-06')
  await fila.locator('input[name="nota"]').fill('Prueba de mirar-calendario')
  await fila.getByRole('button', { name: 'Guardar' }).click()
  // Al guardar, el formulario se cierra y la fila se pinta con lo nuevo.
  await fila.locator('form').waitFor({ state: 'detached' })
  await fila.getByText('Prueba de mirar-calendario').waitFor()
  await p.screenshot({ path: 'capturas/calendario-editar.png' })

  const { data: guardada } = await admin.from('calendario_actividades').select('estado, fecha_confirmada, nota').eq('id', ID).single()
  comprobar(
    guardada.estado === 'agendado' && guardada.fecha_confirmada === '2026-11-06' && guardada.nota === 'Prueba de mirar-calendario',
    'la actualización llegó a la base'
  )

  await p.reload()
  await p.getByRole('heading', { name: 'Calendario del proyecto' }).waitFor()
  const recargada = p.locator('li', { hasText: 'Iberia habilita la tarjeta de pago' }).last()
  // Se espera a lo que se busca, no un tiempo fijo: `isVisible` no espera.
  const aparece = (texto) =>
    recargada.getByText(texto).waitFor({ timeout: 10000 }).then(() => true, () => false)
  comprobar(await aparece('Confirmada: 6 nov'), 'al recargar, la fila dice la fecha confirmada')
  comprobar(await aparece('Prueba de mirar-calendario'), 'y la nota')

  // Sin sesión, la tabla no se lee. Con un cliente nuevo: `anon` ya canjeó el
  // enlace y lleva la sesión adentro.
  const publico = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data: sinSesion, error: errSinSesion } = await publico.from('calendario_actividades').select('id').limit(1)
  comprobar(Boolean(errSinSesion) || !sinSesion?.length, 'sin sesión, el calendario no se lee')

  // --- 1b) la línea de tiempo se despliega por frente ---------------------------
  const { data: todas } = await admin.from('calendario_actividades').select('frente')
  const deCoordinacion = todas.filter((a) => a.frente === 'coordinacion').length
  const linea = p.locator('section[aria-labelledby="cal-linea"]')
  const coordinacion = linea.getByRole('button', { name: /^Coordinación/ })
  await coordinacion.click()
  comprobar((await coordinacion.getAttribute('aria-expanded')) === 'true', 'tocar «Coordinación» la despliega')
  const filasCoord = await linea.locator('#cal-frente-coordinacion > li').count()
  comprobar(filasCoord === deCoordinacion, `y sale una pista por actividad (${filasCoord} de ${deCoordinacion})`)
  await linea.screenshot({ path: 'capturas/calendario-linea-coordinacion.png' })
  await coordinacion.click()
  comprobar((await linea.locator('#cal-frente-coordinacion').count()) === 0, 'tocarla otra vez la contrae')

  await linea.getByRole('button', { name: 'Ver todos en detalle' }).click()
  const filasTodas = await linea.locator('ul[id^="cal-frente-"] > li').count()
  comprobar(filasTodas === todas.length, `«Ver todos en detalle» abre los ocho frentes (${filasTodas} de ${todas.length})`)
  await linea.screenshot({ path: 'capturas/calendario-linea-todos.png' })
  await linea.getByRole('button', { name: 'Contraer todos' }).click()
  await escritorio.close()

  // --- 2) el teléfono -----------------------------------------------------------
  const telefono = await navegador.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
  await telefono.addCookies(sesion)
  const t = await telefono.newPage()
  await t.goto(`${BASE}/dashboard/calendario`)
  await t.getByRole('heading', { name: 'Calendario del proyecto' }).waitFor()
  const desborde = await t.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  comprobar(desborde <= 0, `en un iPhone 14 la página no se desborda de lado (${desborde} px)`)
  await t.screenshot({ path: 'capturas/calendario-iphone.png' })
  await t.locator('#cal-linea').scrollIntoViewIfNeeded()
  await t.screenshot({ path: 'capturas/calendario-iphone-linea.png' })
  await t.locator('section[aria-labelledby="cal-linea"]').getByRole('button', { name: /^Tecnología/ }).click()
  const desbordeAbierto = await t.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  comprobar(desbordeAbierto <= 0, `con un frente abierto tampoco se desborda (${desbordeAbierto} px)`)
  await t.screenshot({ path: 'capturas/calendario-iphone-linea-abierta.png' })
  await telefono.close()
} finally {
  await admin.from('calendario_actividades').update(original).eq('id', ID)
  const { data: vuelta } = await admin.from('calendario_actividades').select('estado, nota').eq('id', ID).single()
  comprobar(vuelta.estado === original.estado && vuelta.nota === original.nota, `«${ID}» quedó como estaba`)
  await navegador.close()
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nSin fallos')
process.exit(fallos ? 1 : 0)
