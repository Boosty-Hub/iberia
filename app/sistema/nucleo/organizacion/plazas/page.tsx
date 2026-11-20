import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { fechaLarga } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_PLAZAS } from '@/lib/plataforma/tablas'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Plazas · Organización' }

/**
 * Las plazas como tabla (NUC-ORG · Explorar): la fuente es `ui.plazas(al, esc)`,
 * con ocupadas y vacantes al día de los datos y, en un escenario, la versión del
 * escenario encima de la real. Filtrar, agrupar, totalizar y exportar los hace
 * `TablaDatos` en el servidor; la fila abre la ficha de la plaza.
 */
export default async function PlazasPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/plazas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Plazas' }]}
        descripcion={`Las plazas vigentes al ${fechaLarga(ctx.al)}${ctx.esc ? ', con los cambios del escenario' : ''}: dotación aprobada, titulares y lo que falta o sobra. Una fila abre su ficha.`}
      />
      <TablaServidor fuente={TABLA_PLAZAS} sp={sp} sesion={sesion} ctx={ctx} vacio="No hay plazas con estos filtros a esa fecha." />
    </>
  )
}
