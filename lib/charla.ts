import 'server-only'
import { CURSO } from '@/lib/adiestramiento'
import { obtenerSesion, puede } from '@/lib/auth'
import { empleadoActual } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

/**
 * La conversación libre con Ajito (`/canal/adiestramiento/ajito`).
 *
 * **Quién entra.** La abre el interruptor del curso, `asistente_libre_activo`:
 * encendido, la lección 8 se despide con «yo me quedo aquí contigo» y el botón
 * de «Preguntarle algo a Ajito». Apagado, solo entran los editores de Boosty,
 * para probarla antes de prenderla para todos. En los dos casos hace falta
 * matrícula en el curso: de ahí salen el nombre, el oficio y la voz.
 */

/**
 * Cuántos mensajes al día, por persona.
 *
 * Cada mensaje es una llamada al modelo grande, y a veces un dibujo. Doscientas
 * personas sin tope es una factura sin techo; con cuarenta al día nadie que la use
 * de verdad llega, y quien la use de juguete se frena solo.
 */
export const TOPE_DIARIO = 40

/** El título de una conversación: lo primero que se le dijo, recortado. */
export function tituloDe(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (!limpio) return 'Una foto'
  return limpio.length > 60 ? `${limpio.slice(0, 57).trimEnd()}…` : limpio
}

/** Medianoche de hoy en Venezuela, en ISO: desde ahí se cuenta el tope. */
export function inicioDelDia(): string {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${hoy}T00:00:00-04:00`).toISOString()
}

export async function contextoCharla() {
  const empleado = await empleadoActual()
  if (!empleado) return null
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, abierto, asistente_libre_activo')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso?.abierto) return null

  const sesion = await obtenerSesion()
  const editor = puede(sesion, 'modulo:adiestramiento', 'editar')
  if (!curso.asistente_libre_activo && !editor) return null

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id, familia_oficio, nombre_corto, voz')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)
    .maybeSingle()
  if (!matricula) return null

  return { empleado, supabase, curso, matricula, editor }
}

export type ContextoCharla = NonNullable<Awaited<ReturnType<typeof contextoCharla>>>
