import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoCheck, IconoMas } from '@/components/iconos'
import { leerTareas } from '@/components/sistema/colaboracion/datos'
import { tieneFicha } from '@/components/sistema/colaboracion/abrir'
import { requerirEmpleado, requerirSeccion } from '@/lib/canal'
import { hrefFicha, vencida, venceHoy, type Tarea } from '@/lib/plataforma/colaboracion'
import { fechaCorta, hoyCaracas } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'
import { cambiarMiTarea, crearMiTarea } from './acciones'

export const metadata: Metadata = { title: 'Tareas' }

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const CAMPO =
  'w-full rounded-xl border border-marca-200 bg-white px-3.5 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none'

/**
 * Tareas en el teléfono (24-nov-2026, Gabriel: sección principal, al lado de Inicio). Las que me asignaron en la
 * plataforma y las que me anoto yo (`nucleo.tarea`), en lista o en calendario por fecha de vencimiento. Se
 * terminan con un toque; las hechas quedan abajo un tiempo por si hay que reabrirlas.
 */
export default async function TareasPage({ searchParams }: PageProps<'/canal/tareas'>) {
  await requerirSeccion('tareas')
  const [, sp] = await Promise.all([requerirEmpleado(), searchParams])
  const todas = (await leerTareas({ abiertas: false, limite: 200 })).filter((t) => t.mia)
  const hoy = hoyCaracas()
  const abiertas = todas.filter((t) => t.estado === 'abierta')
  const hechas = todas.filter((t) => t.estado === 'hecha').slice(0, 10)
  const vista = sp.vista === 'calendario' ? 'calendario' : 'lista'
  const mes = typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoy.slice(0, 7)

  return (
    <>
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">Tareas</h1>
          <p className="mt-1 text-[13px] text-marca-500">Las que te asignaron y las que te anotas tú.</p>
        </div>
        <nav aria-label="Vista" className="flex shrink-0 rounded-full bg-marca-100 p-1 text-[13px] font-semibold">
          <Link
            href="/canal/tareas"
            aria-current={vista === 'lista' ? 'page' : undefined}
            className={cn('toque rounded-full px-3', vista === 'lista' ? 'bg-white text-marca-900 shadow-sm' : 'text-marca-500')}
          >
            Lista
          </Link>
          <Link
            href={`/canal/tareas?vista=calendario&mes=${mes}`}
            aria-current={vista === 'calendario' ? 'page' : undefined}
            className={cn('toque rounded-full px-3', vista === 'calendario' ? 'bg-white text-marca-900 shadow-sm' : 'text-marca-500')}
          >
            Calendario
          </Link>
        </nav>
      </header>

      <details className="tarjeta-canal mb-4 overflow-hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-[15px] font-semibold text-marca-800">
          <IconoMas className="h-5 w-5 text-acento-600" />
          Nueva tarea
        </summary>
        <form action={crearMiTarea} className="space-y-3 border-t border-marca-100 p-4">
          <div>
            <label htmlFor="titulo" className="mb-1 block text-[13px] font-medium text-marca-600">
              Qué hay que hacer
            </label>
            <input id="titulo" name="titulo" required maxLength={200} placeholder="Revisar el inventario de envases" className={cn(CAMPO, 'min-h-11')} />
          </div>
          <div>
            <label htmlFor="detalle" className="mb-1 block text-[13px] font-medium text-marca-600">
              Detalle <span className="font-normal text-marca-400">(opcional)</span>
            </label>
            <textarea id="detalle" name="detalle" rows={2} maxLength={1000} className={cn(CAMPO, 'py-2.5')} />
          </div>
          <div>
            <label htmlFor="vence" className="mb-1 block text-[13px] font-medium text-marca-600">
              Para cuándo <span className="font-normal text-marca-400">(opcional)</span>
            </label>
            <input id="vence" type="date" name="vence" min={hoy} className={cn(CAMPO, 'min-h-11')} />
          </div>
          <button type="submit" className="btn-canal btn-canal-rojo w-full">
            Anotar tarea
          </button>
        </form>
      </details>

      {vista === 'calendario' ? (
        <Calendario tareas={todas} mes={mes} hoy={hoy} />
      ) : abiertas.length === 0 ? (
        <div className="tarjeta-canal mb-4 px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-100 text-marca-500">
            <IconoCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-marca-900">No tienes tareas pendientes</h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">
            Anota una arriba, o te avisamos en la campana cuando alguien te asigne una.
          </p>
        </div>
      ) : (
        <ul className="tarjeta-canal mb-4 divide-y divide-marca-100 overflow-hidden">
          {abiertas.map((t) => (
            <FilaTarea key={t.id} t={t} hoy={hoy} />
          ))}
        </ul>
      )}

      {vista === 'lista' && hechas.length > 0 && (
        <section aria-labelledby="hechas">
          <h2 id="hechas" className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">
            Hechas
          </h2>
          <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
            {hechas.map((t) => (
              <FilaTarea key={t.id} t={t} hoy={hoy} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** El mes en cuadrícula, de lunes a domingo, con un punto en cada día que vence algo; debajo, las del mes. */
function Calendario({ tareas, mes, hoy }: { tareas: Tarea[]; mes: string; hoy: string }) {
  const [a, m] = mes.split('-').map(Number)
  const primero = new Date(Date.UTC(a, m - 1, 1))
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const hueco = (primero.getUTCDay() + 6) % 7
  const iso = (d: number) => `${mes}-${String(d).padStart(2, '0')}`
  const porDia = new Map<string, Tarea[]>()
  for (const t of tareas) if (t.vence?.startsWith(mes)) porDia.set(t.vence, [...(porDia.get(t.vence) ?? []), t])
  const mover = (delta: number) => {
    const d = new Date(Date.UTC(a, m - 1 + delta, 1))
    return `/canal/tareas?vista=calendario&mes=${d.toISOString().slice(0, 7)}`
  }
  const largo = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero)
  const titulo = largo.charAt(0).toUpperCase() + largo.slice(1)
  const delMes = tareas.filter((t) => t.vence?.startsWith(mes)).sort((x, y) => (x.vence ?? '').localeCompare(y.vence ?? ''))
  const sinFecha = tareas.filter((t) => !t.vence && t.estado === 'abierta')

  return (
    <>
      <section className="tarjeta-canal mb-4 px-3 py-3" aria-label={`Calendario de ${titulo}`}>
        <div className="mb-2 flex items-center justify-between">
          <Link href={mover(-1)} aria-label="Mes anterior" className="toque w-11 rounded-full text-xl text-marca-600 active:bg-marca-100">
            ‹
          </Link>
          <p className="text-[15px] font-semibold text-marca-900">{titulo}</p>
          <Link href={mover(1)} aria-label="Mes siguiente" className="toque w-11 rounded-full text-xl text-marca-600 active:bg-marca-100">
            ›
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-marca-500" aria-hidden>
          {DIAS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: hueco }, (_, i) => (
            <span key={`h${i}`} />
          ))}
          {Array.from({ length: dias }, (_, i) => {
            const dia = iso(i + 1)
            const lista = porDia.get(dia) ?? []
            const pendientes = lista.filter((t) => t.estado === 'abierta').length
            const atrasada = pendientes > 0 && dia < hoy
            return (
              <span
                key={dia}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center rounded-lg text-[14px] tabular-nums',
                  dia === hoy ? 'bg-marca-800 font-bold text-white' : 'text-marca-800',
                  lista.length > 0 && dia !== hoy && 'bg-marca-50 font-semibold'
                )}
              >
                {i + 1}
                {lista.length > 0 && (
                  <span
                    aria-label={`${lista.length} tarea${lista.length > 1 ? 's' : ''}`}
                    className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', atrasada ? 'bg-acento-600' : pendientes ? 'bg-oro-300' : 'bg-[#1f8a5b]')}
                  />
                )}
              </span>
            )
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-marca-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-oro-300" />
            Pendiente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-acento-600" />
            Vencida
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a5b]" />
            Hecha
          </span>
        </p>
      </section>

      {delMes.length > 0 ? (
        <ul className="tarjeta-canal mb-4 divide-y divide-marca-100 overflow-hidden">
          {delMes.map((t) => (
            <FilaTarea key={t.id} t={t} hoy={hoy} />
          ))}
        </ul>
      ) : (
        <p className="mb-4 px-1 text-[14px] text-marca-500">No hay tareas con fecha en este mes.</p>
      )}
      {sinFecha.length > 0 && (
        <section aria-labelledby="sin-fecha">
          <h2 id="sin-fecha" className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">
            Sin fecha
          </h2>
          <ul className="tarjeta-canal mb-4 divide-y divide-marca-100 overflow-hidden">
            {sinFecha.map((t) => (
              <FilaTarea key={t.id} t={t} hoy={hoy} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function FilaTarea({ t, hoy }: { t: Tarea; hoy: string }) {
  const hecha = t.estado === 'hecha'
  const atrasada = vencida(t, hoy)
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <form action={cambiarMiTarea} className="shrink-0">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="estado" value={hecha ? 'abierta' : 'hecha'} />
        <button
          type="submit"
          aria-label={hecha ? `Reabrir: ${t.titulo}` : `Marcar como hecha: ${t.titulo}`}
          className={cn(
            'toque -m-1.5 w-11 rounded-full',
            hecha ? 'text-[#1f6f4b]' : 'text-marca-500 active:bg-marca-100'
          )}
        >
          <span className={cn('grid h-7 w-7 place-items-center rounded-full border-2', hecha ? 'border-[#1f8a5b] bg-[#e7f5ee]' : 'border-marca-300')}>
            {hecha && <IconoCheck className="h-4 w-4" />}
          </span>
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] leading-snug', hecha ? 'text-marca-500 line-through' : 'font-semibold text-marca-900')}>{t.titulo}</p>
        {t.detalle && !hecha && <p className="mt-0.5 text-[13px] leading-relaxed text-marca-600">{t.detalle}</p>}
        <p className="mt-1 text-[12px] text-marca-500">
          {t.vence && !hecha && (
            <span className={cn(atrasada && 'font-semibold text-acento-700')}>
              {atrasada ? 'Venció el ' : venceHoy(t, hoy) ? 'Vence hoy · ' : 'Vence el '}
              {venceHoy(t, hoy) ? '' : fechaCorta(t.vence)}
              {' · '}
            </span>
          )}
          {t.creadaPor.id === t.asignadaA.id ? 'Anotada por ti' : `De ${t.creadaPor.nombre}`}
        </p>
        {t.objetoTipo && t.objetoId && t.objetoTitulo && tieneFicha(t.objetoTipo) && (
          <Link href={hrefFicha(t.objetoTipo, t.objetoId)} className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-acento-700 active:text-acento-800">
            {t.objetoTitulo} →
          </Link>
        )}
      </div>
    </li>
  )
}
