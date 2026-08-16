/**
 * Que todo esté de verdad contra Supabase.
 *
 *   node --env-file=.env.local scripts/probar-supabase.mjs
 *
 * No comprueba que el código compile: comprueba que **lo que el código da por
 * hecho existe en el proyecto real**. Son dos cosas distintas y se separan
 * solas el día del despliegue, cuando una migración que se aplicó a mano en un
 * sitio y no en otro deja la aplicación pidiendo una columna que no está.
 *
 * Mira cuatro cosas, y todas contra `NEXT_PUBLIC_SUPABASE_URL`:
 *
 *   1. Que las tablas, vistas, columnas y funciones que usa el código existan.
 *   2. Que **la RLS esté encendida en todas** y con políticas. Una tabla nueva
 *      sin RLS es legible por cualquiera con la clave pública, que está en el
 *      navegador de todo el mundo.
 *   3. Que los buckets sean **privados** y tengan dentro lo que deben.
 *   4. Que nada apunte a un Supabase local.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !SECRETO) {
  console.error('\n✖ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

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

/** Una tabla o vista responde si se le puede pedir una fila sin que estalle. */
async function responde(relacion, columnas = '*') {
  const { error } = await admin.from(relacion).select(columnas).limit(1)
  return error?.message ?? null
}

// =============================================================================

console.log(`\nContra ${URL_SUPA}\n`)

comprobar(
  'no apunta a un Supabase local',
  !/localhost|127\.0\.0\.1|kong/.test(URL_SUPA),
  URL_SUPA
)
comprobar('es un proyecto alojado', /^https:\/\/[a-z]{20}\.supabase\.co$/.test(URL_SUPA), URL_SUPA)

// --- 0) las claves, del formato nuevo ----------------------------------------
//
// Supabase va a apagar las claves antiguas —los JWT de `anon` y `service_role`,
// los que empiezan por `eyJ`— y el día que las apague, cualquier cosa que
// todavía las use deja de responder. Las nuevas son `sb_publishable_…` y
// `sb_secret_…`.
//
// Esto se comprueba por el formato y no por que «funcione»: una clave vieja
// funciona perfectamente hasta el minuto en que la apagan, así que probarla no
// dice nada. Lo que dice es cómo empieza.

console.log('\nLas claves\n')

/** Qué es cada clave, sin imprimirla. */
function formato(valor) {
  if (!valor) return 'vacía'
  if (valor.startsWith('sb_publishable_')) return 'nueva · publishable'
  if (valor.startsWith('sb_secret_')) return 'nueva · secret'
  if (valor.startsWith('sbp_')) return 'token personal del CLI'
  if (valor.startsWith('eyJ')) return 'LEGACY JWT'
  return 'desconocido'
}

