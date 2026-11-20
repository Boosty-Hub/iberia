'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { claveDe, normalizarFicha } from '@/components/sistema/procesos/comun'
import type { Json } from '@/lib/database.types'

/**
 * Acciones del catálogo de procesos. **Una versión publicada nunca se edita**
 * (lo impide un trigger en la base): editar es abrir un borrador
 * (`sgc.nuevo_borrador`), cambiarlo y enviarlo a revisión
 * (`sgc.enviar_proceso`), que abre la solicitud con la ruta «proceso». Aprobar
 * no se hace aquí: lo hace la bandeja, y quien pidió nunca aprueba lo suyo.
 *
 * Cada acción vuelve a pedir el permiso: el botón escondido no protege nada.
 */

export type EstadoAccion = { error?: string; ok?: string }

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

function nulo(fd: FormData, campo: string): string | null {
  return texto(fd, campo) || null
}

function mensajeDe(error: { message: string; code?: string }): string {
  if (error.code === '42501') return 'No tienes permiso para hacer eso.'
  if (error.code === '23P01') return 'Ya hay otra versión vigente que choca con esas fechas.'
  return error.message
}

const RUTA = '/sistema/nucleo/procesos'

function refrescar(ref?: string) {
  revalidatePath(RUTA)
  revalidatePath(`${RUTA}/arbol`)
  if (ref) {
    revalidatePath(`${RUTA}/${ref}`)
    revalidatePath(`${RUTA}/${ref}/editar`)
  }
}

/** «Editar»: abre el borrador (o devuelve el que ya hay) y lleva al formulario. */
export async function abrirBorrador(fd: FormData) {
  await requerirPermiso('sistema:procesos', 'editar')
  const ref = texto(fd, 'ref')
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('nuevo_borrador', { p_ref: ref })
  if (error) redirect(`${RUTA}/${ref}?error=${encodeURIComponent(mensajeDe(error))}`)
  refrescar(ref)
  redirect(`${RUTA}/${ref}/editar`)
}

/** El padre nuevo tiene que estar un nivel arriba: así el árbol no se rompe ni hace ciclos. */
async function validarPadre(
  supabase: Awaited<ReturnType<typeof createClient>>,
  padre: string | null,
  nivel: number,
  escenario: string | null,
): Promise<string | null> {
  if (nivel === 0) return padre ? 'Un macroproceso no cuelga de otro proceso.' : null
  if (!padre) return 'Elige de qué proceso cuelga.'
  let q = supabase.schema('sgc').from('proceso').select('nivel').eq('ref', padre)
  q = escenario ? q.eq('escenario_id', escenario).neq('estado', 'retirada') : q.is('escenario_id', null).eq('estado', 'vigente')
  const { data } = await q.limit(1).maybeSingle()
  if (!data) return 'El proceso padre no existe o no está vigente.'
  if (data.nivel !== nivel - 1) return 'El proceso padre tiene que estar exactamente un nivel arriba.'
  return null
}

