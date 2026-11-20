import { catalogoIa } from '@/lib/ia/servidor'
import { LeyendaIa } from '@/components/sistema/ui/ficha-edicion'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'

/**
 * La pestaña IA de un módulo del Programa (Anexo E §7, «Pestaña IA de cada
 * módulo»). Hoy no hay capacidades encendidas en PRG: se dice, con lo que
 * significaría cada nivel. Si el catálogo trae capacidades del módulo (todas
 * nacen en N0), se listan apagadas: encenderlas es del Gobierno de IA.
 */
export async function IaDelModulo({ codigo }: { codigo: string }) {
  const capacidades = (await catalogoIa()).filter((c) => c.modulo === codigo)
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-xl border border-[var(--borde)] bg-white p-3.5 text-[13px]">
        <LeyendaIa />
      </section>
      <section className="rounded-xl border border-[var(--borde)] bg-white p-3.5 text-[13px]">
        <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Capacidades del catálogo para este módulo</h2>
        {capacidades.length ? (
          <ul className="flex flex-col gap-1.5">
            {capacidades.map((c) => (
              <li key={c.codigo} className="rounded-lg border border-[var(--borde)] px-2.5 py-1.5">
                <p className="flex flex-wrap items-center gap-1.5">
                  <NivelIA nivel={c.encendida ? c.nivel_actual : 'N0'} />
                  <span className="font-mono text-[10.5px] text-marca-500">{c.codigo}</span>
                </p>
                <p className="mt-0.5 font-medium text-marca-800">{c.nombre}</p>
                <p className="text-[12px] text-marca-500">{c.que_hace}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-marca-500">Ninguna capacidad de IA del catálogo apunta a este módulo. Todo funciona por el camino manual.</p>
        )}
      </section>
    </div>
  )
}
