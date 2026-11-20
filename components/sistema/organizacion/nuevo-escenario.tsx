'use client'

import { useActionState } from 'react'
import { crearEscenario } from '@/app/sistema/nucleo/escenarios/acciones'
import { Desplegable } from '@/components/sistema/ui/desplegable'

const BOTON = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700 disabled:opacity-60'
const CAMPO = 'h-8 w-full rounded-md border border-[var(--borde)] bg-white px-2 text-[13px] outline-none focus:border-marca-500'

/** «Nuevo escenario»: copia la estructura de hoy y abre el editor del escenario. */
export function NuevoEscenario() {
  const [estado, accion, pendiente] = useActionState(crearEscenario, {})
  return (
    <Desplegable etiqueta="Abrir un escenario de estructura" alinear="der" ancho="w-80" claseBoton={BOTON} boton={<>+ Nuevo escenario</>}>
      <form action={accion} className="flex flex-col gap-2 p-3 text-[12px] text-marca-600">
        <p>Copia la estructura vigente de hoy. Lo que cambies ahí no toca la realidad hasta que se apruebe.</p>
        <label className="flex flex-col gap-0.5">
          Nombre
          <input name="nombre" required minLength={3} maxLength={120} className={CAMPO} placeholder="Operaciones 2027" autoFocus />
        </label>
        <label className="flex flex-col gap-0.5">
          Para qué
          <input name="descripcion" maxLength={500} className={CAMPO} placeholder="Qué se quiere probar" />
        </label>
        {estado.error && <p role="alert" className="rounded-md bg-[#fbeceb] px-2 py-1 text-[#a3241f]">{estado.error}</p>}
        <button type="submit" disabled={pendiente} className={`${BOTON} justify-center`}>
          {pendiente ? 'Copiando la estructura…' : 'Abrir escenario'}
        </button>
      </form>
    </Desplegable>
  )
}
