import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { configMicrosoft } from '@/lib/asistente/microsoft'
import { eventosMicrosoft, tareasMicrosoft, type EventoMicrosoft, type TareaMicrosoft } from '@/lib/asistente/microsoft-agenda'
import { leerTareas } from '@/components/sistema/colaboracion/datos'
import type { Tarea } from '@/lib/plataforma/colaboracion'
import type { Sesion } from '@/lib/auth'

/**
 * La agenda de la persona (27-nov-2026): sus tareas de la plataforma con fecha y, si conectó Microsoft 365 y su rol
 * tiene el calendario en el alcance del asistente (`m365:calendario`), sus reuniones de Outlook y sus tareas de To Do.
 * Lo de Microsoft se lee en vivo (`lib/asistente/microsoft-agenda.ts`).
 */

export type EstadoMicrosoft = 'sin-configurar' | 'sin-alcance' | 'sin-conectar' | 'ok' | 'error'

export type Agenda = {
  microsoft: { estado: EstadoMicrosoft; error?: string }
  eventos: EventoMicrosoft[]
  todo: { estado: EstadoMicrosoft | 'sin-permiso'; error?: string; tareas: TareaMicrosoft[] }
  tareas: Tarea[]
}

/** Hoy en Caracas, `AAAA-MM-DD`. */
export function hoyCaracas(): string {
  return new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** El lunes de la semana de esa fecha. */
export function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia)
}

/** ¿La persona puede ver su agenda de Microsoft aquí? (Sin llamar a Microsoft.) */
async function puertaMicrosoft(sesion: Sesion): Promise<EstadoMicrosoft> {
  const supabase = await createClient()
  const [cfg, { data: alcance }, { data: conexion }] = await Promise.all([
    configMicrosoft(),
    supabase.schema('asistente').rpc('mi_alcance'),
    supabase.schema('asistente').from('conexion_microsoft').select('perfil_id').eq('perfil_id', sesion.userId).maybeSingle(),
  ])
  if (!cfg) return 'sin-configurar'
  if (!((alcance ?? []) as { fuente: string }[]).some((a) => a.fuente === 'm365:calendario')) return 'sin-alcance'
  return conexion ? 'ok' : 'sin-conectar'
}

/** La agenda entre `desde` y `hasta` (sin incluir). `conTodo`: también las tareas de To Do. */
export async function leerAgenda(sesion: Sesion, desde: string, hasta: string, { conTodo = true, conEventos = true } = {}): Promise<Agenda> {
  const [puerta, tareas] = await Promise.all([puertaMicrosoft(sesion), leerTareas({ abiertas: true })])
  const agenda: Agenda = { microsoft: { estado: puerta }, eventos: [], todo: { estado: puerta, tareas: [] }, tareas: tareas.filter((t) => t.mia) }
  if (puerta !== 'ok') return agenda
  const [ev, td] = await Promise.all([conEventos ? eventosMicrosoft(sesion.userId, desde, hasta) : null, conTodo ? tareasMicrosoft(sesion.userId) : null])
  if (ev?.ok) agenda.eventos = ev.eventos
  else if (ev) agenda.microsoft = { estado: ev.sinConexion ? 'sin-conectar' : 'error', error: ev.error }
  if (td) {
    if (td.ok) agenda.todo = { estado: 'ok', tareas: td.tareas }
    else agenda.todo = { estado: td.sinPermiso ? 'sin-permiso' : td.sinConexion ? 'sin-conectar' : 'error', error: td.error, tareas: [] }
  }
  return agenda
}
