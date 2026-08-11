'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { EstadoFormulario } from '@/app/dashboard/entrevistas/acciones'
import { OpcionesArea } from '@/components/ui'
import {
  ESTADOS_ENTREVISTA,
  ESTADO_ENTREVISTA_ORDEN,
  SEDES,
  TIPOS_SESION,
  TIPOS_SESION_ORDEN,
  type Area,
  type Entrevista,
  type TipoSesion,
} from '@/lib/types'

type Accion = (
  anterior: EstadoFormulario,
  fd: FormData
) => Promise<EstadoFormulario>

function BotonGuardar({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento" disabled={pending}>
      {pending ? 'Guardando…' : etiqueta}
    </button>
  )
}

export function FormularioEntrevista({
  accion,
  areas,
  entrevista,
  cancelarHref,
}: {
  accion: Accion
  areas: Pick<Area, 'id' | 'nombre' | 'tipo'>[]
  entrevista?: Entrevista
  cancelarHref: string
}) {
  const [estado, enviar] = useActionState<EstadoFormulario, FormData>(accion, {})
  const [tipo, setTipo] = useState<TipoSesion>(
    (entrevista?.tipo as TipoSesion) ?? 'entrevista'
  )
  const esEdicion = !!entrevista
  const esEntrevista = tipo === 'entrevista'

  return (
    <form action={enviar} className="space-y-6">
      {esEdicion && <input type="hidden" name="id" value={entrevista.id} />}

      <section className="tarjeta p-5">
        <h2 className="mb-4 text-sm font-semibold text-marca-800">Qué sesión es</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tipo" className="etiqueta">
              Tipo de sesión
            </label>
            <select
              id="tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoSesion)}
              className="campo"
            >
              {TIPOS_SESION_ORDEN.map((t) => (
                <option key={t} value={t}>
                  {TIPOS_SESION[t]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-marca-500">
              {esEntrevista
                ? 'Una entrevista se identifica por su entrevistado.'
                : 'Una reunión o visita se identifica por su título; los asistentes van en participantes.'}
            </p>
          </div>

          <div>
            <label htmlFor="titulo" className="etiqueta">
              Título de la sesión{' '}
              {!esEntrevista && <span className="text-acento-600">*</span>}
            </label>
            <input
              id="titulo"
              name="titulo"
              required={!esEntrevista}
              defaultValue={entrevista?.titulo ?? ''}
              placeholder="Visita a Cagua · Recorrido de manufactura"
              className="campo"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="entrevistado_nombre" className="etiqueta">
              Nombre del entrevistado{' '}
              {esEntrevista && <span className="text-acento-600">*</span>}
            </label>
            <input
              id="entrevistado_nombre"
              name="entrevistado_nombre"
              required={esEntrevista}
              defaultValue={entrevista?.entrevistado_nombre ?? ''}
              placeholder={esEntrevista ? 'Nombre y apellido' : 'No aplica en una sesión grupal'}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="entrevistado_cargo" className="etiqueta">
              Cargo
            </label>
            <input
              id="entrevistado_cargo"
              name="entrevistado_cargo"
              defaultValue={entrevista?.entrevistado_cargo ?? ''}
              placeholder="Gerente de Producción"
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="area_id" className="etiqueta">
              Área
            </label>
            <select
              id="area_id"
              name="area_id"
              defaultValue={entrevista?.area_id ?? ''}
              className="campo"
            >
              <option value="">Sin asignar</option>
              <OpcionesArea areas={areas} />
            </select>
          </div>

          <div>
            <label htmlFor="sede" className="etiqueta">
              Sede
            </label>
            <select
              id="sede"
              name="sede"
              defaultValue={entrevista?.sede ?? ''}
              className="campo"
            >
              <option value="">Sin especificar</option>
              {Object.entries(SEDES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fecha_entrevista" className="etiqueta">
              Fecha
            </label>
            <input
              id="fecha_entrevista"
              name="fecha_entrevista"
              type="date"
              defaultValue={entrevista?.fecha_entrevista ?? ''}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="duracion_minutos" className="etiqueta">
              Duración (minutos)
            </label>
            <input
              id="duracion_minutos"
              name="duracion_minutos"
              type="number"
              min={1}
              max={1440}
              defaultValue={entrevista?.duracion_minutos ?? ''}
              placeholder="45"
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="entrevistador" className="etiqueta">
              Entrevistador
            </label>
            <input
              id="entrevistador"
              name="entrevistador"
              defaultValue={entrevista?.entrevistador ?? ''}
              placeholder="Consultor de Boosty"
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="estado" className="etiqueta">
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={entrevista?.estado ?? 'programada'}
              className="campo"
            >
              {ESTADO_ENTREVISTA_ORDEN.map((e) => (
                <option key={e} value={e}>
                  {ESTADOS_ENTREVISTA[e]}
                </option>
              ))}
            </select>
          </div>

          {esEdicion && (
            <div>
              <label htmlFor="codigo" className="etiqueta">
                Código
              </label>
              <input
                id="codigo"
                name="codigo"
                required
                defaultValue={entrevista.codigo}
                className="campo font-mono"
              />
            </div>
          )}
        </div>

        {!esEdicion && (
          <p className="mt-3 text-xs text-marca-500">
            El código consecutivo (ENT-001, ENT-002…) se asigna automáticamente.
          </p>
        )}
      </section>

      <section className="tarjeta p-5">
        <h2 className="mb-4 text-sm font-semibold text-marca-800">Contenido</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="resumen" className="etiqueta">
              Resumen
            </label>
            <textarea
              id="resumen"
              name="resumen"
              rows={4}
              defaultValue={entrevista?.resumen ?? ''}
              placeholder="Qué se levantó en la conversación. Al importar de Fireflies se llena solo si está vacío."
              className="campo resize-y"
            />
          </div>

          <div>
            <label htmlFor="notas_consultor" className="etiqueta">
              Notas del consultor
            </label>
            <textarea
              id="notas_consultor"
              name="notas_consultor"
              rows={4}
              defaultValue={entrevista?.notas_consultor ?? ''}
              placeholder="Observaciones que no salen de la transcripción: clima, señales, pendientes."
              className="campo resize-y"
            />
          </div>

          <div>
            <label htmlFor="fireflies_url" className="etiqueta">
              Enlace en Fireflies
            </label>
            <input
              id="fireflies_url"
              name="fireflies_url"
              type="url"
              defaultValue={entrevista?.fireflies_url ?? ''}
              placeholder="https://app.fireflies.ai/view/…"
              className="campo"
            />
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
        <BotonGuardar etiqueta={esEdicion ? 'Guardar cambios' : 'Crear entrevista'} />
        <Link href={cancelarHref} className="btn-neutro">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
