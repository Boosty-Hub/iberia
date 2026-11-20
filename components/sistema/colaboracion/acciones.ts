'use server'

import { revalidatePath } from 'next/cache'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { mensajeError } from '@/components/sistema/flujo/formato'
import { leerLinea, leerResumen } from '@/components/sistema/colaboracion/datos'
import { tieneLinea, type DatosLinea, type EstadoTarea, type ResumenNotificaciones } from '@/lib/plataforma/colaboracion'
import { esFecha, esUuid } from '@/lib/plataforma/formato'

/**
 * Las acciones de la colaboración. Solo funciones async ('use server'); los
 * tipos y el vocabulario viven en `lib/plataforma/colaboracion.ts`. Cada una
 * exige sesión aquí y la base vuelve a decidir: comentar va por
 * `nucleo.comentar` (autor = quien llama), las notificaciones se marcan por
 * `nucleo.marcar_leidas` y la RLS de tareas deja solo lo propio.
 */

type Resultado = { ok?: true; error?: string }

/** La línea de tiempo, para refrescarla en el navegador (el panel lateral). */
export async function cargarLinea(tipo: string, id: string): Promise<DatosLinea | null> {
  await requerirSesion()
  return leerLinea(tipo, id)
}

export async function comentar(entrada: { tipo: string; id: string; texto: string; padre?: string | null; menciones?: string[] }): Promise<Resultado> {
  await requerirSesion()
  const texto = (entrada.texto ?? '').trim()
  if (!tieneLinea(entrada.tipo) || !esUuid(entrada.id)) return { error: 'Ese objeto no admite comentarios.' }
  if (!texto) return { error: 'Escribe algo antes de comentar.' }
  if (texto.length > 4000) return { error: 'El comentario pasa de 4.000 caracteres.' }
  const menciones = (entrada.menciones ?? []).filter(esUuid).slice(0, 20)
  const supabase = await createClient()
  const { error } = await supabase.schema('nucleo').rpc('comentar', {
    p_tipo: entrada.tipo,
    p_id: entrada.id,
    p_texto: texto,
    p_padre: entrada.padre && esUuid(entrada.padre) ? entrada.padre : undefined,
    p_menciones: menciones,
  })
  return error ? { error: mensajeError(error) } : { ok: true }
}

/** Corregir el texto de un comentario propio (dentro de 15 minutos; lo exige la base). */
export async function editarComentario(id: string, texto: string): Promise<Resultado> {
  await requerirSesion()
  const limpio = (texto ?? '').trim()
  if (!esUuid(id)) return { error: 'Comentario no válido.' }
  if (!limpio) return { error: 'El comentario no puede quedar vacío.' }
  if (limpio.length > 4000) return { error: 'El comentario pasa de 4.000 caracteres.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('nucleo').from('evento').update({ texto: limpio }).eq('id', id).select('id')
  if (error) return { error: mensajeError(error) }
  return data?.length ? { ok: true } : { error: 'No se pudo corregir: no es tuyo o ya no existe.' }
}

/** Ocultar (o volver a mostrar) un comentario propio, dentro de 15 minutos. */
export async function ocultarComentario(id: string, oculto: boolean): Promise<Resultado> {
  await requerirSesion()
  if (!esUuid(id)) return { error: 'Comentario no válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('nucleo').from('evento').update({ oculto }).eq('id', id).select('id')
  if (error) return { error: mensajeError(error) }
  return data?.length ? { ok: true } : { error: 'No se pudo: no es tuyo o ya no existe.' }
}

export async function seguir(tipo: string, id: string, si: boolean): Promise<Resultado> {
  const sesion = await requerirSesion()
  if (!tieneLinea(tipo) || !esUuid(id)) return { error: 'Ese objeto no se puede seguir.' }
  const supabase = await createClient()
  const tabla = supabase.schema('nucleo').from('seguimiento')
  const { error } = si
    ? await tabla.upsert({ perfil: sesion.userId, objeto_tipo: tipo, objeto_id: id }, { onConflict: 'perfil,objeto_tipo,objeto_id', ignoreDuplicates: true })
    : await tabla.delete().eq('perfil', sesion.userId).eq('objeto_tipo', tipo).eq('objeto_id', id)
  return error ? { error: mensajeError(error) } : { ok: true }
}

export type Mencionable = { id: string; nombre: string; cargo: string | null }

/** A quién se puede mencionar en este objeto: quien puede verlo. */
export async function buscarMencionables(tipo: string, id: string, q: string): Promise<Mencionable[]> {
  await requerirSesion()
  if (!tieneLinea(tipo) || !esUuid(id)) return []
  const supabase = await createClient()
  const { data } = await supabase.schema('nucleo').rpc('mencionables', { p_tipo: tipo, p_id: id, p_q: (q ?? '').slice(0, 60) })
  return (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo }))
}

