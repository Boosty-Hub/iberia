import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Lecturas compartidas de las pantallas de Organización (R1): la dotación
 * agregada por dirección, con o sin el plan. Todo con la sesión de quien mira.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

export type PorDireccion = {
  ref: string
  nombre: string
  aprobada: number
  ocupada: number
  vacantes: number
  porEncima: number
  plazas: number
  plan: number | null
  enRequisicion: number
}

const vigente = (d: string) => `[${d},${d}]`

/**
 * Las plazas al día, agrupadas por la dirección que las contiene (la unidad de
 * tipo dirección o dirección general más cercana hacia arriba, como
 * `org.direccion_de`). Con `conPlan` suma el plan aprobado del año y lo que
 * está en requisición (de `ui.dotacion`, que pide `sistema:dotacion`).
 */
export async function dotacionPorDireccion(supabase: Cliente, al: string, conPlan: boolean): Promise<PorDireccion[]> {
  const [{ data: plazas }, { data: unidades }, dot] = await Promise.all([
    supabase.schema('ui').rpc('plazas', { p_al: al }).select('unidad_ref, dotacion, ocupadas, vacantes, exceso').range(0, 4999),
    supabase.schema('org').from('unidad').select('ref, nombre, tipo, padre_ref').is('escenario_id', null).filter('vigencia', 'cs', vigente(al)).range(0, 1999),
    conPlan
      ? supabase.schema('ui').rpc('dotacion', { p_al: al, p_anio: Number(al.slice(0, 4)) }).select('direccion_ref, plan, en_requisicion').range(0, 4999)
      : Promise.resolve({ data: [] as { direccion_ref: string | null; plan: number | null; en_requisicion: number }[] }),
  ])
  const u = new Map((unidades ?? []).map((x) => [x.ref, x]))
  const memo = new Map<string, string>()
  const direccion = (ref: string): string => {
    if (memo.has(ref)) return memo.get(ref)!
    let r = ref
    for (let i = 0; i < 14; i++) {
      const x = u.get(r)
      if (!x || ['direccion', 'direccion_general'].includes(x.tipo) || !x.padre_ref) break
      r = x.padre_ref
    }
    memo.set(ref, r)
    return r
  }
  const grupos = new Map<string, PorDireccion>()
  const grupo = (ref: string) => {
    let g = grupos.get(ref)
    if (!g) {
      g = { ref, nombre: u.get(ref)?.nombre ?? 'Sin dirección', aprobada: 0, ocupada: 0, vacantes: 0, porEncima: 0, plazas: 0, plan: conPlan ? 0 : null, enRequisicion: 0 }
      grupos.set(ref, g)
    }
    return g
  }
  for (const p of plazas ?? []) {
    const g = grupo(direccion(p.unidad_ref as string))
    g.aprobada += Number(p.dotacion) || 0
    g.ocupada += Number(p.ocupadas) || 0
    g.vacantes += Number(p.vacantes) || 0
    g.porEncima += Number(p.exceso) || 0
    g.plazas++
  }
  let sinPlan = true
  for (const d of dot.data ?? []) {
    if (!d.direccion_ref) continue
    const g = grupo(d.direccion_ref)
    if (d.plan !== null && d.plan !== undefined) {
      g.plan = (g.plan ?? 0) + Number(d.plan)
      sinPlan = false
    }
    g.enRequisicion += Number(d.en_requisicion) || 0
  }
  const lista = [...grupos.values()].sort((a, b) => b.aprobada - a.aprobada || a.nombre.localeCompare(b.nombre, 'es'))
  // Sin ninguna línea de plan aprobada, «plan 0» mentiría: va nulo.
  if (conPlan && sinPlan) for (const g of lista) g.plan = null
  return lista
}
