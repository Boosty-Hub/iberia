'use server'

import { obtenerSesion, puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoModelos, miPolitica } from '@/lib/asistente/servidor'
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
    }

/** Lo que necesita el asistente en el panel lateral, leído al abrirlo (no en cada página). */
export async function datosPanelAsistente(): Promise<DatosPanel> {
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
  return {
    ok: true,
    yo: { id: sesion.userId, nombre: (sesion.perfil.nombre_completo || sesion.email || '').split(' ')[0] },
    politica,
    modelos,
    atajos: (atajos ?? []).map((a) => ({ id: a.id, comando: a.comando, titulo: a.titulo, instruccion: a.instruccion, modelo: a.modelo, esfuerzo: a.esfuerzo, empresa: a.dueno === null })),
    capacidades: (capacidades ?? []) as { capacidad: string; disponible: boolean; motivo: string | null }[],
  }
}
