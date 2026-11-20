import type { createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>

export type Contacto = { cedula: string | null; telefono: string | null; email: string | null }

/**
 * Cédula, teléfono y correo del padrón, con la sesión de quien pregunta.
 *
 * Desde la migración `seguimiento_privacidad` esas columnas **no salen de
 * `empleados` por la API** (privilegios de columna: ni en `select`, ni
 * embebidas, ni en un filtro). La única puerta es `contacto_empleados()`, que
 * pregunta adentro: a cada quien le da lo suyo; todo, al equipo editor y a
 * `modulo:empleados` · editar; el teléfono, también a `modulo:recordatorios` ·
 * editar. A quien no le toca, la fila no viene (o viene con el campo en null).
 *
 * Va por POST (rpc), así que una lista larga de ids no choca con el largo de la
 * URL; se parte en tandas por el tope de 1.000 filas de Supabase.
 */
export async function contactosDe(supabase: Cliente, ids: readonly (string | null | undefined)[]): Promise<Map<string, Contacto>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  const mapa = new Map<string, Contacto>()
  for (let i = 0; i < unicos.length; i += 500) {
    const { data, error } = await supabase.rpc('contacto_empleados', { p_ids: unicos.slice(i, i + 500) })
    if (error) throw new Error(`No se pudo leer el contacto del padrón: ${error.message}`)
    for (const c of data ?? []) mapa.set(c.empleado_id, { cedula: c.cedula ?? null, telefono: c.telefono ?? null, email: c.email ?? null })
  }
  return mapa
}
