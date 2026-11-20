'use client'

import { useState } from 'react'
import { agregarPaso, guardarPaso } from '@/app/sistema/administracion/aprobaciones/acciones'
import { IconoMas } from '@/components/iconos'
import { Enviar, FormAccion } from './formulario'
import { ACCION_PASO, RESOLUTOR } from './formato'

type Opcion = { id: string; nombre: string }
export type PasoRuta = {
  id: string
  orden: number
  nombre: string
  resolutor: string
  cargo_id: string | null
  plaza_ref: string | null
  rol_id: string | null
  accion: string
  condicion: Record<string, unknown> | null
  ve_costos: boolean
  hito: boolean
}

/**
 * Un paso de una ruta: quién firma (por cargo, plaza, jefe o director de la
 * unidad del objeto, o rol), qué hace, cuándo aplica, si ve costos y si es el
 * hito que aprueba el objeto. Sirve para editar uno y para agregar uno nuevo.
 */
export function EditorPaso({
  ruta,
  paso,
  cargos,
  plazas,
  roles,
  origenes,
  conCondicionRequisicion,
}: {
  ruta: string
  paso?: PasoRuta
  cargos: Opcion[]
  plazas: Opcion[]
  roles: Opcion[]
  origenes: { clave: string; etiqueta: string }[]
  conCondicionRequisicion: boolean
}) {
  const [resolutor, setResolutor] = useState(paso?.resolutor ?? 'cargo')
  const sufijo = paso?.id ?? 'nuevo'
  const condOrigen = (paso?.condicion?.origen as string[] | undefined) ?? []
  const condPlan = paso?.condicion?.fuera_de_plan
  return (
    <FormAccion accion={paso ? guardarPaso : agregarPaso} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="ruta" value={ruta} />
      {paso && <input type="hidden" name="id" value={paso.id} />}
      <div className="md:col-span-2">
        <label htmlFor={`nom-${sufijo}`} className="etiqueta">
          Nombre del paso
        </label>
        <input id={`nom-${sufijo}`} name="nombre" defaultValue={paso?.nombre ?? ''} maxLength={120} className="campo" placeholder="Gerente General · aprueba" />
      </div>
      <div>
        <label htmlFor={`res-${sufijo}`} className="etiqueta">
          Quién firma
        </label>
        <select id={`res-${sufijo}`} name="resolutor" value={resolutor} onChange={(e) => setResolutor(e.target.value)} className="campo">
          {Object.entries(RESOLUTOR).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        {resolutor === 'cargo' && (
          <>
            <label htmlFor={`car-${sufijo}`} className="etiqueta">
              Cargo
            </label>
            <select id={`car-${sufijo}`} name="cargo_id" defaultValue={paso?.cargo_id ?? ''} className="campo">
              <option value="">Elige…</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </>
        )}
        {resolutor === 'plaza' && (
          <>
            <label htmlFor={`pla-${sufijo}`} className="etiqueta">
              Plaza
            </label>
            <select id={`pla-${sufijo}`} name="plaza_ref" defaultValue={paso?.plaza_ref ?? ''} className="campo">
              <option value="">Elige…</option>
              {plazas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </>
        )}
        {resolutor === 'rol' && (
          <>
            <label htmlFor={`rol-${sufijo}`} className="etiqueta">
              Rol
            </label>
            <select id={`rol-${sufijo}`} name="rol_id" defaultValue={paso?.rol_id ?? ''} className="campo">
              <option value="">Elige…</option>
              {roles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </>
        )}
        {(resolutor === 'jefe_unidad' || resolutor === 'director_unidad') && (
          <p className="pt-7 text-xs text-marca-500">Sale de la unidad del objeto, en la estructura vigente el día que se envía.</p>
        )}
      </div>
      <div>
        <label htmlFor={`acc-${sufijo}`} className="etiqueta">
          Acción
        </label>
        <select id={`acc-${sufijo}`} name="accion" defaultValue={paso?.accion ?? 'aprobar'} className="campo">
          {Object.entries(ACCION_PASO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.etiqueta}
            </option>
          ))}
        </select>
      </div>
      {conCondicionRequisicion ? (
        <fieldset className="md:col-span-2 xl:col-span-2">
          <legend className="etiqueta">Aplica solo si el origen es… (vacío = siempre)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {origenes.map((o) => (
              <label key={o.clave} className="flex items-center gap-1.5 text-sm text-marca-700">
                <input type="checkbox" name="cond_origen" value={o.clave} defaultChecked={condOrigen.includes(o.clave)} className="accent-[var(--color-acento-600)]" />
                {o.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="hidden xl:col-span-2 xl:block" />
      )}
      {conCondicionRequisicion && (
        <div>
          <label htmlFor={`plan-${sufijo}`} className="etiqueta">
            Plan de dotación
          </label>
          <select id={`plan-${sufijo}`} name="cond_fuera_de_plan" defaultValue={condPlan === true ? 'si' : condPlan === false ? 'no' : ''} className="campo">
            <option value="">Indiferente</option>
            <option value="si">Solo si está fuera de plan</option>
            <option value="no">Solo si está dentro del plan</option>
          </select>
        </div>
      )}
      <div className="flex flex-col justify-end gap-1.5 text-sm text-marca-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="ve_costos" defaultChecked={paso?.ve_costos} className="accent-[var(--color-acento-600)]" />
          Ve costos
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hito" defaultChecked={paso?.hito} className="accent-[var(--color-acento-600)]" />
          Es el hito (aprueba el objeto)
        </label>
      </div>
      <div className="flex items-end md:col-span-2 xl:col-span-4">
        <Enviar clase={paso ? 'btn-primario' : 'btn-acento'}>
          {!paso && <IconoMas className="h-4 w-4" />}
          {paso ? 'Guardar el paso' : 'Agregar el paso'}
        </Enviar>
      </div>
    </FormAccion>
  )
}