/** Guarda el borrador: datos del nodo y ficha completa. */
export async function guardarBorrador(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:procesos', 'editar')
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const id = texto(fd, 'id')

  const { data: actual } = await sgc.from('proceso').select('id, ref, nivel, estado, ficha, escenario_id').eq('id', id).maybeSingle()
  if (!actual) return { error: 'Ese borrador ya no existe.' }
  if (actual.estado !== 'borrador') return { error: 'Solo se edita un borrador. Esta versión ya se envió o se publicó.' }

  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }

  let ficha: unknown
  try {
    ficha = JSON.parse(texto(fd, 'ficha') || '{}')
  } catch {
    return { error: 'La ficha llegó dañada. Recarga la página e intenta de nuevo.' }
  }
  // Lo que la pantalla no edita (el origen de la hoja y cualquier clave que
  // traiga la carga) se conserva tal cual.
  const previa = (actual.ficha && typeof actual.ficha === 'object' ? actual.ficha : {}) as Record<string, unknown>
  const limpia = normalizarFicha(ficha)
  // Pasa por JSON para que el tipo sea `Json` (lo que la columna acepta).
  const nueva = JSON.parse(
    JSON.stringify({
      ...previa,
      ...limpia,
      origen: previa.origen ?? null,
      objetivo: limpia.objetivo || null,
      alcance: limpia.alcance || null,
    }),
  ) as Json

  const padre = nulo(fd, 'padre_ref')
  const errPadre = await validarPadre(supabase, padre, actual.nivel, actual.escenario_id)
  if (errPadre) return { error: errPadre }

  const plaza = nulo(fd, 'dueno_plaza_ref')
  const { error } = await sgc
    .from('proceso')
    .update({
      nombre,
      tipo: nulo(fd, 'tipo'),
      estado_operativo: texto(fd, 'estado_operativo') || 'vigente',
      codigo_sgc: nulo(fd, 'codigo_sgc'),
      generacion: nulo(fd, 'generacion'),
      codigo_informe: nulo(fd, 'codigo_informe'),
      padre_ref: padre,
      dueno_plaza_ref: plaza,
      dueno_texto: nulo(fd, 'dueno_texto'),
      area_texto: nulo(fd, 'area_texto'),
      nota: nulo(fd, 'nota'),
      ficha: nueva,
    })
    .eq('id', id)
    .eq('estado', 'borrador')
  if (error) return { error: mensajeDe(error) }

  refrescar(actual.ref)
  return { ok: 'Borrador guardado.' }
}

/** «Enviar a revisión»: abre la solicitud con la ruta de aprobación de procesos. */
export async function enviarARevision(fd: FormData) {
  await requerirPermiso('sistema:procesos', 'editar')
  const id = texto(fd, 'id')
  const ref = texto(fd, 'ref')
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('enviar_proceso', { p_id: id })
  if (error) redirect(`${RUTA}/${ref}/editar?error=${encodeURIComponent(mensajeDe(error))}`)
  refrescar(ref)
  redirect(`${RUTA}/${ref}/editar?enviado=1`)
}

/**
 * Descartar un borrador que nunca se envió. Es la única fila de procesos que se
 * borra: no fue publicada ni revisada, y la auditoría guarda lo que decía.
 */
export async function descartarBorrador(fd: FormData) {
  await requerirPermiso('sistema:procesos', 'eliminar')
  const id = texto(fd, 'id')
  const ref = texto(fd, 'ref')
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').from('proceso').delete().eq('id', id).eq('estado', 'borrador').is('escenario_id', null)
  if (error) redirect(`${RUTA}/${ref}/editar?error=${encodeURIComponent(mensajeDe(error))}`)
  refrescar(ref)
  const { count } = await supabase.schema('sgc').from('proceso').select('id', { count: 'exact', head: true }).eq('ref', ref).is('escenario_id', null)
  redirect(count ? `${RUTA}/${ref}?descartado=1` : `${RUTA}/arbol?descartado=1`)
}

/**
 * Un proceso hijo nuevo: nace como borrador, versión 1, sin vigencia. Con la
 * casilla marcada se envía a aprobación en el mismo paso; si no, queda para
 * completar su ficha antes.
 */
