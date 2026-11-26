'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ESFUERZOS, type Esfuerzo, type Motor } from '@/lib/asistente/tipos'

type R = { ok: true } | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function numeroOk(n: unknown, max: number): number | null {
  if (n === null || n === undefined || n === '') return null
  const v = Number(n)
  return Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 100) / 100 : NaN
}

/** Motor, interruptor, topes de la empresa y valores por defecto. La RLS vuelve a pedir la casilla. */
export async function guardarConfig(entrada: {
  motor?: Motor
  encendido?: boolean
  tope_mensual_empresa_usd?: number
  modelo_anthropic?: string
  modelo_openai?: string
  esfuerzo_defecto?: Esfuerzo
  tope_diario_usd?: number
  tope_mensual_usd?: number
  cuota_mb?: number
  esfuerzo_max?: Esfuerzo
  instrucciones_empresa?: string
  programador_pausado?: boolean
  max_tareas?: number
  frecuencia_min_min?: number
  tope_investigacion_usd?: number
  correo_remitente?: string | null
  correo_nombre?: string
  whatsapp_plantilla?: string | null
}): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente-admin', 'editar')
  const cambios: Record<string, unknown> = { actualizado_por: sesion.userId, actualizado_en: new Date().toISOString() }
  if (entrada.motor !== undefined) {
    if (!['anthropic', 'openai'].includes(entrada.motor)) return { ok: false, error: 'El motor local llega en la fase 6.' }
    cambios.motor = entrada.motor
  }
  if (entrada.encendido !== undefined) cambios.encendido = !!entrada.encendido
  for (const k of ['tope_mensual_empresa_usd', 'tope_diario_usd', 'tope_mensual_usd'] as const) {
    if (entrada[k] !== undefined) {
      const v = numeroOk(entrada[k], 100000)
      if (v === null || Number.isNaN(v)) return { ok: false, error: 'Revisa los montos: números de 0 en adelante.' }
      cambios[k] = v
    }
  }
  if (entrada.cuota_mb !== undefined) {
    const v = numeroOk(entrada.cuota_mb, 1_000_000)
    if (v === null || Number.isNaN(v)) return { ok: false, error: 'Revisa la cuota.' }
    cambios.cuota_mb = Math.round(v)
  }
  for (const k of ['esfuerzo_defecto', 'esfuerzo_max'] as const) {
    if (entrada[k] !== undefined) {
      if (!ESFUERZOS.includes(entrada[k]!)) return { ok: false, error: 'Esfuerzo no válido.' }
      cambios[k] = entrada[k]
    }
  }
  if (entrada.modelo_anthropic !== undefined) cambios.modelo_anthropic = entrada.modelo_anthropic
  if (entrada.modelo_openai !== undefined) cambios.modelo_openai = entrada.modelo_openai
  if (entrada.programador_pausado !== undefined) cambios.programador_pausado = !!entrada.programador_pausado
  if (entrada.max_tareas !== undefined) {
    const v = numeroOk(entrada.max_tareas, 100)
    if (v === null || Number.isNaN(v)) return { ok: false, error: 'El máximo de tareas va de 0 a 100.' }
    cambios.max_tareas = Math.round(v)
  }
  if (entrada.frecuencia_min_min !== undefined) {
    const v = Math.round(Number(entrada.frecuencia_min_min))
    if (!Number.isFinite(v) || v < 60 || v > 10080) return { ok: false, error: 'La frecuencia mínima va de 1 hora a 1 semana.' }
    cambios.frecuencia_min_min = v
  }
  if (entrada.tope_investigacion_usd !== undefined) {
    const v = numeroOk(entrada.tope_investigacion_usd, 100)
    if (v === null || Number.isNaN(v)) return { ok: false, error: 'El tope de la investigación va de 0 a 100 US$.' }
    cambios.tope_investigacion_usd = v
  }
  if (entrada.correo_remitente !== undefined) {
    const v = entrada.correo_remitente?.trim() || null
    if (v && !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(v)) return { ok: false, error: 'El remitente tiene que ser una dirección de correo.' }
    cambios.correo_remitente = v
  }
  if (entrada.correo_nombre !== undefined) cambios.correo_nombre = entrada.correo_nombre.trim().slice(0, 80) || 'Asistente de IA · Iberia'
  if (entrada.whatsapp_plantilla !== undefined) {
    const v = entrada.whatsapp_plantilla?.trim() || null
    if (v && !/^[a-z0-9_]{1,512}$/.test(v)) return { ok: false, error: 'La plantilla de WhatsApp va en minúsculas, números y guion bajo.' }
    cambios.whatsapp_plantilla = v
  }
  if (entrada.instrucciones_empresa !== undefined) {
    if (entrada.instrucciones_empresa.length > 20000) return { ok: false, error: 'Las instrucciones pasan de 20.000 caracteres.' }
    cambios.instrucciones_empresa = entrada.instrucciones_empresa
  }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').from('config').update(cambios as never).eq('id', true).select('id')
  revalidatePath('/sistema/administracion/asistente', 'layout')
  if (error || !data?.length) return { ok: false, error: 'No se pudo guardar (¿tienes la casilla para editar?).' }
  return { ok: true }
}