{
  const publica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
  const secreta = process.env.SUPABASE_SECRET_KEY ?? ''

  comprobar(
    `la clave pública es del formato nuevo (${formato(publica)})`,
    publica.startsWith('sb_publishable_'),
    formato(publica)
  )
  comprobar(
    `la clave secreta es del formato nuevo (${formato(secreta)})`,
    secreta.startsWith('sb_secret_'),
    formato(secreta)
  )
  comprobar('ninguna es un JWT legacy', !publica.startsWith('eyJ') && !secreta.startsWith('eyJ'))

  // La secreta bypasea la RLS: si alguna vez sale al navegador, se acabó.
  comprobar(
    'la clave secreta no está expuesta como NEXT_PUBLIC_',
    !Object.entries(process.env).some(
      ([nombre, valor]) => nombre.startsWith('NEXT_PUBLIC_') && (valor ?? '').startsWith('sb_secret_')
    )
  )

  // Y que no queden guardadas ni comentadas.
  //
  // No basta con mirar las variables cargadas: una clave `service_role`
  // comentada en el archivo sigue siendo una clave de `service_role` —bypasea
  // la RLS entera— en texto plano, y esta carpeta la sincroniza OneDrive. Es la
  // misma historia que la de Azure, que acabó en una captura de pantalla.
  //
  // Se buscan en el archivo y no con `grep`, porque las herramientas de
  // búsqueda respetan el `.gitignore` y `.env.local` está ignorado: fue justo
  // así como se pasaron por alto la primera vez.
  try {
    const texto = readFileSync('.env.local', 'utf8')
    const restos = [...texto.matchAll(/^[^\n]*eyJhbGciOi[^\n]*/gm)].map((m) =>
      m[0].split('=')[0].replace(/^#\s*/, '').trim()
    )
    comprobar(
      'no quedan claves legacy guardadas en .env.local, ni comentadas',
      restos.length === 0,
      restos.join(', ')
    )
  } catch {
    // Sin archivo —en un servidor, por ejemplo— no hay nada que mirar.
    pasadas++
    console.log('  · sin .env.local que revisar')
  }
}

// --- 1) lo que el código da por hecho ----------------------------------------

console.log('\nLas tablas y vistas del adiestramiento\n')

/** Relación → columnas que el código pide por nombre. */
const RELACIONES = {
  cursos: 'id, clave, abierto, asistente_libre_activo',
  lecciones: 'id, numero, titulo, forma, activa',
  matriculas: 'id, curso_id, empleado_id, familia_oficio, nombre_corto, estado, ultimo_toque',
  avances: 'id, matricula_id, leccion_id, estado, paso',
  respuestas:
    'id, clave_paso, texto, media_url, entrada, devolucion, devolucion_audio, devolucion_en',
  certificados: 'id, codigo, nombre_completo, cedula, cargo, area_nombre, emitido_en, entregado_en',
  recordatorios: 'id, matricula_id, escalon, via, estado, mensaje, enviado_en',
  ajustes_whatsapp: 'id, activo, id_numero, token, plantilla, probado_en, probado_ok',
  accesos: 'id, empleado_id, token_hash, motivo, usos, ultimo_uso, mensaje, expira_en',
  empleados: 'id, cedula, nombre_completo, telefono, familia_oficio, perfil_id',
  // Las vistas, que es donde más fácil se rompe algo sin enterarse.
  adiestramiento_avance: 'curso_id, familia_oficio, matriculados, completados',
  recordatorios_pendientes: 'matricula_id, dias, ultimo_escalon, lecciones_hechas',
  accesos_estado: 'id, empleado_id, motivo, enviado_en, usos, vigente',
  padron_estado: 'id, nombre_completo, telefono, matricula_id, acceso_expira, acceso_usos',
}

for (const [relacion, columnas] of Object.entries(RELACIONES)) {
  const error = await responde(relacion, columnas)
  comprobar(`${relacion} · ${columnas.split(',').length} columnas`, error === null, error ?? '')
}

// Las vistas no pueden traer secretos aunque corran como su dueña.
console.log('')
for (const vista of ['accesos_estado', 'padron_estado']) {
  const { error } = await admin.from(vista).select('token_hash').limit(1)
  comprobar(`${vista} no expone el hash del token`, error !== null, 'lo devolvió')
}

// --- 2) la función del certificado -------------------------------------------

console.log('\nLa función de emisión\n')

{
  // Se llama con una matrícula inventada: tiene que existir y tiene que negarse.
  const { error } = await admin.rpc('emitir_mi_certificado', {
    p_matricula: '00000000-0000-0000-0000-000000000000',
  })
  const mensaje = error?.message ?? ''
  comprobar('emitir_mi_certificado existe', !/could not find|does not exist/i.test(mensaje), mensaje)
  comprobar(
    'y no emite nada sin ficha ni matrícula',
    /padr[óo]n|no es tuya|faltan/i.test(mensaje),
    mensaje || 'devolvió algo'
  )
}

{
  const { error } = await admin.rpc('matricular_pendientes', { curso_clave: 'ajito' })
  comprobar(
    'matricular_pendientes existe',
    !/could not find|does not exist/i.test(error?.message ?? ''),
    error?.message ?? ''
  )
}

// --- 3) RLS encendida en todo ------------------------------------------------
//
// Se pregunta al propio Postgres. Una tabla nueva sin RLS la lee cualquiera con
// la clave pública, que va dentro del navegador de las 200 personas.

console.log('\nRLS\n')

const NUEVAS = [
  'cursos',
  'lecciones',
  'matriculas',
  'avances',
  'respuestas',
  'certificados',
  'recordatorios',
  'ajustes_whatsapp',
  'accesos',
]

{
  // Sin sesión: con la clave pública no debería salir ni una fila de las tablas
  // sensibles. Es la comprobación de verdad, más que preguntar por el flag.
  const anon = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })

  for (const tabla of NUEVAS) {
    const { data, error } = await anon.from(tabla).select('*').limit(1)
    const cerrada = Boolean(error) || (data ?? []).length === 0
    comprobar(`${tabla}: nada sin sesión`, cerrada, `devolvió ${(data ?? []).length} filas`)
  }

  for (const vista of ['padron_estado', 'accesos_estado', 'recordatorios_pendientes']) {
    const { data, error } = await anon.from(vista).select('*').limit(1)
    const cerrada = Boolean(error) || (data ?? []).length === 0
    comprobar(`${vista}: nada sin sesión`, cerrada, `devolvió ${(data ?? []).length} filas`)
  }
}

