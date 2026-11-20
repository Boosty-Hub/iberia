import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_HISTORIAL_PROCESOS } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Historial · Procesos' }

/**
 * Quién cambió qué en el catálogo de procesos y en el cruce con el informe
 * (`ui.historial_procesos`, sobre `control.auditoria`). Lo ve quien tiene el
 * permiso de auditoría; las filas de los escenarios no salen (son ensayos).
 */
export default async function HistorialProcesosPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/historial'>) {
  await requerirPermiso('sistema:procesos')
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:auditoria'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Historial' }]}
        descripcion="Cada versión creada, enviada, aprobada o reemplazada, y cada corrección del cruce, con quién y cuándo. Una fila abre la ficha del proceso."
      />
      <TablaServidor fuente={TABLA_HISTORIAL_PROCESOS} sp={sp} sesion={sesion} ctx={ctx} vacio="Sin cambios con estos filtros." />
    </>
  )
}
