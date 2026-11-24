'use client'

import { useActionState, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { descartarCambios, enviarCambios, quitarCambio, type EstadoCambios } from '@/app/sistema/cambios/acciones'

const BOTON = 'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold disabled:opacity-50'

function Mensaje({ e }: { e: EstadoCambios }) {
  if (e.error) return <p role="alert" className="mt-2 rounded-lg bg-[#fdecea] px-3 py-2 text-[12.5px] text-[#a3241f]">{e.error}</p>
  if (e.ok) return <p role="status" className="mt-2 rounded-lg bg-[#e7f5ee] px-3 py-2 text-[12.5px] text-[#1f6f4b]">{e.ok}</p>
  return null
}

export function QuitarCambio({ id }: { id: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await quitarCambio(id)
            if (r.error) setError(r.error)
            else router.refresh()
          })
        }
        className="h-8 rounded-lg border border-[var(--borde)] px-2.5 text-[12px] hover:bg-marca-50"
      >
        {pendiente ? 'Quitando…' : 'Quitar'}
      </button>
      {error && <span className="mt-1 text-[11px] text-acento-700">{error}</span>}
    </span>
  )
}

export function EnviarCambios({ escenario, hoy, n }: { escenario: string; hoy: string; n: number }) {
  const [e, accion, pendiente] = useActionState(enviarCambios, {})
  return (
    <form action={accion} className="rounded-xl border border-[var(--borde)] bg-white p-4">
      <input type="hidden" name="escenario" value={escenario} />
      <h2 className="text-[14px] font-bold text-marca-900">Enviar a aprobación</h2>
      <p className="mt-0.5 text-[12.5px] text-marca-500">
        {n === 1 ? 'El cambio va' : `Los ${n} cambios van juntos`}. Los aprueba quien tiene «Aprobar cambios» en su rol (nunca tú mismo). Al aprobarse entran a la
        realidad en la fecha que elijas; si algo ya no cuadra, la aprobación falla y te lo devuelven.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="text-[12px] font-semibold text-marca-700">
          Rigen desde
          <input type="date" name="fecha" defaultValue={hoy} min={hoy} required className="mt-1 h-9 w-full rounded-lg border border-[var(--borde)] px-2 text-[13px]" />
        </label>
        <label className="text-[12px] font-semibold text-marca-700">
          Nota para quien aprueba (opcional)
          <input name="nota" maxLength={500} placeholder="Por qué se hacen estos cambios" className="mt-1 h-9 w-full rounded-lg border border-[var(--borde)] px-2 text-[13px]" />
        </label>
      </div>
      <button type="submit" disabled={pendiente} className={`${BOTON} mt-3 bg-[#D4332C] text-white hover:bg-[#b82a24]`}>
        {pendiente ? 'Enviando…' : `Enviar ${n} cambio${n === 1 ? '' : 's'} a aprobación`}
      </button>
      <Mensaje e={e} />
    </form>
  )
}

export function DescartarCambios({ escenario }: { escenario: string }) {
  const [e, accion, pendiente] = useActionState(descartarCambios, {})
  return (
    <form action={accion} className="flex flex-wrap items-center gap-3 text-[12.5px] text-marca-600">
      <input type="hidden" name="escenario" value={escenario} />
      <label className="inline-flex items-center gap-1.5">
        <input type="checkbox" name="confirmo" /> Descartar todo el borrador
      </label>
      <button type="submit" disabled={pendiente} className="h-8 rounded-lg border border-acento-300 px-2.5 text-[12px] font-medium text-acento-700 hover:bg-acento-50">
        {pendiente ? 'Descartando…' : 'Descartar'}
      </button>
      <Mensaje e={e} />
    </form>
  )
}
