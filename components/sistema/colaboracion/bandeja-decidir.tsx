'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition, type ReactNode } from 'react'
import { aprobarVarios, decidirPaso } from '@/app/sistema/bandeja/acciones'
import { abrirFicha } from '@/components/sistema/colaboracion/abrir'
import { DecidirPaso } from '@/components/sistema/flujo/decidir-paso'
import { ACCION_PASO } from '@/components/sistema/flujo/formato'
import { hace } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * «Me toca decidir» como lista de trabajo: de cualquier tipo, con su edad y el
 * resumen del impacto. Se decide en la fila (devolver o rechazar piden motivo,
 * igual que la base) y se aprueba en lote **solo dentro del mismo tipo**.
 */

export type FilaDecidir = {
  pasoId: string
  tipoObjeto: string
  tipoEtiqueta: string
  ficha: { tipo: string; id: string } | null
  hrefModulo: string | null
  titulo: string
  paso: string
  orden: number
  accion: string
  hito: boolean
  pidio: string | null
  esperandoDesde: string
  dias: number
  impacto: string | null
  quien: string | null
  requisicionId: string | null
}

export function BandejaDecidir({ filas }: { filas: FilaDecidir[] }) {
  const router = useRouter()
  const uid = useId()
  const [filtro, setFiltro] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [abierta, setAbierta] = useState<string | null>(null)
  const [comentarioLote, setComentarioLote] = useState('')
  const [aviso, setAviso] = useState<{ ok?: string; error?: string } | null>(null)
  const [pendiente, iniciar] = useTransition()

  const tipos = [...new Map(filas.map((f) => [f.tipoObjeto, f.tipoEtiqueta])).entries()]
  const visibles = filtro ? filas.filter((f) => f.tipoObjeto === filtro) : filas
  const tipoElegido = elegidas.size ? filas.find((f) => elegidas.has(f.pasoId))?.tipoObjeto : null

  function alternar(f: FilaDecidir) {
    setElegidas((prev) => {
      const s = new Set(prev)
      if (s.has(f.pasoId)) s.delete(f.pasoId)
      else s.add(f.pasoId)
      return s
    })
  }

  function aprobarLote() {
    setAviso(null)
    iniciar(async () => {
      const r = await aprobarVarios([...elegidas], comentarioLote)
      setAviso(r)
      if (!r.error || (r.aprobados ?? 0) > 0) {
        setElegidas(new Set())
        setComentarioLote('')
      }
      router.refresh()
    })
  }

  function decidir(f: FilaDecidir, decision: 'aprobado' | 'devuelto' | 'rechazado', comentario: string) {
    setAviso(null)
    iniciar(async () => {
      const fd = new FormData()
      fd.set('paso', f.pasoId)
      fd.set('decision', decision)
      fd.set('comentario', comentario)
      const r = await decidirPaso({}, fd)
      setAviso(r.error ? { error: r.error } : { ok: `${f.titulo}: ${r.ok}` })
      if (!r.error) setAbierta(null)
      router.refresh()
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', pendiente && 'opacity-70')} aria-busy={pendiente}>
      {tipos.length > 1 && (
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
          <Chip activo={!filtro} onClick={() => setFiltro(null)}>
            Todo · {filas.length}
          </Chip>
          {tipos.map(([t, e]) => (
            <Chip key={t} activo={filtro === t} onClick={() => setFiltro(t)}>
              {e} · {filas.filter((f) => f.tipoObjeto === t).length}
            </Chip>
          ))}
        </div>
      )}

      {aviso && (
        <p role={aviso.error ? 'alert' : 'status'} className={cn('rounded-lg border px-3 py-2 text-[12.5px]', aviso.error ? 'border-acento-200 bg-acento-50 text-acento-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>
          {aviso.error ? '⚠ ' : '✓ '}
          {aviso.error ?? aviso.ok}
        </p>
      )}

      {elegidas.size > 0 && (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[#2b2a28] bg-[#2b2a28] px-3 py-2 text-white shadow-lg" role="region" aria-label="Aprobar en lote">
          <span className="text-[12.5px] font-semibold">
            {elegidas.size} {elegidas.size === 1 ? 'elegida' : 'elegidas'} · {filas.find((f) => f.tipoObjeto === tipoElegido)?.tipoEtiqueta}
          </span>
          <label htmlFor={`${uid}-lote`} className="sr-only">
            Comentario para todas (opcional)
          </label>
          <input
            id={`${uid}-lote`}
            value={comentarioLote}
            onChange={(e) => setComentarioLote(e.target.value)}
            maxLength={1000}
            placeholder="Comentario para todas (opcional)"
            className="h-8 min-w-0 flex-1 basis-40 rounded-lg border border-[#4a4845] bg-[#3a3936] px-2.5 text-[12.5px] text-white placeholder:text-[#bdb8b0]"
          />
          <button type="button" onClick={() => setElegidas(new Set())} className="h-8 rounded-lg px-2.5 text-xs text-[#e8e5df] hover:bg-white/10">
            Quitar selección
          </button>
          <button type="button" onClick={aprobarLote} disabled={pendiente} className="h-8 rounded-lg bg-[#D4332C] px-3 text-xs font-semibold text-white hover:bg-[#b92b25] disabled:opacity-50">
            {pendiente ? 'Aprobando…' : `Aprobar ${elegidas.size}`}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <div className="hidden grid-cols-[2rem_minmax(0,1fr)_9rem_7rem_minmax(0,14rem)_6.5rem] gap-3 border-b border-[var(--borde)] bg-[#fafbfc] px-3 py-2 text-[11px] font-semibold text-marca-500 lg:grid" aria-hidden>
          <span />
          <span>Qué y tu paso</span>
          <span>Pidió</span>
          <span>Espera</span>
          <span>Impacto</span>
          <span />
        </div>
        <ul>
          {visibles.map((f) => {
            const otroTipo = Boolean(tipoElegido && tipoElegido !== f.tipoObjeto)
            const completar = f.accion === 'completar'
            const bloqueo = completar ? 'Este paso pide candidato y fecha: se decide en la fila.' : otroTipo ? 'En lote solo se aprueban juntas las del mismo tipo.' : null
            const viejo = f.dias >= 3
            return (
              <li key={f.pasoId} className="border-t border-[#eef0f3] first:border-0">
                <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-3 py-2.5 lg:grid-cols-[2rem_minmax(0,1fr)_9rem_7rem_minmax(0,14rem)_6.5rem] lg:items-center">
                  <span className="pt-0.5 lg:pt-0">
                    <input
                      type="checkbox"
                      checked={elegidas.has(f.pasoId)}
                      disabled={Boolean(bloqueo)}
                      onChange={() => alternar(f)}
                      aria-label={`Elegir «${f.titulo}» para aprobar en lote`}
                      title={bloqueo ?? 'Elegir para aprobar en lote'}
                      className="h-4 w-4 accent-[#2b2a28] disabled:opacity-30"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-[#eef0f3] px-1.5 text-[10.5px] font-semibold text-marca-600">{f.tipoEtiqueta}</span>
                      {f.hito && <span className="rounded-md bg-[#fbeceb] px-1.5 text-[10.5px] font-semibold text-[#a3241f]">Aprueba el objeto</span>}
                    </p>
                    {f.ficha ? (
                      <button type="button" onClick={() => abrirFicha(router, f.ficha!.tipo, f.ficha!.id)} className="mt-0.5 block max-w-full text-left font-semibold break-words text-marca-900 hover:underline">
                        {f.titulo}
                      </button>
                    ) : f.hrefModulo ? (
                      <Link href={f.hrefModulo} className="mt-0.5 block max-w-full font-semibold break-words text-marca-900 hover:underline">
                        {f.titulo}
                      </Link>
                    ) : (
                      <p className="mt-0.5 font-semibold break-words text-marca-900">{f.titulo}</p>
                    )}
                    <p className="text-[12px] text-marca-600">
                      Paso {f.orden}: {f.paso}
                      {f.quien ? <span className="text-marca-400"> · {f.quien}</span> : null}
                    </p>
                  </div>
                  <span className="col-start-2 text-[12px] text-marca-600 lg:col-start-auto">
                    <span className="lg:hidden">Pidió </span>
                    {f.pidio ?? '—'}
                  </span>
                  <span className="col-start-2 text-[12px] lg:col-start-auto">
                    {viejo ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#f0d49c] bg-[#fdf4e3] px-1.5 font-semibold text-[#8a5a12]" title={`Esperando desde ${f.esperandoDesde}`}>
                        ⚠ {f.dias} días
                      </span>
                    ) : (
                      <span className="text-marca-600" suppressHydrationWarning>
                        <span className="lg:hidden">Espera </span>
                        {hace(f.esperandoDesde).replace('hace ', '')}
                      </span>
                    )}
                  </span>
                  <span className="col-start-2 text-[12px] break-words text-marca-700 lg:col-start-auto">{f.impacto ?? <span className="text-marca-400">—</span>}</span>
                  <span className="col-start-2 lg:col-start-auto lg:text-right">
                    <button
                      type="button"
                      onClick={() => setAbierta((a) => (a === f.pasoId ? null : f.pasoId))}
                      aria-expanded={abierta === f.pasoId}
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] px-2.5 text-xs font-medium hover:bg-marca-50"
                    >
                      Decidir {abierta === f.pasoId ? '▴' : '▾'}
                    </button>
                  </span>
                </div>
                {abierta === f.pasoId && (
                  <div className="border-t border-dashed border-[var(--borde)] bg-[#fafbfc] px-3 py-3 lg:pl-14">
                    {completar ? (
                      <DecidirPaso compacto pasoId={f.pasoId} accion={f.accion} nombre={f.paso} requisicionId={f.requisicionId ?? undefined} />
                    ) : (
                      <DecidirEnFila fila={f} pendiente={pendiente} alDecidir={(d, c) => decidir(f, d, c)} />
                    )}
                    {f.hrefModulo && (
                      <Link href={f.hrefModulo} className="mt-2 inline-block text-[12px] text-acento-700 hover:underline">
                        Revisar en el módulo →
                      </Link>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3 text-xs focus-visible:outline-2 focus-visible:outline-acento-500',
        activo ? 'border-[#2b2a28] bg-[#2b2a28] font-semibold text-white' : 'border-[var(--borde)] bg-white text-marca-700 hover:bg-marca-50'
      )}
    >
      {children}
    </button>
  )
}

function DecidirEnFila({ fila, pendiente, alDecidir }: { fila: FilaDecidir; pendiente: boolean; alDecidir: (d: 'aprobado' | 'devuelto' | 'rechazado', c: string) => void }) {
  const uid = useId()
  const [comentario, setComentario] = useState('')
  const [falta, setFalta] = useState(false)
  const conMotivo = (d: 'devuelto' | 'rechazado') => {
    if (comentario.trim().length < 3) {
      setFalta(true)
      return
    }
    if (d === 'rechazado' && !window.confirm('¿Rechazar? La solicitud se cierra y no sigue la ruta.')) return
    alDecidir(d, comentario)
  }
  return (
    <div>
      <label htmlFor={`${uid}-c`} className="text-[12px] font-semibold text-marca-700">
        Comentario <span className="font-normal text-marca-500">· obligatorio para devolver o rechazar</span>
      </label>
      <textarea
        id={`${uid}-c`}
        value={comentario}
        onChange={(e) => {
          setComentario(e.target.value)
          setFalta(false)
        }}
        rows={2}
        maxLength={1000}
        aria-invalid={falta}
        aria-describedby={falta ? `${uid}-f` : undefined}
        placeholder="Lo que quien pidió debe saber"
        className={cn('mt-1 block w-full rounded-lg border bg-white px-2.5 py-2 text-[13px] focus:outline-2 focus:outline-acento-500', falta ? 'border-acento-500' : 'border-[var(--borde)]')}
      />
      {falta && (
        <p id={`${uid}-f`} role="alert" className="mt-1 text-[12px] text-acento-700">
          Para devolver o rechazar, escribe el motivo: quien lo pidió lo va a leer.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pendiente} onClick={() => alDecidir('aprobado', comentario)} className="btn-acento h-9">
          {ACCION_PASO[fila.accion]?.boton ?? 'Aprobar'}
        </button>
        <button type="button" disabled={pendiente} onClick={() => conMotivo('devuelto')} className="btn-neutro h-9">
          ↩ Devolver
        </button>
        <button type="button" disabled={pendiente} onClick={() => conMotivo('rechazado')} className="btn-peligro h-9">
          ✕ Rechazar
        </button>
      </div>
    </div>
  )
}
