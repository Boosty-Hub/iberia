'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'
import { guardarRequisicion, ocupantesDeUnidad } from '@/app/sistema/nucleo/organizacion/requisiciones/acciones'
import { Enviar, Mensaje } from './formulario'
import { sangria } from './estructura'
import type { EstadoAccion } from './formato'

type Opcion = { clave: string; etiqueta: string }
type Ocupante = { plaza_ref: string; cargo: string; empleado_id: string; nombre: string }

export type RequisicionInicial = {
  id: string
  unidad_ref: string
  cargo_id: string
  plaza_ref: string | null
  origen: string
  reemplaza_empleado_id: string | null
  motivo_contrato: string | null
  tiempo_contrato: string | null
  cantidad: number
  tipo_nomina: string | null
  justificacion: string
  perfil: Record<string, string | null>
  condiciones: Record<string, string | null>
  fecha_deseada: string | null
}

/**
 * La Requisición de Personal II-21-40-001, digital. Lo que cambia según el
 * origen: una vacante se elige por su plaza (el cargo sale de ella) y dice a
 * quién reemplaza; un contrato a tiempo determinado lleva motivo y tiempo.
 */
export function FormularioRequisicion({
  unidades,
  plazas,
  cargos,
  origenes,
  nominas,
  familias,
  puedeCrearCargo,
  inicial,
  ocupantesIniciales = [],
  hoy,
}: {
  unidades: { ref: string; nombre: string; nivel: number }[]
  plazas: { ref: string; unidad_ref: string; cargo_id: string; cargo: string; dotacion: number; ocupadas: number }[]
  cargos: { id: string; nombre: string }[]
  origenes: Opcion[]
  nominas: Opcion[]
  familias: Opcion[]
  puedeCrearCargo: boolean
  inicial?: RequisicionInicial
  ocupantesIniciales?: Ocupante[]
  hoy: string
}) {
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(guardarRequisicion, {})
  const [unidad, setUnidad] = useState(inicial?.unidad_ref ?? '')
  const [origen, setOrigen] = useState(inicial?.origen ?? 'cargo_nuevo')
  const [plaza, setPlaza] = useState(inicial?.plaza_ref ?? '')
  const [cargoModo, setCargoModo] = useState<'catalogo' | 'nuevo'>('catalogo')
  const [fisico, setFisico] = useState(inicial?.perfil?.requisito_fisico ?? '')
  const [ocupantes, setOcupantes] = useState<Ocupante[]>(ocupantesIniciales)
  const [cargando, iniciar] = useTransition()

  const esVacante = origen.startsWith('vacante')
  const plazasUnidad = useMemo(() => plazas.filter((p) => p.unidad_ref === unidad), [plazas, unidad])

  // A quién reemplaza: se pregunta a la base al cambiar de unidad.
  useEffect(() => {
    if (!esVacante || !unidad) return
    if (inicial && unidad === inicial.unidad_ref && ocupantesIniciales.length) return
    iniciar(async () => setOcupantes(await ocupantesDeUnidad(unidad)))
  }, [esVacante, unidad, inicial, ocupantesIniciales.length])

  const candidatos = ocupantes.filter((o) => !plaza || o.plaza_ref === plaza)
  const p = (k: string) => inicial?.perfil?.[k] ?? ''
  const c = (k: string) => inicial?.condiciones?.[k] ?? ''

  return (
    <form action={enviar} className="space-y-6">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <fieldset className="tarjeta p-5 sm:p-6">
        <legend className="sr-only">Quién pide y qué</legend>
        <p className="rotulo mb-4">Quién pide y qué</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="req-unidad" className="etiqueta">
              Unidad que pide <span className="text-acento-600">*</span>
            </label>
            <select
              id="req-unidad"
              name="unidad_ref"
              required
              value={unidad}
              onChange={(e) => {
                setUnidad(e.target.value)
                setPlaza('')
              }}
              className="campo"
            >
              <option value="">Elige la dirección, gerencia o área…</option>
              {unidades.map((u) => (
                <option key={u.ref} value={u.ref}>
                  {sangria(u.nivel)}
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="req-origen" className="etiqueta">
              Origen <span className="text-acento-600">*</span>
            </label>
            <select id="req-origen" name="origen" value={origen} onChange={(e) => setOrigen(e.target.value)} className="campo">
              {origenes.map((o) => (
                <option key={o.clave} value={o.clave}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="req-cantidad" className="etiqueta">
              Cantidad de personas <span className="text-acento-600">*</span>
            </label>
            <input id="req-cantidad" name="cantidad" type="number" min={1} max={50} defaultValue={inicial?.cantidad ?? 1} className="campo" />
          </div>

          {esVacante ? (
            <>
              <div>
                <label htmlFor="req-plaza" className="etiqueta">
                  Plaza vacante que se cubre <span className="text-acento-600">*</span>
                </label>
                <select id="req-plaza" name="plaza_ref" value={plaza} onChange={(e) => setPlaza(e.target.value)} className="campo" disabled={!unidad}>
                  <option value="">{unidad ? (plazasUnidad.length ? 'Elige la plaza…' : 'Esta unidad no tiene plazas cargadas') : 'Primero elige la unidad'}</option>
                  {plazasUnidad.map((x) => (
                    <option key={x.ref} value={x.ref}>
                      {x.cargo} · {x.ocupadas} de {x.dotacion} ocupadas
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="req-reemplaza" className="etiqueta">
                  A quién reemplaza
                </label>
                <select
                  id="req-reemplaza"
                  name="reemplaza_empleado_id"
                  defaultValue={inicial?.reemplaza_empleado_id ?? ''}
                  className="campo"
                  disabled={!unidad || cargando}
                >
                  <option value="">{cargando ? 'Buscando…' : candidatos.length ? 'Nadie en particular' : 'Nadie ocupa hoy esa plaza'}</option>
                  {candidatos.map((o) => (
                    <option key={`${o.plaza_ref}-${o.empleado_id}`} value={o.empleado_id}>
                      {o.nombre} · {o.cargo}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-marca-500">Al registrar el ingreso, su ocupación se cierra con esa fecha.</p>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <span className="etiqueta">
                Cargo <span className="text-acento-600">*</span>
              </span>
              {puedeCrearCargo && (
                <div className="mb-2 flex flex-wrap gap-4 text-sm text-marca-700">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cargo_modo" value="catalogo" checked={cargoModo === 'catalogo'} onChange={() => setCargoModo('catalogo')} className="accent-[var(--color-acento-600)]" />
                    Del catálogo
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cargo_modo" value="nuevo" checked={cargoModo === 'nuevo'} onChange={() => setCargoModo('nuevo')} className="accent-[var(--color-acento-600)]" />
                    No está en el catálogo: crearlo
                  </label>
                </div>
              )}
              {cargoModo === 'catalogo' ? (
                <>
                  <select id="req-cargo" name="cargo_id" defaultValue={inicial?.cargo_id ?? ''} className="campo" aria-label="Cargo">
                    <option value="">Elige el cargo…</option>
                    {cargos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  {!puedeCrearCargo && (
                    <p className="mt-1 text-xs text-marca-500">
                      ¿El cargo no está en la lista? Pídele a Desarrollo Organizacional que lo cree en el catálogo antes de enviar, y
                      descríbelo en la justificación.
                    </p>
                  )}
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="cargo_nuevo_nombre" maxLength={120} className="campo" placeholder="Nombre del cargo nuevo" aria-label="Nombre del cargo nuevo" />
                  <select name="cargo_nuevo_familia" defaultValue="" className="campo" aria-label="Familia del cargo">
                    <option value="">Familia del cargo (opcional)</option>
                    {familias.map((f) => (
                      <option key={f.clave} value={f.clave}>
                        {f.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {origen === 'tiempo_determinado' && (
            <>
              <div>
                <label htmlFor="req-motivo" className="etiqueta">
                  Motivo del contrato <span className="text-acento-600">*</span>
                </label>
                <input id="req-motivo" name="motivo_contrato" defaultValue={inicial?.motivo_contrato ?? ''} maxLength={200} className="campo" placeholder="Suplencia por reposo, temporada alta…" />
              </div>
              <div>
                <label htmlFor="req-tiempo" className="etiqueta">
                  Tiempo <span className="text-acento-600">*</span>
                </label>
                <input id="req-tiempo" name="tiempo_contrato" defaultValue={inicial?.tiempo_contrato ?? ''} maxLength={60} className="campo" placeholder="3 meses" />
              </div>
            </>
          )}

          <div>
            <label htmlFor="req-nomina" className="etiqueta">
              Tipo de nómina
            </label>
            <select id="req-nomina" name="tipo_nomina" defaultValue={inicial?.tipo_nomina ?? ''} className="campo">
              <option value="">Sin indicar</option>
              {nominas.map((n) => (
                <option key={n.clave} value={n.clave}>
                  {n.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="req-fecha" className="etiqueta">
              Fecha deseada de ingreso
            </label>
            <input id="req-fecha" name="fecha_deseada" type="date" min={hoy} defaultValue={inicial?.fecha_deseada ?? ''} className="campo" />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="req-just" className="etiqueta">
              Justificación <span className="text-acento-600">*</span>
            </label>
            <textarea
              id="req-just"
              name="justificacion"
              required
              minLength={10}
              rows={4}
              maxLength={3000}
              defaultValue={inicial?.justificacion ?? ''}
              className="campo"
              placeholder="Por qué hace falta esta persona: qué carga de trabajo cubre, qué pasa si no se contrata"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="tarjeta p-5 sm:p-6">
        <legend className="sr-only">Perfil del cargo</legend>
        <p className="rotulo mb-4">Perfil del cargo</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="req-edu" className="etiqueta">
              Nivel educativo
            </label>
            <input id="req-edu" name="nivel_educativo" defaultValue={p('nivel_educativo')} maxLength={120} className="campo" placeholder="TSU, universitario, bachiller…" list="niveles-educativos" />
            <datalist id="niveles-educativos">
              <option value="Educación primaria" />
              <option value="Bachiller" />
              <option value="Técnico medio" />
              <option value="TSU" />
              <option value="Universitario" />
              <option value="Postgrado" />
            </datalist>
          </div>
          <div>
            <label htmlFor="req-esp" className="etiqueta">
              Especialidad
            </label>
            <input id="req-esp" name="especialidad" defaultValue={p('especialidad')} maxLength={120} className="campo" placeholder="Ingeniería de alimentos, contaduría…" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="req-con" className="etiqueta">
              Conocimientos y habilidades
            </label>
            <textarea id="req-con" name="conocimientos" rows={3} maxLength={2000} defaultValue={p('conocimientos')} className="campo" placeholder="Lo que tiene que saber hacer desde el primer día" />
          </div>
          <div className="md:col-span-2 rounded-xl border border-marca-200/70 bg-marca-50/60 p-4">
            <label htmlFor="req-fis" className="etiqueta">
              Requisito físico del puesto <span className="font-normal text-marca-500">· opcional</span>
            </label>
            <input
              id="req-fis"
              name="requisito_fisico"
              value={fisico}
              onChange={(e) => setFisico(e.target.value)}
              maxLength={200}
              className="campo"
              placeholder="Por ejemplo: cargar sacos de 25 kg durante la jornada"
            />
            {fisico.trim() && (
              <div className="mt-3">
                <label htmlFor="req-fisj" className="etiqueta">
                  Por qué el puesto lo exige <span className="text-acento-600">*</span>
                </label>
                <textarea id="req-fisj" name="requisito_fisico_justificacion" rows={2} maxLength={1000} defaultValue={p('requisito_fisico_justificacion')} className="campo" />
              </div>
            )}
            <p className="mt-2 text-xs text-pretty text-marca-500">
              La requisición no pide edad, sexo, estatura ni peso: pedirlos como requisito choca con la prohibición de discriminación
              de la LOTTT (decisión E1-04). Si el puesto exige algo físico, se describe la tarea y se justifica.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="tarjeta p-5 sm:p-6">
        <legend className="sr-only">Condiciones del cargo</legend>
        <p className="rotulo mb-4">Condiciones del cargo</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="req-turnos" className="etiqueta">
              Turnos
            </label>
            <input id="req-turnos" name="turnos" defaultValue={c('turnos')} maxLength={120} className="campo" list="turnos-opciones" placeholder="Diurno, rotativo…" />
            <datalist id="turnos-opciones">
              <option value="Diurno" />
              <option value="Nocturno" />
              <option value="Mixto" />
              <option value="Rotativo" />
            </datalist>
          </div>
          <div>
            <label htmlFor="req-postura" className="etiqueta">
              De pie o sentado
            </label>
            <select id="req-postura" name="postura" defaultValue={c('postura')} className="campo">
              <option value="">Sin indicar</option>
              <option value="de_pie">De pie</option>
              <option value="sentado">Sentado</option>
              <option value="alterna">Alterna</option>
            </select>
          </div>
          <div>
            <label htmlFor="req-carga" className="etiqueta">
              Carga
            </label>
            <input id="req-carga" name="carga" defaultValue={c('carga')} maxLength={120} className="campo" placeholder="Levanta hasta 25 kg, no carga…" />
          </div>
        </div>
      </fieldset>

      <Mensaje estado={estado} />
      <div className="flex flex-wrap items-center gap-3">
        <Enviar pendiente="Guardando…">{inicial ? 'Guardar los cambios' : 'Guardar el borrador'}</Enviar>
        <Link href={inicial ? `/sistema/nucleo/organizacion/requisiciones/${inicial.id}` : '/sistema/nucleo/organizacion/requisiciones'} className="btn-neutro h-10">
          Cancelar
        </Link>
        <p className="text-xs text-marca-500">Al guardar ves el impacto antes de enviarla a aprobación.</p>
      </div>
    </form>
  )
}
