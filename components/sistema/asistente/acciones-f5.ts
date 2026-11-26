'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { lanzarCorrida } from '@/lib/asistente/programador'
import { catalogoFuentes } from '@/lib/asistente/fuentes'
import type { CanalTarea, Frecuencia } from '@/lib/asistente/tipos'

type R = { ok: true; id?: string } | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const limpio = (m?: string) => (m ?? '').replace(/^.*?ERROR:\s*/, '').replace(/\s*\(SQLSTATE.*$/, '')

export type EntradaTarea = Frecuencia & {
  id?: string
  nombre: string
  instruccion: string
  proyectoId: string | null
  modelo: string | null
  canales: CanalTarea[]
  destinatarios: string[]
  enMiDia: boolean
  origenChat?: string | null
  origenMensaje?: string | null
}

function fila(e: EntradaTarea) {
  const canales = [...new Set(['plataforma', ...e.canales.filter((c) => c === 'correo' || c === 'whatsapp')])]
  return {
    nombre: e.nombre.trim().slice(0, 120),
    instruccion: e.instruccion.trim().slice(0, 8000),
    proyecto_id: e.proyectoId && UUID.test(e.proyectoId) ? e.proyectoId : null,
    modelo: e.modelo || null,
    frecuencia: e.frecuencia,
    hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(e.hora) ? e.hora : '08:00',
    dias: e.frecuencia === 'semanal' ? [...new Set(e.dias.filter((d) => d >= 1 && d <= 7))] : [],
    dia_mes: e.frecuencia === 'mensual' ? e.dia_mes : null,
    cada_horas: e.frecuencia === 'horas' ? e.cada_horas : null,
    canales,
    destinatarios: e.destinatarios.filter((d) => UUID.test(d)).slice(0, 20),
    en_mi_dia: e.enMiDia,
  }
}

function errorLegible(m?: string): string {
  const t = limpio(m)
  if (/tarea_semanal/.test(t)) return 'Una tarea semanal necesita al menos un día.'
  if (/tarea_mensual/.test(t)) return 'Una tarea mensual necesita el día del mes.'
  if (/tarea_horas/.test(t)) return 'Falta cada cuántas horas.'
  if (/nombre/.test(t) && /check/.test(t)) return 'El nombre va de 2 a 120 caracteres.'
  if (/instruccion/.test(t) && /check/.test(t)) return 'La instrucción es muy corta.'
  return t || 'No se pudo guardar la tarea.'
}

/** Crea o cambia una tarea programada. La base valida la política (puede programar, máximo, frecuencia mínima). */
export async function guardarTarea(e: EntradaTarea): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (e.id && !UUID.test(e.id)) return { ok: false, error: 'No válido.' }
  if (!['horas', 'diaria', 'semanal', 'mensual'].includes(e.frecuencia)) return { ok: false, error: 'Frecuencia no válida.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente').from('tarea')
  if (e.id) {
    const { data, error } = await db.update(fila(e)).eq('id', e.id).select('id')
    revalidatePath('/sistema/asistente/tareas')
    if (error) return { ok: false, error: errorLegible(error.message) }
    return data?.length ? { ok: true, id: e.id } : { ok: false, error: 'Esa tarea no es tuya.' }
  }
  const id = crypto.randomUUID()
  const { error } = await db.insert({
    id,
    dueno: sesion.userId,
    ...fila(e),
    origen_chat: e.origenChat && UUID.test(e.origenChat) ? e.origenChat : null,
    origen_mensaje: e.origenMensaje && UUID.test(e.origenMensaje) ? e.origenMensaje : null,
  })
  revalidatePath('/sistema/asistente/tareas')
  return error ? { ok: false, error: errorLegible(error.message) } : { ok: true, id }
}

export async function pausarTarea(id: string, pausar: boolean): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').from('tarea').update({ estado: pausar ? 'pausada' : 'activa', pausada_motivo: pausar ? 'La pausaste tú.' : null }).eq('id', id).select('id')
  revalidatePath('/sistema/asistente/tareas')
  if (error) return { ok: false, error: errorLegible(error.message) }
  return data?.length ? { ok: true } : { ok: false, error: 'Esa tarea no es tuya.' }
}

