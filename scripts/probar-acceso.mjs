/**
 * Verifica las políticas RLS contra el proyecto real, con sesiones de verdad.
 *
 *   node --env-file=.env.local scripts/probar-acceso.mjs --password "<clave admin>"
 *
 * Comprueba tres identidades:
 *   · anónimo   — no debe ver nada
 *   · lector    — lee el levantamiento, no escribe, no ve borradores del informe
 *   · admin     — control total
 *
 * Crea un usuario lector y una entrevista temporales, y los borra al terminar.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publicable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secreta = process.env.SUPABASE_SECRET_KEY

if (!url || !publicable || !secreta) {
  console.error('\n✖ Faltan variables. Corre con: node --env-file=.env.local …\n')
  process.exit(1)
}

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const EMAIL_ADMIN = args.email ?? 'gmontiel@spatiumgroup.com'
const CLAVE_ADMIN = args.password
if (!CLAVE_ADMIN) {
  console.error('\n✖ Falta --password con la clave del usuario admin.\n')
  process.exit(1)
}

const EMAIL_LECTOR = `lector.prueba.${Date.now()}@iberia-test.local`
const CLAVE_LECTOR = 'PruebaLector2026!x'

let fallos = 0
let pruebas = 0

function verificar(nombre, condicion, detalle) {
  pruebas++
  if (condicion) {
    console.log(`  ✔ ${nombre}`)
  } else {
    fallos++
    console.log(`  ✖ ${nombre}`)
    if (detalle !== undefined) console.log('     ', JSON.stringify(detalle))
  }
}

const anon = () => createClient(url, publicable, { auth: { persistSession: false } })
const admin = createClient(url, secreta, { auth: { persistSession: false } })

async function sesion(email, password) {
  const cliente = anon()
  const { data, error } = await cliente.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`)
  return { cliente, user: data.user }
}

let idLector = null
let idEntrevista = null
let idSeccionBorrador = null
// Los hallazgos usan ON DELETE SET NULL sobre la entrevista (un hallazgo validado
// no debe perderse con ella), así que borrar la entrevista NO se los lleva:
// hay que rastrearlos aparte.
const idsHallazgos = []

try {
  // ---------------------------------------------------------------------------
  console.log('\n── Anónimo (sin sesión)')

  const sinSesion = anon()
  for (const tabla of ['entrevistas', 'areas', 'informe_secciones', 'hallazgos', 'archivos']) {
    const { data, error } = await sinSesion.from(tabla).select('*').limit(1)
    verificar(`${tabla}: sin acceso`, (data?.length ?? 0) === 0, { data, error: error?.message })
  }

  // ---------------------------------------------------------------------------
  console.log('\n── Admin')

  const { cliente: cAdmin, user: uAdmin } = await sesion(EMAIL_ADMIN, CLAVE_ADMIN)

  const { data: perfilAdmin } = await cAdmin.from('profiles').select('*').eq('id', uAdmin.id).maybeSingle()
  verificar('lee su propio perfil', perfilAdmin?.rol === 'admin', perfilAdmin?.rol)

  // Se compara contra lo que existe de verdad, no contra un número fijo: el
  // organigrama cambia y un conteo hardcodeado solo produce falsos fallos.
  const { count: areasTotales } = await admin
    .from('areas')
    .select('id', { count: 'exact', head: true })
  const { data: areasAdmin } = await cAdmin.from('areas').select('id, nombre')
  verificar(
    `ve todas las áreas del organigrama (${areasTotales})`,
    areasAdmin?.length === areasTotales,
    `${areasAdmin?.length} de ${areasTotales}`
  )

  const { data: creada, error: errorCrear } = await cAdmin
    .from('entrevistas')
    .insert({ codigo: `TEST-${Date.now()}`, entrevistado_nombre: 'Prueba RLS', estado: 'programada' })
    .select('id')
    .single()
  verificar('crea entrevistas', !!creada?.id, errorCrear?.message)
  idEntrevista = creada?.id ?? null

  if (idEntrevista) {
    const { error: errorSeg } = await cAdmin.from('transcripcion_segmentos').insert({
      entrevista_id: idEntrevista,
      indice: 0,
      hablante: 'Prueba',
      texto: 'Segmento de prueba para verificar RLS.',
    })
    verificar('inserta segmentos de transcripción', !errorSeg, errorSeg?.message)

    const { data: hallazgoCreado, error: errorHal } = await cAdmin
      .from('hallazgos')
      .insert({
        entrevista_id: idEntrevista,
        titulo: 'Hallazgo de prueba',
        tipo: 'cuello_botella',
      })
      .select('id')
      .single()
    verificar('crea hallazgos', !!hallazgoCreado?.id, errorHal?.message)
    if (hallazgoCreado?.id) idsHallazgos.push(hallazgoCreado.id)
  }

  const { count: seccionesTotales } = await admin
    .from('informe_secciones')
    .select('id', { count: 'exact', head: true })
  const { data: seccionesAdmin } = await cAdmin.from('informe_secciones').select('id, publicado')
  verificar(
    `ve todas las secciones del informe, publicadas o no (${seccionesTotales})`,
    seccionesAdmin?.length === seccionesTotales,
    `${seccionesAdmin?.length} de ${seccionesTotales}`
  )
  idSeccionBorrador = seccionesAdmin?.find((s) => !s.publicado)?.id ?? null

  const { data: todosPerfiles } = await cAdmin.from('profiles').select('id')
  verificar('lista todos los perfiles', (todosPerfiles?.length ?? 0) >= 1, todosPerfiles?.length)

  // ---------------------------------------------------------------------------
  console.log('\n── Lector de Iberia')

  const { data: nuevoLector, error: errorLector } = await admin.auth.admin.createUser({
    email: EMAIL_LECTOR,
    password: CLAVE_LECTOR,
    email_confirm: true,
    user_metadata: { nombre_completo: 'Lector Prueba', rol: 'lector', organizacion: 'iberia' },
  })
  if (errorLector) throw new Error(`No se pudo crear el lector: ${errorLector.message}`)
  idLector = nuevoLector.user.id

  const { data: perfilCreado } = await admin
    .from('profiles')
    .select('rol, organizacion')
    .eq('id', idLector)
    .maybeSingle()
  verificar(
    'el trigger le asigna rol lector / Iberia',
    perfilCreado?.rol === 'lector' && perfilCreado?.organizacion === 'iberia',
    perfilCreado
  )

  const { cliente: cLector } = await sesion(EMAIL_LECTOR, CLAVE_LECTOR)

  const { data: entrevistasLector } = await cLector.from('entrevistas').select('id')
  verificar('lee entrevistas', (entrevistasLector?.length ?? 0) >= 1, entrevistasLector?.length)

  const { error: errorEscritura } = await cLector
    .from('entrevistas')
    .insert({ codigo: `HACK-${Date.now()}`, entrevistado_nombre: 'No debería entrar' })
  verificar('NO puede crear entrevistas', !!errorEscritura, errorEscritura?.message ?? 'insertó!')

  if (idEntrevista) {
    const { data: tocada } = await cLector
      .from('entrevistas')
      .update({ entrevistado_nombre: 'Modificado por lector' })
      .eq('id', idEntrevista)
      .select('id')
    verificar('NO puede modificar entrevistas', (tocada?.length ?? 0) === 0, tocada)
  }

  const { data: seccionesLector } = await cLector.from('informe_secciones').select('id, publicado')
  verificar(
    'NO ve las secciones en borrador',
    (seccionesLector ?? []).every((s) => s.publicado),
    seccionesLector?.map((s) => s.publicado)
  )

  if (idSeccionBorrador) {
    const { data: borrador } = await cLector
      .from('informe_secciones')
      .select('id')
      .eq('id', idSeccionBorrador)
      .maybeSingle()
    verificar('un borrador concreto le queda invisible', !borrador, borrador)
  }

  const { data: perfilesLector } = await cLector.from('profiles').select('id')
  verificar(
    'solo ve su propio perfil',
    perfilesLector?.length === 1,
    perfilesLector?.length
  )

  const { data: subida, error: errorSubida } = await cLector.storage
    .from('archivos')
    .upload(`otro/${Date.now()}-prueba.txt`, new Blob(['no debería subir']))
  verificar('NO puede subir a Storage', !!errorSubida, errorSubida?.message ?? subida)
} catch (e) {
  fallos++
  console.error(`\n✖ Error inesperado: ${e.message}`)
} finally {
  // ---------------------------------------------------------------------------
  console.log('\n── Limpieza')

  // Los hallazgos van primero: la entrevista no se los lleva al borrarse.
  if (idsHallazgos.length > 0) {
    const { error } = await admin.from('hallazgos').delete().in('id', idsHallazgos)
    console.log(
      error
        ? `  ✖ hallazgos: ${error.message}`
        : `  ✔ ${idsHallazgos.length} hallazgo(s) de prueba borrado(s)`
    )
  }
  if (idEntrevista) {
    const { error } = await admin.from('entrevistas').delete().eq('id', idEntrevista)
    console.log(error ? `  ✖ entrevista: ${error.message}` : '  ✔ entrevista de prueba borrada')
  }
  if (idLector) {
    const { error } = await admin.auth.admin.deleteUser(idLector)
    console.log(error ? `  ✖ lector: ${error.message}` : '  ✔ usuario lector de prueba borrado')
  }
}

console.log(`\n${'─'.repeat(52)}`)
if (fallos === 0) {
  console.log(`✔ ${pruebas} verificaciones de acceso, todas en verde\n`)
} else {
  console.log(`✖ ${fallos} de ${pruebas} verificaciones fallaron\n`)
  process.exit(1)
}
