/**
 * Toda edición pasa por aprobación (migración 20261124040000), con sesiones reales contra el proyecto de PRUEBAS:
 *
 *   node --env-file=.env.local scripts/plataforma/probar-cambios.mjs
 *
 * Autor: la cuenta de administración de pruebas. Aprobador: la de administración Iberia de pruebas (otro administrador).
 * Comprueba: la API ya no escribe la realidad ni llama las funciones directas; proponer deja la realidad intacta y
 * acumula en el borrador; un cambio que no cuadra falla en el acto; el autor no aprueba lo suyo; al aprobar, el lote
 * entra a la realidad (dotación y «reporta a» de una plaza, a la vez, sin pisarse); devolver regresa el lote al borrador;
 * y deja todo como estaba.
 */
import { createClient } from '@supabase/supabase-js'

const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
if (!URL_SUPA || URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Faltan las SUPABASE_PRUEBAS_* (o apuntan a producción)')
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })

let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

async function cliente(email) {
  const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
  const { data: e, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`${email}: ${error.message}`)
  const { data } = await anon.auth.verifyOtp({ token_hash: e.properties.hashed_token, type: 'magiclink' })
  const c = createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } })
  return { c, id: data.user.id }
}

const autor = await cliente('admin.pruebas@plataforma.local')
const aprobador = await cliente('admin.iberia.pruebas@plataforma.local')
const hoy = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10)

// Se empieza limpio: sin borrador abierto del autor.
await admin.schema('org').from('escenario').update({ estado: 'descartado' }).eq('tipo', 'cambios').eq('estado', 'borrador').eq('creado_por', autor.id)

// Una plaza vigente con dotación ≥ 1 y otra a la que pueda reportar.
// El «otro jefe» es el jefe de su jefe: así no se arma un círculo (la base lo rechaza, y está bien).
const { data: plazas } = await admin.schema('org').from('plaza').select('ref, dotacion, reporta_a_ref, unidad_ref').is('escenario_id', null).filter('vigencia', 'cs', `[${hoy},${hoy}]`).neq('estado', 'cerrada').range(0, 999)
const porRef = new Map(plazas.map((x) => [x.ref, x]))
const p = plazas.find((x) => x.reporta_a_ref && porRef.get(x.reporta_a_ref)?.reporta_a_ref)
const otroJefe = porRef.get(porRef.get(p.reporta_a_ref).reporta_a_ref)
const leer = async () => (await admin.schema('org').from('plaza').select('dotacion, reporta_a_ref').eq('ref', p.ref).is('escenario_id', null).filter('vigencia', 'cs', `[${hoy},${hoy}]`).single()).data

// 1 · La API ya no escribe la realidad.
{
  const { data } = await autor.c.schema('org').from('plaza').update({ dotacion: p.dotacion + 7 }).eq('ref', p.ref).is('escenario_id', null).select('ref')
  ok(!(data ?? []).length && (await leer()).dotacion === p.dotacion, 'la API no actualiza una plaza real (antes sí, sin versionar)')
  const { error } = await autor.c.schema('org').rpc('editar_plaza', { p_ref: p.ref, p_fecha: hoy, p_dotacion: p.dotacion + 1, p_reporta_a_ref: p.reporta_a_ref, p_estado: '', p_tipo_nomina: '', p_sede: '' })
  ok(!!error, `la función directa ya no se llama desde la sesión (${error?.code ?? 'sin error'})`)
}

// 2 · Proponer: la realidad queda igual y el borrador acumula.
const prop = (funcion, args, parche, descripcion) =>
  autor.c.schema('org').rpc('proponer_cambio', { p_funcion: funcion, p_args: args, p_descripcion: descripcion, p_parche: parche, p_objeto: 'plaza', p_objeto_ref: p.ref })
{
  const r1 = await prop('editar_plaza', { p_ref: p.ref }, { dotacion: p.dotacion + 1 }, 'prueba: dotación +1')
  const r2 = await prop('editar_plaza', { p_ref: p.ref }, { reporta_a_ref: otroJefe.ref }, 'prueba: reporta a otro jefe')
  ok(!r1.error && !r2.error && r2.data?.cambios === 2, `dos cambios propuestos en el borrador (${r1.error?.message ?? r2.error?.message ?? r2.data?.cambios})`)
  const real = await leer()
  ok(real.dotacion === p.dotacion && real.reporta_a_ref === p.reporta_a_ref, 'la realidad no cambió al proponer')
  const r3 = await prop('editar_plaza', { p_ref: p.ref }, { dotacion: 0 }, 'prueba: dotación 0 (no vale)')
  ok(!!r3.error && /al menos 1/.test(r3.error.message), `un cambio que no cuadra falla en el acto: «${r3.error?.message}»`)
}

