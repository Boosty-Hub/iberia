import 'server-only'
import { mejorFicha } from '@/lib/coincidencia'
import { createAdminClient, type createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>

/**
 * Lo que el padrón tiene que saber para no matricular a la persona equivocada.
 *
 * El 27 de septiembre de 2026 Gabriel matriculó a Martha Fuentes y le acuñó el
 * enlace, y no le sirvió de nada: eligió «Martha Fuentes», una de las fichas que
 * se cargaron a mano en agosto, en vez de «Martha Beatriz Fuentes Quintero»,
 * ficha 4837, la de Capital Humano. El enlace le creó una cuenta nueva a la ficha
 * de muestra, y la cuenta de verdad de Martha —la de su correo— siguió sin ficha.
 *
 * Dos cruces, por el nombre (`mejorFicha`):
 *
 *  · **Duplicada**: una ficha cargada a mano —sin número— que repite a una de
 *    Capital Humano. No se matricula ni se le acuña enlace: se usa la otra.
 *  · **Cuenta que coincide**: una cuenta de Iberia sin ficha cuyo nombre coincide
 *    con una ficha sin cuenta. Se ofrece enlazarlas en vez de acuñarle a esa
 *    ficha una cuenta nueva.
 */
export type Cruces = {
  duplicadas: Map<string, { nombre: string; ficha: string }>
  propuestas: Map<string, { id: string; email: string }>
}

export async function cruzarPadron(supabase: Cliente): Promise<Cruces> {
  const [{ data: fichas }, { data: perfiles }] = await Promise.all([
    supabase.from('empleados').select('id, ficha, nombre_completo, perfil_id').eq('activo', true),
    supabase.from('profiles').select('id, email, nombre_completo, organizacion, activo'),
  ])
  const todas = fichas ?? []

  const deCapitalHumano = todas.filter((f) => f.ficha)
  const duplicadas = new Map<string, { nombre: string; ficha: string }>()
  for (const f of todas.filter((x) => !x.ficha)) {
    const real = mejorFicha(f.nombre_completo, deCapitalHumano)
    if (real?.ficha) duplicadas.set(f.id, { nombre: real.nombre_completo, ficha: real.ficha })
  }

  // Las cuentas de Iberia que no cuelgan de ninguna ficha. Las del enlace
  // (`@iberia.local`) nacen enlazadas, y las de Boosty no están en el padrón.
  const enlazadas = new Set(todas.map((f) => f.perfil_id).filter(Boolean))
  const sueltas = (perfiles ?? []).filter(
    (p) => p.activo && p.organizacion === 'iberia' && !enlazadas.has(p.id) && !p.email.endsWith('@iberia.local')
  )
  const libres = todas.filter((f) => !f.perfil_id && !duplicadas.has(f.id))
  const propuestas = new Map<string, { id: string; email: string }>()
  const repetidas = new Set<string>()
  for (const cuenta of sueltas) {
    const ficha = mejorFicha(cuenta.nombre_completo, libres)
    if (!ficha) continue
    // Dos cuentas para la misma ficha: no se propone ninguna.
    if (propuestas.has(ficha.id)) repetidas.add(ficha.id)
    propuestas.set(ficha.id, { id: cuenta.id, email: cuenta.email })
  }
  for (const id of repetidas) propuestas.delete(id)

  return { duplicadas, propuestas }
}

/**
 * Enlaza una cuenta con su ficha. Lo usan Usuarios y el padrón.
 *
 * Con la clave de servicio: la política de `empleados` no deja escribir
 * `perfil_id` desde la sesión. Una ficha no se enlaza a dos cuentas, ni una
 * cuenta a dos fichas. Devuelve el porqué si no se pudo.
 */
export async function enlazarCuentaConFicha(
  perfilId: string,
  empleadoId: string,
  email: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data: ficha } = await admin
    .from('empleados')
    .select('id, nombre_completo, perfil_id, activo, email')
    .eq('id', empleadoId)
    .maybeSingle()
  if (!ficha?.activo) return 'Esa ficha no existe o está inactiva.'
  if (ficha.perfil_id && ficha.perfil_id !== perfilId) {
    return `La ficha de ${ficha.nombre_completo} ya está enlazada a otra cuenta.`
  }

  const { data: otra } = await admin
    .from('empleados')
    .select('nombre_completo')
    .eq('perfil_id', perfilId)
    .neq('id', empleadoId)
    .maybeSingle()
  if (otra) return `Esa cuenta ya está enlazada a la ficha de ${otra.nombre_completo}.`

  const { error } = await admin
    .from('empleados')
    .update({ perfil_id: perfilId, email: ficha.email ?? email })
    .eq('id', empleadoId)
  return error ? `No se pudo enlazar: ${error.message}` : null
}
