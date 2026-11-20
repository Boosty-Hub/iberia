'use server'

import { revalidatePath } from 'next/cache'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { campo, mensajeError, type EstadoAccion } from '@/components/sistema/flujo/formato'

/**
 * Decide un paso: aprobar, rechazar o devolver. **Quién puede lo dice la base**
 * (`flujo.puede_decidir`, dentro de `flujo.decidir`): el aprobador resuelto, o
 * quien administra aprobaciones si la plaza no tiene cuenta, y nunca quien pidió.
 * Aquí solo se exige sesión y se valida el motivo antes de ir a la base.
 *
 * En el paso de Desarrollo Organizacional de una requisición («completar») se
 * anotan primero el candidato y la fecha de ingreso.
 */
export async function decidirPaso(_anterior: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirSesion()
  const supabase = await createClient()

  const paso = campo(fd, 'paso')
  const decision = campo(fd, 'decision')
  const comentario = campo(fd, 'comentario')
  if (!paso) return { error: 'Falta el paso.' }
  if (!['aprobado', 'rechazado', 'devuelto'].includes(decision)) return { error: 'Elige aprobar, devolver o rechazar.' }
  if (decision !== 'aprobado' && comentario.length < 3) {
    return { error: 'Para devolver o rechazar, escribe el motivo: quien lo pidió lo va a leer.' }
  }

  const requisicion = campo(fd, 'requisicion')
  if (requisicion && decision === 'aprobado' && fd.has('candidato')) {
    const candidato = campo(fd, 'candidato')
    const fechaIngreso = campo(fd, 'fecha_ingreso')
    if (candidato.length < 3) return { error: 'Escribe el nombre del candidato.' }
    if (!fechaIngreso) return { error: 'Falta la fecha de ingreso.' }
    const { error } = await supabase
      .schema('org')
      .rpc('registrar_candidato', { p_req: requisicion, p_candidato: candidato, p_fecha: fechaIngreso })
    if (error) return { error: mensajeError(error) }
  }

  const { data, error } = await supabase
    .schema('flujo')
    .rpc('decidir', { p_paso: paso, p_decision: decision, p_comentario: comentario || undefined })
  if (error) return { error: mensajeError(error) }

  revalidatePath('/sistema/bandeja')
  revalidatePath('/sistema')
  revalidatePath('/sistema/nucleo/organizacion/requisiciones', 'layout')
  revalidatePath('/sistema/nucleo/escenarios', 'layout')
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  const texto =
    decision === 'aprobado'
      ? data === 'aprobada'
        ? 'Aprobado. Era el último paso: la solicitud quedó aprobada.'
        : 'Aprobado. Pasó al siguiente paso.'
      : decision === 'devuelto'
        ? 'Devuelto a quien lo pidió, con tu comentario.'
        : 'Rechazado. Quien lo pidió verá tu motivo.'
  return { ok: texto }
}

/**
 * Aprobar varias de una vez, **solo del mismo tipo** (Anexo E §8): se vuelve a
 * leer la bandeja de quien llama y se rechaza lo que no esté en ella, lo que
 * mezcle tipos o lo que pida datos (el paso «completar» de una requisición).
 * Cada paso pasa por `flujo.decidir`, que vuelve a preguntar si te toca.
 */
export async function aprobarVarios(pasos: string[], comentario: string): Promise<EstadoAccion & { aprobados?: number }> {
  await requerirSesion()
  const ids = [...new Set(pasos)].filter((p) => /^[0-9a-f-]{36}$/i.test(p))
  if (!ids.length) return { error: 'Elige al menos una.' }
  if (ids.length > 50) return { error: 'De a 50 como máximo.' }
  const supabase = await createClient()
  const { data: bandeja, error: e1 } = await supabase.schema('flujo').rpc('bandeja')
  if (e1) return { error: mensajeError(e1) }
  const mias = new Map((bandeja ?? []).map((b) => [b.paso_id, b]))
  const elegidos = ids.map((id) => mias.get(id))
  if (elegidos.some((b) => !b)) return { error: 'Alguna ya no te toca (la decidió otra persona o cambió de paso). Actualiza la bandeja.' }
  const tipos = new Set(elegidos.map((b) => b!.tipo_objeto))
  if (tipos.size > 1) return { error: 'En lote solo se aprueban juntas las del mismo tipo.' }
  if (elegidos.some((b) => b!.accion === 'completar')) return { error: 'El paso que registra candidato y fecha se decide uno por uno.' }

  let aprobados = 0
  const fallos: string[] = []
  for (const b of elegidos) {
    const { error } = await supabase.schema('flujo').rpc('decidir', { p_paso: b!.paso_id, p_decision: 'aprobado', p_comentario: comentario.trim() || undefined })
    if (error) fallos.push(`${b!.titulo}: ${mensajeError(error)}`)
    else aprobados++
  }
  revalidatePath('/sistema/bandeja')
  revalidatePath('/sistema')
  revalidatePath('/sistema/nucleo/organizacion/requisiciones', 'layout')
  revalidatePath('/sistema/nucleo/escenarios', 'layout')
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  if (fallos.length) return { aprobados, error: `Se aprobaron ${aprobados}; no se pudo con ${fallos.length}: ${fallos.join(' · ')}` }
  return { aprobados, ok: aprobados === 1 ? 'Aprobada 1.' : `Aprobadas ${aprobados}.` }
}