export async function encenderModelo(id: string, encendido: boolean): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').from('modelo').update({ encendido }).eq('id', id).select('id')
  revalidatePath('/sistema/administracion/asistente/motor')
  return error || !data?.length ? { ok: false, error: 'No se pudo cambiar el modelo.' } : { ok: true }
}

type CamposPolitica = {
  modelos: string[] | null
  esfuerzo_max: Esfuerzo | null
  tope_diario_usd: number | null
  tope_mensual_usd: number | null
  cuota_mb: number | null
  puede_programar: boolean | null
  max_tareas: number | null
}

function limpiar(p: CamposPolitica): CamposPolitica | string {
  const diario = numeroOk(p.tope_diario_usd, 100000)
  const mensual = numeroOk(p.tope_mensual_usd, 100000)
  const cuota = numeroOk(p.cuota_mb, 1_000_000)
  const tareas = numeroOk(p.max_tareas, 100)
  if ([diario, mensual, cuota, tareas].some((v) => Number.isNaN(v))) return 'Revisa los números.'
  if (p.esfuerzo_max && !ESFUERZOS.includes(p.esfuerzo_max)) return 'Esfuerzo no válido.'
  return {
    modelos: p.modelos && p.modelos.length ? p.modelos.slice(0, 20) : null,
    esfuerzo_max: p.esfuerzo_max || null,
    tope_diario_usd: diario,
    tope_mensual_usd: mensual,
    cuota_mb: cuota === null ? null : Math.round(cuota),
    puede_programar: typeof p.puede_programar === 'boolean' ? p.puede_programar : null,
    max_tareas: tareas === null ? null : Math.round(tareas),
  }
}

/** La política de un rol. Un campo vacío hereda de la configuración general. */
export async function guardarPoliticaRol(rolId: string, p: CamposPolitica): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente-admin', 'editar')
  if (!UUID.test(rolId)) return { ok: false, error: 'Rol no válido.' }
  const v = limpiar(p)
  if (typeof v === 'string') return { ok: false, error: v }
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').from('politica_rol').upsert({ rol_id: rolId, ...v, actualizado_por: sesion.userId, actualizado_en: new Date().toISOString() })
  revalidatePath('/sistema/administracion/asistente/usuarios')
  return error ? { ok: false, error: 'No se pudo guardar la política del rol.' } : { ok: true }
}

/** La excepción de una persona: habilitar o quitar el asistente, y sus topes y modelos. */
export async function guardarPoliticaUsuario(perfilId: string, p: CamposPolitica & { habilitado: boolean | null; nota?: string }): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente-admin', 'editar')
  if (!UUID.test(perfilId)) return { ok: false, error: 'Persona no válida.' }
  const v = limpiar(p)
  if (typeof v === 'string') return { ok: false, error: v }
  const supabase = await createClient()
  const { error } = await supabase
    .schema('asistente')
    .from('politica_usuario')
    .upsert({ perfil_id: perfilId, habilitado: p.habilitado, nota: p.nota?.trim().slice(0, 500) || null, ...v, actualizado_por: sesion.userId, actualizado_en: new Date().toISOString() })
  revalidatePath('/sistema/administracion/asistente/usuarios')
  return error ? { ok: false, error: 'No se pudo guardar la excepción.' } : { ok: true }
}

export async function quitarPoliticaUsuario(perfilId: string): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  if (!UUID.test(perfilId)) return { ok: false, error: 'Persona no válida.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').from('politica_usuario').delete().eq('perfil_id', perfilId)
  revalidatePath('/sistema/administracion/asistente/usuarios')
  return error ? { ok: false, error: 'No se pudo quitar la excepción.' } : { ok: true }
}
