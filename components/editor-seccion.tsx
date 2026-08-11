'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { EstadoSeccion } from '@/app/dashboard/informe/acciones'
import { IconoCheck } from '@/components/iconos'
import { Markdown } from '@/components/markdown'
import {
  PARTES_INFORME,
  PARTES_INFORME_ORDEN,
  type InformeSeccion,
} from '@/lib/types'

type Accion = (anterior: EstadoSeccion, fd: FormData) => Promise<EstadoSeccion>

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar sección'}
    </button>
  )
}

export function EditorSeccion({
  accion,
  seccion,
  cancelarHref,
}: {
  accion: Accion
  seccion?: InformeSeccion
  cancelarHref: string
}) {
  const [estado, enviar] = useActionState<EstadoSeccion, FormData>(accion, {})
  const [contenido, setContenido] = useState(seccion?.contenido_md ?? '')
  const [vista, setVista] = useState<'escribir' | 'previa'>('escribir')
  const esEdicion = !!seccion

  return (
    <form action={enviar} className="space-y-6">
      {esEdicion && <input type="hidden" name="id" value={seccion.id} />}

      <section className="tarjeta p-5">
        <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
          <div>
            <label htmlFor="numero" className="etiqueta">
              Número
            </label>
            <input
              id="numero"
              name="numero"
              defaultValue={seccion?.numero ?? ''}
              placeholder="01"
              className="campo font-mono"
            />
          </div>

          <div>
            <label htmlFor="titulo" className="etiqueta">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              id="titulo"
              name="titulo"
              required
              defaultValue={seccion?.titulo ?? ''}
              placeholder="Cuellos de botella y trabajo manual"
              className="campo"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="subtitulo" className="etiqueta">
              Subtítulo
            </label>
            <input
              id="subtitulo"
              name="subtitulo"
              defaultValue={seccion?.subtitulo ?? ''}
              placeholder="Dónde se pierde tiempo y trazabilidad"
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="orden" className="etiqueta">
              Orden
            </label>
            <input
              id="orden"
              name="orden"
              type="number"
              defaultValue={seccion?.orden ?? 100}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="parte" className="etiqueta">
              Parte del informe
            </label>
            <select
              id="parte"
              name="parte"
              defaultValue={seccion?.parte ?? 'levantamiento'}
              className="campo"
            >
              {PARTES_INFORME_ORDEN.map((p) => (
                <option key={p} value={p}>
                  {PARTES_INFORME[p]}
                </option>
              ))}
            </select>
          </div>

          {!esEdicion && (
            <div className="sm:col-span-2">
              <label htmlFor="slug" className="etiqueta">
                URL de la sección
              </label>
              <input
                id="slug"
                name="slug"
                placeholder="Se genera del título si lo dejas vacío"
                className="campo font-mono"
              />
            </div>
          )}
        </div>
      </section>

      {/* Contenido */}
      <section className="tarjeta">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--borde)] px-5 py-3">
          <h2 className="text-sm font-semibold text-marca-800">Contenido</h2>

          <div className="flex gap-1 rounded-md bg-marca-100 p-0.5 text-xs">
            {(['escribir', 'previa'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  vista === v ? 'bg-white text-marca-800 shadow-sm' : 'text-marca-600'
                }`}
              >
                {v === 'escribir' ? 'Escribir' : 'Vista previa'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {vista === 'escribir' ? (
            <>
              <textarea
                name="contenido_md"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={22}
                placeholder={
                  '## El flujo del pedido al cobro\n\n' +
                  'Texto en **markdown**. Se admiten tablas, listas y citas:\n\n' +
                  '| Área | Cuello de botella | Impacto |\n' +
                  '| --- | --- | --- |\n' +
                  '| Planificación | Reporte manual en Excel | Alto |\n\n' +
                  '> «Me toma como hora y media cada mañana.»\n'
                }
                className="campo resize-y font-mono text-[13px] leading-relaxed"
              />
              <p className="mt-2 text-xs text-marca-500">
                Markdown con tablas, listas, citas y enlaces. La vista previa muestra
                exactamente cómo se verá en el informe.
              </p>
            </>
          ) : contenido.trim() ? (
            <Markdown contenido={contenido} />
          ) : (
            <p className="py-10 text-center text-sm text-marca-500">
              Todavía no hay contenido que previsualizar.
            </p>
          )}

          {/* El textarea controlado no se envía si está oculto: se replica aquí. */}
          {vista === 'previa' && (
            <input type="hidden" name="contenido_md" value={contenido} />
          )}
        </div>
      </section>

      <section className="tarjeta p-5">
        <label className="flex items-start gap-2.5 text-sm text-marca-700">
          <input
            type="checkbox"
            name="publicado"
            defaultChecked={seccion?.publicado ?? false}
            className="mt-0.5 accent-acento-600"
          />
          <span>
            <strong className="font-medium text-marca-800">Publicar esta sección</strong>
            <span className="mt-0.5 block text-xs text-marca-500">
              Mientras esté sin publicar, solo el equipo de Boosty la ve. Los lectores de
              Iberia únicamente acceden a las secciones publicadas.
            </span>
          </span>
        </label>
      </section>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {estado.error}
        </p>
      )}

      {estado.ok && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <IconoCheck className="h-4 w-4 shrink-0" />
          Sección guardada.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <BotonGuardar />
        <Link href={cancelarHref} className="btn-neutro">
          Volver al informe
        </Link>
      </div>
    </form>
  )
}
