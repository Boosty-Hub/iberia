import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_VALIDACION_PROCESOS } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Validación · Procesos' }

const ETAPAS = [
  { clave: 'como_es', n: '1', titulo: 'Cómo es', texto: 'Se levanta la ficha PHVA del proceso como se hace hoy.' },
  { clave: 'mejoras', n: '2', titulo: 'Mejoras', texto: 'El dueño y el SGC proponen los cambios en un borrador.' },
  { clave: 'revision', n: '3', titulo: 'Revisión', texto: 'Revisión con IA (sin capacidad encendida todavía) y decisión del comité en la bandeja.' },
  { clave: 'optimizado', n: '4', titulo: 'Proceso optimizado', texto: 'Aprobado, vigente y con revisión periódica.' },
]

/**
 * El tablero de la secuencia de New Iberia por departamento (NUC-PRO §3):
 * «cómo es → mejoras → revisión con IA → proceso optimizado», una fila por
 * macroproceso, con lo que hay en cada estado y el siguiente paso. Sale de
 * `ui.validacion_procesos()`: `sgc.proceso` y las solicitudes de `flujo`.
 */
export default async function ValidacionPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/validacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:procesos'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [{ data }] = await Promise.all([
    supabase.schema('ui').rpc('validacion_procesos').range(0, 199),
    precargarMetricas(['procesos_validados', 'procesos_con_ficha', 'procesos_en_revision'], ctx),
  ])
  const filas = data ?? []
  const porEtapa = (e: string) => filas.filter((f) => f.etapa === e).length
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Validación' }]}
        descripcion="La secuencia de New Iberia por área: qué falta levantar, qué está en mejoras, qué espera al comité y qué ya quedó validado. Una fila abre la ficha del macroproceso."
      />
      <ol className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="La secuencia de validación">
        {ETAPAS.map((e) => (
          <li key={e.clave} className="flex gap-2.5 rounded-xl border border-[var(--borde)] bg-white p-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2b2a28] text-[11px] font-bold text-white" aria-hidden>
              {e.n}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-marca-900">
                {e.titulo}
                <span className="rounded-lg bg-[#eef0f3] px-1.5 text-[10.5px] font-normal text-marca-600 tabular-nums">
                  {numero(porEtapa(e.clave))} área{porEtapa(e.clave) === 1 ? '' : 's'}
                </span>
              </span>
              <span className="block text-[11.5px] text-marca-500">{e.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      {/* Las cifras salen del registro de métricas (`ui.metrica`): las mismas de Procesos › Resumen. */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="procesos_validados" ctx={ctx} sesion={sesion} complemento={{ titulo: 'Procesos por validar', texto: 'Niveles 1 a 3 sin una versión validada' }} />
        <KpiMetrica
          clave="procesos_con_ficha"
          ctx={ctx}
          sesion={sesion}
          complemento={{
            titulo: '«Cómo es» por levantar',
            texto: 'Procesos de niveles 1 a 3 sin ficha PHVA',
            href: '/sistema/nucleo/procesos/catalogo?f.tiene_ficha=false&f.nivel_nombre=Proceso&f.nivel_nombre=Subproceso&f.nivel_nombre=Actividad',
          }}
        />
        <KpiMetrica clave="procesos_en_revision" ctx={ctx} sesion={sesion} titulo="En revisión" />
        <KpiMetrica clave="procesos_validados" ctx={ctx} sesion={sesion} titulo="Validados" />
      </div>
      <TablaServidor fuente={TABLA_VALIDACION_PROCESOS} sp={sp} sesion={sesion} ctx={ctx} vacio="No hay macroprocesos con estos filtros." />
      <p className="mt-2 text-[11.5px] text-marca-500">
        «Validados»: versiones vigentes aprobadas por la ruta de procesos en la plataforma. La revisión con IA (NUC-PRO-IA-02) se enciende en R4; mientras tanto la etapa 3 es
        la decisión del comité.
      </p>
    </>
  )
}