export async function borrarTarea(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('tarea').delete().eq('id', id).select('id')
  revalidatePath('/sistema/asistente/tareas')
  return data?.length ? { ok: true } : { ok: false, error: 'No se pudo borrar.' }
}

/** «Correr ahora»: la base revisa que sea tuya y que no esté corriendo; el servidor la lanza. */
export async function correrAhora(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').rpc('correr_ahora', { p_tarea: id })
  if (error || !data) return { ok: false, error: errorLegible(error?.message) }
  await lanzarCorrida(data as string)
  revalidatePath('/sistema/asistente/tareas')
  return { ok: true, id: data as string }
}

/**
 * «Mantener al día» (tablero vivo): una tarea que vuelve a hacer el artefacto
 * con los datos del día, con las mismas fuentes y los permisos de ese día.
 */
export async function mantenerAlDia(htmlId: string, f: Frecuencia & { enMiDia: boolean }): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(htmlId)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const { data: h } = await db.from('html').select('grupo, titulo, tipo, mensaje_id, chat_id').eq('id', htmlId).eq('dueno', sesion.userId).maybeSingle()
  if (!h) return { ok: false, error: 'Solo se mantiene al día un artefacto tuyo.' }
  const { data: ya } = await db.from('tarea').select('id').eq('html_grupo', h.grupo).maybeSingle()
  if (ya) return { ok: false, error: 'Este artefacto ya se mantiene al día. Cámbialo en Tareas.' }
  // El pedido original y las fuentes que usó, para que la tarea rehaga lo mismo.
  let pedido = ''
  let fuentes: string[] = []
  if (h.mensaje_id) {
    const { data: m } = await db.from('mensaje').select('turno_id').eq('id', h.mensaje_id).maybeSingle()
    if (m?.turno_id) {
      const { data: u } = await db.from('mensaje').select('texto').eq('turno_id', m.turno_id).eq('rol', 'usuario').maybeSingle()
      pedido = u?.texto ?? ''
    }
  }
  if (h.chat_id) {
    const { data: c } = await db.rpc('fuentes_del_chat', { p_chat: h.chat_id })
    const titulos = new Map(catalogoFuentes().map((x) => [x.clave, x.titulo]))
    fuentes = ((c ?? []) as { fuente: string }[]).map((x) => titulos.get(x.fuente) ?? x.fuente)
  }
  const instruccion =
    `Actualiza el artefacto «${h.titulo}» (id ${h.grupo}) con los datos de hoy.` +
    (fuentes.length ? ` Vuelve a consultar las mismas fuentes (${fuentes.join(', ')}).` : ' Vuelve a consultar las mismas fuentes que usó.') +
    ' Mantén el diseño y la estructura, publica la versión nueva con la herramienta artefacto (el mismo id) y pon visible «Datos al» con la fecha y la hora de Caracas. En el chat, una línea con lo que cambió.' +
    (pedido ? `\n\nEl pedido con que se hizo: «${pedido.slice(0, 3000)}»` : '')
  const id = crypto.randomUUID()
  const { error } = await db.from('tarea').insert({
    id,
    dueno: sesion.userId,
    tipo: 'tablero',
    html_grupo: h.grupo,
    nombre: h.titulo.slice(0, 120),
    instruccion: instruccion.slice(0, 8000),
    frecuencia: f.frecuencia,
    hora: f.hora,
    dias: f.frecuencia === 'semanal' ? f.dias : [],
    dia_mes: f.frecuencia === 'mensual' ? f.dia_mes : null,
    cada_horas: f.frecuencia === 'horas' ? f.cada_horas : null,
    canales: ['plataforma'],
    en_mi_dia: f.enMiDia,
    origen_chat: h.chat_id,
  })
  revalidatePath('/sistema/asistente/tareas')
  revalidatePath('/sistema')
  return error ? { ok: false, error: errorLegible(error.message) } : { ok: true, id }
}
