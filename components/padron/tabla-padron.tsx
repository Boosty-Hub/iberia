'use client'

import { useState } from 'react'
import {
  acunarEnlaces,
  enlazarCuenta,
  mandarEnlaces,
  marcarEnlacesMandados,
  matricularSeleccionados,
} from '@/app/dashboard/empleados/acciones'

export type Fila = {
  id: string
  nombre: string
  cedula: string
  cargo: string | null
  area: string | null
  nivel: string
  telefono: string | null
  activo: boolean
  familia: string
  matriculado: boolean
  leccionesHechas: number
  tieneEnlace: boolean
  enlaceMandado: boolean
  entradas: number
  /** El número de ficha de Capital Humano. Sin número, se cargó a mano. */
  ficha: string | null
  /** El correo de la cuenta enlazada, si la tiene. */
  cuenta: string | null
  /** Ficha de muestra que repite a una de Capital Humano: se usa aquella. */
  duplicada: { nombre: string; ficha: string } | null
  /** Una cuenta de Iberia sin ficha cuyo nombre coincide con esta. */
  cuentaPropuesta: { id: string; email: string } | null
}

/**
 * El padrón con selección múltiple.
 *
 * Es cliente y no servidor por una sola razón: **la selección**. Doscientas
 * personas no se enrolan de una en una, y marcar de a uno recargando la página
 * cada vez sería un trabajo de tarde entera.
 *
 * La barra de acciones aparece solo cuando hay algo marcado, y va pegada abajo:
 * al seleccionar cuarenta filas la cabecera ya no se ve, y un botón que hay que
 * ir a buscar arriba es un botón que se toca a ciegas.
 *
 * **Quien no tiene teléfono no se puede seleccionar para mandar**, y por eso la
 * casilla sigue disponible —para matricularlo— pero la barra avisa a cuántos de
 * los marcados no se les va a poder mandar nada. Enterarse después de darle al
 * botón es enterarse tarde.
 */
