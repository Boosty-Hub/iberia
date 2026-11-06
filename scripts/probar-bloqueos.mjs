/**
 * Reportes y bloqueos del canal, contra la base real y con sesiones de empleado.
 *
 *   npm run probar:bloqueos
 *
 * Variables que necesita (los mismos nombres que usan las demás pruebas):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   SUPABASE_SECRET_KEY
 * ⚠️ El `.env.local` de esta máquina solo trae tokens de gestión, no esas tres: quien
 * corre la prueba (la CI o quien tenga las claves del proyecto) las pone en el
 * entorno. Sin ellas la prueba FALLA; no se salta.
 *
 * No pide contraseñas: acuña la sesión de cada cuenta de prueba con un enlace
 * mágico emitido con la clave de servicio, y prueba con esas sesiones (la clave de
 * servicio bypasea RLS y no probaría nada). La clave de servicio solo arma y
 * desarma el escenario.
 *
 * Gente de prueba, nada de personas reales: cuentas `prueba-bloqueos-*`, fichas con
 * cédula `PRUEBA-BLOQUEOS-*` y el rol `personal-planta`.
 *   A bloquea · B es bloqueado · C no bloquea a nadie (el testigo: no ve cambio).
 * La limpieza corre siempre al salir —también tras un fallo— y barre por prefijo,
 * así que recoge lo que haya quedado de una corrida que se cayó.
 *
 * Requiere la migración `20261106120000_reportes_y_bloqueos.sql` aplicada.
 */

import { createClient } from '@supabase/supabase-js'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY

if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error(
    '\n✖ Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o SUPABASE_SECRET_KEY.' +
      '\n  El .env.local de esta máquina solo trae tokens de gestión: las claves del proyecto' +
      '\n  las pone en el entorno quien corre la prueba.\n'
  )
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

const PREFIJO = 'prueba-bloqueos-'
const CEDULA = 'PRUEBA-BLOQUEOS-'
const NOMBRE = 'PRUEBA-bloqueos'
const TOKEN = 'PRUEBA-bloqueos-token-'

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

/** Una consulta que tiene que funcionar: si falla, la prueba no puede seguir. */
function ok(resultado, que) {
  if (resultado.error) throw new Error(`${que}: ${resultado.error.message}`)
  return resultado.data
}

const ids = (filas) => new Set((filas ?? []).map((f) => f.id))
const tiene = (conjunto, ...xs) => xs.every((x) => conjunto.has(x))
const noTiene = (conjunto, ...xs) => xs.every((x) => !conjunto.has(x))

// --- Limpieza ---------------------------------------------------------------------

async function usuariosDePrueba() {
  const encontrados = []
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 })
    const usuarios = data?.users ?? []
    encontrados.push(...usuarios.filter((u) => (u.email ?? '').startsWith(PREFIJO)))
    if (usuarios.length < 200) break
  }
  return encontrados
}

/**
 * Deja la base como estaba. Barre por prefijo y no por las variables de esta
 * corrida: recoge también lo de una corrida anterior que se cayó a mitad.
 * Solo toca lo que cuelga de fichas `PRUEBA-BLOQUEOS-*`.
 */
async function limpiar() {
  const { data: fichas } = await admin.from('empleados').select('id').like('cedula', `${CEDULA}%`)
  const fichasIds = (fichas ?? []).map((f) => f.id)

  await admin.from('dispositivos').delete().like('token', `${TOKEN}%`)

  if (fichasIds.length) {
    // Las conversaciones donde participó alguien de prueba (solo hay gente de
    // prueba en ellas): borrar la ficha se lleva las filas de participación, no
    // la conversación. Los mensajes se van en cascada.
    const { data: partes } = await admin
      .from('conversacion_participantes')
      .select('conversacion_id')
      .in('empleado_id', fichasIds)
    const convs = [...new Set((partes ?? []).map((p) => p.conversacion_id))]
    if (convs.length) await admin.from('conversaciones').delete().in('id', convs)

    await admin.from('grupos').delete().in('creador_id', fichasIds)
    await admin.from('publicaciones').delete().in('autor_id', fichasIds)
    await admin.from('empleados').delete().in('id', fichasIds)
  }

  const usuarios = await usuariosDePrueba()
  for (const u of usuarios) await admin.auth.admin.deleteUser(u.id)
  return { fichas: fichasIds.length, usuarios: usuarios.length }
}

