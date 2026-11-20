import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_CRUCE_PROCESOS } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { editarCeldaCruce } from '@/app/sistema/nucleo/procesos/acciones'

export const metadata: Metadata = { title: 'Cruce SGC ↔ informe · Procesos' }

/**
 * La conciliación entre los dos inventarios: cada proceso del SGC (II-XX)
 * frente a su par en el inventario de la Fase 1 (`ui.cruce_procesos`). El
 * cruce lo propuso la carga; aquí Calidad corrige el tipo y lo marca
 * confirmado, en la celda. Cada cambio queda en la auditoría.
 */
export default async function CrucePage({ searchParams }: PageProps<'/sistema/nucleo/procesos/cruce'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const ctx = await leerContexto(sp)
  const editable = puede(sesion, 'sistema:procesos', 'editar')
  const fuente = editable ? TABLA_CRUCE_PROCESOS : { ...TABLA_CRUCE_PROCESOS, columnas: TABLA_CRUCE_PROCESOS.columnas.map((c) => ({ ...c, editable: false })) }
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Cruce SGC ↔ informe' }]}
        descripcion={
          editable
            ? 'Cada proceso del SGC frente a su par en el inventario de la Fase 1. Toca el tipo o «Por confirmar» para corregirlo en la celda; la fila abre la ficha del proceso.'
            : 'Cada proceso del SGC frente a su par en el inventario de la Fase 1, con el tipo de cruce y si Calidad ya lo confirmó.'
        }
      />
      <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} alEditar={editable ? editarCeldaCruce : undefined} vacio="No hay cruces con estos filtros." />
    </>
  )
}
