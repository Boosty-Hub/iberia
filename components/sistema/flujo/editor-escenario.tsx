'use client'

import { useState } from 'react'
import {
  agregarPlaza,
  agregarUnidad,
  cambiarDotacion,
  cerrarPlaza,
  cerrarUnidad,
  moverUnidad,
  renombrarUnidad,
} from '@/app/sistema/nucleo/escenarios/acciones'
import { IconoBasura, IconoCheck, IconoEditar, IconoMas } from '@/components/iconos'
import { Insignia } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Enviar, FormAccion } from './formulario'
import { sangria } from './estructura'

type Opcion = { clave: string; etiqueta: string }
export type UnidadEscenario = { ref: string; nombre: string; tipo: string; padre_ref: string | null; nivel: number }
export type PlazaEscenario = {
  ref: string
  unidad_ref: string
  cargo_id: string
  cargo: string
  reporta_a_ref: string | null
  dotacion: number
  /** Dotación en la realidad a la fecha base; null si la plaza es nueva. */
  real: number | null
  ocupadas: number
}

/**
 * El árbol del escenario, editable: renombrar, mover, agregar y cerrar unidades;
 * agregar plazas, cambiar su dotación y cerrarlas. Cada cambio es una acción de
 * servidor sobre las filas del escenario; la realidad no se toca.
 */
