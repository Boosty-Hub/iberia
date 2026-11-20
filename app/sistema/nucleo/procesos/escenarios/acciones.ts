'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { claveDe } from '@/components/sistema/procesos/comun'

/**
 * Escenarios de procesos (E1.6). Un escenario es una copia aislada de un
 * subárbol vigente (filas de `sgc.proceso` con `escenario_id`): se edita libre,
 * se compara contra la realidad y, al aprobarse por su ruta, se publica con su
 * «vigente desde». Mientras está en borrador nada de esto toca la realidad.
 */

export type EstadoEscenario = { error?: string; ok?: string }

const RUTA = '/sistema/nucleo/procesos/escenarios'

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

function mensajeDe(error: { message: string; code?: string }): string {
  if (error.code === '42501') return 'No tienes permiso para hacer eso.'
  return error.message
}

type Cliente = Awaited<ReturnType<typeof createClient>>

/** El escenario existe, es de procesos y sigue en edición. */
async function enEdicion(supabase: Cliente, escenario: string): Promise<string | null> {
  const { data } = await supabase.schema('org').from('escenario').select('estado, alcance').eq('id', escenario).maybeSingle()
  if (!data || data.alcance !== 'procesos') return 'El escenario no existe.'
  if (data.estado !== 'borrador') return 'El escenario ya se envió: no se edita mientras se aprueba o después de publicarse.'
  return null
}

export async function crearEscenario(_: EstadoEscenario, fd: FormData): Promise<EstadoEscenario> {
  await requerirPermiso('sistema:escenarios', 'crear')
  await requerirPermiso('sistema:procesos', 'editar')
  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
  const raiz = texto(fd, 'raiz') || null
  const supabase = await createClient()
  const { data: id, error } = await supabase
    .schema('sgc')
    .rpc('crear_escenario_procesos', { p_nombre: nombre, p_descripcion: texto(fd, 'descripcion') || undefined, p_raiz: raiz ?? undefined })
  if (error || !id) return { error: mensajeDe(error ?? { message: 'No se pudo crear el escenario.' }) }
  revalidatePath(RUTA)
  redirect(`${RUTA}/${id}`)
}

export async function editarNodo(_: EstadoEscenario, fd: FormData): Promise<EstadoEscenario> {
  await requerirPermiso('sistema:escenarios', 'editar')
  await requerirPermiso('sistema:procesos', 'editar')
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const escenario = texto(fd, 'escenario')
  const id = texto(fd, 'id')
  const err = await enEdicion(supabase, escenario)
  if (err) return { error: err }

  const { data: nodo } = await sgc.from('proceso').select('ref, nivel, estado').eq('id', id).eq('escenario_id', escenario).maybeSingle()
  if (!nodo) return { error: 'Ese nodo no es de este escenario.' }
  if (nodo.estado === 'retirada') return { error: 'Está retirado en el escenario: restáuralo antes de editarlo.' }

  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
  const padre = texto(fd, 'padre_ref') || null
  if (nodo.nivel > 0) {
    if (!padre) return { error: 'Elige de qué proceso cuelga.' }
    const { data: p } = await sgc.from('proceso').select('nivel, estado').eq('ref', padre).eq('escenario_id', escenario).maybeSingle()
    if (!p || p.estado === 'retirada') return { error: 'El padre elegido no está en el escenario.' }
    if (p.nivel !== nodo.nivel - 1) return { error: 'El padre tiene que estar exactamente un nivel arriba.' }
  }
  const plaza = texto(fd, 'dueno_plaza_ref') || null
  const { error } = await sgc
    .from('proceso')
    .update({
      nombre,
      padre_ref: nodo.nivel > 0 ? padre : null,
      dueno_plaza_ref: plaza,
      estado_operativo: texto(fd, 'estado_operativo') || 'vigente',
    })
    .eq('id', id)
    .eq('escenario_id', escenario)
  if (error) return { error: mensajeDe(error) }
  revalidatePath(`${RUTA}/${escenario}`)
  return { ok: 'Guardado en el escenario.' }
}

