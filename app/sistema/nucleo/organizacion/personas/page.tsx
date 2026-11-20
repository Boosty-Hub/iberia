import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { fechaLarga } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_PERSONAS } from '@/lib/plataforma/tablas-organizacion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Personas · Organización' }

/**
 * Quién ocupa cada plaza (`ui.personas`): nombre, ficha, cargo, unidad, tipo de
 * ocupación, desde cuándo y con qué certeza se casó con el padrón. Del padrón
 * solo sale el nombre y la ficha: nunca teléfono, correo ni cédula. La fila
 * abre la ficha de la persona, donde se mueve o se termina la ocupación.
 */
export default async function PersonasPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/personas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Personas' }]}
        descripcion={`Las personas que ocupan plazas al ${fechaLarga(ctx.al)}. «Por nombre del cargo» marca lo que la carga casó solo por el texto del cargo: conviene confirmarlo. Los datos personales los lleva Capital Humano en el padrón.`}
      />
      <TablaServidor fuente={TABLA_PERSONAS} sp={sp} sesion={sesion} ctx={ctx} vacio="Nadie con estos filtros a esa fecha." />
    </>
  )
}