export function EditorEscenario({
  escenario,
  editable,
  unidades,
  plazas,
  cargos,
  tiposUnidad,
  nominas,
}: {
  escenario: string
  editable: boolean
  unidades: UnidadEscenario[]
  plazas: PlazaEscenario[]
  cargos: { id: string; nombre: string }[]
  tiposUnidad: Opcion[]
  nominas: Opcion[]
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const tipo = Object.fromEntries(tiposUnidad.map((t) => [t.clave, t.etiqueta]))
  const porUnidad = new Map<string, PlazaEscenario[]>()
  for (const p of plazas) {
    if (!porUnidad.has(p.unidad_ref)) porUnidad.set(p.unidad_ref, [])
    porUnidad.get(p.unidad_ref)!.push(p)
  }
  const etiquetaPlaza = (p: PlazaEscenario) => `${p.cargo} · ${unidades.find((u) => u.ref === p.unidad_ref)?.nombre ?? ''}`

  return (
    <ul className="tarjeta divide-y divide-[var(--borde)] overflow-hidden">
      {unidades.map((u) => {
        const suyas = (porUnidad.get(u.ref) ?? []).slice().sort((a, b) => a.cargo.localeCompare(b.cargo, 'es'))
        const total = suyas.reduce((s, p) => s + p.dotacion, 0)
        const cambia = suyas.some((p) => p.real !== p.dotacion)
        const abiertaEsta = abierta === u.ref
        return (
          <li key={u.ref} className="px-4 py-3 sm:px-5">
            <details open={u.nivel === 0} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2" style={{ paddingLeft: `${Math.min(u.nivel, 6) * 1.1}rem` }}>
                <span aria-hidden className="inline-block w-3 text-marca-400 transition-transform group-open:rotate-90">
                  ›
                </span>
                <span className="font-semibold text-marca-900">{u.nombre}</span>
                <Insignia tono="neutro">{tipo[u.tipo] ?? u.tipo}</Insignia>
                <span className={cn('text-xs tabular-nums', cambia ? 'font-semibold text-acento-700' : 'text-marca-500')}>
                  {suyas.length} {suyas.length === 1 ? 'plaza' : 'plazas'} · dotación {total}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setAbierta(abiertaEsta ? null : u.ref)
                    }}
                    className="btn-neutro ml-auto h-8 px-3 text-xs"
                    aria-expanded={abiertaEsta}
                  >
                    <IconoEditar className="h-3.5 w-3.5" />
                    {abiertaEsta ? 'Cerrar edición' : 'Editar unidad'}
                  </button>
                )}
              </summary>

              <div className="mt-2" style={{ paddingLeft: `${Math.min(u.nivel, 6) * 1.1}rem` }}>
                {suyas.length ? (
                  <ul className="space-y-1">
                    {suyas.map((p) => (
                      <li key={p.ref} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-marca-50">
                        <span className="min-w-0 flex-1 text-marca-800">
                          {p.cargo}
                          {p.real === null && <Insignia tono="acento" className="ml-2">Nueva</Insignia>}
                          {p.real !== null && p.real !== p.dotacion && (
                            <span className="ml-2 text-xs text-acento-700">
                              antes {p.real} ({p.dotacion - p.real > 0 ? '+' : ''}
                              {p.dotacion - p.real})
                            </span>
                          )}
                          {p.ocupadas > p.dotacion && <span className="ml-2 text-xs text-amber-700">{p.ocupadas} ocupadas hoy</span>}
                        </span>
                        {editable ? (
                          <>
                            <FormAccion accion={cambiarDotacion} className="flex items-center gap-1" mensajeClase="mt-0 py-1 text-xs">
                              <input type="hidden" name="escenario" value={escenario} />
                              <input type="hidden" name="ref" value={p.ref} />
                              <label className="sr-only" htmlFor={`dot-${p.ref}`}>
                                Dotación de {p.cargo}
                              </label>
                              <input id={`dot-${p.ref}`} name="dotacion" type="number" min={0} max={999} defaultValue={p.dotacion} className="campo h-8 w-20 px-2 py-1 text-sm" />
                              <Enviar clase="btn-neutro" className="h-8 px-2" pendiente="…">
                                <IconoCheck className="h-3.5 w-3.5" />
                                <span className="sr-only">Guardar dotación</span>
                              </Enviar>
                            </FormAccion>
                            <FormAccion accion={cerrarPlaza} mensajeClase="mt-0 py-1 text-xs">
                              <input type="hidden" name="escenario" value={escenario} />
                              <input type="hidden" name="ref" value={p.ref} />
                              <Enviar clase="btn-peligro" className="h-8 px-2" pendiente="…" confirmar={`¿Cerrar la plaza de ${p.cargo} en el escenario?`}>
                                <IconoBasura className="h-3.5 w-3.5" />
                                <span className="sr-only">Cerrar la plaza</span>
                              </Enviar>
                            </FormAccion>
                          </>
                        ) : (
                          <span className="text-xs text-marca-600 tabular-nums">dotación {p.dotacion}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 text-xs text-marca-500">Sin plazas.</p>
                )}

                {editable && abiertaEsta && (
                  <div className="mt-3 grid gap-3 rounded-xl border border-marca-200/70 bg-marca-50/50 p-4 lg:grid-cols-2">
                    <FormAccion accion={renombrarUnidad} className="space-y-2">
                      <input type="hidden" name="escenario" value={escenario} />
                      <input type="hidden" name="ref" value={u.ref} />
                      <p className="text-xs font-semibold text-marca-700">Renombrar o cambiar el tipo</p>
                      <input name="nombre" defaultValue={u.nombre} maxLength={120} className="campo" aria-label="Nombre de la unidad" />
                      <select name="tipo" defaultValue={u.tipo} className="campo" aria-label="Tipo de unidad">
                        {tiposUnidad.map((t) => (
                          <option key={t.clave} value={t.clave}>
                            {t.etiqueta}
                          </option>
                        ))}
                      </select>
                      <Enviar clase="btn-primario">Guardar</Enviar>
                    </FormAccion>

                    <FormAccion accion={moverUnidad} className="space-y-2">
                      <input type="hidden" name="escenario" value={escenario} />
                      <input type="hidden" name="ref" value={u.ref} />
                      <p className="text-xs font-semibold text-marca-700">Mover: depende de</p>
                      <select name="padre_ref" defaultValue={u.padre_ref ?? ''} className="campo" aria-label="Unidad de la que depende">
                        <option value="">Ninguna (es la raíz)</option>
                        {unidades
                          .filter((x) => x.ref !== u.ref)
                          .map((x) => (
                            <option key={x.ref} value={x.ref}>
                              {sangria(x.nivel)}
                              {x.nombre}
                            </option>
                          ))}
                      </select>
                      <Enviar clase="btn-primario">Mover</Enviar>
                    </FormAccion>

                    <FormAccion accion={agregarPlaza} className="space-y-2">
                      <input type="hidden" name="escenario" value={escenario} />
                      <input type="hidden" name="unidad_ref" value={u.ref} />
                      <p className="text-xs font-semibold text-marca-700">Agregar una plaza</p>
                      <select name="cargo_id" defaultValue="" className="campo" aria-label="Cargo de la plaza">
                        <option value="">Cargo…</option>
                        {cargos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="dotacion" type="number" min={0} max={999} defaultValue={1} className="campo" aria-label="Dotación" />
                        <select name="tipo_nomina" defaultValue="" className="campo" aria-label="Tipo de nómina">
                          <option value="">Nómina…</option>
                          {nominas.map((n) => (
                            <option key={n.clave} value={n.clave}>
                              {n.etiqueta}
                            </option>
                          ))}
                        </select>
                      </div>
                      <select name="reporta_a_ref" defaultValue={suyas[0]?.ref ?? ''} className="campo" aria-label="Reporta a">
                        <option value="">Reporta a… (ninguna)</option>
                        {plazas.map((p) => (
                          <option key={p.ref} value={p.ref}>
                            {etiquetaPlaza(p)}
                          </option>
                        ))}
                      </select>
                      <Enviar>
                        <IconoMas className="h-4 w-4" />
                        Agregar plaza
                      </Enviar>
                    </FormAccion>

                    <FormAccion accion={agregarUnidad} className="space-y-2">
                      <input type="hidden" name="escenario" value={escenario} />
                      <input type="hidden" name="padre_ref" value={u.ref} />
                      <p className="text-xs font-semibold text-marca-700">Agregar una unidad debajo</p>
                      <input name="nombre" maxLength={120} className="campo" placeholder="Nombre de la unidad nueva" aria-label="Nombre de la unidad nueva" />
                      <select name="tipo" defaultValue="" className="campo" aria-label="Tipo de la unidad nueva">
                        <option value="">Tipo…</option>
                        {tiposUnidad.map((t) => (
                          <option key={t.clave} value={t.clave}>
                            {t.etiqueta}
                          </option>
                        ))}
                      </select>
                      <Enviar>
                        <IconoMas className="h-4 w-4" />
                        Agregar unidad
                      </Enviar>
                    </FormAccion>

                    <FormAccion accion={cerrarUnidad} className="lg:col-span-2">
                      <input type="hidden" name="escenario" value={escenario} />
                      <input type="hidden" name="ref" value={u.ref} />
                      <Enviar clase="btn-peligro" pendiente="Cerrando…" confirmar={`¿Cerrar «${u.nombre}» en el escenario, con sus plazas?`}>
                        <IconoBasura className="h-4 w-4" />
                        Cerrar esta unidad en el escenario
                      </Enviar>
                    </FormAccion>
                  </div>
                )}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
