import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { fechaLarga } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_CATALOGO_PROCESOS } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { accionFilaCatalogo } from '@/app/sistema/nucleo/procesos/acciones'

export const metadata: Metadata = { title: 'Catálogo · Procesos' }

/**
 * El catálogo de procesos como tabla (NUC-PRO · Explorar): los cuatro niveles
 * en orden de árbol (`ui.procesos(al, esc)`), con códigos SGC e informe, tipo,
 * estado operativo, ciclo abierto, dueño, documentos y ficha. Una fila abre la
 * ficha PHVA en el panel; «＋ Hijo» crea un proceso hijo en borrador y «Mover»
 * abre la ficha para cambiar de dónde cuelga (también en borrador).
 *
 * Reemplaza al «Árbol» de la Etapa 1.
 */
export default async function CatalogoProcesosPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/catalogo'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const ctx = await leerContexto(sp)
  const edita = puede(sesion, 'sistema:procesos', 'editar') || puede(sesion, 'sistema:procesos', 'crear')
  const fuente = edita ? TABLA_CATALOGO_PROCESOS : { ...TABLA_CATALOGO_PROCESOS, columnas: TABLA_CATALOGO_PROCESOS.columnas.filter((c) => c.tipo !== 'acciones') }
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Catálogo' }]}
        descripcion={
          ctx.esc
            ? 'El catálogo del escenario: lo que cambia sale con su ciclo «Escenario». Se edita en el mapa.'
            : `Macroproceso → proceso → subproceso → actividad, como regían el ${fechaLarga(ctx.al)}, más los procesos nuevos que todavía son borrador. Una fila abre su ficha PHVA.`
        }
      />
      <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} alAccion={edita ? accionFilaCatalogo : undefined} vacio="No hay procesos con estos filtros a esa fecha." />
    </>
  )
}