/** A quién se le puede asignar una tarea: quien entra a la plataforma. */
export async function buscarPersonas(q: string): Promise<Mencionable[]> {
  await requerirSesion()
  const supabase = await createClient()
  const { data } = await supabase.schema('nucleo').rpc('personas', { p_q: (q ?? '').slice(0, 60) })
  return (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo }))
}

// -----------------------------------------------------------------------------
// Notificaciones
// -----------------------------------------------------------------------------

export async function resumenNotificaciones(): Promise<ResumenNotificaciones> {
  await requerirSesion()
  return leerResumen()
}

/** Marca leídas las indicadas, o todas con `null`. */
export async function marcarLeidas(ids: string[] | null): Promise<Resultado> {
  await requerirSesion()
  const lista = ids === null ? null : ids.filter(esUuid)
  if (lista && !lista.length) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase.schema('nucleo').rpc('marcar_leidas', lista ? { p_ids: lista } : {})
  if (error) return { error: mensajeError(error) }
  revalidatePath('/sistema/notificaciones')
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Tareas
// -----------------------------------------------------------------------------

export async function crearTarea(entrada: {
  titulo: string
  asignadaA: string
  vence?: string | null
  detalle?: string | null
  objetoTipo?: string | null
  objetoId?: string | null
}): Promise<Resultado> {
  const sesion = await requerirSesion()
  const titulo = (entrada.titulo ?? '').trim()
  if (titulo.length < 3) return { error: 'Escribe la tarea (al menos 3 caracteres).' }
  if (titulo.length > 200) return { error: 'El título pasa de 200 caracteres: lo demás va en el detalle.' }
  if (!esUuid(entrada.asignadaA)) return { error: 'Elige a quién se la asignas.' }
  if (entrada.vence && !esFecha(entrada.vence)) return { error: 'La fecha de vencimiento no es válida.' }
  const conObjeto = Boolean(entrada.objetoTipo && entrada.objetoId)
  if (conObjeto && (!tieneLinea(entrada.objetoTipo as string) || !esUuid(entrada.objetoId))) return { error: 'Ese objeto no admite tareas.' }
  const supabase = await createClient()
  const { error } = await supabase
    .schema('nucleo')
    .from('tarea')
    .insert({
      id: crypto.randomUUID(),
      titulo,
      detalle: entrada.detalle?.trim() || null,
      asignada_a: entrada.asignadaA,
      creada_por: sesion.userId,
      vence: entrada.vence || null,
      objeto_tipo: conObjeto ? entrada.objetoTipo : null,
      objeto_id: conObjeto ? entrada.objetoId : null,
    })
  if (error) return { error: mensajeError(error) }
  revalidatePath('/sistema/tareas')
  revalidatePath('/sistema/bandeja')
  revalidatePath('/sistema')
  return { ok: true }
}

export async function cambiarTarea(id: string, estado: EstadoTarea): Promise<Resultado> {
  await requerirSesion()
  if (!esUuid(id) || !['abierta', 'hecha', 'cancelada'].includes(estado)) return { error: 'Tarea no válida.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('nucleo').from('tarea').update({ estado }).eq('id', id).select('id')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'No se pudo: la tarea no es tuya o ya no existe.' }
  revalidatePath('/sistema/tareas')
  revalidatePath('/sistema/bandeja')
  revalidatePath('/sistema')
  return { ok: true }
}
