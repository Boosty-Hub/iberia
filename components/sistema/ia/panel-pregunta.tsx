'use client'

import { Fragment, useEffect, useRef, useState, useTransition } from 'react'
import { leerEstadoIa, preguntarIa, type RespuestaIa } from '@/components/sistema/ia/acciones'
import { EVENTO_PREGUNTAR_IA } from '@/components/sistema/ia/abrir'
import { GeneradoConIa, NivelIA } from '@/components/sistema/ia/nivel-ia'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { IconoCerrar } from '@/components/iconos'
import { capacidadViva, type EstadoIa } from '@/lib/ia/niveles'
import { fechaCorta } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * El panel «Preguntar a la IA» (NUC-PRO-IA-01, N1). Lo abre el botón de la
 * cabecera de cada módulo, la pestaña IA de una ficha o Ctrl K (evento
 * `preguntar-ia`). Responde con los permisos de quien pregunta y cita cada
 * registro: la cita abre su ficha. Si no está en los datos, lo dice.
 */

type Turno = { pregunta: string; r: RespuestaIa | null }

const TIPO: Record<string, string> = { proceso: 'Proceso', documento: 'Documento', unidad: 'Unidad', cargo: 'Cargo', plaza: 'Plaza' }

export function PanelPreguntaIa() {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<EstadoIa | null | undefined>(undefined)
  const [texto, setTexto] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [pensando, iniciar] = useTransition()
  const entrada = useRef<HTMLTextAreaElement>(null)
  const fondo = useRef<HTMLDivElement>(null)
  const { fijar } = useContextoUrl()

  const preguntar = (q: string) => {
    const pregunta = q.trim()
    if (pregunta.length < 4 || pensando) return
    setTexto('')
    setTurnos((t) => [...t, { pregunta, r: null }])
    iniciar(async () => {
      const r = await preguntarIa(pregunta).catch(() => ({ respuesta: '', suficiente: false, citas: [], leidos: 0, costoUsd: 0, error: 'No se pudo hablar con el servidor.' }))
      setTurnos((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r } : x)))
    })
  }

  useEffect(() => {
    const abrir = (e: Event) => {
      setAbierto(true)
      leerEstadoIa()
        .then(setEstado)
        .catch(() => setEstado(null))
      const q = (e as CustomEvent<{ pregunta?: string }>).detail?.pregunta ?? ''
      if (q) setTexto(q)
      setTimeout(() => entrada.current?.focus(), 0)
    }
    window.addEventListener(EVENTO_PREGUNTAR_IA, abrir)
    return () => window.removeEventListener(EVENTO_PREGUNTAR_IA, abrir)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-paleta-abierta]')) setAbierto(false)
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [abierto])

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' })
  }, [turnos])

  // La ficha se abre en su panel lateral; esta conversación queda guardada y
  // vuelve a verse al abrir otra vez «Preguntar a la IA».
  const abrirCita = (ficha: string) => {
    setAbierto(false)
    fijar({ ficha })
  }

  if (!abierto) return null
  const viva = capacidadViva(estado ?? null, 'NUC-PRO-IA-01') && !estado?.sin_presupuesto

  return (
    <aside
      role="dialog"
      aria-label="Preguntar a la IA"
      data-panel-pregunta-ia
      className="fixed inset-x-0 top-[var(--alto-barra)] bottom-0 z-50 flex flex-col border-l border-[var(--borde)] bg-white shadow-[-12px_0_30px_rgba(0,0,0,0.08)] min-[701px]:left-auto min-[701px]:w-[440px]"
    >
      <header className="flex items-start gap-2 border-b border-[var(--borde)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-bold text-marca-900">✦ Preguntar a la IA</span>
            <NivelIA nivel="N1" />
          </p>
          <p className="mt-0.5 text-[12px] text-marca-500">Responde solo con lo que tu rol puede leer, y cita cada registro. La decisión sigue siendo tuya.</p>
        </div>
        <button type="button" onClick={() => setAbierto(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-marca-500 hover:bg-marca-50" aria-label="Cerrar (Esc)">
          <IconoCerrar className="h-4 w-4" />
        </button>
      </header>

      <div ref={fondo} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[13px]">
        {estado === undefined ? (
          <p className="text-marca-400">Revisando si la IA está encendida…</p>
        ) : !viva ? (
          <p className="rounded-lg border border-[var(--borde)] bg-[#f4f5f7] p-2.5 text-marca-600">
            {!estado?.general
              ? 'La IA está apagada en toda la plataforma (interruptor general).'
              : estado.sin_presupuesto
                ? 'Se alcanzó el tope diario de gasto de la IA. Mañana vuelve; mientras, usa la búsqueda (Ctrl K).'
                : 'Esta capacidad (NUC-PRO-IA-01) está apagada.'}{' '}
            Todo funciona por el camino manual.
          </p>
        ) : !turnos.length ? (
          <div className="flex flex-col gap-2 text-marca-600">
            <p>Pregunta por un proceso, un documento o la estructura. Por ejemplo:</p>
            {['¿Qué registros genera la gestión del SGC?', '¿Quién es el dueño del proceso de compras y qué documentos lo rigen?', '¿Qué hace el proceso II-31?'].map((q) => (
              <button key={q} type="button" onClick={() => preguntar(q)} className="w-fit rounded-lg border border-[var(--borde)] px-2.5 py-1 text-left text-[12.5px] hover:bg-marca-50">
                {q}
              </button>
            ))}
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {turnos.map((t, i) => (
              <li key={i} className="flex flex-col gap-2">
                <p className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-[#2b2a28] px-3 py-1.5 text-white">{t.pregunta}</p>
                {!t.r ? (
                  <p className="text-marca-400" role="status">
                    La IA está leyendo lo que puedes ver…
                  </p>
                ) : t.r.error ? (
                  <p className="rounded-lg border border-[#f3c9c6] bg-[#fdf3f2] p-2 text-[#a3241f]" role="status">
                    ⚠ {t.r.error}
                  </p>
                ) : (
                  <div data-respuesta-ia className="rounded-xl border border-dashed border-[#9d93bd] bg-[#fbfaff] p-2.5">
                    <GeneradoConIa className="mb-1.5" />
                    <p className="leading-relaxed whitespace-pre-line text-marca-800">
                      {t.r.respuesta.split(/(\[\d{1,2}\])/g).map((parte, k) => {
                        const m = parte.match(/^\[(\d{1,2})\]$/)
                        const cita = m ? t.r!.citas.find((c) => c.n === Number(m[1])) : null
                        if (!m) return <Fragment key={k}>{parte}</Fragment>
                        return cita ? (
                          <button
                            key={k}
                            type="button"
                            onClick={() => abrirCita(`${cita.tipo}:${cita.id}`)}
                            className="mx-0.5 rounded bg-[#e3edfc] px-1 align-super text-[10px] font-bold text-[#1d4f8f] hover:underline"
                            title={`Abrir ${TIPO[cita.tipo]?.toLowerCase()} «${cita.titulo}»`}
                          >
                            {cita.n}
                          </button>
                        ) : null
                      })}
                    </p>
                    {t.r.citas.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 border-t border-[#e6dff7] pt-2" aria-label="Fuentes">
                        {t.r.citas.map((c) => (
                          <li key={c.n}>
                            <button
                              type="button"
                              data-cita-ia
                              onClick={() => abrirCita(`${c.tipo}:${c.id}`)}
                              className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white"
                            >
                              <span className="mt-px rounded bg-[#e3edfc] px-1 text-[10px] font-bold text-[#1d4f8f]">{c.n}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] text-marca-900">
                                  {c.codigo && <span className="mr-1 font-mono text-[11px] text-marca-500">{c.codigo}</span>}
                                  {c.titulo}
                                </span>
                                <span className="block text-[11px] text-marca-400">
                                  {TIPO[c.tipo]}
                                  {c.version && ` · ${c.version}`}
                                  {c.fecha && ` · ${c.tipo === 'proceso' ? 'vigente desde' : 'fecha'} ${fechaCorta(c.fecha)}`}
                                  {c.detalle && c.tipo === 'documento' && ` · ${c.detalle.replace('_', ' ')}`}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1.5 text-[11px] text-marca-400">
                      {t.r.suficiente ? `Leyó ${t.r.leidos} registro(s) a tu alcance.` : `No le alcanzó con los ${t.r.leidos} registro(s) a tu alcance: no adivina.`}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-[var(--borde)] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          preguntar(texto)
        }}
      >
        <textarea
          ref={entrada}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              preguntar(texto)
            }
          }}
          disabled={!viva}
          maxLength={500}
          rows={2}
          placeholder={viva ? 'Escribe tu pregunta…' : 'La IA no está disponible'}
          aria-label="Tu pregunta"
          className="campo min-h-[2.75rem] flex-1 resize-none"
        />
        <button type="submit" disabled={!viva || pensando || texto.trim().length < 4} className={cn('inline-flex h-11 items-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white', (!viva || pensando) && 'opacity-60')}>
          {pensando ? 'Pensando…' : 'Preguntar'}
        </button>
      </form>
    </aside>
  )
}
