import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { enOrdenDeArbol, etiquetaSangrada } from '@/components/sistema/procesos/comun'
import { leerProcesos } from '@/components/sistema/procesos/datos'
import { CrearEscenario } from '@/components/sistema/procesos/escenario'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_ESCENARIOS_PROCESOS } from '@/lib/plataforma/tablas-procesos'

export const metadata: Metadata = { title: 'Escenarios · Procesos' }

/**
 * Escenarios de procesos: copias aisladas de una parte del catálogo para
 * ensayar una reorganización sin tocar la realidad. La tabla
 * (`ui.escenarios_procesos`) trae cuánto agrega, retira y cambia cada uno
 * frente a lo vigente; «◆ Mapa» lo abre en el lienzo en modo escenario y
 * «Cambios» lleva a la comparación y al envío con fecha.
 */
export default async function EscenariosProcesosPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/escenarios'>) {
  await requerirPermiso('sistema:procesos')
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:escenarios'), searchParams])
  const ctx = await leerContexto(sp)
  const puedeCrear = puede(sesion, 'sistema:escenarios', 'crear') && puede(sesion, 'sistema:procesos', 'editar')
  const raices = puedeCrear
    ? enOrdenDeArbol((await leerProcesos(await createClient())).vigentes.filter((v) => v.nivel <= 1)).map((v) => ({ valor: v.ref, etiqueta: etiquetaSangrada(v) }))
    : []
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Escenarios' }]}
        descripcion="Ensaya cambios al catálogo en una copia aislada, compáralos contra lo vigente y, cuando se aprueben, se publican con fecha. Lo de antes queda cerrado, no borrado."
      />
      {puedeCrear && (
        <details className="group mb-3 rounded-xl border border-[var(--borde)] bg-white">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3.5 text-[13px] font-semibold text-[#5a3f9e]">
            <span aria-hidden>◆</span> Nuevo escenario de procesos
            <span className="ml-auto text-[11px] font-normal text-marca-400 group-open:hidden">Abrir</span>
          </summary>
          <div className="max-w-xl border-t border-[var(--borde)] p-3.5">
            <CrearEscenario raices={raices} />
          </div>
        </details>
      )}
      <TablaServidor fuente={TABLA_ESCENARIOS_PROCESOS} sp={sp} sesion={sesion} ctx={ctx} vacio="Todavía no hay escenarios de procesos." />
    </>
  )
}
