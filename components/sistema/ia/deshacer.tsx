'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deshacerPropuesta } from '@/components/sistema/ia/acciones'
import { CuentaRegresiva } from '@/components/sistema/ia/propuesta-ia'

/** «↶ Deshacer» de lo que la IA aplicó sola (N4), con su cuenta regresiva. */
export function BotonDeshacer({ propuesta, hasta, puede }: { propuesta: string; hasta: string; puede: boolean }) {
  const router = useRouter()
  const [r, setR] = useState<{ ok?: string; error?: string } | null>(null)
  const [vencida, setVencida] = useState(false)
  const [ocupado, iniciar] = useTransition()
  if (r?.ok) return <span className="text-[12px] text-[#1f6f4b]">✓ {r.ok}</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-[#f4f5f7] px-2 py-1 text-[12px] text-marca-700">
      <span aria-hidden>↶</span>
      <CuentaRegresiva hasta={hasta} onVencer={() => setVencida(true)} />
      {puede && !vencida && (
        <button
          type="button"
          data-deshacer={propuesta}
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const x = await deshacerPropuesta(propuesta)
              setR(x)
              if (!x.error) router.refresh()
            })
          }
          className="inline-flex h-7 items-center rounded-md border border-[#6b7380] bg-white px-2 font-semibold text-marca-800 hover:bg-marca-50 disabled:opacity-60"
        >
          {ocupado ? 'Deshaciendo…' : '↶ Deshacer'}
        </button>
      )}
      {r?.error && <span className="text-[#a3241f]">⚠ {r.error}</span>}
    </span>
  )
}
