'use client'

import { useActionState, useState } from 'react'
import { actualizarCruce, type EstadoAccion } from '@/app/sistema/nucleo/procesos/acciones'
import { TIPOS_CRUCE } from './comun'
import { Enviar, Mensaje } from './formularios'

/** Los controles de un cruce: tipo, confirmado y nota. Guarda con auditoría. */
export function CruceControles({
  cruce,
  editable,
}: {
  cruce: { id: string; tipo: string; confirmado: boolean; nota: string | null }
  editable: boolean
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(actualizarCruce, {})
  const [tipo, setTipo] = useState(cruce.tipo)
  const [confirmado, setConfirmado] = useState(cruce.confirmado)
  const [nota, setNota] = useState(cruce.nota ?? '')
  const cambiado = tipo !== cruce.tipo || confirmado !== cruce.confirmado || nota !== (cruce.nota ?? '')
  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={cruce.id} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-marca-600">
          <span className="sr-only">Tipo de cruce</span>
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!editable} className="campo h-10 w-40 py-1.5">
            {Object.entries(TIPOS_CRUCE).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm text-marca-700">
          <input
            type="checkbox"
            name="confirmado"
            value="si"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            disabled={!editable}
            className="h-4 w-4 accent-[var(--color-acento-600)]"
          />
          Confirmado
        </label>
      </div>
      <textarea
        name="nota"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        disabled={!editable}
        rows={2}
        placeholder="Nota del cruce"
        className="campo text-xs"
        aria-label="Nota del cruce"
      />
      {editable && cambiado && <Enviar texto="Guardar" pendiente="Guardando…" clase="btn-primario h-9 px-3 text-xs" />}
      <Mensaje estado={estado} />
    </form>
  )
}
