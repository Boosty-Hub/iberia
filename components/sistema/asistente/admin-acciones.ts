'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ESFUERZOS, type Esfuerzo, type Motor } from '@/lib/asistente/tipos'
import { modelosDelServidor } from '@/lib/asistente/motor/local'

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
  local_url?: string | null
  local_modo?: 'hibrido' | 'adentro'
  ventanas_por_dia?: number
}): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente-admin', 'editar')
  const cambios: Record<string, unknown> = { actualizado_por: sesion.userId, actualizado_en: new Date().toISOString() }
  const supabase = await createClient()
  if (entrada.local_url !== undefined) {
    const v = entrada.local_url?.trim().replace(/\/$/, '') || null
    if (v && !/^https?:\/\/[^\s]+$/.test(v)) return { ok: false, error: 'La dirección del servidor local empieza por http:// o https://.' }
    cambios.local_url = v
  }
  if (entrada.local_modo !== undefined) {
    if (!['hibrido', 'adentro'].includes(entrada.local_modo)) return { ok: false, error: 'Modo no válido.' }
    cambios.local_modo = entrada.local_modo
  }
  if (entrada.motor !== undefined) {
    if (!['anthropic', 'openai', 'local'].includes(entrada.motor)) return { ok: false, error: 'Motor no válido.' }
    if (entrada.motor === 'local') {
      // El motor local se enciende solo con su servidor y al menos un modelo local encendido.
      const { data: cfg } = await supabase.schema('asistente').from('config').select('local_url').eq('id', true).maybeSingle()
      const url = cambios.local_url !== undefined ? cambios.local_url : cfg?.local_url
      const { count } = await supabase.schema('asistente').from('modelo').select('id', { count: 'exact', head: true }).eq('proveedor', 'local').eq('encendido', true)
      if (!url) return { ok: false, error: 'Para usar el motor local falta la dirección de su servidor.' }
      if (!count) return { ok: false, error: 'Para usar el motor local falta al menos un modelo local encendido.' }
    }
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
  if (entrada.ventanas_por_dia !== undefined) {
    const v = Math.round(Number(entrada.ventanas_por_dia))
    if (!(v >= 1 && v <= 5)) return { ok: false, error: 'Las ventanas por día van de 1 a 5.' }
    cambios.ventanas_por_dia = v
  }
  // La investigación profunda tiene que caber en una ventana de 5 h (tope diario / ventanas por día).
  if (entrada.tope_investigacion_usd !== undefined || entrada.ventanas_por_dia !== undefined || entrada.tope_diario_usd !== undefined) {
    const { data: actual } = await supabase.schema('asistente').from('config').select('tope_investigacion_usd, ventanas_por_dia, tope_diario_usd').eq('id', true).maybeSingle()
    const inv = Number(entrada.tope_investigacion_usd ?? actual?.tope_investigacion_usd ?? 0)
    const ventana = Number(entrada.tope_diario_usd ?? actual?.tope_diario_usd ?? 0) / Number(entrada.ventanas_por_dia ?? actual?.ventanas_por_dia ?? 2)
    if (inv > ventana + 0.0001) return { ok: false, error: `El tope de una investigación (US$ ${inv.toFixed(2)}) no cabe en una ventana de 5 h (US$ ${ventana.toFixed(2)}): bájalo, o sube el tope diario o baja las ventanas por día.` }
  }
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
  ventanas_por_dia: number | null
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
    ventanas_por_dia: p.ventanas_por_dia && p.ventanas_por_dia >= 1 && p.ventanas_por_dia <= 5 ? Math.round(p.ventanas_por_dia) : null,
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

// ── Motor local (fase 6) ─────────────────────────────────────────────────────

/** Le pregunta al servidor de modelos qué modelos tiene: si responde, la red y la clave sirven. */
export async function probarMotorLocal(url: string): Promise<{ ok: true; modelos: string[] } | { ok: false; error: string }> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  const v = url.trim().replace(/\/$/, '')
  if (!/^https?:\/\/[^\s]+$/.test(v)) return { ok: false, error: 'La dirección empieza por http:// o https://.' }
  return modelosDelServidor(v, process.env.ASISTENTE_LOCAL_CLAVE?.trim() || null)
}

/** Da de alta un modelo del motor local. El precio es el costo estimado de operar el equipo, para que el tope cuente. */
export async function agregarModeloLocal(m: { id: string; nombre: string; nombreApi: string; precioEntrada: number; precioSalida: number }): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  const id = m.id.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._:-]{1,80}$/.test(id)) return { ok: false, error: 'El id va en minúsculas, sin espacios (por ejemplo local-qwen3-32b).' }
  if (!m.nombre.trim()) return { ok: false, error: 'Falta el nombre.' }
  const pe = numeroOk(m.precioEntrada, 1000)
  const ps = numeroOk(m.precioSalida, 1000)
  if (pe === null || ps === null || Number.isNaN(pe) || Number.isNaN(ps)) return { ok: false, error: 'Revisa los costos (US$ por millón de tokens, 0 si no se cuenta).' }
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').from('modelo').insert({
    id,
    proveedor: 'local',
    nombre: m.nombre.trim().slice(0, 80),
    descripcion: 'Motor local de Iberia.',
    nombre_api: m.nombreApi.trim() || null,
    precio_entrada: pe,
    precio_salida: ps,
    esfuerzos: ['medium'],
    vision: false,
    encendido: true,
    orden: 50,
    verificado_en: new Date().toISOString().slice(0, 10),
  })
  revalidatePath('/sistema/administracion/asistente/motor')
  return error ? { ok: false, error: /duplicate|unique/.test(error.message) ? 'Ya existe un modelo con ese id.' : 'No se pudo agregar el modelo.' } : { ok: true }
}

export async function quitarModeloLocal(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('modelo').delete().eq('id', id).eq('proveedor', 'local').select('id')
  revalidatePath('/sistema/administracion/asistente/motor')
  return data?.length ? { ok: true } : { ok: false, error: 'No se pudo quitar (¿lo usa algún turno?).' }
}

/** Enciende o apaga una capacidad del motor local (por ejemplo, las herramientas, después de probarlas). */
export async function cambiarCapacidadLocal(capacidad: string, disponible: boolean): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('capacidad_motor').update({ disponible }).eq('motor', 'local').eq('capacidad', capacidad).select('capacidad')
  revalidatePath('/sistema/administracion/asistente/motor')
  return data?.length ? { ok: true } : { ok: false, error: 'No se pudo cambiar.' }
}
