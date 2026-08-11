/**
 * Prueba de humo de las páginas con una sesión real.
 *
 *   node --env-file=.env.local scripts/probar-paginas.mjs --password "<clave admin>"
 *
 * Inicia sesión de verdad, deja que @supabase/ssr serialice la cookie (así el
 * formato es exactamente el que la app espera) y pide cada ruta comprobando
 * el status y un marcador de contenido.
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publicable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const CLAVE = args.password

if (!url || !publicable || !CLAVE) {
  console.error('\n✖ Faltan variables o --password.\n')
  process.exit(1)
}

let fallos = 0
let pruebas = 0

function verificar(nombre, condicion, detalle) {
  pruebas++
  if (condicion) console.log(`  ✔ ${nombre}`)
  else {
    fallos++
    console.log(`  ✖ ${nombre}`)
    if (detalle !== undefined) console.log('     ', String(detalle).slice(0, 300))
  }
}

// --- 1) Sesión real -----------------------------------------------------------

const plano = createClient(url, publicable, { auth: { persistSession: false } })
const { data: login, error: errorLogin } = await plano.auth.signInWithPassword({
  email: EMAIL,
  password: CLAVE,
})
if (errorLogin) {
  console.error(`\n✖ No se pudo iniciar sesión: ${errorLogin.message}\n`)
  process.exit(1)
}

// --- 2) Cookie serializada por la misma librería que la lee -------------------

const capturadas = []
const ssr = createServerClient(url, publicable, {
  cookies: {
    getAll: () => [],
    setAll: (cookies) => capturadas.push(...cookies),
  },
})

await ssr.auth.setSession({
  access_token: login.session.access_token,
  refresh_token: login.session.refresh_token,
})

if (capturadas.length === 0) {
  console.error('\n✖ @supabase/ssr no emitió cookies; no se puede simular la sesión.\n')
  process.exit(1)
}

const cookieHeader = capturadas.map((c) => `${c.name}=${c.value}`).join('; ')
console.log(`\nSesión lista · ${capturadas.length} cookie(s): ${capturadas.map((c) => c.name).join(', ')}`)

// --- 3) Recorrido de páginas --------------------------------------------------

async function pedir(ruta) {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  })
  const cuerpo = res.status < 400 ? await res.text() : ''
  return { status: res.status, ubicacion: res.headers.get('location'), cuerpo }
}

const RUTAS = [
  { ruta: '/dashboard', marcadores: ['Fase 1', 'Entrevistas registradas', 'Gabriel'] },
  { ruta: '/dashboard/entrevistas', marcadores: ['Entrevistas', 'Importar de Fireflies'] },
  {
    ruta: '/dashboard/entrevistas/importar',
    marcadores: ['Importar entrevistas', 'Arrastra los archivos', 'Crear a mano'],
  },
  { ruta: '/dashboard/entrevistas/nueva', marcadores: ['Nombre del entrevistado', 'Crear entrevista'] },
  { ruta: '/dashboard/archivos', marcadores: ['Archivos', 'Subir archivo'] },
  { ruta: '/dashboard/hallazgos', marcadores: ['Hallazgos'] },
  { ruta: '/dashboard/hallazgos/nuevo', marcadores: ['Crear hallazgo', 'Cita que lo respalda'] },
  { ruta: '/dashboard/informe', marcadores: ['Editor del informe', 'Levantamiento'] },
  { ruta: '/dashboard/informe/resumen-ejecutivo', marcadores: ['Resumen ejecutivo', 'Publicar esta secci'] },
  { ruta: '/dashboard/usuarios', marcadores: ['Provisionar acceso', 'Cuentas'] },
  { ruta: '/informe', marcadores: ['arquitectura de IA', 'construcci'] },
]

console.log('\n── Páginas con sesión de admin')

for (const { ruta, marcadores } of RUTAS) {
  const { status, ubicacion, cuerpo } = await pedir(ruta)

  if (status !== 200) {
    verificar(`${ruta} responde 200`, false, `HTTP ${status} → ${ubicacion ?? ''}`)
    continue
  }

  const faltantes = marcadores.filter((m) => !cuerpo.includes(m))
  verificar(
    `${ruta} (200, ${(cuerpo.length / 1024).toFixed(0)} kB)`,
    faltantes.length === 0,
    faltantes.length ? `faltan marcadores: ${faltantes.join(', ')}` : undefined
  )
}

// --- 4) El login redirige a quien ya tiene sesión -----------------------------

console.log('\n── Reglas de sesión')

const enLogin = await pedir('/login')
verificar(
  '/login con sesión redirige al dashboard',
  enLogin.status === 307 && enLogin.ubicacion?.includes('/dashboard'),
  `HTTP ${enLogin.status} → ${enLogin.ubicacion}`
)

const raiz = await pedir('/')
verificar(
  '/ con sesión lleva al dashboard',
  raiz.status === 307 && raiz.ubicacion?.includes('/dashboard'),
  `HTTP ${raiz.status} → ${raiz.ubicacion}`
)

// --- 5) Sin cookie, nada pasa -------------------------------------------------

const sinCookie = await fetch(`${BASE}/informe`, { redirect: 'manual' })
verificar(
  '/informe sin cookie redirige al login',
  sinCookie.status === 307 && sinCookie.headers.get('location')?.includes('/login'),
  `HTTP ${sinCookie.status} → ${sinCookie.headers.get('location')}`
)

// --- 6) Descarga por enlace firmado ------------------------------------------
// El bucket es privado: la ruta de descarga es el único camino y debe exigir
// sesión. Solo se comprueba si ya hay archivos cargados.

const conSesion = createClient(url, publicable, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${login.session.access_token}` } },
})
const { data: archivos } = await conSesion
  .from('archivos')
  .select('id, nombre, tamano_bytes')
  .limit(3)

if (!archivos?.length) {
  console.log('\n── Descargas\n  (sin archivos cargados: nada que comprobar)')
} else {
  console.log('\n── Descargas')

  for (const a of archivos) {
    const res = await fetch(`${BASE}/dashboard/archivos/${a.id}/descargar`, {
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    })
    const destino = res.headers.get('location') ?? ''
    const esFirmada = /token=/.test(destino)

    let bytes = 0
    if (esFirmada) {
      bytes = (await (await fetch(destino)).arrayBuffer()).byteLength
    }

    verificar(
      `${a.nombre.slice(0, 40)} → enlace firmado y bytes correctos`,
      esFirmada && bytes === a.tamano_bytes,
      `HTTP ${res.status} · firmada: ${esFirmada} · ${bytes} de ${a.tamano_bytes} bytes`
    )
  }

  const descargaSinSesion = await fetch(
    `${BASE}/dashboard/archivos/${archivos[0].id}/descargar`,
    { redirect: 'manual' }
  )
  verificar(
    'descargar sin sesión queda bloqueado',
    descargaSinSesion.status === 307 &&
      descargaSinSesion.headers.get('location')?.includes('/login'),
    `HTTP ${descargaSinSesion.status} → ${descargaSinSesion.headers.get('location')}`
  )
}

console.log(`\n${'─'.repeat(52)}`)
if (fallos === 0) {
  console.log(`✔ ${pruebas} verificaciones de páginas, todas en verde\n`)
} else {
  console.log(`✖ ${fallos} de ${pruebas} verificaciones fallaron\n`)
  process.exit(1)
}
