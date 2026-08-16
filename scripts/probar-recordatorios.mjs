/**
 * El empujón: la escalera y los mensajes que salen.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/probar-recordatorios.mjs
 *
 * Dos mitades, y las dos hacen falta:
 *
 *  1. **La escalera, sin red.** Que se lea del guion, que devuelva el escalón
 *     más alto vencido y no todos, y que no repita uno ya mandado. Y el
 *     normalizador de teléfonos, que es donde un dato mal copiado en el padrón
 *     se convierte en un mensaje a un desconocido.
 *
 *  2. **Los mensajes de verdad.** Se montan tres trabajadores con distintos días
 *     de silencio, se le da al botón del panel y se comprueba que a cada quien
 *     le tocó el escalón que le tocaba — y que darle dos veces no manda dos.
 *
 * Necesita el servidor de desarrollo levantado.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { escalera, escalonQueToca, redactar } from '../lib/recordatorios.ts'
import { aInternacional, comoSeLee } from '../lib/telefono.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL_ADMIN = args.email ?? 'gmontiel@spatiumgroup.com'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

const PREFIJO = 'prueba-empujon-'
const CEDULA = 'PRUEBA-EMPUJON-'

const problemas = []
let pasadas = 0

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) {
    pasadas++
    console.log(`  ✓ ${descripcion}`)
  } else {
    problemas.push(`${descripcion}${detalle ? ` · ${detalle}` : ''}`)
    console.log(`  ✖ ${descripcion}${detalle ? ` · ${detalle}` : ''}`)
  }
}

// =============================================================================
// 1) La escalera, sin red
// =============================================================================

console.log('\nLa escalera\n')

const pasos = escalera(readFileSync('contenido/adiestramiento/recordatorios.md', 'utf8'))

comprobar(`se leen los escalones del guion (${pasos.map((p) => p.dias).join(', ')})`, pasos.length >= 4)
comprobar(
  'vienen ordenados por días',
  pasos.every((p, i) => i === 0 || p.dias > pasos[i - 1].dias)
)
comprobar(
  'todos traen texto y una pieza que rellenar',
  pasos.every((p) => p.plantilla.length > 20 && p.plantilla.includes('{nombre}'))
)

// Ninguna palabra prohibida del guion, ni inglés, ni reclamo.
const PROHIBIDAS = /\b(automatizaci|robot|sustituir|reemplazar|monitorear|optimizar|feedback|link|check)\b/i
const RECLAMO = /\b(no has|todav[íi]a no|por qu[ée] no|deber[íi]as haber|te olvidaste)\b/i
for (const paso of pasos) {
  const mal = paso.plantilla.match(PROHIBIDAS)
  comprobar(`día ${paso.dias}: sin vocabulario prohibido`, !mal, mal?.[0] ?? '')
  const reclamo = paso.plantilla.match(RECLAMO)
  comprobar(`día ${paso.dias}: no reclama`, !reclamo, reclamo?.[0] ?? '')
}

console.log('')
comprobar('con un día de silencio no toca nada', escalonQueToca(1, null, pasos) === null)
comprobar('con dos días toca el primero', escalonQueToca(2, null, pasos)?.dias === pasos[0].dias)
comprobar(
  'con veinte días toca el último, no los cuatro',
  escalonQueToca(20, null, pasos)?.dias === pasos[pasos.length - 1].dias
)
comprobar(
  'no se repite uno ya mandado',
  escalonQueToca(6, 5, pasos) === null,
  String(escalonQueToca(6, 5, pasos)?.dias)
)
comprobar(
  'pero sí se sube al siguiente',
  escalonQueToca(9, 5, pasos)?.dias === 8,
  String(escalonQueToca(9, 5, pasos)?.dias)
)
comprobar(
  'después del último no hay más',
  escalonQueToca(60, pasos[pasos.length - 1].dias, pasos) === null
)

const redactado = redactar(pasos[1].plantilla, {
  nombre: 'Yorge',
  hechas: 3,
  faltan: 6,
  siguiente: 'Ajito dibuja',
  enlace: 'https://x.tld/abc',
})
comprobar('al redactar no quedan piezas sin rellenar', !/\{[a-z]+\}/.test(redactado), redactado)
comprobar('y el nombre entra', redactado.includes('Yorge'))

console.log('\nTeléfonos\n')

const CASOS = [
  ['0412-1234567', '584121234567'],
  ['(0424) 123 45 67', '584241234567'],
  ['+58 414 1234567', '584141234567'],
  ['04261234567', '584261234567'],
  ['584161234567', '584161234567'],
]
for (const [entrada, esperado] of CASOS) {
  const salida = aInternacional(entrada)
  comprobar(`«${entrada}» → ${esperado}`, salida === esperado, String(salida))
}

const MALOS = ['0212-1234567', '412123456', '', null, 'no tiene', '04121234567890']
for (const malo of MALOS) {
  comprobar(`«${malo}» no se manda`, aInternacional(malo) === null, String(aInternacional(malo)))
}
comprobar('se vuelve a leer bonito', comoSeLee('584121234567') === '0412-1234567')

// =============================================================================
// 2) Los mensajes de verdad
// =============================================================================

/** Días de silencio, y qué escalón le toca a cada uno. */
const GENTE = [
  { id: 'fresco', nombre: 'Keila Sánchez', dias: 1, espera: null },
  { id: 'tibio', nombre: 'Wilmer Godoy', dias: 6, espera: 5 },
  { id: 'frio', nombre: 'Douglas Rangel', dias: 22, espera: pasos[pasos.length - 1].dias },
]

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const usuarios = (data?.users ?? []).filter((u) => (u.email ?? '').startsWith(PREFIJO))
  const { data: fichas } = await admin.from('empleados').select('id').like('cedula', `${CEDULA}%`)
  for (const f of fichas ?? []) await admin.from('empleados').delete().eq('id', f.id)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u.id)
}