const { data: lote } = await admin.schema('org').from('escenario').select('id').eq('tipo', 'cambios').eq('estado', 'borrador').eq('creado_por', autor.id).single()

// 3 · Enviar y aprobar.
{
  const { data: sol, error } = await autor.c.schema('org').rpc('enviar_cambios', { p_esc: lote.id, p_vigente_desde: hoy, p_nota: 'prueba' })
  ok(!error && !!sol, `enviado a aprobación (${error?.message ?? 'ok'})`)
  const { data: paso } = await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', sol).eq('decision', 'pendiente').single()
  const propio = await autor.c.schema('flujo').rpc('decidir', { p_paso: paso.id, p_decision: 'aprobado' })
  ok(!!propio.error, 'el autor no aprueba lo suyo')
  const { data: bandeja } = await aprobador.c.schema('flujo').rpc('bandeja')
  ok((bandeja ?? []).some((x) => x.paso_id === paso.id), 'al aprobador le sale en su bandeja')
  const dec = await aprobador.c.schema('flujo').rpc('decidir', { p_paso: paso.id, p_decision: 'aprobado' })
  ok(!dec.error, `el aprobador aprueba (${dec.error?.message ?? dec.data})`)
  const real = await leer()
  ok(real.dotacion === p.dotacion + 1 && real.reporta_a_ref === otroJefe.ref, `entró a la realidad: dotación ${p.dotacion} → ${real.dotacion} y «reporta a» cambiado, sin pisarse`)
  const { data: e } = await admin.schema('org').from('escenario').select('estado').eq('id', lote.id).single()
  ok(e.estado === 'publicado', `el lote quedó «${e.estado}»`)
  const { data: aud } = await admin.schema('control').from('auditoria').select('actor').eq('tabla', 'plaza').order('en', { ascending: false }).limit(1)
  ok(aud?.[0]?.actor === autor.id, 'la auditoría registra al autor')
}

// 4 · Devolver: el lote vuelve al borrador (y se deja la plaza como estaba, con otro lote aprobado).
{
  await prop('editar_plaza', { p_ref: p.ref }, { dotacion: p.dotacion, reporta_a_ref: p.reporta_a_ref }, 'prueba: devolver la plaza a como estaba')
  const { data: l2 } = await admin.schema('org').from('escenario').select('id').eq('tipo', 'cambios').eq('estado', 'borrador').eq('creado_por', autor.id).single()
  const { data: sol } = await autor.c.schema('org').rpc('enviar_cambios', { p_esc: l2.id, p_vigente_desde: hoy })
  const { data: paso } = await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', sol).eq('decision', 'pendiente').single()
  const dev = await aprobador.c.schema('flujo').rpc('decidir', { p_paso: paso.id, p_decision: 'devuelto', p_comentario: 'prueba de devolución' })
  const { data: e } = await admin.schema('org').from('escenario').select('estado').eq('id', l2.id).single()
  ok(!dev.error && e.estado === 'borrador', `devuelto: el lote vuelve al borrador del autor (${dev.error?.message ?? e.estado})`)
  const { data: sol2 } = await autor.c.schema('org').rpc('enviar_cambios', { p_esc: l2.id, p_vigente_desde: hoy })
  const { data: paso2 } = await admin.schema('flujo').from('paso').select('id').eq('solicitud_id', sol2).eq('decision', 'pendiente').single()
  await aprobador.c.schema('flujo').rpc('decidir', { p_paso: paso2.id, p_decision: 'aprobado' })
  const real = await leer()
  ok(real.dotacion === p.dotacion && real.reporta_a_ref === p.reporta_a_ref, 'la plaza quedó como estaba (por otro lote aprobado)')
}

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