export async function crearHijo(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:procesos', 'crear')
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')

  const padreRef = texto(fd, 'padre_ref')
  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }

  const { data: padre } = await sgc
    .from('proceso')
    .select('ref, nivel, tipo, dueno_plaza_ref, dueno_texto, area_texto')
    .eq('ref', padreRef)
    .is('escenario_id', null)
    .eq('estado', 'vigente')
    .maybeSingle()
  if (!padre) return { error: 'El proceso padre no está vigente.' }
  if (padre.nivel >= 3) return { error: 'Las actividades (nivel 3) no tienen hijos.' }

  const { count } = await sgc.from('proceso').select('id', { count: 'exact', head: true }).eq('padre_ref', padreRef).is('escenario_id', null)
  const id = crypto.randomUUID()
  const ref = crypto.randomUUID()
  const plaza = nulo(fd, 'dueno_plaza_ref') ?? padre.dueno_plaza_ref
  const { error } = await sgc.from('proceso').insert({
    id,
    ref,
    clave: claveDe(nombre),
    nivel: padre.nivel + 1,
    padre_ref: padreRef,
    orden: 10000 + (count ?? 0),
    nombre,
    tipo: padre.tipo,
    codigo_sgc: nulo(fd, 'codigo_sgc'),
    codigo_informe: nulo(fd, 'codigo_informe'),
    estado_operativo: texto(fd, 'estado_operativo') || 'propuesto',
    dueno_plaza_ref: plaza,
    dueno_texto: plaza ? null : padre.dueno_texto,
    area_texto: padre.area_texto,
    ficha: {},
    estado: 'borrador',
    version: 1,
    vigencia: null,
    fuente: ['plataforma'],
    nota: nulo(fd, 'nota'),
  })
  if (error) return { error: mensajeDe(error) }

  if (fd.get('enviar') === 'si') {
    const { error: e2 } = await sgc.rpc('enviar_proceso', { p_id: id })
    if (e2) return { error: `Se creó el borrador, pero no se pudo enviar: ${mensajeDe(e2)}` }
  }
  refrescar(ref)
  redirect(`${RUTA}/${ref}/editar${fd.get('enviar') === 'si' ? '?enviado=1' : '?creado=1'}`)
}

/** Mover un nodo: abre su borrador con el padre nuevo y lleva a revisarlo. */
export async function moverNodo(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:procesos', 'editar')
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const ref = texto(fd, 'ref')
  const padre = nulo(fd, 'padre_ref')

  const { data: id, error } = await sgc.rpc('nuevo_borrador', { p_ref: ref })
  if (error || !id) return { error: mensajeDe(error ?? { message: 'No se pudo abrir el borrador.' }) }
  const { data: b } = await sgc.from('proceso').select('nivel, estado, padre_ref').eq('id', id).maybeSingle()
  if (!b) return { error: 'No se encontró el borrador.' }
  if (b.estado !== 'borrador') return { error: 'Este proceso ya tiene una versión en revisión: espera la decisión antes de moverlo.' }
  if (b.padre_ref === padre) return { error: 'Ya cuelga de ese proceso.' }
  const errPadre = await validarPadre(supabase, padre, b.nivel, null)
  if (errPadre) return { error: errPadre }
  const { error: e2 } = await sgc.from('proceso').update({ padre_ref: padre }).eq('id', id).eq('estado', 'borrador')
  if (e2) return { error: mensajeDe(e2) }

  if (fd.get('enviar') === 'si') {
    const { error: e3 } = await sgc.rpc('enviar_proceso', { p_id: id })
    if (e3) return { error: `El borrador quedó movido, pero no se pudo enviar: ${mensajeDe(e3)}` }
  }
  refrescar(ref)
  redirect(`${RUTA}/${ref}/editar${fd.get('enviar') === 'si' ? '?enviado=1' : '?movido=1'}`)
}

/** El cruce SGC ↔ informe: tipo, confirmación y nota. Directo, con auditoría. */
export async function actualizarCruce(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:procesos', 'editar')
  const supabase = await createClient()
  const id = texto(fd, 'id')
  const tipo = texto(fd, 'tipo')
  if (!['equivalente', 'contiene', 'parcial', 'sin_par'].includes(tipo)) return { error: 'Tipo de cruce no válido.' }
  const { error } = await supabase
    .schema('sgc')
    .from('proceso_cruce')
    .update({ tipo, confirmado: fd.get('confirmado') === 'si', nota: nulo(fd, 'nota') })
    .eq('id', id)
  if (error) return { error: mensajeDe(error) }
  revalidatePath(`${RUTA}/cruce`)
  return { ok: 'Guardado.' }
}