// --- 4) los buckets ----------------------------------------------------------

console.log('\nStorage\n')

const { data: buckets } = await admin.storage.listBuckets()
const porNombre = new Map((buckets ?? []).map((b) => [b.name, b]))

const BUCKETS = ['archivos', 'adiestramiento', 'adiestramiento-respuestas']
for (const nombre of BUCKETS) {
  const bucket = porNombre.get(nombre)
  comprobar(`bucket ${nombre} existe`, Boolean(bucket))
  if (bucket) comprobar(`bucket ${nombre} es privado`, bucket.public === false, 'es público')
}

// Los audios del curso: 9 carpetas con sus MP3.
{
  const { data: carpetas } = await admin.storage.from('adiestramiento').list('', { limit: 100 })
  const lecciones = (carpetas ?? []).filter((f) => /^leccion-\d+$/.test(f.name))
  comprobar(`los audios están subidos (${lecciones.length} lecciones)`, lecciones.length === 9)

  let mp3 = 0
  for (const carpeta of lecciones) {
    const { data } = await admin.storage.from('adiestramiento').list(carpeta.name, { limit: 100 })
    mp3 += (data ?? []).filter((f) => f.name.endsWith('.mp3')).length
  }
  comprobar(`los 70 audios del guion están arriba (${mp3})`, mp3 === 70, String(mp3))

  const { data: fichas } = await admin.storage.from('adiestramiento').list('fichas', { limit: 100 })
  const png = (fichas ?? []).filter((f) => f.name.endsWith('.png')).length
  comprobar(`las 10 fichas están arriba (${png})`, png === 10, String(png))
}

// --- 5) el curso, sembrado ---------------------------------------------------

console.log('\nEl curso\n')

{
  const { data: curso } = await admin.from('cursos').select('id, abierto').eq('clave', 'ajito').maybeSingle()
  comprobar('el curso «ajito» está sembrado', Boolean(curso))

  if (curso) {
    const { count } = await admin
      .from('lecciones')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', curso.id)
      .eq('activa', true)
    comprobar(`las 9 lecciones están sembradas (${count})`, count === 9, String(count))
  }

  const { data: ajustes } = await admin.from('ajustes_whatsapp').select('id, activo').maybeSingle()
  comprobar('la fila única de la conexión de WhatsApp existe', Boolean(ajustes))
}

// --- 6) que no quede basura de las pruebas ------------------------------------

console.log('\nSin restos de las pruebas\n')

{
  const { data: fichas } = await admin
    .from('empleados')
    .select('cedula')
    .or('cedula.like.PRUEBA-%,cedula.like.prueba-%')
  comprobar(
    'no quedan fichas de prueba en el padrón',
    (fichas ?? []).length === 0,
    (fichas ?? []).map((f) => f.cedula).join(', ')
  )

  const { data } = await admin.auth.admin.listUsers({ perPage: 500 })
  const sobrantes = (data?.users ?? []).filter((u) => (u.email ?? '').startsWith('prueba-'))
  comprobar(
    'no quedan cuentas de prueba en auth',
    sobrantes.length === 0,
    sobrantes.map((u) => u.email).join(', ')
  )
}

// =============================================================================

console.log(`\n${pasadas} comprobaciones pasaron.`)

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} fallo${problemas.length > 1 ? 's' : ''}:`)
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

console.log('Todo está contra Supabase.\n')
