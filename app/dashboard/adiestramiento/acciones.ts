'use server'

import { revalidatePath } from 'next/cache'
import { CURSO } from '@/lib/adiestramiento'
import { requerirEditor } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * Abre o cierra el curso, y enciende o apaga el asistente libre.
 *
 * El asistente libre viene apagado de fábrica: si se enciende, aparece el botón
 * de «pregúntale lo que sea» y la última lección se despide distinto —Ajito se
 * queda en vez de despedirse—. No es un detalle de configuración: cambia lo que
 * el curso promete.
 */
export async function guardarConfiguracion(datos: FormData) {
  await requerirEditor()
  const supabase = await createClient()

  await supabase
    .from('cursos')
    .update({
      abierto: datos.get('abierto') === 'si',
      asistente_libre_activo: datos.get('asistente_libre') === 'si',
      updated_at: new Date().toISOString(),
    })
    .eq('clave', CURSO)

  revalidatePath('/dashboard/adiestramiento')
  revalidatePath('/canal')
}

/**
 * Le abre matrícula a todo el padrón activo de planta y administrativo que
 * todavía no la tenga. Es idempotente: se corre otra vez cada vez que Capital
 * Humano complete el padrón, y solo agrega a los nuevos.
 *
 * Va con el cliente administrativo porque `matricular_pendientes` tiene el
 * EXECUTE revocado a `authenticated` — matricular a doscientas personas no es
 * una operación que deba poder disparar una sesión de navegador comprometida.
 */
export async function matricularPendientes() {
  await requerirEditor()

  const admin = createAdminClient()
  await admin.rpc('matricular_pendientes', { curso_clave: CURSO })

  revalidatePath('/dashboard/adiestramiento')
}
