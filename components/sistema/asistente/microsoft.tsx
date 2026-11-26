'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { desconectarMicrosoft, guardarIdentificadoresMicrosoft } from './acciones-f7'
import { cn } from '@/lib/utils'

const campo = 'rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] text-marca-900 outline-none focus:border-marca-400'
const rotulo = 'mb-1 block text-[12px] font-semibold text-marca-600'

export function BotonDesconectar() {
  const router = useRouter()
  const [seguro, setSeguro] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (!seguro)
    return (
      <button type="button" className="btn-neutro h-9 px-3 text-[13px]" onClick={() => setSeguro(true)}>
        Desconectar
      </button>
    )
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-marca-600">El asistente deja de leer tu cuenta y se borra el acceso guardado.</span>
      <button
        type="button"
        className="btn-peligro h-9 px-3 text-[13px]"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await desconectarMicrosoft()
            if (r.ok) router.refresh()
            else setError(r.error)
          })
        }
      >
        Sí, desconectar
      </button>
      <button type="button" className="btn-neutro h-9 px-3 text-[13px]" onClick={() => setSeguro(false)}>
        Cancelar
      </button>
      {error && <span className="text-[12px] text-acento-700">{error}</span>}
    </span>
  )
}

export function FormIdentificadores({ tenant, cliente, editable }: { tenant: string; cliente: string; editable: boolean }) {
  const router = useRouter()
  const [t, setT] = useState(tenant)
  const [c, setC] = useState(cliente)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={rotulo} htmlFor="ms-tenant">Directory (tenant) ID</label>
        <input id="ms-tenant" className={cn(campo, 'h-9 w-full font-mono')} disabled={!editable} placeholder="00000000-0000-0000-0000-000000000000" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <div>
        <label className={rotulo} htmlFor="ms-cliente">Application (client) ID</label>
        <input id="ms-cliente" className={cn(campo, 'h-9 w-full font-mono')} disabled={!editable} placeholder="00000000-0000-0000-0000-000000000000" value={c} onChange={(e) => setC(e.target.value)} />
      </div>
      {editable && (
        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="button"
            className="btn-acento h-9 px-4 text-[13px]"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await guardarIdentificadoresMicrosoft(t, c)
                setMsg(r.ok ? { ok: true, texto: 'Guardado.' } : { ok: false, texto: r.error })
                if (r.ok) router.refresh()
              })
            }
          >
            Guardar
          </button>
          {msg && <span className={cn('text-[12px]', msg.ok ? 'text-emerald-700' : 'text-acento-700')}>{msg.texto}</span>}
        </div>
      )}
    </div>
  )
}
