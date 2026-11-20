import type { ReactNode } from 'react'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { ENTREGABLES, ESTADOS_HITO, TIPOS_HITO, mesDe, nombreMes, type Entregable, type TipoHito } from '@/lib/programa'
import { TIPOS_SESION, type TipoSesion } from '@/lib/types'
import { fechaCorta, hoyCaracas } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Las piezas del Programa en el lenguaje denso de la plataforma. Se mudaron de
 * `/dashboard/programa` con sus reglas: lo lee Iberia, así que nada de dinero y
 * nada de alarmas (la diferencia contra la cuota se escribe, no se pinta).
 */

export function Seccion({ titulo, descripcion, children, className, id, acciones }: { titulo: string; descripcion?: ReactNode; children: ReactNode; className?: string; id?: string; acciones?: ReactNode }) {
  return (
    <section id={id} className={cn('min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5', className)} aria-labelledby={id ? `${id}-t` : undefined}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id ? `${id}-t` : undefined} className="text-[13px] font-semibold text-marca-900">
          {titulo}
        </h2>
        {acciones && <div className="ml-auto flex items-center gap-1.5">{acciones}</div>}
      </div>
      {descripcion && <p className="-mt-1 mb-2.5 max-w-3xl text-[12.5px] text-marca-500">{descripcion}</p>}
      {children}
    </section>
  )
}

/**
 * Una casilla del cuadro mes × perfil: las horas y, debajo, la diferencia contra
 * la cuota. La diferencia se **escribe** —«+34», «−2»— en vez de pintarse: la
 * cláusula 8 administra las horas como promedio dentro de la fase. Quien se pasa
 * va en seminegrita: forma, no tono.
 */
export function Casilla({ horas: h, cuota, mide, corrido, total }: { horas: number; cuota: number; mide: boolean; corrido: boolean; total?: boolean }) {
  const delta = h - cuota
  return (
    <td className="px-3 py-2 text-right align-top">
      <span className={cn('block tabular-nums', !corrido ? 'text-marca-400' : total || (mide && delta > 0) ? 'font-semibold text-marca-900' : 'text-marca-800')}>
        {h ? h.toLocaleString('es-VE', { maximumFractionDigits: 2 }) : '—'}
      </span>
      {mide && corrido && h > 0 && delta !== 0 && (
        <span className="mt-0.5 block text-[11.5px] text-marca-500 tabular-nums">
          {delta > 0 ? '+' : '−'}
          {Math.abs(delta).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
        </span>
      )}
    </td>
  )
}

export type Evento = {
  origen: string | null
  id: string | null
  fecha: string | null
  titulo: string | null
  descripcion: string | null
  tipo: string | null
  entregable: string | null
  estado: string | null
  duracion_minutos: number | null
}

/** Los hitos traen un `tipo` de `TIPOS_HITO` y las sesiones uno de `TIPOS_SESION`. */
function comoSeRotula(tipo: string | null): string {
  if (!tipo) return ''
  return TIPOS_HITO[tipo as TipoHito] ?? TIPOS_SESION[tipo as TipoSesion] ?? tipo
}

function Pastilla({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'ambar' | 'marca' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tono === 'ambar' ? 'bg-[#fdf4e3] text-[#8a5a12]' : tono === 'marca' ? 'bg-[#fbeceb] text-[#a3241f]' : 'bg-[#eef0f3] text-marca-600'
      )}
    >
      {children}
    </span>
  )
}

/**
 * El hilo de la línea de tiempo, agrupado por mes: con más de cuarenta entradas
 * —cada sesión del levantamiento es una— un hilo corrido no se puede recorrer.
 * Una sesión abre su ficha en el panel lateral, si la sesión puede verla.
 */
export function Hilo({ eventos, marcarRiesgo, abrirSesiones }: { eventos: Evento[]; marcarRiesgo: boolean; abrirSesiones: boolean }) {
  const hoy = hoyCaracas()
  const meses: { mes: string; eventos: Evento[] }[] = []
  for (const ev of eventos) {
    const mes = ev.fecha ? mesDe(ev.fecha) : 'sin-fecha'
    const ultimo = meses.at(-1)
    if (ultimo?.mes === mes) ultimo.eventos.push(ev)
    else meses.push({ mes, eventos: [ev] })
  }
  if (!eventos.length) return <p className="py-3 text-[12.5px] text-marca-400">Nada por aquí.</p>

  return (
    <div className="flex flex-col gap-4">
      {meses.map(({ mes, eventos: delMes }) => (
        <div key={mes}>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-marca-400 uppercase">
            {mes === 'sin-fecha' ? 'Sin fecha' : nombreMes(mes)}
            <span className="ml-2 font-normal tracking-normal normal-case">
              · {delMes.length} {delMes.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </p>
          <ol className="relative border-l border-marca-200 pl-5">
            {delMes.map((ev) => {
              const futuro = (ev.fecha ?? '') > hoy
              const enRiesgo = marcarRiesgo && ev.estado === 'en_riesgo'
              // Lo que tenía fecha y no se ha hecho: «pendiente», en neutro (nada de alarmas).
              const pendiente = !futuro && ev.estado !== 'hecho' && ev.estado !== 'cancelado'
              const titulo = <span className="font-semibold text-marca-900">{ev.titulo}</span>
              return (
                <li key={`${ev.origen}-${ev.id}`} className="relative pb-3.5 last:pb-0">
                  <span
                    aria-hidden
                    className={cn('absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white', enRiesgo ? 'bg-amber-400' : futuro || pendiente ? 'bg-marca-300' : 'bg-acento-500')}
                  />
                  <p className="text-[11.5px] text-marca-500 tabular-nums">{fechaCorta(ev.fecha)}</p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    {ev.origen === 'sesion' && abrirSesiones && ev.id ? (
                      <BotonFicha tipo="entrevista" id={ev.id} className="text-marca-900">
                        {titulo}
                      </BotonFicha>
                    ) : (
                      titulo
                    )}
                    {/* La duración, solo de lo que ocurrió: la de una sesión programada es la reservada. */}
                    {ev.duracion_minutos && ev.estado === 'hecho' ? <span className="text-[11.5px] text-marca-500">{ev.duracion_minutos} min</span> : null}
                  </p>
                  {ev.descripcion && <p className="mt-0.5 max-w-3xl text-[12.5px] text-marca-600">{ev.descripcion}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pastilla>{comoSeRotula(ev.tipo)}</Pastilla>
                    {ev.entregable && <Pastilla tono="marca">{ENTREGABLES[ev.entregable as Entregable] ?? ev.entregable}</Pastilla>}
                    {/* «En riesgo» es juicio de seguimiento interno: solo lo ve el equipo. */}
                    {pendiente && !enRiesgo && <Pastilla>Pendiente</Pastilla>}
                    {!pendiente && ev.estado === 'previsto' && <Pastilla>{ESTADOS_HITO.previsto}</Pastilla>}
                    {enRiesgo && <Pastilla tono="ambar">{ESTADOS_HITO.en_riesgo}</Pastilla>}
                    {!marcarRiesgo && !pendiente && ev.estado === 'en_riesgo' && <Pastilla>{ESTADOS_HITO.previsto}</Pastilla>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

/** El pie de las pantallas del programa: de dónde sale cada cosa. */
export function PieContrato({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11.5px] text-marca-500">{children}</p>
}
