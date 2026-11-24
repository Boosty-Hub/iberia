/**
 * El escenario de estructura con todas las ediciones y sin pisar la realidad (migración 20261124050000), con sesiones
 * reales contra PRUEBAS:   node --env-file=.env.local scripts/plataforma/probar-escenarios.mjs
 *
 * Comprueba: la comparación ve «reporta a», nómina y sede de la plaza (antes no); enviar se niega si una plaza que
 * cierra tiene gente; enviar se niega si algo que el escenario cambia se editó en la realidad después de su fecha base;
 * y un escenario limpio sí se envía. Descarta lo que crea.
 */
import { createClient } from '@supabase/supabase-js'

const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (!URL_SUPA || URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Faltan las SUPABASE_PRUEBAS_*')
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}
async function cliente(email) {
  const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data: e } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const { data } = await anon.auth.verifyOtp({ token_hash: e.properties.hashed_token, type: 'magiclink' })
  return { c: createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } }), id: data.user.id }
}
const yo = await cliente('admin.pruebas@plataforma.local')
const aprobador = await cliente('admin.iberia.pruebas@plataforma.local')
const hoy = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10)
const org = yo.c.schema('org')
const creados = []

async function nuevo(nombre) {
  const { data, error } = await org.rpc('crear_escenario_estructura', { p_nombre: nombre, p_fecha: hoy })
  if (error) throw error
  creados.push(data)
  return data
}

// Una plaza con gente y su jefe con jefe.
const { data: ocup } = await admin.schema('org').from('ocupacion').select('plaza_ref').filter('vigencia', 'cs', `[${hoy},${hoy}]`).eq('tipo', 'titular').limit(200)
const conGente = ocup[0].plaza_ref
const { data: plazas } = await admin.schema('org').from('plaza').select('ref, reporta_a_ref, tipo_nomina').is('escenario_id', null).filter('vigencia', 'cs', `[${hoy},${hoy}]`).range(0, 999)
const porRef = new Map(plazas.map((x) => [x.ref, x]))
const sinGente = plazas.find((x) => !ocup.some((o) => o.plaza_ref === x.ref) && x.reporta_a_ref && porRef.get(x.reporta_a_ref)?.reporta_a_ref && !plazas.some((y) => y.reporta_a_ref === x.ref))

// 1 · La comparación ve reporta a y nómina.
{
  const esc = await nuevo('Prueba · ediciones de plaza')
  const nuevoJefe = porRef.get(sinGente.reporta_a_ref).reporta_a_ref
  const nomina = sinGente.tipo_nomina === 'mensual' ? 'semanal' : 'mensual'
  const { error } = await org.from('plaza').update({ reporta_a_ref: nuevoJefe, tipo_nomina: nomina }).eq('escenario_id', esc).eq('ref', sinGente.ref)
  ok(!error, `se edita «reporta a» y nómina dentro del escenario (${error?.message ?? 'ok'})`)
  const { data: cmp } = await org.rpc('comparar_escenario', { p_escenario: esc })
  const c = (cmp ?? []).find((x) => x.ref === sinGente.ref)
  ok(!!c && c.despues?.tipo_nomina === nomina && c.despues?.reporta_a_ref === nuevoJefe, 'la comparación lo ve (antes la nómina no aparecía)')
  const { data: sol, error: e2 } = await org.rpc('enviar_escenario', { p_esc: esc, p_vigente_desde: hoy })
  ok(!e2 && !!sol, `un escenario limpio se envía (${e2?.message ?? 'ok'})`)
  if (sol) {
    const { data: paso } = await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', sol).eq('decision', 'pendiente').single()
    await aprobador.c.schema('flujo').rpc('decidir', { p_paso: paso.id, p_decision: 'rechazado', p_comentario: 'prueba, se rechaza' })
  }
}

// 2 · Una plaza con gente que el escenario cierra: no se envía.
{
  const esc = await nuevo('Prueba · cierra plaza con gente')
  await org.from('plaza').delete().eq('escenario_id', esc).eq('ref', conGente)
  const { error } = await org.rpc('enviar_escenario', { p_esc: esc, p_vigente_desde: hoy })
  ok(!!error && /cierra en el escenario y tiene a/.test(error.message), `no se envía si una plaza que cierra tiene gente: «${error?.message?.slice(0, 110)}…»`)
}

// 3 · Algo que el escenario cambia se editó en la realidad después de su fecha base. Se arma el caso: un escenario con
// base de ayer y, en la realidad, un cambio aprobado hoy sobre la misma plaza (por «Mis cambios»); luego se devuelve.
{
  const ayer = new Date(Date.now() - 28 * 3600e3).toISOString().slice(0, 10)
  const { data: esc, error: e0 } = await org.rpc('crear_escenario_estructura', { p_nombre: 'Prueba · base vieja', p_fecha: ayer })
  if (e0) throw e0
  creados.push(esc)
  const { data: antes } = await admin.schema('org').from('plaza').select('dotacion').eq('ref', sinGente.ref).is('escenario_id', null).filter('vigencia', 'cs', `[${hoy},${hoy}]`).single()
  const lote = async (dotacion) => {
    await admin.schema('org').from('escenario').update({ estado: 'descartado' }).eq('tipo', 'cambios').eq('estado', 'borrador').eq('creado_por', yo.id)
    const { error } = await org.rpc('proponer_cambio', { p_funcion: 'editar_plaza', p_args: { p_ref: sinGente.ref }, p_descripcion: 'prueba F4', p_parche: { dotacion } })
    if (error) throw error
    const { data: l } = await admin.schema('org').from('escenario').select('id').eq('tipo', 'cambios').eq('estado', 'borrador').eq('creado_por', yo.id).single()
    const { data: sol } = await org.rpc('enviar_cambios', { p_esc: l.id, p_vigente_desde: hoy })
    const { data: paso } = await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', sol).eq('decision', 'pendiente').single()
    const r = await aprobador.c.schema('flujo').rpc('decidir', { p_paso: paso.id, p_decision: 'aprobado' })
    if (r.error) throw r.error
  }
  await lote(antes.dotacion + 1)
  await org.from('plaza').update({ dotacion: 9 }).eq('escenario_id', esc).eq('ref', sinGente.ref)
  const { error } = await org.rpc('enviar_escenario', { p_esc: esc, p_vigente_desde: hoy })
  ok(!!error && /se cambió en la realidad/.test(error.message), `no se envía si la realidad cambió después de la base: «${error?.message?.slice(0, 120)}…»`)
  await lote(antes.dotacion)
}

// Limpieza: lo que quedó en borrador se descarta.
await admin.schema('org').from('escenario').update({ estado: 'descartado' }).in('id', creados).eq('estado', 'borrador')
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
