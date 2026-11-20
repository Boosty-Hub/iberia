import { createClient } from '@/lib/supabase/server'
import { estadoIa } from '@/lib/ia/servidor'
import { capacidadViva, COLUMNA_DE_REGLA, type MarcaCelda, type NivelIa } from '@/lib/ia/niveles'

/**
 * Las marcas ⚑ de NUC-ORG-IA-05 en la tabla de plazas: una por plaza y regla
 * pendiente, en la columna que la regla explica (exceso → «Por encima»; sin
 * titular → «Vacantes»; inferida → «Certeza»). Con la sesión de quien mira:
 * si no puede leer la plaza, no ve su marca. `null` = la IA no se pinta
 * (interruptor general o capacidad apagados).
 */
export async function marcasPlazas(): Promise<{ marcas: Record<string, Record<string, MarcaCelda>>; refs: string[] } | null> {
  const estado = await estadoIa()
  if (!capacidadViva(estado, 'NUC-ORG-IA-05')) return null
  const supabase = await createClient()
  const { data } = await supabase
    .schema('ia')
    .from('propuesta')
    .select('objeto_id, regla, nivel, titulo, explicacion')
    .eq('capacidad', 'NUC-ORG-IA-05')
    .eq('objeto_tipo', 'plaza')
    .eq('estado', 'pendiente')
    .range(0, 999)
  const marcas: Record<string, Record<string, MarcaCelda>> = {}
  for (const p of data ?? []) {
    const col = COLUMNA_DE_REGLA[p.regla] ?? 'cargo'
    const fila = (marcas[p.objeto_id] ??= {})
    const previa = fila[col]
    fila[col] = previa
      ? { ...previa, n: (previa.n ?? 1) + 1 }
      : { texto: p.explicacion ? `${p.titulo}. ${p.explicacion}` : p.titulo, nivel: p.nivel as NivelIa, n: 1 }
  }
  return { marcas, refs: Object.keys(marcas) }
}
