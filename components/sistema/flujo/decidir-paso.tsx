'use client'

import { useId } from 'react'
import { decidirPaso } from '@/app/sistema/bandeja/acciones'
import { IconoAlerta } from '@/components/iconos'
import { Enviar, FormAccion } from './formulario'
import { ACCION_PASO } from './formato'

/**
 * Aprobar, devolver o rechazar el paso que te toca. El comentario es opcional
 * para aprobar y obligatorio para devolver o rechazar (lo exige también la base).
 * En el paso «completar» de una requisición se piden el candidato y la fecha.
 */
export function DecidirPaso({
  pasoId,
  accion,
  nombre,
  requisicionId,
  candidato,
  fechaIngreso,
  compacto,
}: {
  pasoId: string
  accion: string
  nombre: string
  requisicionId?: string
  candidato?: string | null
  fechaIngreso?: string | null
  compacto?: boolean
}) {
  const id = useId()
  const completar = accion === 'completar' && Boolean(requisicionId)
  return (
    <FormAccion accion={decidirPaso} className={compacto ? '' : 'tarjeta border-acento-200 p-5'}>
      <input type="hidden" name="paso" value={pasoId} />
      {requisicionId && <input type="hidden" name="requisicion" value={requisicionId} />}
      {!compacto && (
        <>
          <p className="rotulo mb-1">Te toca decidir</p>
          <p className="mb-4 text-sm font-semibold text-marca-900">{nombre}</p>
        </>
      )}
      {completar && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-cand`} className="etiqueta">
              Candidato seleccionado <span className="text-acento-600">*</span>
            </label>
            <input id={`${id}-cand`} name="candidato" defaultValue={candidato ?? ''} maxLength={120} className="campo" placeholder="Nombre y apellido" />
          </div>
          <div>
            <label htmlFor={`${id}-fecha`} className="etiqueta">
              Fecha de ingreso <span className="text-acento-600">*</span>
            </label>
            <input id={`${id}-fecha`} name="fecha_ingreso" type="date" defaultValue={fechaIngreso ?? ''} className="campo" />
          </div>
        </div>
      )}
      <label htmlFor={`${id}-com`} className="etiqueta">
        Comentario <span className="font-normal text-marca-500">· obligatorio para devolver o rechazar</span>
      </label>
      <textarea id={`${id}-com`} name="comentario" rows={compacto ? 2 : 3} maxLength={1000} className="campo" placeholder="Lo que quien pidió debe saber" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Enviar name="decision" value="aprobado" pendiente="Enviando…">
          {ACCION_PASO[accion]?.boton ?? 'Aprobar'}
        </Enviar>
        <Enviar name="decision" value="devuelto" clase="btn-neutro" pendiente="Enviando…">
          Devolver
        </Enviar>
        <Enviar name="decision" value="rechazado" clase="btn-peligro" pendiente="Enviando…" confirmar="¿Rechazar? La solicitud se cierra y no sigue la ruta.">
          <IconoAlerta className="h-4 w-4" />
          Rechazar
        </Enviar>
      </div>
    </FormAccion>
  )
}
