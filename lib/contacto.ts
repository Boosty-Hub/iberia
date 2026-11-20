import type { createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>

export type Contacto = { cedula: string | null; telefono: string | null; email: string | null }

/**
 * Las puertas a lo que la API ya no sirve por columna. Primero, cédula, teléfono y
 * correo del padrón, con la sesión de quien pregunta.
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

// -----------------------------------------------------------------------------
// Las otras columnas cerradas (migración `privacidad_programa`): mismo patrón.
// -----------------------------------------------------------------------------

/**
 * Las columnas de `entrevistas` que la API sirve a una sesión. `notas_consultor`,
 * `fireflies_url` y `busqueda` (que indexa las notas) no salen: un `select('*')`
 * lo rechaza la base. Lo «solo Boosty» se pide con `internasDeEntrevistas()`.
 */
export const COLUMNAS_ENTREVISTA =
  'id, codigo, entrevistado_nombre, entrevistado_cargo, area_id, sede, fecha_entrevista, duracion_minutos, entrevistador, estado, resumen, fireflies_meta, created_by, created_at, updated_at, tipo, titulo, entrevistado_id' as const

export type Interna = { notas_consultor: string | null; fireflies_url: string | null }

/** Notas del consultor y enlace de Fireflies: solo responde al equipo editor (a los demás, vacío). */
export async function internasDeEntrevistas(supabase: Cliente, ids: readonly string[]): Promise<Map<string, Interna>> {
  const mapa = new Map<string, Interna>()
  if (!ids.length) return mapa
  const { data, error } = await supabase.rpc('entrevistas_internas', { p_ids: [...new Set(ids)] })
  if (error) throw new Error(`No se pudo leer lo interno de la sesión: ${error.message}`)
  for (const f of data ?? []) mapa.set(f.id, { notas_consultor: f.notas_consultor ?? null, fireflies_url: f.fireflies_url ?? null })
  return mapa
}

/** Los hallazgos de una sesión por estado: el validado a quien abre la sesión, el resto solo al equipo. */
export async function hallazgosPorEstado(supabase: Cliente, entrevistaId: string): Promise<Map<string, number>> {
  const { data } = await supabase.rpc('hallazgos_por_estado', { p_entrevista: entrevistaId })
  return new Map((data ?? []).map((f) => [f.estado, f.n]))
}

/** Las columnas de `certificados` que la API sirve: todas menos la cédula. */
export const COLUMNAS_CERTIFICADO = 'id, matricula_id, codigo, nombre_completo, ficha, cargo, area_nombre, emitido_en, entregado_en, created_at' as const

/**
 * La cédula congelada en cada certificado: a su dueño, al equipo editor y a quien
 * además de `modulo:certificados` · ver tiene `modulo:empleados` · editar. A los
 * demás no les llega, y la hoja sale con el número de ficha (`identificacion()`).
 */
export async function cedulasDeCertificados(supabase: Cliente, ids: readonly string[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>()
  const unicos = [...new Set(ids)]
  for (let i = 0; i < unicos.length; i += 500) {
    const { data, error } = await supabase.rpc('cedulas_certificados', { p_ids: unicos.slice(i, i + 500) })
    if (error) throw new Error(`No se pudo leer la cédula del certificado: ${error.message}`)
    for (const f of data ?? []) mapa.set(f.id, f.cedula ?? null)
  }
  return mapa
}

/** Un certificado con su cédula, si a quien mira le toca verla. */
export async function conCedula<T extends { id: string }>(supabase: Cliente, fila: T | null): Promise<(T & { cedula: string | null }) | null> {
  if (!fila) return null
  const cedulas = await cedulasDeCertificados(supabase, [fila.id])
  return { ...fila, cedula: cedulas.get(fila.id) ?? null }
}
