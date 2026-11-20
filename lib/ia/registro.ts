import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * El registro de las llamadas al modelo (R6 · M2, 20-nov-2026).
 *
 * `ia.registrar_llamada` y `ia.explicar_propuestas` las llamaba cualquier
 * sesión: se podía inventar un gasto de US$ 500 (y apagar la IA de todos por
 * tope) o escribir un evento «de la IA» en la línea de tiempo de un objeto.
 * Ahora solo las llama el servidor, con la clave de servicio, y **solo para
 * escribir este registro**: quién pidió sale de la sesión verificada
 * (`requerirSesion`), y ninguna lectura de datos del usuario pasa por aquí
 * (las lecturas siguen con su sesión y su RLS).
 *
 * Los topes son atómicos: antes de llamar al modelo se **reserva** (la base
 * cuenta y reserva bajo un mismo candado: las preguntas de hoy por persona y el
 * gasto del día más lo reservado en curso), y al registrar se libera.
 */

export type Medida = { tokensEntrada: number; tokensSalida: number; costoUsd: number; latenciaMs: number; modelo: string | null }

/** Lo que se reserva por llamada (el peor caso aproximado de cada una). */
export const RESERVA_USD = { pregunta: 0.1, lote: 0.25 } as const

function mensaje(e: { message?: string } | null | undefined): string {
  return (e?.message ?? 'No se pudo reservar la llamada.').replace(/^.*?ERROR:\s*/, '')
}

export async function reservarLlamada(
  perfil: string,
  capacidad: string,
  opciones: { topePersona?: number; reservaUsd: number }
): Promise<{ reserva: string } | { error: string }> {
  const db = createAdminClient()
  const { data, error } = await db.schema('ia').rpc('reservar_llamada_servicio', {
    p_perfil: perfil,
    p_capacidad: capacidad,
    p_tope_persona: opciones.topePersona ?? undefined,
    p_reserva_usd: opciones.reservaUsd,
  })
  if (error || !data) return { error: mensaje(error) }
  return { reserva: data as string }
}

export async function registrarLlamada(
  perfil: string,
  reserva: string,
  llamada: {
    capacidad: string
    accion: 'respondio' | 'explico' | 'bloqueo' | 'error'
    resumen: string
    evidencia: unknown[]
    medida: Partial<Medida> | null | undefined
    objetoTipo?: string
    objetoId?: string
  }
): Promise<{ error?: string }> {
  const db = createAdminClient()
  const m = llamada.medida ?? {}
  const { error } = await db.schema('ia').rpc('registrar_llamada_servicio', {
    p_perfil: perfil,
    p_reserva: reserva,
    p_capacidad: llamada.capacidad,
    p_accion: llamada.accion,
    p_resumen: llamada.resumen,
    p_evidencia: llamada.evidencia as never,
    p_tokens_entrada: m.tokensEntrada ?? 0,
    p_tokens_salida: m.tokensSalida ?? 0,
    p_costo_usd: m.costoUsd ?? 0,
    p_latencia_ms: m.latenciaMs ?? 0,
    p_modelo: m.modelo ?? 'ninguno',
    ...(llamada.objetoTipo && llamada.objetoId ? { p_objeto_tipo: llamada.objetoTipo, p_objeto_id: llamada.objetoId } : {}),
  })
  return error ? { error: mensaje(error) } : {}
}

/** Una reserva que no llegó al modelo (no había con qué preguntarle): no cuenta. */
export async function liberarReserva(perfil: string, reserva: string): Promise<void> {
  const db = createAdminClient()
  await db.schema('ia').rpc('liberar_reserva_servicio', { p_perfil: perfil, p_reserva: reserva })
}

export async function explicarPropuestas(perfil: string, items: { id: string; texto: string }[]): Promise<number> {
  const db = createAdminClient()
  const { data } = await db.schema('ia').rpc('explicar_propuestas_servicio', { p_perfil: perfil, p_items: items })
  return (data as number | null) ?? 0
}
