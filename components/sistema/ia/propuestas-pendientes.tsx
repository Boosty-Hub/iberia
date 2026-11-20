import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { estadoIa } from '@/lib/ia/servidor'
import type { NivelIa } from '@/lib/ia/niveles'
import { hace } from '@/lib/plataforma/formato'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'

/**
 * `<PropuestasPendientes/>` para Mi día (R5 lo incluye): lo que la IA propuso y
 * espera una decisión de quien mira —solo objetos que puede leer y que su rol
 * edita—, lo de más nivel primero. Cada una abre la ficha del objeto en el
 * panel lateral, donde se decide. Con la IA apagada, no pinta nada.
 */
export async function PropuestasPendientes({ limite = 5, titulo = 'La IA propone' }: { limite?: number; titulo?: string }) {
  const estado = await estadoIa()
  if (!estado?.general) return null
  const supabase = await createClient()
  const { data } = await supabase.schema('ia').rpc('mis_propuestas', { p_limite: limite })
  const filas = data ?? []
  if (!filas.length) return null
  const total = Number(filas[0]?.total ?? filas.length)

  return (
    <section data-propuestas-pendientes className="rounded-xl border border-[var(--borde)] bg-white p-3">
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-marca-900">
        <span aria-hidden className="text-[#5a3f9e]">✦</span> {titulo}
        <span className="rounded-lg bg-[#eef0f3] px-1.5 text-[11px] font-semibold text-marca-600">{total}</span>
        <span className="ml-auto text-[11px] font-normal text-marca-400">Tú decides cada una</span>
      </h2>
      <ul className="divide-y divide-[#eef0f3]">
        {filas.map((p) => (
          <li key={p.id}>
            <Link href={`?ficha=${p.objeto_tipo}:${p.objeto_id}`} scroll={false} className="flex items-start gap-2 py-1.5 hover:bg-[#f8f9fb]">
              <NivelIA nivel={p.nivel as NivelIa} corto />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-marca-900">{p.titulo}</span>
                <span className="block truncate text-[11px] text-marca-400">
                  {p.objeto} · {p.capacidad} · {hace(p.creado_en)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > filas.length && <p className="mt-1.5 text-[11px] text-marca-400">Y {total - filas.length} más en las fichas y en la tabla de plazas (filtro «con propuestas»).</p>}
    </section>
  )
}
