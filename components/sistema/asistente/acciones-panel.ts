'use server'

import { obtenerSesion, puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoModelos, miPolitica } from '@/lib/asistente/servidor'
import { leerChat } from '@/lib/asistente/datos'
import { catalogoFuentes } from '@/lib/asistente/fuentes'
import type { ArchivoVista, MensajeVista, TurnoVista } from '@/lib/asistente/datos'
import type { ModeloCatalogo, Politica } from '@/lib/asistente/tipos'

export type DatosPanel =
  | { ok: false; motivo: string }
  | {
      ok: true
      yo: { id: string; nombre: string }
      politica: Politica | null
      modelos: ModeloCatalogo[]
      atajos: { id: string; comando: string; titulo: string; instruccion: string; modelo: string | null; esfuerzo: string | null; empresa: boolean }[]
      capacidades: { capacidad: string; disponible: boolean; motivo: string | null }[]
      /** El chat que se estaba viendo, cuando la ventana se abre desde él (26-nov-2026): sigue el mismo. */
      abierto: ChatAbierto | null
    }

export type ChatAbierto = {
  id: string
  titulo: string
  mensajes: MensajeVista[]
  archivos: ArchivoVista[]
  turno: TurnoVista | null
  modelo: string | null
  esfuerzo: string | null
  proyecto: { id: string; nombre: string } | null
  compartido: boolean
  esDueno: boolean
  participantes: { perfil_id: string; nombre: string; rol: string }[]
  fuentes: string[]
  tareasProgramadas: string[]
  deTarea: { nombre: string; tipo: 'tarea' | 'tablero' } | null
}

/** Lo que necesita el asistente en el panel lateral, leído al abrirlo (no en cada página). */
export async function datosPanelAsistente(chatId: string | null = null): Promise<DatosPanel> {
  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, motivo: 'Tu sesión venció. Vuelve a entrar.' }
  if (!puede(sesion, 'sistema:asistente')) return { ok: false, motivo: 'No tienes el asistente de IA habilitado. Pídeselo a la administración de la plataforma.' }
  const supabase = await createClient()
  const [politica, modelos, { data: atajos }, { data: capacidades }] = await Promise.all([
    miPolitica(),
    catalogoModelos(),
    supabase.schema('asistente').from('atajo').select('id, comando, titulo, instruccion, modelo, esfuerzo, dueno').order('comando'),
    supabase.schema('asistente').rpc('capacidades', {}),
  ])
  const abierto = chatId && /^[0-9a-f-]{36}$/.test(chatId) ? await chatParaVentana(chatId, sesion.userId) : null
  return {
    ok: true,
    abierto,
    yo: { id: sesion.userId, nombre: (sesion.perfil.nombre_completo || sesion.email || '').split(' ')[0] },
    politica,
    modelos,
    atajos: (atajos ?? []).map((a) => ({ id: a.id, comando: a.comando, titulo: a.titulo, instruccion: a.instruccion, modelo: a.modelo, esfuerzo: a.esfuerzo, empresa: a.dueno === null })),
    capacidades: (capacidades ?? []) as { capacidad: string; disponible: boolean; motivo: string | null }[],
  }
}

/** Lo mismo que lee la página del chat (`PaginaChat`), con la sesión de quien mira: la RLS decide si lo puede ver. */
async function chatParaVentana(chatId: string, yo: string): Promise<ChatAbierto | null> {
  const c = await leerChat(chatId)
  if (!c) return null
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: proyecto }, { data: participantes }, { data: fuentes }, { data: tareas }, { data: deTarea }] = await Promise.all([
    c.chat.proyecto_id ? db.from('proyecto').select('id, nombre').eq('id', c.chat.proyecto_id).maybeSingle() : Promise.resolve({ data: null }),
    db.rpc('participantes', { p_chat: chatId }),
    db.rpc('fuentes_del_chat', { p_chat: chatId }),
    db.from('tarea').select('origen_mensaje').eq('origen_chat', chatId),
    c.chat.tarea_id ? db.from('tarea').select('nombre, tipo').eq('id', c.chat.tarea_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const titulos = new Map(catalogoFuentes().map((f) => [f.clave, f.titulo]))
  return {
    id: chatId,
    titulo: c.chat.titulo,
    mensajes: c.mensajes,
    archivos: c.archivos,
    turno: c.turno,
    modelo: c.chat.modelo,
    esfuerzo: c.chat.esfuerzo,
    proyecto: proyecto ? { id: proyecto.id, nombre: proyecto.nombre } : null,
    compartido: c.chat.compartido,
    esDueno: c.chat.dueno === yo,
    participantes: (participantes ?? []) as { perfil_id: string; nombre: string; rol: string }[],
    fuentes: ((fuentes ?? []) as { fuente: string }[]).map((f) => titulos.get(f.fuente) ?? f.fuente),
    tareasProgramadas: ((tareas ?? []) as { origen_mensaje: string | null }[]).map((x) => x.origen_mensaje).filter((x): x is string => !!x),
    deTarea: deTarea ? { nombre: deTarea.nombre, tipo: deTarea.tipo as 'tarea' | 'tablero' } : c.chat.tarea_id ? { nombre: 'una tarea', tipo: 'tarea' } : null,
  }
}