export function TablaPadron({
  gente,
  whatsappListo,
}: {
  gente: Fila[]
  whatsappListo: boolean
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())

  // Una ficha de muestra repetida no se marca: se matricula la de Capital Humano.
  const seleccionables = gente.filter((p) => p.activo && !p.duplicada)
  const todosMarcados = seleccionables.length > 0 && marcados.size === seleccionables.length

  function alternar(id: string) {
    setMarcados((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  function alternarTodos() {
    setMarcados(todosMarcados ? new Set() : new Set(seleccionables.map((p) => p.id)))
  }

  const elegidos = gente.filter((p) => marcados.has(p.id))
  const sinTelefono = elegidos.filter((p) => !p.telefono).length
  const sinMatricula = elegidos.filter((p) => !p.matriculado).length
  // A quien ya tiene una cuenta que coincide no se le acuña: se enlaza.
  const porEnlazar = elegidos.filter((p) => !p.cuenta && p.cuentaPropuesta).length
  const sinEnlace = elegidos.filter((p) => !p.tieneEnlace && !(!p.cuenta && p.cuentaPropuesta)).length
  const sinMandar = elegidos.filter((p) => p.tieneEnlace && !p.enlaceMandado).length

  return (
    <>
      <div className="tarjeta overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--borde)] bg-marca-50/60 text-left">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={alternarTodos}
                  aria-label="Marcar a todos"
                  className="h-4 w-4"
                />
              </th>
              <th className="px-3 py-3 font-semibold text-marca-700">Persona</th>
              <th className="px-3 py-3 font-semibold text-marca-700">Teléfono</th>
              <th className="px-3 py-3 font-semibold text-marca-700">Curso</th>
              <th className="px-3 py-3 font-semibold text-marca-700">Enlace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--borde)]">
            {gente.map((persona) => (
              <tr key={persona.id} className={marcados.has(persona.id) ? 'bg-acento-50/40' : ''}>
                <td className="px-4 py-3 align-top">
                  <input
                    type="checkbox"
                    checked={marcados.has(persona.id)}
                    onChange={() => alternar(persona.id)}
                    disabled={!persona.activo || Boolean(persona.duplicada)}
                    aria-label={`Marcar a ${persona.nombre}`}
                    className="h-4 w-4"
                  />
                </td>

                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-marca-900">{persona.nombre}</p>
                  <p className="text-[13px] text-marca-500">
                    {persona.cargo ?? 'Sin cargo'}
                    {persona.area ? ` · ${persona.area}` : ''}
                  </p>
                  <p className="text-[12px] text-marca-400">
                    {persona.ficha ? `Ficha ${persona.ficha}` : 'Cargada a mano'}
                    {persona.cedula && ` · ${persona.cedula}`} · {persona.nivel} · {persona.familia}
                    {!persona.activo && ' · inactivo'}
                  </p>
                  {/* De quién es la cuenta: matricular una ficha sin cuenta no le
                      abre el curso a nadie, y una ficha puede tener la cuenta del
                      enlace o la del correo de la persona. */}
                  <p className="text-[12px] text-marca-500" data-cuenta>
                    {persona.cuenta
                      ? persona.cuenta.endsWith('@iberia.local')
                        ? 'Cuenta: la de su enlace'
                        : `Cuenta: ${persona.cuenta}`
                      : 'Sin cuenta'}
                  </p>

                  {persona.duplicada && (
                    <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] leading-relaxed text-amber-800" data-duplicada>
                      <span className="font-semibold">Ficha de muestra repetida.</span> La de Capital Humano es{' '}
                      «{persona.duplicada.nombre}», ficha {persona.duplicada.ficha}: matricula esa.
                    </p>
                  )}

                  {!persona.cuenta && persona.cuentaPropuesta && (
                    <form action={enlazarCuenta} className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5" data-cuenta-propuesta>
                      <input type="hidden" name="empleado_id" value={persona.id} />
                      <input type="hidden" name="perfil_id" value={persona.cuentaPropuesta.id} />
                      <span className="text-[12px] leading-relaxed text-amber-800">
                        Ya tiene cuenta: <span className="font-semibold">{persona.cuentaPropuesta.email}</span>. Enlázala
                        en vez de acuñarle otra.
                      </span>
                      <button type="submit" className="btn-neutro h-8 px-2.5 text-[12px]">
                        Enlazar
                      </button>
                    </form>
                  )}
                </td>

                <td className="px-3 py-3 align-top">
                  {persona.telefono ? (
                    <span className="text-marca-700 tabular-nums">{persona.telefono}</span>
                  ) : (
                    <span className="text-[13px] text-acento-700">Falta</span>
                  )}
                </td>

                <td className="px-3 py-3 align-top">
                  {persona.matriculado ? (
                    <span className="text-marca-700 tabular-nums">
                      {persona.leccionesHechas} de 9
                    </span>
                  ) : (
                    <span className="text-[13px] text-marca-400">Sin matrícula</span>
                  )}
                </td>

                <td className="px-3 py-3 align-top text-[13px]">
                  {!persona.tieneEnlace ? (
                    <span className="text-marca-400">Sin acuñar</span>
                  ) : !persona.enlaceMandado ? (
                    <span className="text-marca-700">Acuñado, sin mandar</span>
                  ) : persona.entradas === 0 ? (
                    // El dato que más dice de todos: se mandó y nadie lo tocó.
                    <span className="text-acento-700">Mandado · no ha entrado</span>
                  ) : (
                    <span className="text-marca-600 tabular-nums">
                      Entró {persona.entradas}{' '}
                      {persona.entradas === 1 ? 'vez' : 'veces'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {marcados.size > 0 && (
        <div className="sticky bottom-0 z-10 mt-4 border-t border-[var(--borde)] bg-white/95 py-4 backdrop-blur">
          <form className="flex flex-wrap items-center gap-2">
            {[...marcados].map((id) => (
              <input key={id} type="hidden" name="empleado" value={id} />
            ))}

            <span className="mr-2 text-sm font-medium text-marca-900">
              {marcados.size} marcad{marcados.size === 1 ? 'o' : 'os'}
            </span>

            <button
              type="submit"
              formAction={matricularSeleccionados}
              disabled={sinMatricula === 0}
              className="btn-acento"
            >
              Matricular {sinMatricula > 0 && `(${sinMatricula})`}
            </button>

            <button
              type="submit"
              formAction={acunarEnlaces}
              disabled={sinEnlace === 0}
              className="btn-neutro"
            >
              Acuñar enlace {sinEnlace > 0 && `(${sinEnlace})`}
            </button>

            {whatsappListo ? (
              <button
                type="submit"
                formAction={mandarEnlaces}
                disabled={sinMandar === 0}
                className="btn-acento"
              >
                Mandar por WhatsApp {sinMandar > 0 && `(${sinMandar})`}
              </button>
            ) : (
              <button
                type="submit"
                formAction={marcarEnlacesMandados}
                disabled={sinMandar === 0}
                className="btn-neutro"
              >
                Marcar mandados a mano {sinMandar > 0 && `(${sinMandar})`}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMarcados(new Set())}
              className="text-sm text-marca-500 underline"
            >
              Quitar la selección
            </button>

            {porEnlazar > 0 && (
              <p className="w-full text-[13px] text-amber-800">
                {porEnlazar} de los marcados ya tiene{porEnlazar === 1 ? '' : 'n'} cuenta: no se le acuña enlace,
                se enlaza en su fila.
              </p>
            )}

            {sinTelefono > 0 && (
              <p className="w-full text-[13px] text-acento-700">
                {sinTelefono} de los marcados no tiene teléfono: se les puede matricular y
                acuñar el enlace, pero no hay por dónde mandárselo.
              </p>
            )}
          </form>
        </div>
      )}
    </>
  )
}
