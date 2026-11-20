import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Tramo } from '@/components/sistema/procesos/piezas-r2'

/**
 * Lo que la administración del canal lee para sus barras: la adopción por área,
 * sede y nivel (`ui.canal_uso`, que pide la casilla `modulo:reportes` adentro).
 * Son cuentas por grupo, nunca personas ni contenidos.
 */

export type FilaUso = {
  clave: string
  area: string
  sede: string
  sede_nombre: string
  nivel: string
  nivel_nombre: string
  en_padron: number
  con_cuenta: number
  entraron: number
  activas_30d: number
  mensajes_30d: number
  lecturas_30d: number
}

export const TRAMOS_USO: Tramo[] = [
  { clave: 'activas', etiqueta: 'activas en 30 días', simbolo: '●', color: '#1f8a5b' },
  { clave: 'sin_actividad', etiqueta: 'con cuenta, sin actividad', simbolo: '○', color: '#e3b25a' },
  { clave: 'sin_cuenta', etiqueta: 'sin cuenta', simbolo: '–', color: '#c4c9d0' },
]

export async function leerUso(al?: string): Promise<FilaUso[]> {
  const supabase = await createClient()
  const { data } = await supabase.schema('ui').rpc('canal_uso', al ? { p_al: al } : {})
  return (data ?? []) as FilaUso[]
}

/** Agrupa las filas por área, sede o nivel en los tres tramos de la barra. */
export function filasUso(filas: FilaUso[], por: 'area' | 'sede' | 'nivel') {
  const m = new Map<string, { etiqueta: string; valores: Record<string, number> }>()
  for (const f of filas) {
    const clave = por === 'area' ? f.area : por === 'sede' ? f.sede : f.nivel
    const etiqueta = por === 'area' ? f.area : por === 'sede' ? f.sede_nombre : f.nivel_nombre
    const g = m.get(clave) ?? { etiqueta, valores: { activas: 0, sin_actividad: 0, sin_cuenta: 0 } }
    g.valores.activas += f.activas_30d
    g.valores.sin_actividad += Math.max(0, f.con_cuenta - f.activas_30d)
    g.valores.sin_cuenta += Math.max(0, f.en_padron - f.con_cuenta)
    m.set(clave, g)
  }
  return [...m.entries()]
    .map(([clave, g]) => ({ clave, etiqueta: g.etiqueta, valores: g.valores, total: Object.values(g.valores).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
}
