import 'server-only'
import { createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>

/**
 * El nombre de cada tipo YY. El documento guarda solo los dos dígitos, y el
 * mismo YY significa cosas distintas según la generación del código (un 30 de
 * 2008 es norma técnica; de 2012, diagrama): si difieren, se dicen los dos.
 */
export async function nombresDeTipo(supabase: Cliente): Promise<Map<string, string>> {
  const { data } = await supabase.schema('sgc').from('tipo_documento').select('yy, generacion, nombre').order('generacion', { ascending: false })
  const porYY = new Map<string, { generacion: string; nombre: string }[]>()
  for (const t of data ?? []) (porYY.get(t.yy) ?? porYY.set(t.yy, []).get(t.yy)!).push(t)
  const m = new Map<string, string>()
  for (const [yy, ts] of porYY) {
    const distintos = [...new Set(ts.map((t) => t.nombre))]
    m.set(yy, distintos.length === 1 ? distintos[0] : ts.map((t) => `${t.nombre} (${t.generacion})`).join(' · '))
  }
  return m
}
