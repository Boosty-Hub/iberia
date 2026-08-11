/**
 * Comprueba los caminos del canal contra la base real, con la sesión de un
 * empleado (clave publicable + contraseña), no con la clave de servicio: lo
 * que se está probando es justamente RLS.
 *
 *   node --env-file=.env.local scripts/probar-canal.mjs --password "<clave>"
 *
 * Todo lo que crea lo borra al final con la clave de servicio. Si algo falla a
 * mitad, la limpieza igual corre.
 */

import { createClient } from '@supabase/supabase-js'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const CLAVE = args.password
if (!CLAVE) {
  console.error('\n✖ Falta --password.\n')
  process.exit(1)
}

const comoEmpleado = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } }
)

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const creado = { conversaciones: [], grupos: [], publicaciones: [], conexiones: [] }
let ok = 0
let fallos = 0

function comprobar(titulo, condicion, detalle = '') {
  if (condicion) {
    ok++
    console.log(`  ✔ ${titulo}`)
  } else {
    fallos++
    console.log(`  ✖ ${titulo}${detalle ? `\n      ${detalle}` : ''}`)
  }
}

try {
  const { error: errAuth } = await comoEmpleado.auth.signInWithPassword({
    email: EMAIL,
    password: CLAVE,
  })
  if (errAuth) throw new Error(`No se pudo entrar: ${errAuth.message}`)

  const { data: yo } = await comoEmpleado
    .from('empleados')
    .select('id, nombre_completo, nivel')
    .eq('email', EMAIL)
    .maybeSingle()

  if (!yo) throw new Error(`${EMAIL} no tiene ficha en el padrón`)
  console.log(`\nSesión de ${yo.nombre_completo} (${yo.nivel})\n`)

  // --- Directorio -------------------------------------------------------------
  console.log('── Directorio')
  const { data: gente } = await comoEmpleado
    .from('empleados')
    .select('id, nombre_completo, nivel')
    .eq('activo', true)
  comprobar('el directorio es visible para toda la organización', (gente?.length ?? 0) > 1)

  const otro = gente.find((p) => p.id !== yo.id && p.nivel === 'planta')
  const par = gente.find((p) => p.id !== yo.id && p.nivel === 'gerencia')
  comprobar('hay alguien de planta y alguien de gerencia para probar', !!otro && !!par)

  // --- Conexiones -------------------------------------------------------------
  console.log('\n── Conexiones')
  const { data: conexion, error: errConexion } = await comoEmpleado
    .from('conexiones')
    .insert({ solicita_id: yo.id, recibe_id: par.id })
    .select('id')
    .single()
  comprobar('puedo solicitar conexión a un par', !!conexion, errConexion?.message)
  if (conexion) creado.conexiones.push(conexion.id)

  const { error: errAjena } = await comoEmpleado
    .from('conexiones')
    .insert({ solicita_id: par.id, recibe_id: otro.id })
  comprobar('no puedo solicitar conexión en nombre de otro', !!errAjena)

  // --- Conversación directa -----------------------------------------------------
  console.log('\n── Conversación directa')
  const convId = crypto.randomUUID()
  const { error: errConv } = await comoEmpleado
    .from('conversaciones')
    .insert({ id: convId, tipo: 'directa' })
  comprobar('puedo abrir una conversación directa', !errConv, errConv?.message)
  creado.conversaciones.push(convId)

  const { error: errYo } = await comoEmpleado
    .from('conversacion_participantes')
    .insert({ conversacion_id: convId, empleado_id: yo.id })
  comprobar('me sumo yo al hilo', !errYo, errYo?.message)

  const { error: errOtro } = await comoEmpleado
    .from('conversacion_participantes')
    .insert({ conversacion_id: convId, empleado_id: otro.id })
  comprobar('sumo a la otra persona', !errOtro, errOtro?.message)

  const { error: errTercero } = await comoEmpleado
    .from('conversacion_participantes')
    .insert({ conversacion_id: convId, empleado_id: par.id })
  comprobar('un 1:1 no se convierte en grupo con un tercero', !!errTercero)

  const { error: errMsg } = await comoEmpleado
    .from('mensajes')
    .insert({ conversacion_id: convId, autor_id: yo.id, texto: 'Prueba automatizada' })
  comprobar('escribo en el hilo donde participo', !errMsg, errMsg?.message)

  const { data: leidos } = await comoEmpleado
    .from('mensajes')
    .select('id')
    .eq('conversacion_id', convId)
  comprobar('leo lo que se escribió', (leidos?.length ?? 0) === 1)

  const { error: errAjeno } = await comoEmpleado
    .from('mensajes')
    .insert({ conversacion_id: convId, autor_id: otro.id, texto: 'Suplantación' })
  comprobar('no puedo escribir en nombre de otro', !!errAjeno)

  const { data: sinLeer } = await comoEmpleado.rpc('mensajes_sin_leer')
  comprobar('el contador de no leídos responde', typeof sinLeer === 'number')

  // --- Grupos -------------------------------------------------------------------
  console.log('\n── Grupos')
  const grupoId = crypto.randomUUID()
  const { error: errGrupo } = await comoEmpleado.from('grupos').insert({
    id: grupoId,
    nombre: 'Prueba automatizada',
    tipo: 'cerrado',
    creador_id: yo.id,
  })
  comprobar('puedo crear un grupo', !errGrupo, errGrupo?.message)
  creado.grupos.push(grupoId)

  const { error: errMiembro } = await comoEmpleado
    .from('grupo_miembros')
    .insert({ grupo_id: grupoId, empleado_id: yo.id, rol: 'coordinador' })
  comprobar('quedo como coordinador', !errMiembro, errMiembro?.message)

  const { data: veoGrupo } = await comoEmpleado
    .from('grupos')
    .select('id')
    .eq('id', grupoId)
    .maybeSingle()
  comprobar('veo el grupo cerrado del que soy miembro', !!veoGrupo)

  const convGrupo = crypto.randomUUID()
  const { error: errConvGrupo } = await comoEmpleado
    .from('conversaciones')
    .insert({ id: convGrupo, tipo: 'grupo', grupo_id: grupoId })
  comprobar('abro la conversación del grupo', !errConvGrupo, errConvGrupo?.message)
  creado.conversaciones.push(convGrupo)

  const { error: errDuplicado } = await comoEmpleado
    .from('conversaciones')
    .insert({ id: crypto.randomUUID(), tipo: 'grupo', grupo_id: grupoId })
  comprobar('un grupo no puede tener dos hilos', !!errDuplicado)

  // --- Publicaciones --------------------------------------------------------------
  console.log('\n── Publicaciones')
  const { data: publicacion, error: errPub } = await comoEmpleado
    .from('publicaciones')
    .insert({
      titulo: 'Prueba automatizada',
      tipo: 'noticia',
      audiencia: 'todos',
      estado: 'publicado',
      autor_id: yo.id,
      publicado_en: new Date().toISOString(),
    })
    .select('id')
    .single()
  comprobar('publico en el canal', !!publicacion, errPub?.message)
  if (publicacion) creado.publicaciones.push(publicacion.id)

  const { error: errLectura } = await comoEmpleado
    .from('publicacion_lecturas')
    .insert({ publicacion_id: publicacion.id, empleado_id: yo.id, origen: 'feed' })
  comprobar('queda registrada mi lectura', !errLectura, errLectura?.message)

  const { error: errLecturaAjena } = await comoEmpleado
    .from('publicacion_lecturas')
    .insert({ publicacion_id: publicacion.id, empleado_id: otro.id, origen: 'feed' })
  comprobar('no puedo registrar la lectura de otro', !!errLecturaAjena)

  // --- Accesos ---------------------------------------------------------------------
  console.log('\n── Accesos')
  const { data: tokens } = await comoEmpleado.from('accesos').select('id')
  comprobar('los enlaces de WhatsApp no se leen desde el cliente', (tokens?.length ?? 0) === 0)
} catch (e) {
  fallos++
  console.error(`\n✖ ${e.message}`)
} finally {
  // --- Limpieza -----------------------------------------------------------------
  for (const id of creado.publicaciones) await admin.from('publicaciones').delete().eq('id', id)
  for (const id of creado.conversaciones) await admin.from('conversaciones').delete().eq('id', id)
  for (const id of creado.grupos) await admin.from('grupos').delete().eq('id', id)
  for (const id of creado.conexiones) await admin.from('conexiones').delete().eq('id', id)
  console.log('\n  (limpieza hecha)')
}

console.log(`\n${fallos === 0 ? '✔' : '✖'} ${ok} bien, ${fallos} mal\n`)
process.exit(fallos === 0 ? 0 : 1)
