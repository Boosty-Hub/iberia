'use server'

import { revalidatePath } from 'next/cache'
import { CURSO } from '@/lib/adiestramiento'
import { esEditor, requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * Las acciones de Formación (NUC-FOR): la configuración del curso, matricular a
 * los que faltan y marcar certificados entregados. Cada una vuelve a pedir su
 * permiso. Solo funciones async.
 */

const RUTA = '/sistema/nucleo/formacion'

/**
 * Abre o cierra el curso, y enciende o apaga el asistente libre. No es un
 * detalle de configuración: encendido, aparece «pregúntale lo que sea» y la
 * lección 8 se despide distinto (Ajito se queda). Cambia lo que el curso promete.
 */
export async function guardarConfiguracion(datos: FormData): Promise<void> {
  await requerirPermiso('modulo:adiestramiento', 'editar')
  const supabase = await createClient()
  await supabase
    .from('cursos')
    .update({
      abierto: datos.get('abierto') === 'si',
      asistente_libre_activo: datos.get('asistente_libre') === 'si',
      updated_at: new Date().toISOString(),
    })
    .eq('clave', CURSO)
  revalidatePath(RUTA, 'layout')
  revalidatePath('/canal')
}

/**
 * Le abre matrícula a todo el padrón activo de planta y administrativo que no la
 * tenga. Idempotente: se corre cada vez que Capital Humano complete el padrón.
 *
 * Con la clave de servicio porque `matricular_pendientes` tiene el EXECUTE
 * revocado a `authenticated`: matricular a doscientas personas no es algo que
 * deba poder disparar una sesión de navegador comprometida.
 */
export async function matricularPendientes(): Promise<void> {
  await requerirPermiso('modulo:adiestramiento', 'editar')
  const admin = createAdminClient()
  await admin.rpc('matricular_pendientes', { curso_clave: CURSO })
  revalidatePath(RUTA, 'layout')
  revalidatePath('/sistema/personas/padron')
}

/**
 * Marca certificados como entregados en mano (el Gerente de Planta los entrega
 * impresos). Lo escribe el equipo: la política de `certificados` solo deja
 * escribir a los editores, y la fecha de entrega queda en la fila.
 */
export async function marcarEntregados(ids: string[]): Promise<{ ok?: string; error?: string }> {
  const sesion = await requerirPermiso('modulo:certificados')
  if (!esEditor(sesion.perfil)) return { error: 'Marcar la entrega es del equipo de Boosty.' }
  const limpios = [...new Set(ids.filter((v) => /^[0-9a-f-]{36}$/i.test(v)))].slice(0, 1000)
  if (!limpios.length) return { error: 'No hay certificados que marcar.' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('certificados')
    .update({ entregado_en: new Date().toISOString() })
    .in('id', limpios)
    .is('entregado_en', null)
    .select('id')
  if (error) return { error: `No se pudo marcar: ${error.message}` }
  revalidatePath(RUTA, 'layout')
  const n = data?.length ?? 0
  return n ? { ok: `${n} certificado${n === 1 ? '' : 's'} marcado${n === 1 ? '' : 's'} como entregado${n === 1 ? '' : 's'} en mano.` } : { ok: 'Ya estaban entregados.' }
}