export async function agregarNodo(_: EstadoEscenario, fd: FormData): Promise<EstadoEscenario> {
  await requerirPermiso('sistema:escenarios', 'editar')
  await requerirPermiso('sistema:procesos', 'crear')
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const escenario = texto(fd, 'escenario')
  const err = await enEdicion(supabase, escenario)
  if (err) return { error: err }
  const padreRef = texto(fd, 'padre_ref')
  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
  const { data: padre } = await sgc
    .from('proceso')
    .select('nivel, tipo, dueno_plaza_ref, dueno_texto, area_texto, estado')
    .eq('ref', padreRef)
    .eq('escenario_id', escenario)
    .maybeSingle()
  if (!padre || padre.estado === 'retirada') return { error: 'El padre no está en el escenario.' }
  if (padre.nivel >= 3) return { error: 'Las actividades (nivel 3) no tienen hijos.' }
  const { count } = await sgc.from('proceso').select('id', { count: 'exact', head: true }).eq('padre_ref', padreRef).eq('escenario_id', escenario)
  const { error } = await sgc.from('proceso').insert({
    id: crypto.randomUUID(),
    ref: crypto.randomUUID(),
    clave: claveDe(nombre),
    nivel: padre.nivel + 1,
    padre_ref: padreRef,
    orden: 10000 + (count ?? 0),
    nombre,
    tipo: padre.tipo,
    estado_operativo: 'propuesto',
    dueno_plaza_ref: texto(fd, 'dueno_plaza_ref') || padre.dueno_plaza_ref,
    dueno_texto: padre.dueno_texto,
    area_texto: padre.area_texto,
    ficha: {},
    estado: 'borrador',
    version: 1,
    vigencia: null,
    escenario_id: escenario,
    fuente: ['plataforma'],
  })
  if (error) return { error: mensajeDe(error) }
  revalidatePath(`${RUTA}/${escenario}`)
  return { ok: 'Agregado al escenario.' }
}

/** Retirar (o restaurar) un nodo y todo lo que cuelga de él, dentro del escenario. */
export async function retirarNodo(fd: FormData) {
  await requerirPermiso('sistema:escenarios', 'editar')
  await requerirPermiso('sistema:procesos', 'editar')
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const escenario = texto(fd, 'escenario')
  const ref = texto(fd, 'ref')
  const restaurar = fd.get('restaurar') === 'si'
  const err = await enEdicion(supabase, escenario)
  if (err) redirect(`${RUTA}/${escenario}?error=${encodeURIComponent(err)}`)

  const { data: filas } = await sgc.from('proceso').select('ref, padre_ref, estado').eq('escenario_id', escenario).range(0, 4999)
  if (restaurar) {
    const padre = (filas ?? []).find((f) => f.ref === (filas ?? []).find((x) => x.ref === ref)?.padre_ref)
    if (padre?.estado === 'retirada') redirect(`${RUTA}/${escenario}?error=${encodeURIComponent('Su padre también está retirado: restaura primero el padre.')}`)
  }
  const hijos = new Map<string, string[]>()
  for (const f of filas ?? []) if (f.padre_ref) (hijos.get(f.padre_ref) ?? hijos.set(f.padre_ref, []).get(f.padre_ref)!).push(f.ref)
  const refs: string[] = []
  const pila = [ref]
  while (pila.length && refs.length < 2000) {
    const r = pila.pop()!
    refs.push(r)
    pila.push(...(hijos.get(r) ?? []))
  }
  const { error } = await sgc
    .from('proceso')
    .update({ estado: restaurar ? 'borrador' : 'retirada' })
    .eq('escenario_id', escenario)
    .in('ref', refs)
  if (error) redirect(`${RUTA}/${escenario}?error=${encodeURIComponent(mensajeDe(error))}`)
  revalidatePath(`${RUTA}/${escenario}`)
  redirect(`${RUTA}/${escenario}`)
}

export async function enviarEscenario(_: EstadoEscenario, fd: FormData): Promise<EstadoEscenario> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const supabase = await createClient()
  const escenario = texto(fd, 'escenario')
  const desde = texto(fd, 'vigente_desde')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return { error: 'Elige la fecha desde la que rige.' }
  const { error } = await supabase.schema('sgc').rpc('enviar_escenario_procesos', { p_esc: escenario, p_vigente_desde: desde })
  if (error) return { error: mensajeDe(error) }
  revalidatePath(RUTA)
  revalidatePath(`${RUTA}/${escenario}`)
  redirect(`${RUTA}/${escenario}?enviado=1`)
}

export async function descartarEscenario(fd: FormData) {
  await requerirPermiso('sistema:escenarios', 'editar')
  const supabase = await createClient()
  const escenario = texto(fd, 'escenario')
  const { error } = await supabase.schema('org').from('escenario').update({ estado: 'descartado' }).eq('id', escenario).eq('estado', 'borrador')
  if (error) redirect(`${RUTA}/${escenario}?error=${encodeURIComponent(mensajeDe(error))}`)
  revalidatePath(RUTA)
  redirect(`${RUTA}/${escenario}`)
}
