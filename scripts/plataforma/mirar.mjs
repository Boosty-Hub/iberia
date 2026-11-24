/**
 * Plataforma Iberia · verificación visual contra el PROYECTO DE PRUEBAS.
 *
 * Acuña la sesión de una cuenta de prueba (sin contraseña, con la clave de
 * servicio del proyecto de pruebas), recorre las rutas pedidas en escritorio y
 * en teléfono, y deja las capturas en `capturas/sistema/`. Reporta errores de
 * consola, respuestas 500 y desborde horizontal. Las cuentas de prueba se crean
 * solas la primera vez; nunca se usa la cuenta de una persona de Iberia.
 *
 *   node --env-file=.env.local scripts/plataforma/mirar.mjs /sistema /sistema/nucleo/procesos
 *   … --como usuario       # la cuenta de prueba con rol «Usuario Iberia»
 *   … --como iberia        # administrador de la organización Iberia (como Alberto)
 *   … --base http://localhost:3005 --solo-escritorio
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3005')
const COMO = opc('--como', 'admin')
const SOLO_ESCRITORIO = argv.includes('--solo-escritorio')
const rutas = argv.filter((a, i) => a.startsWith('/') && !['--base', '--como'].includes(argv[i - 1]))
if (!rutas.length) rutas.push('/sistema')

const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')

// Cuentas de prueba: personas ficticias, solo en el proyecto de pruebas.
const CUENTAS = {
  admin: { email: 'admin.pruebas@plataforma.local', nombre: 'Administración de pruebas', rol: 'administrador' },
  consultor: { email: 'consultor.pruebas@plataforma.local', nombre: 'Consultoría de pruebas', rol: 'consultor' },
  usuario: { email: 'usuario.pruebas@plataforma.local', nombre: 'Usuaria de pruebas', rol: 'usuario-iberia' },
  lector: { email: 'lector.pruebas@plataforma.local', nombre: 'Lectura de pruebas', rol: 'lector' },
  // Como Alberto: administrador, pero de Iberia. No es del equipo de Boosty (no ve lo «solo equipo»).
  iberia: { email: 'admin.iberia.pruebas@plataforma.local', nombre: 'Administración Iberia de pruebas', rol: 'administrador', organizacion: 'iberia' },
  // Las del canal (las siembra sembrar-canal-pruebas.mjs): una operaria de planta y quien publica y modera.
  planta: { email: 'canal.pruebas@plataforma.local', nombre: 'Operaria Prueba', rol: 'personal-planta', organizacion: 'iberia' },
  comunica: { email: 'comunica.pruebas@plataforma.local', nombre: 'Comunicaciones Prueba', rol: 'lector', organizacion: 'iberia' },
}
const cuenta = CUENTAS[COMO]
if (!cuenta) throw new Error(`--como debe ser uno de: ${Object.keys(CUENTAS).join(', ')}`)

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })

async function asegurarCuenta() {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 })
  let u = lista?.users?.find((x) => x.email === cuenta.email)
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({
      email: cuenta.email,
      email_confirm: true,
      user_metadata: { nombre_completo: cuenta.nombre, rol_clave: cuenta.rol, organizacion: cuenta.organizacion ?? 'boosty' },
    })
    if (error) throw new Error(`no se pudo crear ${cuenta.email}: ${error.message}`)
    u = data.user
  }
  const { data: rol } = await admin.from('roles').select('id').eq('clave', cuenta.rol).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: cuenta.nombre, organizacion: cuenta.organizacion ?? 'boosty' }).eq('id', u.id)
  return u
}

function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  const { hostname } = new URL(BASE)
  return partes.map((p) => ({ ...p, domain: hostname, path: '/' }))
}

await asegurarCuenta()
const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: cuenta.email })
if (e1) throw e1
const { data: ver, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
if (e2) throw e2

await mkdir('capturas/sistema', { recursive: true })
const nav = await chromium.launch()
const tamanos = SOLO_ESCRITORIO ? [['escritorio', 1440, 900]] : [['escritorio', 1440, 900], ['telefono', 390, 844]]
let fallos = 0
for (const [nombreTam, w, h] of tamanos) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await ctx.addCookies(cookies(ver.session))
  const pagina = await ctx.newPage()
  const errores = []
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  pagina.on('pageerror', (e) => errores.push(String(e)))
  for (const ruta of rutas) {
    errores.length = 0
    const r = await pagina.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 90000 })
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const archivo = `capturas/sistema/${COMO}-${nombreTam}-${ruta.replace(/[\/?=&:]+/g, '_').replace(/^_/, '') || 'raiz'}.png`
    await pagina.screenshot({ path: archivo, fullPage: true })
    const mal = r.status() >= 400 || errores.length || desborde > 2 || !pagina.url().includes(ruta.split('?')[0])
    if (mal) fallos++
    console.log(`${mal ? '✖' : '✓'} ${nombreTam} ${ruta} → ${r.status()} ${pagina.url().replace(BASE, '')}${desborde > 2 ? ` · desborda ${desborde}px` : ''} · ${archivo}`)
    for (const e of errores.slice(0, 5)) console.log(`    consola: ${e.slice(0, 300)}`)
  }
  await ctx.close()
}
await nav.close()
process.exit(fallos ? 1 : 0)
