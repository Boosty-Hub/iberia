import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, porcentaje } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_VALIDACION_PROCESOS } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
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
  const { data } = await supabase.schema('ui').rpc('validacion_procesos').range(0, 199)
  const filas = data ?? []
  const suma = (k: 'procesos' | 'sin_ficha' | 'borradores' | 'en_revision' | 'validados') => filas.reduce((s, f) => s + (f[k] ?? 0), 0)
  const porEtapa = (e: string) => filas.filter((f) => f.etapa === e).length
  const sello = { fuente: 'sgc.proceso + flujo.solicitud', en: new Date().toISOString(), estado: 'al_dia' as const }
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
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Procesos por validar" valor={numero(suma('procesos') - suma('validados'))} unidad={`de ${numero(suma('procesos'))}`} sello={sello} />
        <Kpi titulo="«Cómo es» por levantar" valor={numero(suma('sin_ficha'))} comparacion={{ texto: 'Procesos sin ficha PHVA' }} sello={sello} href="/sistema/nucleo/procesos/catalogo?f.tiene_ficha=false" />
        <Kpi titulo="En mejoras o en revisión" valor={numero(suma('borradores') + suma('en_revision'))} comparacion={{ texto: `${numero(suma('en_revision'))} esperan al comité` }} sello={sello} href="/sistema/nucleo/procesos/catalogo?f.ciclo=borrador&f.ciclo=en_revision" />
        <Kpi
          titulo="Validados"
          valor={numero(suma('validados'))}
          comparacion={{ texto: `${porcentaje(suma('procesos') ? (suma('validados') / suma('procesos')) * 100 : 0)} · meta: compras, comercial y finanzas al 31-mar-2027` }}
          sello={sello}
        />
      </div>
      <TablaServidor fuente={TABLA_VALIDACION_PROCESOS} sp={sp} sesion={sesion} ctx={ctx} vacio="No hay macroprocesos con estos filtros." />
      <p className="mt-2 text-[11.5px] text-marca-500">
        «Validados»: versiones vigentes aprobadas por la ruta de procesos en la plataforma. La revisión con IA (NUC-PRO-IA-02) se enciende en R4; mientras tanto la etapa 3 es
        la decisión del comité.
      </p>
    </>
  )
}
