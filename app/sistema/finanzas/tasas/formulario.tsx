'use client'

import { useActionState, useState } from 'react'
import { cargarTasaManual } from '@/app/sistema/finanzas/tasas/acciones'
import { hoyCaracas } from '@/lib/plataforma/formato'

/** La carga manual: respaldo cuando el BCV no publica o el capturador falla. Motivo obligatorio. */
export function FormularioTasa({ conParalelo }: { conParalelo: boolean }) {
  const [estado, accion, pendiente] = useActionState(cargarTasaManual, null)
  const [tipo, setTipo] = useState<'oficial' | 'paralelo'>('oficial')
  const campo = 'h-9 w-full rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] outline-none focus:border-acento-400 focus:ring-2 focus:ring-acento-100'
  return (
    <form action={accion} className="grid gap-2.5 text-[12.5px] sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-marca-500">Tipo</span>
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'oficial' | 'paralelo')} className={campo}>
          <option value="oficial">BCV oficial</option>
          {conParalelo && <option value="paralelo">Paralelo (uso interno)</option>}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-marca-500">Moneda</span>
        <select name="moneda" className={campo} disabled={tipo === 'paralelo'} defaultValue="USD">
          <option value="USD">Dólar (USD)</option>
          <option value="EUR">Euro (EUR)</option>
        </select>
        {tipo === 'paralelo' && <input type="hidden" name="moneda" value="USD" />}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-marca-500">Tasa en Bs (venta)</span>
        <input name="tasa" inputMode="decimal" placeholder="919,26" required className={`${campo} tabular-nums`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-marca-500">Fecha valor</span>
        <input name="fecha_valor" type="date" required defaultValue={hoyCaracas()} className={campo} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-marca-500">Motivo (obligatorio)</span>
        <input name="motivo" required minLength={5} maxLength={300} placeholder="El BCV no publicó a las 4:50 p. m.; tomada de la gaceta" className={campo} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente} className="inline-flex h-9 items-center rounded-lg bg-[#2b2a28] px-3.5 text-xs font-semibold text-white hover:bg-marca-700 disabled:opacity-60">
          {pendiente ? 'Cargando…' : 'Cargar la tasa'}
        </button>
        <p className="text-[11.5px] text-marca-400">Nada se edita: si ya hay una vigente con esa fecha valor, queda reemplazada y enlazada a esta.</p>
      </div>
      {estado?.error && (
        <p role="alert" className="text-xs text-acento-700 sm:col-span-2">
          {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p role="status" className="text-xs text-[#1f6f4b] sm:col-span-2">
          ✓ {estado.ok}
        </p>
      )}
    </form>
  )
}
