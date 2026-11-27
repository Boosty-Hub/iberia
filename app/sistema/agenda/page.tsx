import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirSesion } from '@/lib/auth'
import { hoyCaracas, leerAgenda, lunesDe, sumarDias } from '@/lib/plataforma/agenda'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { AvisoMicrosoft, ItemAgenda, Leyenda, diaDe, itemsDelDia } from '@/components/sistema/agenda/piezas'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agenda · Plataforma Iberia' }

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * La agenda (27-nov-2026, pedido de Gabriel): la semana de la persona con sus tareas de la plataforma y, si conectó
 * Microsoft 365, sus reuniones de Outlook y sus tareas de To Do, leídas en vivo (`lib/plataforma/agenda.ts`). En el
 * teléfono, lista por día con solo los días que tienen algo.
 */
export default async function AgendaPage({ searchParams }: PageProps<'/sistema/agenda'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const hoy = hoyCaracas()
  const pedido = typeof sp.semana === 'string' && FECHA.test(sp.semana) ? sp.semana : hoy
  const lunes = lunesDe(pedido)
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const agenda = await leerAgenda(sesion, lunes, sumarDias(lunes, 7))
  const conMicrosoft = agenda.microsoft.estado === 'ok'
  const conTodo = agenda.todo.estado === 'ok'
  const porDia = new Map(dias.map((d) => [d, itemsDelDia(agenda, d)]))
  const total = [...porDia.values()].reduce((n, x) => n + x.length, 0)
  const sinFecha = agenda.tareas.filter((t) => !t.vence).length + agenda.todo.tareas.filter((t) => !t.vence).length
  const vencidas = agenda.tareas.filter((t) => t.vence && t.vence < hoy).length + agenda.todo.tareas.filter((t) => t.vence && t.vence < hoy).length
  const a = diaDe(lunes)
  const b = diaDe(dias[6])
  const rango = a.mes === b.mes ? `${a.numero} – ${b.numero} ${b.mes} ${b.anio}` : `${a.numero} ${a.mes} – ${b.numero} ${b.mes} ${b.anio}`
  const boton = 'inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[12.5px] font-medium text-marca-800 hover:bg-marca-50'

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo="Agenda"
        migas={[{ etiqueta: 'Agenda' }]}
        descripcion={`Tu semana: tus tareas de la plataforma${conMicrosoft ? `, tus reuniones de Outlook${conTodo ? ' y tus tareas de To Do' : ''}, leídas en vivo de Microsoft` : ''}.`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <nav aria-label="Semanas" className="flex items-center gap-1.5">
          <Link href={`/sistema/agenda?semana=${sumarDias(lunes, -7)}`} className={boton} aria-label="Semana anterior">
            ←
          </Link>
          <Link href="/sistema/agenda" className={cn(boton, lunes === lunesDe(hoy) && 'border-marca-800')}>
            Hoy
          </Link>
          <Link href={`/sistema/agenda?semana=${sumarDias(lunes, 7)}`} className={boton} aria-label="Semana siguiente">
            →
          </Link>
        </nav>
        <h2 className="text-[15px] font-semibold text-marca-900" data-agenda-rango>
          {rango}
        </h2>
        <div className="ml-auto">
          <Leyenda conMicrosoft={conMicrosoft} conTodo={conTodo} />
        </div>
      </div>

      <div className="mb-3 empty:hidden">
        <AvisoMicrosoft agenda={agenda} />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-7" data-agenda-semana>
        {dias.map((d) => {
          const items = porDia.get(d) ?? []
          const x = diaDe(d)
          const esHoy = d === hoy
          return (
            <section
              key={d}
              aria-label={`${x.semana} ${x.numero} de ${x.mes}`}
              className={cn('min-w-0 rounded-xl border bg-[#fbfbfc] md:min-h-[18rem]', esHoy ? 'border-acento-300 bg-white' : 'border-[var(--borde)]', !items.length && 'hidden md:block')}
              data-dia={d}
            >
              <header className="flex items-baseline gap-1.5 border-b border-[var(--borde)] px-2.5 py-2">
                <span className={cn('text-[11px] font-semibold tracking-wide uppercase', esHoy ? 'text-acento-700' : 'text-marca-500')}>{x.corto}</span>
                <span className={cn('text-[16px] font-bold', esHoy ? 'text-acento-700' : 'text-marca-900')}>{x.numero}</span>
                {esHoy && <span className="ml-auto rounded-full bg-acento-50 px-1.5 text-[10.5px] font-semibold text-acento-700">Hoy</span>}
              </header>
              <div className="flex flex-col gap-1.5 p-1.5">
                {items.map((it, i) => (
                  <ItemAgenda key={i} item={it} />
                ))}
                {!items.length && <p className="px-1 py-3 text-center text-[11.5px] text-marca-400">—</p>}
              </div>
            </section>
          )
        })}
      </div>
      {!total && <p className="mt-3 rounded-xl border border-[var(--borde)] bg-white px-4 py-6 text-center text-[12.5px] text-marca-500 md:hidden">Nada en tu agenda esta semana.</p>}

      {(sinFecha > 0 || vencidas > 0) && (
        <p className="mt-3 text-[12px] text-marca-500">
          {vencidas > 0 && <>Tienes {vencidas} tarea{vencidas === 1 ? '' : 's'} vencida{vencidas === 1 ? '' : 's'}. </>}
          {sinFecha > 0 && <>{sinFecha} tarea{sinFecha === 1 ? '' : 's'} sin fecha no sale{sinFecha === 1 ? '' : 'n'} en el calendario. </>}
          <Link href="/sistema/tareas" className="font-semibold text-acento-700 hover:underline">
            Ver todas en Tareas
          </Link>
        </p>
      )}
    </>
  )
}
