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
