import type { Metadata } from 'next'
import { datosFormularioRequisicion } from '@/components/sistema/flujo/datos'
import { ordenarArbol } from '@/components/sistema/flujo/estructura'
import { hoyCaracas } from '@/components/sistema/flujo/formato'
import { FormularioRequisicion } from '@/components/sistema/flujo/formulario-requisicion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
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
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Pedir una persona más"
        migas={[{ etiqueta: 'Requisiciones', href: '/sistema/nucleo/organizacion/requisiciones' }, { etiqueta: 'Nueva' }]}
        descripcion="Requisición de Personal II-21-40-001. Se guarda como borrador: antes de enviarla ves cómo cambia la dotación de la unidad, sus dependencias y la ruta que va a recorrer."
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
