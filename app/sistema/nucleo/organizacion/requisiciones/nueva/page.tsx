import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoAtras } from '@/components/iconos'
import { datosFormularioRequisicion } from '@/components/sistema/flujo/datos'
import { ordenarArbol } from '@/components/sistema/flujo/estructura'
import { hoyCaracas } from '@/components/sistema/flujo/formato'
import { FormularioRequisicion } from '@/components/sistema/flujo/formulario-requisicion'
import { EncabezadoPagina } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Nueva requisición de personal' }

/** El II-21-40-001 digital: se guarda en borrador y, ya con su impacto a la vista, se envía. */
export default async function NuevaRequisicionPage() {
  const sesion = await requerirPermiso('sistema:requisiciones', 'crear')
  const supabase = await createClient()
  const hoy = hoyCaracas()
  const datos = await datosFormularioRequisicion(supabase, hoy)

  return (
    <>
      <Link href="/sistema/nucleo/organizacion/requisiciones" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Requisiciones
      </Link>
      <EncabezadoPagina
        rotulo="Requisición de personal · II-21-40-001"
        titulo="Pedir una persona más"
        descripcion="Llena lo que pide el formato. Se guarda como borrador: antes de enviarla ves cómo cambia la dotación de la unidad, sus dependencias y la ruta que va a recorrer."
      />
      <FormularioRequisicion
        {...datos}
        unidades={ordenarArbol(datos.unidades)}
        puedeCrearCargo={puede(sesion, 'sistema:estructura', 'crear')}
        hoy={hoy}
      />
    </>
  )
}
