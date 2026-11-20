'use client'

import { useActionState } from 'react'
import { aprobarPlan, guardarLineas, nuevoPlan } from '@/app/sistema/nucleo/organizacion/dotacion/acciones'
import type { Estado } from '@/components/sistema/organizacion/formulario'
import { cn } from '@/lib/utils'

/**
 * Las versiones del plan de dotación de un año: abrir la siguiente (copia la
 * última, o la dotación de hoy si es la primera), agregar una línea que no está
 * en la tabla y aprobar el borrador (queda congelado). Las cantidades de las
 * líneas que ya existen se editan en la celda «Plan en borrador» de la tabla.
 */

export type VersionPlan = { id: string; anio: number; version: number; estado: string; aprobadoEn: string | null; aprobadoPor: string | null; lineas: number; total: number; nota: string | null }

const CAMPO = 'h-8 w-full rounded-md border border-[var(--borde)] bg-white px-2 text-[13px] outline-none focus:border-marca-500'
const BTN = 'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold disabled:opacity-60'
const ESTADO: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: 'Borrador', clase: 'bg-[#f1edfa] text-[#5a3f9e]' },
  aprobado: { texto: 'Aprobado · congelado', clase: 'bg-[#e7f5ee] text-[#1f6f4b]' },
  reemplazado: { texto: 'Reemplazado', clase: 'bg-[#eef0f3] text-marca-600' },
}

function Mensaje({ e }: { e: Estado }) {
  if (e.error)
    return (
      <p role="alert" className="mt-1.5 rounded-md bg-[#fbeceb] px-2 py-1 text-[12px] text-[#a3241f]">
        {e.error}
      </p>
    )
  if (e.ok)
    return (
      <p role="status" className="mt-1.5 rounded-md bg-[#e7f5ee] px-2 py-1 text-[12px] text-[#1f6f4b]">
        ✓ {e.ok}
      </p>
    )
  return null
}

export function PlanVersiones({
  anio,
  versiones,
  editar,
  unidades,
  cargos,
}: {
  anio: number
  versiones: VersionPlan[]
  editar: boolean
  unidades: { valor: string; etiqueta: string }[]
  cargos: { valor: string; etiqueta: string }[]
}) {
  const [eNuevo, nuevo, pNuevo] = useActionState(nuevoPlan, {})
  const [eAprobar, aprobar, pAprobar] = useActionState(aprobarPlan, {})
  const [eLinea, linea, pLinea] = useActionState(guardarLineas, {})
  const borrador = versiones.find((v) => v.anio === anio && v.estado === 'borrador')

  return (
    <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
      <h2 className="text-[13px] font-semibold text-marca-800">Plan de dotación {anio}: versiones</h2>
      <p className="mb-3 text-[12px] text-marca-500">Una versión aprobada no se toca: el cambio es una versión nueva. Al aprobar una, la anterior del mismo año queda reemplazada.</p>
      {versiones.length ? (
        <ul className="mb-3 divide-y divide-[var(--borde)] rounded-lg border border-[var(--borde)]">
          {versiones.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[12.5px]">
              <span className="font-semibold text-marca-900">
                {v.anio} · v{v.version}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ESTADO[v.estado]?.clase)}>{ESTADO[v.estado]?.texto ?? v.estado}</span>
              <span className="text-marca-600 tabular-nums">
                {v.lineas} líneas · {v.total} puestos
              </span>
              {v.aprobadoEn && (
                <span className="text-marca-400">
                  aprobado el {v.aprobadoEn}
                  {v.aprobadoPor ? ` por ${v.aprobadoPor}` : ''}
                </span>
              )}
              {v.nota && <span className="w-full text-[11.5px] text-marca-500">{v.nota}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[12.5px] text-marca-400">Todavía no hay plan para {anio}.</p>
      )}

      {editar && (
        <div className="flex flex-col gap-3">
          {!borrador && (
            <form action={nuevo}>
              <input type="hidden" name="anio" value={anio} />
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[12px] text-marca-600">
                  Nota de la versión (opcional)
                  <input name="nota" maxLength={300} className={CAMPO} placeholder="Qué cambia y por qué" />
                </label>
                <button type="submit" disabled={pNuevo} className={cn(BTN, 'bg-[#2b2a28] text-white hover:bg-marca-700')}>
                  {pNuevo ? 'Abriendo…' : 'Abrir versión en borrador'}
                </button>
              </div>
              <Mensaje e={eNuevo} />
            </form>
          )}
          {borrador && (
            <>
              <p className="rounded-md bg-[#f1edfa] px-2.5 py-1.5 text-[12px] text-[#5a3f9e]">
                Hay un borrador (v{borrador.version}): edita sus cantidades en la columna «Plan en borrador» de la tabla, o agrega una línea aquí.
              </p>
              <form action={linea} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
                <input type="hidden" name="plan" value={borrador.id} />
                <label className="flex min-w-0 flex-col gap-0.5 text-[12px] text-marca-600">
                  Unidad
                  <select name="nueva_unidad" className={CAMPO} defaultValue="">
                    <option value="">Elige…</option>
                    {unidades.map((u) => (
                      <option key={u.valor} value={u.valor}>
                        {u.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-0.5 text-[12px] text-marca-600">
                  Cargo
                  <select name="nuevo_cargo" className={CAMPO} defaultValue="">
                    <option value="">Elige…</option>
                    {cargos.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
                  Cantidad
                  <input name="nueva_cantidad" type="number" min={0} max={9999} className={CAMPO} />
                </label>
                <button type="submit" disabled={pLinea} className={cn(BTN, 'border border-[var(--borde)] bg-white text-marca-800 hover:bg-marca-50')}>
                  {pLinea ? 'Guardando…' : 'Agregar línea'}
                </button>
              </form>
              <Mensaje e={eLinea} />
              <form action={aprobar} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="plan" value={borrador.id} />
                <label className="flex items-center gap-1.5 text-[12px] text-marca-700">
                  <input type="checkbox" name="confirmo" className="h-4 w-4" /> Entiendo que la versión aprobada queda congelada.
                </label>
                <button type="submit" disabled={pAprobar} className={cn(BTN, 'bg-[#D4332C] text-white hover:bg-acento-700')}>
                  {pAprobar ? 'Aprobando…' : `Aprobar v${borrador.version}`}
                </button>
              </form>
              <Mensaje e={eAprobar} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
