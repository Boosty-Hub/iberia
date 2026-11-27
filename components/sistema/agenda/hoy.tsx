import Link from 'next/link'
import type { Sesion } from '@/lib/auth'
import { hoyCaracas, leerAgenda, sumarDias } from '@/lib/plataforma/agenda'
import { AvisoMicrosoft, ItemAgenda, diaDe, itemsDelDia } from './piezas'

/** «Hoy» en Mi día (27-nov-2026): las reuniones y tareas del día, de la plataforma y de Microsoft 365. */
export async function HoyEnAgenda({ sesion }: { sesion: Sesion }) {
  const hoy = hoyCaracas()
  const agenda = await leerAgenda(sesion, hoy, sumarDias(hoy, 1))
  const items = itemsDelDia(agenda, hoy)
  const d = diaDe(hoy)
  return (
    <section className="mb-3 min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="hoy-agenda" data-hoy-agenda>
      <header className="flex items-center justify-between gap-2 border-b border-[var(--borde)] px-4 py-2.5">
        <h2 id="hoy-agenda" className="text-[13px] font-semibold text-marca-900">
          Hoy, {d.semana} {d.numero} <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600">{items.length}</span>
        </h2>
        <Link href="/sistema/agenda" className="text-xs font-semibold text-acento-700 hover:underline">
          Ver la semana
        </Link>
      </header>
      <div className="p-2.5 empty:hidden">
        <AvisoMicrosoft agenda={agenda} conTodo={false} />
      </div>
      {items.length ? (
        <div className="grid grid-cols-1 gap-1.5 p-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.slice(0, 9).map((it, i) => (
            <ItemAgenda key={i} item={it} compacto />
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-center text-[12.5px] text-marca-400">Nada en tu agenda para hoy.</p>
      )}
      {items.length > 9 && (
        <p className="px-4 pb-3 text-[12px] text-marca-500">
          Y {items.length - 9} más.{' '}
          <Link href="/sistema/agenda" className="font-semibold text-acento-700 hover:underline">
            Ver la agenda
          </Link>
        </p>
      )}
    </section>
  )
}
