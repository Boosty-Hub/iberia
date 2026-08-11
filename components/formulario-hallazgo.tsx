'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { OpcionesArea } from '@/components/ui'
import { nombreSesion } from '@/lib/utils'
import { useFormStatus } from 'react-dom'
import type { EstadoFormularioHallazgo } from '@/app/dashboard/hallazgos/acciones'
import {
  ESTADOS_HALLAZGO,
  NIVELES,
  TIPOS_HALLAZGO,
  type Area,
  type Hallazgo,
} from '@/lib/types'

type Accion = (
  anterior: EstadoFormularioHallazgo,
  fd: FormData
) => Promise<EstadoFormularioHallazgo>

export type ValoresIniciales = {
  entrevistaId?: string | null
  segmentoId?: string | null
  cita?: string | null
  areaId?: string | null
}

function BotonGuardar({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento" disabled={pending}>
      {pending ? 'Guardando…' : etiqueta}
    </button>
  )
}

export function FormularioHallazgo({
  accion,
  areas,
  entrevistas,
  hallazgo,
  iniciales,
  cancelarHref,
}: {
  accion: Accion
  areas: Pick<Area, 'id' | 'nombre' | 'tipo'>[]
  entrevistas: { id: string; codigo: string; titulo: string | null; entrevistado_nombre: string | null }[]
  hallazgo?: Hallazgo
  iniciales?: ValoresIniciales
  cancelarHref: string
}) {
  const [estado, enviar] = useActionState<EstadoFormularioHallazgo, FormData>(accion, {})
  const esEdicion = !!hallazgo

  const entrevistaId = hallazgo?.entrevista_id ?? iniciales?.entrevistaId ?? ''
  const segmentoId = hallazgo?.segmento_id ?? iniciales?.segmentoId ?? ''
  const cita = hallazgo?.cita_textual ?? iniciales?.cita ?? ''
  const areaId = hallazgo?.area_id ?? iniciales?.areaId ?? ''

  return (
    <form action={enviar} className="space-y-6">
      {esEdicion && <input type="hidden" name="id" value={hallazgo.id} />}
      {segmentoId && <input type="hidden" name="segmento_id" value={String(segmentoId)} />}

      <section className="tarjeta p-5">
        <div className="space-y-4">
          <div>
            <label htmlFor="titulo" className="etiqueta">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              id="titulo"
              name="titulo"
              required
              defaultValue={hallazgo?.titulo ?? ''}
              placeholder="El reporte de pedidos se arma a mano cada mañana"
              className="campo"
            />
            <p className="mt-1 text-xs text-marca-500">
              Redáctalo como afirmación: qué pasa, no qué habría que hacer.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tipo" className="etiqueta">
                Tipo
              </label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={hallazgo?.tipo ?? 'cuello_botella'}
                className="campo"
              >
                {Object.entries(TIPOS_HALLAZGO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="estado" className="etiqueta">
                Estado
              </label>
              <select
                id="estado"
                name="estado"
                defaultValue={hallazgo?.estado ?? 'propuesto'}
                className="campo"
              >
                {Object.entries(ESTADOS_HALLAZGO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="impacto" className="etiqueta">
                Impacto
              </label>
              <select
                id="impacto"
                name="impacto"
                defaultValue={hallazgo?.impacto ?? ''}
                className="campo"
              >
                <option value="">Sin estimar</option>
                {Object.entries(NIVELES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="esfuerzo" className="etiqueta">
                Esfuerzo
              </label>
              <select
                id="esfuerzo"
                name="esfuerzo"
                defaultValue={hallazgo?.esfuerzo ?? ''}
                className="campo"
              >
                <option value="">Sin estimar</option>
                {Object.entries(NIVELES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="area_id" className="etiqueta">
                Área
              </label>
              <select id="area_id" name="area_id" defaultValue={areaId} className="campo">
                <option value="">Sin asignar</option>
                <OpcionesArea areas={areas} />
              </select>
            </div>

            <div>
              <label htmlFor="entrevista_id" className="etiqueta">
                Entrevista de origen
              </label>
              <select
                id="entrevista_id"
                name="entrevista_id"
                defaultValue={entrevistaId}
                className="campo"
              >
                <option value="">Ninguna</option>
                {entrevistas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {nombreSesion(e)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="descripcion" className="etiqueta">
              Descripción
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={4}
              defaultValue={hallazgo?.descripcion ?? ''}
              placeholder="El detalle: cuánto tiempo cuesta, a quién afecta, qué datos hay disponibles."
              className="campo resize-y"
            />
          </div>

          <div>
            <label htmlFor="cita_textual" className="etiqueta">
              Cita que lo respalda
            </label>
            <textarea
              id="cita_textual"
              name="cita_textual"
              rows={3}
              defaultValue={cita}
              placeholder="Lo dicho en la entrevista, en palabras del entrevistado."
              className="campo resize-y"
            />
            {segmentoId && (
              <p className="mt-1 text-xs text-acento-700">
                Vinculado al turno de la transcripción del que salió la cita.
              </p>
            )}
          </div>
        </div>
      </section>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {estado.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <BotonGuardar etiqueta={esEdicion ? 'Guardar cambios' : 'Crear hallazgo'} />
        <Link href={cancelarHref} className="btn-neutro">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