function cookiesDeSesion(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const LIMITE = 3180
  if (valor.length <= LIMITE) return [{ name: nombre, value: valor }]
  const trozos = []
  for (let i = 0; i < valor.length; i += LIMITE) {
    trozos.push({ name: `${nombre}.${trozos.length}`, value: valor.slice(i, i + LIMITE) })
  }
  return trozos
}

await limpiar()

const { data: curso } = await admin
  .from('cursos')
  .select('id, abierto')
  .eq('clave', 'ajito')
  .single()

if (!curso.abierto) {
  console.error('\n✖ El curso está cerrado. Ábrelo: npm run sembrar:adiestramiento -- --abrir\n')
  process.exit(1)
}

console.log('\nLos mensajes\n')

const navegador = await chromium.launch()
const matriculas = {}

try {
  for (const persona of GENTE) {
    const correo = `${PREFIJO}${persona.id}@iberia.invalid`

    const { data: creado } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre_completo: persona.nombre, organizacion: 'iberia', rol: 'lector' },
    })

    const { data: ficha } = await admin
      .from('empleados')
      .insert({
        cedula: `${CEDULA}${persona.id}`,
        nombre_completo: persona.nombre,
        cargo: 'Operador',
        nivel: 'planta',
        tipo_nomina: 'diaria',
        sede: 'cagua',
        telefono: '0412-1234567',
        familia_oficio: 'linea',
        perfil_id: creado.user.id,
      })
      .select('id')
      .single()

    // El silencio se finge moviendo `ultimo_toque` hacia atrás, que es
    // exactamente lo que mira la vista.
    const desde = new Date(Date.now() - persona.dias * 24 * 60 * 60 * 1000).toISOString()

    const { data: matricula } = await admin
      .from('matriculas')
      .insert({
        curso_id: curso.id,
        empleado_id: ficha.id,
        familia_oficio: 'linea',
        nombre_corto: persona.nombre.split(' ')[0],
        estado: 'en_curso',
        ultimo_toque: desde,
      })
      .select('id')
      .single()

    matriculas[persona.id] = matricula.id
  }

  // Sesión de editor: preparar es una acción del panel.
  const { data: enlace } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL_ADMIN,
  })
  const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
  const { data: sesion } = await anon.auth.verifyOtp({
    token_hash: enlace.properties.hashed_token,
    type: 'magiclink',
  })

  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 1400 },
    locale: 'es-VE',
  })
  await contexto.addCookies(
    cookiesDeSesion(sesion.session).map((c) => ({
      ...c,
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }))
  )

  const pagina = await contexto.newPage()
  pagina.on('console', (m) => {
    if (m.type() === 'error') problemas.push(`[consola] ${m.text()}`)
  })

  await pagina.goto(`${BASE}/dashboard/adiestramiento/recordatorios`, {
    waitUntil: 'networkidle',
  })

  const nuestras = Object.values(matriculas)
  const leer = async () => {
    const { data } = await admin
      .from('recordatorios')
      .select('matricula_id, escalon, mensaje, estado')
      .in('matricula_id', nuestras)
    return data ?? []
  }

  /**
   * Le da al botón y espera **al efecto**, no a la red.
   *
   * `networkidle` después de un `click()` vuelve enseguida si la red ya estaba
   * quieta en ese instante, y la acción de servidor todavía no ha ido ni
   * vuelto. Es la misma piedra con la que ya tropezó `capturar:oficios`: se
   * espera a que aparezca lo que la acción produce.
   */
  async function preparar(esperados) {
    await pagina.getByRole('button', { name: /preparar los de hoy/i }).click()
    for (let intento = 0; intento < 40; intento++) {
      const filas = await leer()
      if (filas.length >= esperados) return filas
      await pagina.waitForTimeout(250)
    }
    return leer()
  }

  const primera = await preparar(2)

  for (const persona of GENTE) {
    const suyos = primera.filter((r) => r.matricula_id === matriculas[persona.id])

    if (persona.espera === null) {
      comprobar(`${persona.id} (${persona.dias} días): no se le escribe`, suyos.length === 0)
      continue
    }

    comprobar(
      `${persona.id} (${persona.dias} días): un solo mensaje, día ${persona.espera}`,
      suyos.length === 1 && suyos[0].escalon === persona.espera,
      suyos.map((s) => s.escalon).join(', ') || 'ninguno'
    )

    if (suyos[0]) {
      comprobar(
        `${persona.id}: el mensaje lleva su nombre y ninguna pieza vacía`,
        suyos[0].mensaje.includes(persona.nombre.split(' ')[0]) &&
          !/\{[a-z]+\}/.test(suyos[0].mensaje),
        suyos[0].mensaje
      )
      console.log(`      «${suyos[0].mensaje.replace(/\s+/g, ' ').trim()}»`)
    }
  }

  // Dos veces al botón no puede mandar dos veces lo mismo. Aquí se espera a que
  // la acción termine sin poder esperar a un efecto —justamente porque no debe
  // haber ninguno—, así que se le da tiempo y se comprueba que nada cambió.
  await pagina.getByRole('button', { name: /preparar los de hoy/i }).click()
  await pagina.waitForTimeout(4000)
  const segunda = await leer()
  comprobar(
    'darle dos veces al botón no duplica',
    segunda.length === primera.length,
    `${primera.length} → ${segunda.length}`
  )

  // Y con WhatsApp apagado nada sale solo.
  const salidos = segunda.filter((r) => r.estado !== 'preparado')
  comprobar('con WhatsApp apagado nada se manda solo', salidos.length === 0)

  await pagina.screenshot({ path: 'capturas/adiestramiento/12-empujon-con-gente.png', fullPage: true })
  await contexto.close()
} finally {
  await navegador.close()
  await limpiar()
  console.log('\n  · limpieza: fichas y usuarios de prueba borrados')
}

console.log(`\n${pasadas} comprobaciones pasaron.`)

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} fallo${problemas.length > 1 ? 's' : ''}:`)
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

console.log('Sin fallos.\n')
