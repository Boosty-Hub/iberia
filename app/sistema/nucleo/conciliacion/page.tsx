import type { Metadata } from 'next'
import { puede, requerirSesion } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { numero } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_CONCILIACION } from '@/lib/plataforma/tablas-organizacion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Conciliación · Organización' }

const RUTA = '/sistema/nucleo/conciliacion'

/**
 * La cola de calidad del dato (Anexo E §9): lo que la carga inicial no pudo
 * decidir sola —contradicciones entre organigramas, faltantes, inferencias,
 * personas sin casar—, como tabla. La ficha de cada punto lo resuelve o lo
 * descarta con su motivo (`control.resolver_conciliacion`, que pide editar el
 * módulo al que pertenece). La fuente se lee por su código y año, nunca por la
 * ruta del disco.
 */
export default async function ConciliacionPage({ searchParams }: PageProps<'/sistema/nucleo/conciliacion'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  if (!puede(sesion, 'sistema:estructura') && !puede(sesion, 'sistema:procesos') && !puede(sesion, 'sistema:documentos')) redirect('/sistema')
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const { data } = await supabase.schema('ui').rpc('conciliacion').select('estado, tipo, dias').range(0, 4999)
  const filas = data ?? []
  const abiertos = filas.filter((f) => f.estado === 'abierto')
  const sello = { fuente: 'Carga inicial de la estructura, los procesos y los documentos', estado: 'al_dia' as const }
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Conciliación' }]}
        descripcion="Lo que la carga no pudo decidir sola y espera a Capital Humano o a Calidad. Una fila abre el punto: se resuelve diciendo qué se corrigió, o se descarta con su motivo."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Abiertos" valor={numero(abiertos.length)} comparacion={{ texto: `de ${numero(filas.length)} en total` }} sello={sello} href={`${RUTA}?f.estado=abierto`} />
        <Kpi titulo="Contradicciones" valor={numero(abiertos.filter((f) => f.tipo === 'contradiccion').length)} comparacion={{ texto: 'dos fuentes dicen cosas distintas' }} sello={sello} href={`${RUTA}?f.estado=abierto&f.tipo=contradiccion`} />
        <Kpi titulo="Inferencias por confirmar" valor={numero(abiertos.filter((f) => f.tipo === 'inferencia').length)} sello={sello} href={`${RUTA}?f.estado=abierto&f.tipo=inferencia`} />
        <Kpi
          titulo="Más de 30 días abiertos"
          valor={numero(abiertos.filter((f) => (f.dias ?? 0) > 30).length)}
          sello={sello}
          href={`${RUTA}?f.estado=abierto&orden=dias&dir=desc`}
        />
      </div>
      <TablaServidor fuente={TABLA_CONCILIACION} sp={sp} sesion={sesion} ctx={ctx} vacio="Nada en la cola con estos filtros." />
    </>
  )
}