// --- Montaje ------------------------------------------------------------------------

async function persona(clave, nombre) {
  const correo = `${PREFIJO}${clave}@iberia.invalid`
  const creada = await admin.auth.admin.createUser({
    email: correo,
    email_confirm: true,
    user_metadata: {
      nombre_completo: nombre,
      organizacion: 'iberia',
      rol: 'lector',
      rol_clave: 'personal-planta',
    },
  })
  const usuario = ok(creada, `crear la cuenta de ${clave}`).user

  const ficha = ok(
    await admin
      .from('empleados')
      .insert({
        cedula: `${CEDULA}${clave}`,
        nombre_completo: nombre,
        cargo: 'Operador de prueba',
        nivel: 'planta',
        tipo_nomina: 'diaria',
        sede: 'cagua',
        perfil_id: usuario.id,
      })
      .select('id')
      .single(),
    `crear la ficha de ${clave}`
  )

  const enlace = ok(
    await admin.auth.admin.generateLink({ type: 'magiclink', email: correo }),
    `enlace de ${clave}`
  )
  const cliente = createClient(URL_SUPA, CLAVE_PUB, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  ok(
    await cliente.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' }),
    `sesión de ${clave}`
  )

  return { clave, userId: usuario.id, id: ficha.id, cliente }
}

async function enviar(quien, conversacionId, texto) {
  const id = crypto.randomUUID()
  const { error } = await quien.cliente
    .from('mensajes')
    .insert({ id, conversacion_id: conversacionId, autor_id: quien.id, texto })
  return { id, error }
}

async function comentar(quien, publicacionId, texto) {
  const id = crypto.randomUUID()
  const { error } = await quien.cliente
    .from('comentarios')
    .insert({ id, publicacion_id: publicacionId, empleado_id: quien.id, texto })
  return { id, error }
}

const mensajesDe = async (quien, ...convs) =>
  ids(ok(await quien.cliente.from('mensajes').select('id').in('conversacion_id', convs), `mensajes de ${quien.clave}`))
const publicacionesDe = async (quien, ...pubs) =>
  ids(ok(await quien.cliente.from('publicaciones').select('id').in('id', pubs), `publicaciones de ${quien.clave}`))
const comentariosDe = async (quien, pub) =>
  ids(ok(await quien.cliente.from('comentarios').select('id').eq('publicacion_id', pub), `comentarios de ${quien.clave}`))
const sinLeer = async (quien) => ok(await quien.cliente.rpc('mensajes_sin_leer'), `sin leer de ${quien.clave}`)
const tokensDe = async (quien, conv) =>
  new Set(
    ok(
      await quien.cliente.rpc('dispositivos_de_conversacion', { p_conversacion: conv }),
      `dispositivos para ${quien.clave}`
    ).map((d) => d.token)
  )

// -----------------------------------------------------------------------------------

console.log('\nReportes y bloqueos del canal\n')

try {
  await limpiar()

  const A = await persona('a', 'Prueba Bloquea')
  const B = await persona('b', 'Prueba Bloqueado')
  const C = await persona('c', 'Prueba Testigo')

  // --- El escenario (con la clave de servicio) --------------------------------
  const grupo = ok(
    await admin.from('grupos').insert({ nombre: `${NOMBRE} grupo`, creador_id: C.id }).select('id').single(),
    'crear el grupo'
  )
  const convGrupo = crypto.randomUUID()
  const convAB = crypto.randomUUID()
  const convBC = crypto.randomUUID()
  ok(
    await admin.from('conversaciones').insert([
      { id: convGrupo, tipo: 'grupo', grupo_id: grupo.id },
      { id: convAB, tipo: 'directa', grupo_id: null },
      { id: convBC, tipo: 'directa', grupo_id: null },
    ]),
    'crear las conversaciones'
  )
  ok(
    await admin.from('conversacion_participantes').insert([
      { conversacion_id: convGrupo, empleado_id: A.id },
      { conversacion_id: convGrupo, empleado_id: B.id },
      { conversacion_id: convGrupo, empleado_id: C.id },
      { conversacion_id: convAB, empleado_id: A.id },
      { conversacion_id: convAB, empleado_id: B.id },
      { conversacion_id: convBC, empleado_id: B.id },
      { conversacion_id: convBC, empleado_id: C.id },
    ]),
    'sumar a los participantes'
  )

  const pubB = crypto.randomUUID() // de B, normal
  const pubBOficial = crypto.randomUUID() // de B, comunicado oficial
  const pubC = crypto.randomUUID() // de C, normal: donde se comenta
  // audiencia 'area' sin área: la RLS la deja leer, pero el feed de la gente real no la pinta.
  const base = { estado: 'publicado', audiencia: 'area', audiencia_area_id: null, tipo: 'noticia' }
  ok(
    await admin.from('publicaciones').insert([
      { ...base, id: pubB, titulo: `${NOMBRE} de B`, autor_id: B.id, oficial: false },
      { ...base, id: pubBOficial, titulo: `${NOMBRE} oficial de B`, autor_id: B.id, oficial: true },
      { ...base, id: pubC, titulo: `${NOMBRE} de C`, autor_id: C.id, oficial: false },
    ]),
    'crear las publicaciones'
  )

  // Un teléfono para A y otro para C (B no tiene), para el aviso de mensajes.
  const tokenA = `${TOKEN}a-000000000000`
  const tokenC = `${TOKEN}c-000000000000`
  ok(
    await admin.from('dispositivos').insert([
      { perfil_id: A.userId, token: tokenA, plataforma: 'ios' },
      { perfil_id: C.userId, token: tokenC, plataforma: 'ios' },
    ]),
    'registrar los teléfonos'
  )

  // Lo que se dijo, con las sesiones de cada quien (así también se prueba escribir).
  const mA1 = await enviar(A, convAB, 'A a B, antes del bloqueo')
  const mB1 = await enviar(B, convAB, 'B a A, antes del bloqueo')
  const gB1 = await enviar(B, convGrupo, 'B al grupo, antes del bloqueo')
  const gC1 = await enviar(C, convGrupo, 'C al grupo')
  const mBC = await enviar(B, convBC, 'B a C')
  for (const m of [mA1, mB1, gB1, gC1, mBC]) {
    if (m.error) throw new Error(`escribir el mensaje de arranque: ${m.error.message}`)
  }
  const cB = await comentar(B, pubC, 'Comentario de B')
  const cC = await comentar(C, pubC, 'Comentario de C')
  for (const c of [cB, cC]) if (c.error) throw new Error(`comentar: ${c.error.message}`)

  // --- 1. Antes de bloquear: todo se ve ------------------------------------------
  console.log('── Antes del bloqueo (la línea de base)')
  const baseA = {
    directa: await mensajesDe(A, convAB),
    grupo: await mensajesDe(A, convGrupo),
    pubs: await publicacionesDe(A, pubB, pubBOficial, pubC),
    comentarios: await comentariosDe(A, pubC),
    sinLeer: await sinLeer(A),
    tokensB: await tokensDe(B, convGrupo),
  }
  comprobar('A lee el hilo directo con B', tiene(baseA.directa, mA1.id, mB1.id))
  comprobar('A lee los mensajes de B en el grupo', tiene(baseA.grupo, gB1.id, gC1.id))
  comprobar('A ve las publicaciones de B', tiene(baseA.pubs, pubB, pubBOficial, pubC))
  comprobar('A ve los comentarios de B', tiene(baseA.comentarios, cB.id, cC.id))
  comprobar('A tiene 2 conversaciones sin leer', baseA.sinLeer === 2, `salió ${baseA.sinLeer}`)
  comprobar('el aviso de B llega a los teléfonos de A y de C', tiene(baseA.tokensB, tokenA, tokenC))

  const baseC = {
    grupo: await mensajesDe(C, convGrupo),
    pubs: await publicacionesDe(C, pubB, pubBOficial, pubC),
    comentarios: await comentariosDe(C, pubC),
    sinLeer: await sinLeer(C),
  }
  comprobar('C (testigo) ve lo de B y su contador es 2', tiene(baseC.grupo, gB1.id) && baseC.sinLeer === 2, `sin leer ${baseC.sinLeer}`)

  // --- 2. Reportar ---------------------------------------------------------------
  console.log('\n── Reportar')
  const rep = (quien, tipo, id, motivo = 'spam') =>
    quien.cliente.rpc('reportar_contenido', { p_tipo: tipo, p_contenido: id, p_motivo: motivo, p_detalle: null })

  const r1 = await rep(C, 'mensaje', gB1.id)
  comprobar('C reporta un mensaje de B que puede leer', !r1.error, r1.error?.message)
  const r2 = await rep(C, 'mensaje', gB1.id)
  comprobar('reportar dos veces lo mismo no falla', !r2.error, r2.error?.message)
  const { count: filas } = await admin
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('reportante_id', C.id)
    .eq('contenido_id', gB1.id)
  comprobar('y no abre un segundo reporte (idempotente)', filas === 1, `hay ${filas}`)
  const { data: guardado } = await admin
    .from('reportes')
    .select('extracto, autor_id, tipo')
    .eq('reportante_id', C.id)
    .eq('contenido_id', gB1.id)
    .maybeSingle()
  comprobar(
    'el reporte congela el extracto y el autor',
    guardado?.extracto === 'B al grupo, antes del bloqueo' && guardado?.autor_id === B.id && guardado?.tipo === 'mensaje',
    JSON.stringify(guardado)
  )

  const rPropio = await rep(C, 'mensaje', gC1.id)
  comprobar('no se puede reportar lo propio', !!rPropio.error && /escribiste/i.test(rPropio.error.message), rPropio.error?.message ?? 'lo aceptó')
  const rAjeno = await rep(A, 'mensaje', mBC.id)
  comprobar('no se puede reportar lo que no se puede leer (hilo ajeno)', !!rAjeno.error && /encontr/i.test(rAjeno.error.message), rAjeno.error?.message ?? 'lo aceptó')
  const { count: filasAjeno } = await admin
    .from('reportes')
    .select('id', { count: 'exact', head: true })
    .eq('contenido_id', mBC.id)
  comprobar('y el reporte de lo ilegible no deja fila', filasAjeno === 0, `hay ${filasAjeno}`)
  const rTipo = await rep(C, 'foto', gB1.id)
  comprobar('un tipo que no existe se rechaza', !!rTipo.error)

  for (const quien of [A, C]) {
    const lectura = await quien.cliente.from('reportes').select('id')
    comprobar(
      `${quien.clave === 'a' ? 'A' : 'C'} (sin modulo:reportes) no lee los reportes`,
      !lectura.error && (lectura.data ?? []).length === 0,
      lectura.error?.message ?? `leyó ${lectura.data?.length}`
    )
  }
  const escritura = await C.cliente
    .from('reportes')
    .insert({ tipo: 'mensaje', contenido_id: gC1.id, reportante_id: C.id, motivo: 'otro' })
  comprobar('nadie escribe `reportes` directamente', !!escritura.error)

  // --- 3. A bloquea a B -------------------------------------------------------------
  console.log('\n── A bloquea a B')
  const bloqueo = await A.cliente.from('bloqueos').insert({ bloqueador_id: A.id, bloqueado_id: B.id })
  comprobar('A bloquea a B', !bloqueo.error, bloqueo.error?.message)
  const suplantado = await B.cliente.from('bloqueos').insert({ bloqueador_id: A.id, bloqueado_id: C.id })
  comprobar('nadie bloquea en nombre de otro', !!suplantado.error)

  const dirA = await mensajesDe(A, convAB)
  comprobar('A deja de leer los mensajes directos de B', noTiene(dirA, mB1.id) && tiene(dirA, mA1.id))
  const grpA = await mensajesDe(A, convGrupo)
  comprobar('A deja de leer a B en el grupo, pero lee a los demás', noTiene(grpA, gB1.id) && tiene(grpA, gC1.id))
  const pubsA = await publicacionesDe(A, pubB, pubBOficial, pubC)
  comprobar('A no ve las publicaciones de B', noTiene(pubsA, pubB))
  comprobar('pero el comunicado oficial de B se sigue viendo', tiene(pubsA, pubBOficial))
  comprobar('y las de los demás también', tiene(pubsA, pubC))
  const comsA = await comentariosDe(A, pubC)
  comprobar('A no ve los comentarios de B, sí los de C', noTiene(comsA, cB.id) && tiene(comsA, cC.id))
  const noLeidosA = await sinLeer(A)
  comprobar('mensajes_sin_leer de A no cuenta a B', noLeidosA === 1, `salió ${noLeidosA}`)

  const mia = ok(await A.cliente.from('bloqueos').select('bloqueado_id'), 'bloqueos de A')
  comprobar('A lee sus bloqueos', mia.length === 1 && mia[0].bloqueado_id === B.id)
  const deB = ok(await B.cliente.from('bloqueos').select('bloqueado_id'), 'bloqueos de B')
  comprobar('B no lee ningún bloqueo (no se entera)', deB.length === 0)
  const heA = ok(await A.cliente.rpc('he_bloqueado', { p_otro: B.id }), 'he_bloqueado de A')
  const heB = ok(await B.cliente.rpc('he_bloqueado', { p_otro: A.id }), 'he_bloqueado de B')
  comprobar('he_bloqueado solo contesta por los bloqueos propios', heA === true && heB === false)

  // B ya no puede escribirle a A.
  const mB2 = await enviar(B, convAB, 'B a A, con el bloqueo puesto')
  comprobar('B no puede escribir en el hilo directo', !!mB2.error)
  const { data: mB2Fila } = await admin.from('mensajes').select('id').eq('id', mB2.id)
  comprobar('y su mensaje no quedó guardado', (mB2Fila ?? []).length === 0)
  const mA2 = await enviar(A, convAB, 'A a B, con el bloqueo puesto')
  comprobar('A tampoco escribe en un hilo que bloqueó', !!mA2.error)

  // Ni abrirle otro hilo, ni pedirle conexión.
  const convNueva = crypto.randomUUID()
  ok(await B.cliente.from('conversaciones').insert({ id: convNueva, tipo: 'directa' }), 'B abre un hilo vacío')
  const suyaB = await B.cliente.from('conversacion_participantes').insert({ conversacion_id: convNueva, empleado_id: B.id })
  const sumaA = await B.cliente.from('conversacion_participantes').insert({ conversacion_id: convNueva, empleado_id: A.id })
  comprobar('B no puede sumar a A a un hilo directo nuevo', !suyaB.error && !!sumaA.error, sumaA.error?.message ?? 'lo sumó')
  const conexion = await B.cliente.from('conexiones').insert({ solicita_id: B.id, recibe_id: A.id })
  comprobar('B no puede pedirle conexión a A', !!conexion.error)
  const { data: conexionFila } = await admin.from('conexiones').select('id').eq('solicita_id', B.id).eq('recibe_id', A.id)
  comprobar('y la solicitud no quedó guardada', (conexionFila ?? []).length === 0)
  const conexionA = await A.cliente.from('conexiones').insert({ solicita_id: A.id, recibe_id: B.id })
  comprobar('A tampoco le pide conexión a quien bloqueó', !!conexionA.error)
  const conexionC = await C.cliente.from('conexiones').insert({ solicita_id: C.id, recibe_id: A.id })
  comprobar('C sí puede pedirle conexión a A', !conexionC.error, conexionC.error?.message)

  // El grupo sigue funcionando para B y para los demás.
  const gB2 = await enviar(B, convGrupo, 'B al grupo, con el bloqueo puesto')
  comprobar('B sigue escribiendo en el grupo', !gB2.error, gB2.error?.message)
  const gC2 = await enviar(C, convGrupo, 'C al grupo, con el bloqueo puesto')
  comprobar('C sigue escribiendo en el grupo', !gC2.error, gC2.error?.message)
  comprobar('C lee lo que B escribe en el grupo', tiene(await mensajesDe(C, convGrupo), gB1.id, gB2.id))
  comprobar('B lee lo que A escribe en el hilo que A cerró para sí', tiene(await mensajesDe(B, convAB), mA1.id))
  comprobar('A no lee el mensaje nuevo de B en el grupo', noTiene(await mensajesDe(A, convGrupo), gB2.id) && tiene(await mensajesDe(A, convGrupo), gC2.id))

  // Los avisos al teléfono.
  const tokensB = await tokensDe(B, convGrupo)
  comprobar('el aviso de B ya no llega al teléfono de A', noTiene(tokensB, tokenA) && tiene(tokensB, tokenC))
  const tokensBDirecto = await tokensDe(B, convAB)
  comprobar('ni en el hilo directo', noTiene(tokensBDirecto, tokenA))

  // La persona que no bloquea a nadie no nota nada.
  console.log('\n── C, que no bloquea a nadie, no ve cambio')
  comprobar('C ve las mismas publicaciones', tiene(await publicacionesDe(C, pubB, pubBOficial, pubC), pubB, pubBOficial, pubC))
  comprobar('C ve los mismos comentarios', tiene(await comentariosDe(C, pubC), cB.id, cC.id))
  const noLeidosC = await sinLeer(C)
  comprobar('el contador de C es el mismo', noLeidosC === baseC.sinLeer, `${baseC.sinLeer} → ${noLeidosC}`)
  const mBC2 = await enviar(C, convBC, 'C a B, con el bloqueo de A puesto')
  comprobar('C y B se siguen escribiendo', !mBC2.error, mBC2.error?.message)

  // El oráculo: B no puede preguntarle a la base quién lo bloqueó.
  console.log('\n── B no puede preguntar quién lo bloqueó')
  const consultas = [
    ['me_bloqueo', { p_otro: A.id }],
    ['hay_bloqueo', { p_otro: A.id }],
    ['conversacion_bloqueada', { p_conversacion: convAB }],
    ['bloqueo_al_sumar', { p_conversacion: convAB, p_otro: A.id }],
  ]
  for (const [funcion, args] of consultas) {
    const publica = await B.cliente.rpc(funcion, args)
    comprobar(
      `${funcion} no contesta por la API (public)`,
      !!publica.error && publica.data == null,
      publica.error ? '' : `devolvió ${publica.data}`
    )
    const privada = await B.cliente.schema('privado').rpc(funcion, args)
    comprobar(
      `${funcion} no contesta por la API (privado)`,
      privada.error?.code === 'PGRST106' && privada.data == null,
      privada.error ? privada.error.message : `devolvió ${privada.data}`
    )
  }

  // --- 4. A desbloquea ------------------------------------------------------------------
  console.log('\n── A desbloquea a B: todo vuelve')
  const quita = await A.cliente.from('bloqueos').delete().eq('bloqueado_id', B.id)
  comprobar('A deshace el bloqueo', !quita.error, quita.error?.message)
  const quedan = ok(await A.cliente.from('bloqueos').select('bloqueado_id'), 'bloqueos de A')
  comprobar('y ya no hay ninguno', quedan.length === 0)

  const dirA2 = await mensajesDe(A, convAB)
  comprobar('A vuelve a leer los mensajes directos de B', tiene(dirA2, mB1.id, mA1.id))
  const grpA2 = await mensajesDe(A, convGrupo)
  comprobar('y a B en el grupo', tiene(grpA2, gB1.id, gB2.id, gC1.id))
  comprobar('y sus publicaciones', tiene(await publicacionesDe(A, pubB, pubBOficial), pubB, pubBOficial))
  comprobar('y sus comentarios', tiene(await comentariosDe(A, pubC), cB.id, cC.id))
  const noLeidosA2 = await sinLeer(A)
  comprobar('mensajes_sin_leer de A vuelve a 2', noLeidosA2 === 2, `salió ${noLeidosA2}`)
  comprobar('el aviso de B vuelve al teléfono de A', tiene(await tokensDe(B, convGrupo), tokenA, tokenC))

  const mB3 = await enviar(B, convAB, 'B a A, ya sin bloqueo')
  comprobar('B vuelve a escribir en el hilo directo', !mB3.error, mB3.error?.message)
  comprobar('y A lo lee', tiene(await mensajesDe(A, convAB), mB3.id))
  const conexion2 = await B.cliente.from('conexiones').insert({ solicita_id: B.id, recibe_id: A.id })
  comprobar('B puede pedirle conexión a A', !conexion2.error, conexion2.error?.message)
} catch (e) {
  fallos.push(`la prueba se cayó: ${e.message}`)
  console.log(`\n  ✖ la prueba se cayó: ${e.message}`)
} finally {
  const barrido = await limpiar().catch((e) => {
    fallos.push(`la limpieza falló: ${e.message}`)
    return null
  })
  if (barrido) {
    console.log(`\n  · limpieza: ${barrido.fichas} ficha(s) y ${barrido.usuarios} cuenta(s) de prueba borradas`)
    const { count } = await admin
      .from('empleados')
      .select('id', { count: 'exact', head: true })
      .like('cedula', `${CEDULA}%`)
    if (count) fallos.push(`quedaron ${count} fichas de prueba sin borrar`)
  }
}

console.log(`\n${pasadas} comprobaciones pasaron.`)
if (fallos.length) {
  console.log(`${fallos.length} fallaron:`)
  for (const f of fallos) console.log(`  ✖ ${f}`)
  process.exit(1)
}
console.log('Sin fallos.\n')
