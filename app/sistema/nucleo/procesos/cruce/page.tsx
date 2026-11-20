import type { Metadata } from 'next'
import Link from 'next/link'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { CruceControles } from '@/components/sistema/procesos/cruce-fila'
import { leerProcesos } from '@/components/sistema/procesos/datos'
import { PestanasProcesos } from '@/components/sistema/procesos/piezas'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Cruce SGC ↔ informe · Plataforma Iberia' }

/**
 * La conciliación entre los dos inventarios: los procesos del SGC (códigos
 * II-XX) y los del informe de la Fase 1 (`public.procesos`). El cruce lo
 * propuso la carga; aquí Calidad lo confirma o lo corrige. Cada cambio queda en
 * la auditoría.
 */
export default async function CrucePage({ searchParams }: PageProps<'/sistema/nucleo/procesos/cruce'>) {
  const [sesion, consulta] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const supabase = await createClient()
  const filtro = typeof consulta.ver === 'string' ? consulta.ver : 'todos'

  const [{ data: cruces }, { vigentes }, { data: macros }, { data: procs }] = await Promise.all([
    supabase.schema('sgc').from('proceso_cruce').select('id, proceso_ref, codigo_sgc, informe_proceso_id, informe_macro_id, tipo, confirmado, nota').order('codigo_sgc'),
    leerProcesos(supabase),
    supabase.from('macroprocesos').select('id, nivel, numero, nombre'),
    supabase.from('procesos').select('id, macroproceso_id, orden, nombre, estado'),
  ])
  const porRef = new Map(vigentes.map((v) => [v.ref, v]))
  const macro = new Map((macros ?? []).map((m) => [m.id, m]))
  const proc = new Map((procs ?? []).map((p) => [p.id, p]))
  const todos = cruces ?? []
  const lista = todos.filter((c) => (filtro === 'pendientes' ? !c.confirmado : filtro === 'confirmados' ? c.confirmado : true))
  const confirmados = todos.filter((c) => c.confirmado).length
  const editable = puede(sesion, 'sistema:procesos', 'editar')
  const numeroDe = (m?: { nivel: string; numero: number }) => (m ? `${{ Estratégico: 1, Operativo: 2, Soporte: 3 }[m.nivel] ?? '?'}.${m.numero}` : '')

  const pestana = (clave: string, etiqueta: string, n: number) => (
    <Link
      href={`/sistema/nucleo/procesos/cruce${clave === 'todos' ? '' : `?ver=${clave}`}`}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm',
        filtro === clave ? 'bg-acento-50 font-semibold text-acento-700' : 'text-marca-600 hover:bg-marca-50',
      )}
    >
      {etiqueta} <span className="text-xs text-marca-400">{n}</span>
    </Link>
  )

  return (
    <>
      <EncabezadoPagina
        rotulo="Procesos"
        titulo="Cruce SGC ↔ informe"
        descripcion="Cada proceso del SGC frente a su par en el inventario de la Fase 1. Corrige el tipo de cruce y márcalo confirmado cuando Calidad lo valide."
      />
      <PestanasProcesos activa="cruce" escenarios={puede(sesion, 'sistema:escenarios')} />

      <div className="mb-4 flex flex-wrap gap-1">
        {pestana('todos', 'Todos', todos.length)}
        {pestana('pendientes', 'Por confirmar', todos.length - confirmados)}
        {pestana('confirmados', 'Confirmados', confirmados)}
      </div>

      <div className="tarjeta divide-y divide-[var(--borde)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_17rem] gap-4 px-5 py-3 text-xs font-medium text-marca-500 lg:grid">
          <span>SGC</span>
          <span>Informe de la Fase 1</span>
          <span>Cruce</span>
        </div>
        {lista.length === 0 && <p className="p-5 text-sm text-marca-500">No hay cruces en esta vista.</p>}
        {lista.map((c) => {
          const nodo = porRef.get(c.proceso_ref)
          const m = c.informe_macro_id ? macro.get(c.informe_macro_id) : undefined
          const p = c.informe_proceso_id ? proc.get(c.informe_proceso_id) : undefined
          return (
            <div key={c.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_17rem] lg:gap-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-marca-500">{c.codigo_sgc ?? 'Sin código'}</p>
                {nodo ? (
                  <Link href={`/sistema/nucleo/procesos/${nodo.ref}`} className="text-sm font-medium text-marca-800 hover:text-acento-700 hover:underline">
                    {nodo.nombre}
                  </Link>
                ) : (
                  <p className="text-sm text-marca-500">Proceso no vigente</p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-marca-500 lg:hidden">Informe de la Fase 1</p>
                {p || m ? (
                  <>
                    <p className="text-sm text-marca-800">{p?.nombre ?? m?.nombre}</p>
                    {m && (
                      <p className="text-xs text-marca-500">
                        {numeroDe(m)}
                        {p ? `.${p.orden}` : ''} · {m.nombre}
                      </p>
                    )}
                    {p?.estado && p.estado !== 'VIGENTE' && (
                      <Insignia tono="ambar" className="mt-1">
                        {p.estado.toLowerCase()}
                      </Insignia>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-marca-400">
                    {c.informe_proceso_id || c.informe_macro_id ? 'Sin acceso al inventario de la Fase 1' : 'Sin par en el informe'}
                  </p>
                )}
              </div>
              <CruceControles cruce={c} editable={editable} />
            </div>
          )
        })}
      </div>
    </>
  )
}
