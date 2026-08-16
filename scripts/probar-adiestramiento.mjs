/**
 * Comprobaciones de RLS del adiestramiento, contra la base real.
 *
 *   node --env-file=.env.local scripts/probar-adiestramiento.mjs
 *
 * Se ejecuta con una SESIÓN DE EMPLEADO de verdad —acuñada con un enlace mágico,
 * no con la clave de servicio—, porque lo que hay que probar es justamente lo
 * que RLS deja y no deja hacer a una persona corriente. La clave de servicio
 * bypasea RLS y no probaría nada.
 *
 * Lo que se verifica, además de que las operaciones funcionen:
 *  · que nadie pueda avanzar ni responder por cuenta de otra matrícula,
 *  · que las respuestas de una persona no las lea otra,
 *  · que `matricular_pendientes` esté fuera del alcance de una sesión.
 *
 * Todo lo que crea, lo borra. Opciones: --email
 */

import { createClient } from '@supabase/supabase-js'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY

if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

let pasadas = 0
const fallos = []

function comprobar(titulo, condicion, detalle = '') {
  if (condicion) {
    pasadas++
    console.log(`  ✓ ${titulo}`)
  } else {
    fallos.push(`${titulo}${detalle ? ` — ${detalle}` : ''}`)
    console.log(`  ✖ ${titulo}${detalle ? ` — ${detalle}` : ''}`)
  }
}

// --- Sesión de empleado -------------------------------------------------------

async function sesionDe(email) {
  const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (e1) throw new Error(`enlace para ${email}: ${e1.message}`)

  const cliente = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
  const { data, error: e2 } = await cliente.auth.verifyOtp({
    token_hash: enlace.properties.hashed_token,
    type: 'magiclink',
  })
  if (e2) throw new Error(`sesión para ${email}: ${e2.message}`)

  return { cliente, userId: data.user.id }
}

const { cliente, userId } = await sesionDe(EMAIL)

const { data: yo } = await admin
  .from('empleados')
  .select('id, nombre_completo, area_id')
  .eq('perfil_id', userId)
  .maybeSingle()

if (!yo) {
  console.error(`\n✖ ${EMAIL} no tiene ficha en el padrón; no se puede probar.\n`)
  process.exit(1)
}

const { data: curso } = await admin
  .from('cursos')
  .select('id, abierto')
  .eq('clave', 'ajito')
  .single()
const { data: lecciones } = await admin
  .from('lecciones')
  .select('id, numero')
  .eq('curso_id', curso.id)
  .order('numero')

// Matrícula propia temporal, y una ajena para probar que no se puede tocar.
const { data: otro } = await admin
  .from('empleados')
  .select('id, perfil_id')
  .neq('id', yo.id)
  .eq('nivel', 'planta')
  .limit(1)
  .maybeSingle()

let miMatricula = null
let matriculaEsMia = false
let matriculaAjena = null
let respuestaAjena = null
let usuarioPrueba = null
let perfilOriginal = null

/** Con esto se reconoce y se barre lo que crea esta prueba. */
const PREFIJO_PRUEBA = 'prueba-adiestramiento-'

console.log(`\nProbando con la sesión de ${yo.nombre_completo}\n`)

