'use client'

import { useActionState } from 'react'
import { crearCargo } from '@/app/sistema/nucleo/organizacion/acciones'
import { Desplegable } from '@/components/sistema/ui/desplegable'

// El mismo estilo que `BOTON_CABECERA_PRINCIPAL` (que vive en un componente de servidor).
const BOTON_CABECERA_PRINCIPAL = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700'

/** «Nuevo cargo» en la cabecera: un formulario corto; al crearse abre su ficha. */
export function NuevoCargo({ familias }: { familias: { valor: string; etiqueta: string }[] }) {
  const [estado, accion, pendiente] = useActionState(crearCargo, {})
  const campo = 'h-8 w-full rounded-md border border-[var(--borde)] bg-white px-2 text-[13px] outline-none focus:border-marca-500'
  return (
    <Desplegable etiqueta="Crear un cargo" alinear="der" ancho="w-80" claseBoton={BOTON_CABECERA_PRINCIPAL} boton={<>+ Nuevo cargo</>}>
      <form action={accion} className="flex flex-col gap-2 p-3 text-[12.5px]">
        <label className="flex flex-col gap-0.5 text-marca-600">
          Nombre del cargo
          <input name="nombre" required minLength={3} maxLength={120} className={campo} autoFocus />
        </label>
        <label className="flex flex-col gap-0.5 text-marca-600">
          Familia
          <select name="familia" className={campo} defaultValue="">
            <option value="">Sin familia</option>
            {familias.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-marca-600">
          Sinónimos (separados por «;»)
          <input name="sinonimos" maxLength={500} className={campo} />
        </label>
        {estado.error && (
          <p role="alert" className="rounded-md bg-[#fbeceb] px-2 py-1 text-[12px] text-[#a3241f]">
            {estado.error}
          </p>
        )}
        <button type="submit" disabled={pendiente} className={`${BOTON_CABECERA_PRINCIPAL} justify-center`}>
          {pendiente ? 'Creando…' : 'Crear cargo'}
        </button>
      </form>
    </Desplegable>
  )
}
