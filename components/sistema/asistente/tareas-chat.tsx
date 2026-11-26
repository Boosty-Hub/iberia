'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ETIQUETA_CANAL, describirFrecuencia, type Frecuencia, type PropuestaTarea } from '@/lib/asistente/tipos'
import { guardarTarea, mantenerAlDia } from './acciones-f5'
import { EditorFrecuencia, FRECUENCIA_INICIAL } from './tareas'
import { cn } from '@/lib/utils'

/**
 * La tarjeta de una tarea que propuso el asistente: existe solo si la persona
 * la confirma (la IA propone, la persona decide).
 */
export function TarjetaPropuesta({ propuesta, chatId, mensajeId, programada }: { propuesta: PropuestaTarea; chatId: string | null; mensajeId: string | null; programada: boolean }) {
  const [hecha, setHecha] = useState(programada)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const listo = !!mensajeId && !mensajeId.startsWith('tmp-')
  const programar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarTarea({ ...propuesta, proyectoId: null, modelo: null, destinatarios: [], enMiDia: false, origenChat: chatId, origenMensaje: mensajeId })
      if (r.ok) setHecha(true)
      else setError(r.error)
    })
  return (
    <div className="rounded-xl border border-[var(--borde)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" data-propuesta>
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-acento-50 text-acento-700" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-marca-500 uppercase">Tarea programada propuesta</p>
          <p className="text-[14px] font-semibold text-marca-900">{propuesta.nombre}</p>
          <p className="text-[12.5px] text-marca-600">
            {describirFrecuencia(propuesta)} · {propuesta.canales.map((c) => ETIQUETA_CANAL[c]).join(', ')}
          </p>
          <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-marca-700">{propuesta.instruccion}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borde)] px-3.5 py-2">
        {hecha ? (
          <>
            <span className="text-[12.5px] font-semibold text-emerald-700">✓ Programada</span>
            <Link href="/sistema/asistente/tareas" className="text-[12.5px] font-semibold text-acento-700 hover:underline">
              Ver en Tareas
            </Link>
          </>
        ) : (
          <>
            <button type="button" className="btn-acento h-8 px-3.5 text-[12.5px]" disabled={!listo || pendiente} onClick={programar}>
              {pendiente ? 'Programando…' : 'Programar'}
            </button>
            {listo && (
              <Link href={`/sistema/asistente/tareas?desde=${mensajeId}`} className="btn-neutro h-8 px-3 text-[12.5px]">
                Ajustar antes
              </Link>
            )}
            <span className="text-[11.5px] text-marca-500">Corre con tus permisos de ese día.</span>
          </>
        )}
        {error && <span className="w-full text-[12px] text-acento-700">{error}</span>}
      </div>
    </div>
  )
}

/** «Mantener al día»: el artefacto pasa a tablero vivo que se rehace solo con los datos del día. */
export function MantenerAlDia({ htmlId }: { htmlId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [frec, setFrec] = useState<Frecuencia>({ ...FRECUENCIA_INICIAL, frecuencia: 'diaria', hora: '07:00' })
  const [enMiDia, setEnMiDia] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  return (
    <div className="relative">
      <button type="button" className={cn('btn-neutro h-8 px-2.5 text-[12px]', abierto && 'border-marca-400')} aria-expanded={abierto} onClick={() => setAbierto(!abierto)} title="Que se rehaga solo con los datos del día">
        Mantener al día
      </button>
      {abierto && (
        <div role="dialog" aria-label="Mantener al día" className="absolute top-10 right-0 z-20 w-[min(92vw,420px)] rounded-xl border border-[var(--borde)] bg-white p-3.5 shadow-lg">
          <p className="mb-2 text-[12.5px] text-marca-600">Se vuelve a hacer con los datos del día —las mismas fuentes, con tus permisos de ese día— y guarda cada versión.</p>
          <EditorFrecuencia valor={frec} cambiar={setFrec} prefijo="mad" />
          <label className="mt-3 inline-flex items-center gap-2 text-[13px] text-marca-800">
            <input type="checkbox" checked={enMiDia} onChange={(e) => setEnMiDia(e.target.checked)} /> Fijarlo en Mi día
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-acento h-8 px-3.5 text-[12.5px]"
              disabled={pendiente || msg?.ok}
              onClick={() =>
                iniciar(async () => {
                  const r = await mantenerAlDia(htmlId, { ...frec, enMiDia })
                  setMsg(r.ok ? { ok: true, texto: `Listo: ${describirFrecuencia(frec).toLowerCase()}.` } : { ok: false, texto: r.error })
                })
              }
            >
              {pendiente ? 'Programando…' : 'Programar'}
            </button>
            {msg && <span className={cn('text-[12px]', msg.ok ? 'text-emerald-700' : 'text-acento-700')}>{msg.texto}</span>}
            {msg?.ok && (
              <Link href="/sistema/asistente/tareas" className="text-[12px] font-semibold text-acento-700 hover:underline">
                Ver en Tareas
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
