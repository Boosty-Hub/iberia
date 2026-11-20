import type { Metadata } from 'next'
import Link from 'next/link'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { ESTADOS_ESCENARIO, TONO_ESCENARIO, enOrdenDeArbol, etiquetaSangrada, fecha, fechaHora } from '@/components/sistema/procesos/comun'
import { leerProcesos } from '@/components/sistema/procesos/datos'
import { CrearEscenario } from '@/components/sistema/procesos/escenario'
import { PestanasProcesos, Seccion } from '@/components/sistema/procesos/piezas'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Escenarios de procesos · Plataforma Iberia' }

/**
 * Escenarios de procesos: copias aisladas de una parte del catálogo para
 * ensayar una reorganización —renombrar, agregar, mover, retirar, cambiar
 * dueños— sin tocar la realidad. Se comparan contra lo vigente y, aprobados,
 * se publican con fecha.
 */
export default async function EscenariosProcesosPage() {
  await requerirPermiso('sistema:procesos')
  const sesion = await requerirPermiso('sistema:escenarios')
  const supabase = await createClient()

  const [{ data: escenarios }, { vigentes }] = await Promise.all([
    supabase
      .schema('org')
      .from('escenario')
      .select('id, nombre, descripcion, estado, fecha_base, vigente_desde, creado_en, publicado_en, proceso_raiz_ref')
      .eq('alcance', 'procesos')
      .order('creado_en', { ascending: false }),
    leerProcesos(supabase),
  ])
  const nombre = new Map(vigentes.map((v) => [v.ref, v.nombre]))
  const raices = enOrdenDeArbol(vigentes.filter((v) => v.nivel <= 1)).map((v) => ({ valor: v.ref, etiqueta: etiquetaSangrada(v) }))
  const puedeCrear = puede(sesion, 'sistema:escenarios', 'crear') && puede(sesion, 'sistema:procesos', 'editar')
  const lista = escenarios ?? []

  return (
    <>
      <EncabezadoPagina
        rotulo="Procesos"
        titulo="Escenarios de procesos"
        descripcion="Ensaya cambios al catálogo en una copia aislada, compáralos contra lo vigente y, cuando se aprueben, publícalos con fecha."
      />
      <PestanasProcesos activa="escenarios" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {lista.length === 0 ? (
            <p className="tarjeta p-5 text-sm text-marca-600">Todavía no hay escenarios de procesos.</p>
          ) : (
            lista.map((e) => (
              <Link key={e.id} href={`/sistema/nucleo/procesos/escenarios/${e.id}`} className="tarjeta block p-5 transition-colors hover:bg-marca-50/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-marca-900">{e.nombre}</p>
                    <p className="mt-0.5 text-xs text-marca-500">
                      {e.proceso_raiz_ref ? `Copia de «${nombre.get(e.proceso_raiz_ref) ?? 'un proceso ya no vigente'}»` : 'Copia del catálogo completo'} · creado el{' '}
                      {fechaHora(e.creado_en)}
                    </p>
                  </div>
                  <Insignia tono={TONO_ESCENARIO[e.estado] ?? 'neutro'}>{ESTADOS_ESCENARIO[e.estado] ?? e.estado}</Insignia>
                </div>
                {e.descripcion && <p className="mt-2 text-sm text-marca-700">{e.descripcion}</p>}
                {(e.vigente_desde || e.publicado_en) && (
                  <p className="mt-2 text-xs text-marca-500">
                    {e.vigente_desde && <>Rige desde el {fecha(e.vigente_desde)}</>}
                    {e.publicado_en && <> · publicado el {fechaHora(e.publicado_en)}</>}
                  </p>
                )}
              </Link>
            ))
          )}
        </div>
        <div>
          {puedeCrear ? (
            <Seccion titulo="Nuevo escenario">
              <CrearEscenario raices={raices} />
            </Seccion>
          ) : (
            <Seccion titulo="Solo lectura">
              <p className="text-sm text-marca-500">Crear escenarios pide el permiso de crear escenarios y el de editar procesos.</p>
            </Seccion>
          )}
        </div>
      </div>
    </>
  )
}