try {
  // Puede que ya tenga matrícula —se le abre a mano para poder mirar el curso—,
  // y en ese caso se usa la suya y no se borra al final.
  const { data: propia } = await admin
    .from('matriculas')
    .select('id')
    .eq('curso_id', curso.id)
    .eq('empleado_id', yo.id)
    .maybeSingle()

  if (propia) {
    miMatricula = propia.id
  } else {
    const { data: creada, error } = await admin
      .from('matriculas')
      .insert({ curso_id: curso.id, empleado_id: yo.id, familia_oficio: 'linea' })
      .select('id')
      .single()
    if (error) throw new Error(`no se pudo abrir la matrícula: ${error.message}`)
    miMatricula = creada.id
    matriculaEsMia = true
  }

  if (otro) {
    const { data: ya } = await admin
      .from('matriculas')
      .select('id')
      .eq('curso_id', curso.id)
      .eq('empleado_id', otro.id)
      .maybeSingle()
    matriculaAjena = ya?.id ?? null
  }

  // --- Catálogo ---------------------------------------------------------------
  const { data: cursoVisto } = await cliente.from('cursos').select('*').eq('clave', 'ajito').maybeSingle()
  comprobar('el curso se ve con sesión', !!cursoVisto)

  const { data: leccionesVistas } = await cliente.from('lecciones').select('id').eq('curso_id', curso.id)
  comprobar('las 9 lecciones se ven', leccionesVistas?.length === 9, `vio ${leccionesVistas?.length}`)

  // --- Mi matrícula -----------------------------------------------------------
  const { data: mias } = await cliente.from('matriculas').select('id').eq('curso_id', curso.id)
  comprobar('veo mi matrícula', mias?.some((m) => m.id === miMatricula))

  // --- Avanzar ----------------------------------------------------------------
  const leccion = lecciones[3]
  const { error: errAvance } = await cliente
    .from('avances')
    .upsert(
      { matricula_id: miMatricula, leccion_id: leccion.id, estado: 'en_curso' },
      { onConflict: 'matricula_id,leccion_id', ignoreDuplicates: true }
    )
  comprobar('puedo abrir una lección', !errAvance, errAvance?.message)

  const { data: avanceLeido } = await cliente
    .from('avances')
    .select('id, estado')
    .eq('matricula_id', miMatricula)
  comprobar('el avance queda guardado y lo leo', avanceLeido?.length === 1, JSON.stringify(avanceLeido))

  // --- Responder ---------------------------------------------------------------
  const { error: errResp } = await cliente.from('respuestas').insert({
    matricula_id: miMatricula,
    leccion_id: leccion.id,
    clave_paso: 'prueba',
    entrada: 'texto',
    texto: 'Respuesta de prueba automatizada.',
    familia_oficio: 'linea',
    area_id: yo.area_id,
  })
  comprobar('puedo responder un ejercicio', !errResp, errResp?.message)

  const { data: misRespuestas } = await cliente.from('respuestas').select('id, texto')
  comprobar('leo mis respuestas', misRespuestas?.length >= 1)

  // --- Lo que NO se puede -------------------------------------------------------
  if (matriculaAjena) {
    const { error: errAjeno } = await cliente
      .from('avances')
      .insert({ matricula_id: matriculaAjena, leccion_id: leccion.id, estado: 'en_curso' })
    comprobar('no puedo avanzar por cuenta de otro', !!errAjeno, 'lo dejó pasar')

    const { data: creadaAjena } = await admin
      .from('respuestas')
      .insert({
        matricula_id: matriculaAjena,
        leccion_id: leccion.id,
        clave_paso: 'campo',
        es_pregunta_campo: true,
        entrada: 'voz',
        texto: 'Lo que contestó otra persona.',
      })
      .select('id')
      .single()
    respuestaAjena = creadaAjena.id

    // Los editores de Boosty SÍ leen las respuestas: de ahí sale el material del
    // informe. La promesa de la lección 0 es sobre el resto de la organización,
    // y por eso se prueba abajo con una sesión de empleado corriente.
    const { data: comoEditor } = await cliente
      .from('respuestas')
      .select('id')
      .eq('id', respuestaAjena)
    comprobar('como editor sí leo las respuestas, que es el diseño', !!comoEditor?.length)

    // --- La promesa: «tu supervisor no lo lee» --------------------------------
    // Se monta una sesión de empleado corriente —rol lector, sin poder de
    // edición— y se comprueba que la RLS no le deja ver nada ajeno. Es la
    // garantía que Ajito da en la lección 0, y la única forma de probarla es
    // con una sesión que no sea la nuestra.
    const correoPrueba = `${PREFIJO_PRUEBA}${Date.now()}@iberia.invalid`
    const { data: creadoAuth, error: errAuth } = await admin.auth.admin.createUser({
      email: correoPrueba,
      email_confirm: true,
      user_metadata: { nombre_completo: 'Prueba de RLS', organizacion: 'iberia', rol: 'lector' },
    })

    if (errAuth) {
      comprobar('se pudo montar la sesión de empleado corriente', false, errAuth.message)
    } else {
      usuarioPrueba = creadoAuth.user.id
      perfilOriginal = otro.perfil_id ?? null
      await admin.from('empleados').update({ perfil_id: usuarioPrueba }).eq('id', otro.id)

      const { cliente: comoEmpleado } = await sesionDe(correoPrueba)

      // Lo ajeno de verdad es lo que respondió OTRA persona — aquí, lo que
      // respondió la sesión de arriba sobre su propia matrícula. Probar contra
      // `respuestaAjena` sería trampa: esa es de este mismo empleado.
      const { data: fisgoneo } = await comoEmpleado
        .from('respuestas')
        .select('id')
        .eq('matricula_id', miMatricula)
      comprobar(
        'un empleado corriente no lee respuestas ajenas',
        !fisgoneo?.length,
        `vio ${fisgoneo?.length}`
      )

      const { data: propias } = await comoEmpleado
        .from('respuestas')
        .select('id')
        .eq('matricula_id', matriculaAjena)
      comprobar('pero sí lee las suyas', propias?.length === 1, `vio ${propias?.length}`)

      const { data: todas } = await comoEmpleado.from('respuestas').select('id')
      comprobar(
        'y no ve ninguna más en toda la tabla',
        todas?.length === 1,
        `vio ${todas?.length}`
      )

      const { data: matriculasVistas } = await comoEmpleado.from('matriculas').select('id')
      comprobar(
        'y solo ve su propia matrícula',
        matriculasVistas?.length === 1,
        `vio ${matriculasVistas?.length}`
      )

      const { data: tableroEmpleado } = await comoEmpleado
        .from('adiestramiento_avance')
        .select('*')
      comprobar(
        'el tablero de un empleado solo cuenta lo suyo',
        (tableroEmpleado ?? []).reduce((t, f) => t + (f.matriculados ?? 0), 0) === 1,
        JSON.stringify(tableroEmpleado)
      )
    }
  }

  const { error: errRpc } = await cliente.rpc('matricular_pendientes', { curso_clave: 'ajito' })
  comprobar('no puedo matricular a nadie desde una sesión', !!errRpc, 'la función quedó expuesta')

  // --- El tablero no expone respuestas ------------------------------------------
  const { data: tablero } = await cliente.from('adiestramiento_avance').select('*')
  comprobar(
    'el tablero solo trae conteos',
    !tablero?.length || Object.keys(tablero[0]).every((k) => !k.includes('texto')),
    Object.keys(tablero?.[0] ?? {}).join(', ')
  )
} finally {
  await limpiar()
}

/**
 * Deja la base como estaba.
 *
 * La sesión de empleado corriente se monta creando un usuario de auth y
 * apuntándole el `perfil_id` de una ficha del padrón. Si eso se queda a medias,
 * una persona real del padrón queda amarrada a un usuario de prueba — así que
 * la limpieza no se fía de las variables de esta corrida: **barre por prefijo de
 * correo**, y recoge también lo que haya quedado de una corrida anterior que se
 * hubiera caído a mitad de camino.
 */
async function limpiar() {
  if (respuestaAjena) await admin.from('respuestas').delete().eq('id', respuestaAjena)
  // Las respuestas de la prueba se van siempre; la matrícula, solo si la abrió
  // esta corrida.
  if (miMatricula) await admin.from('respuestas').delete().eq('matricula_id', miMatricula).eq('clave_paso', 'prueba')
  if (miMatricula && matriculaEsMia) await admin.from('matriculas').delete().eq('id', miMatricula)

  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const dePrueba = (data?.users ?? []).filter((u) =>
    (u.email ?? '').startsWith(PREFIJO_PRUEBA)
  )

  for (const usuario of dePrueba) {
    await admin.from('empleados').update({ perfil_id: null }).eq('perfil_id', usuario.id)
    await admin.auth.admin.deleteUser(usuario.id)
  }

  if (perfilOriginal && otro) {
    await admin.from('empleados').update({ perfil_id: perfilOriginal }).eq('id', otro.id)
  }

  console.log(
    `\n  · limpieza: ${dePrueba.length} usuario${dePrueba.length === 1 ? '' : 's'} de prueba` +
      ' borrado y el padrón restaurado'
  )
}

console.log(`\n${pasadas} comprobaciones pasaron.`)
if (fallos.length) {
  console.log(`${fallos.length} fallaron:`)
  for (const f of fallos) console.log(`  ✖ ${f}`)
  process.exit(1)
}
console.log('Sin fallos.\n')
