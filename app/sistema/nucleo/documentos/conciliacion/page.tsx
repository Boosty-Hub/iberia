import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { ETIQUETAS_MOTIVO, TABLA_CONCILIACION_DOCUMENTOS, TABLA_CONCILIACION_DOCUMENTOS_TODO } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { Segmentos } from '@/components/sistema/procesos/piezas-r2'
import { resolverDesdeCola } from '@/app/sistema/nucleo/documentos/acciones'

export const metadata: Metadata = { title: 'Conciliación · Documentos' }

const RUTA = '/sistema/nucleo/documentos/conciliacion'
const TEXTO: Record<string, string> = {
  datos_sensibles: 'Sanear o confirmar que se restringe',
  codigo_reutilizado: 'Separar con alias o código nuevo',
  sin_determinar: 'Decidir si es vigente u obsoleto',
  obsoleto: 'Confirmar que sale de circulación',
}

/**
 * La mesa de conciliación de documentos (cap. 05 §4.2) como cola: cada
 * documento con datos sensibles, código reutilizado, estado sin determinar u
 * obsoleto por confirmar, uno por motivo (`ui.conciliacion_documentos`). Se
 * corrige el documento en su ficha y se saca el punto con «Resolver», que deja
 * la decisión en `sgc.documento_conciliacion` (auditada). Se puede reabrir.
 */
export default async function ConciliacionDocumentosPage({ searchParams }: PageProps<'/sistema/nucleo/documentos/conciliacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:documentos'), searchParams])
  const ctx = await leerContexto(sp)
  const todo = sp.ver === 'todo'
  const edita = puede(sesion, 'sistema:documentos', 'editar')
  const base = todo ? TABLA_CONCILIACION_DOCUMENTOS_TODO : TABLA_CONCILIACION_DOCUMENTOS
  const fuente = edita ? base : { ...base, columnas: base.columnas.map((c) => (c.tipo === 'acciones' ? { ...c, acciones: c.acciones?.filter((a) => a.clave !== 'resolver') } : c)) }

  const supabase = await createClient()
  const conteos = await Promise.all(
    Object.keys(ETIQUETAS_MOTIVO).map(async (m) => {
      const { count } = await supabase.schema('ui').rpc('conciliacion_documentos', undefined, { count: 'exact', head: true }).eq('motivo', m).eq('situacion', 'pendiente')
      return [m, count ?? 0] as const
    })
  )
  const sello = { fuente: 'sgc.documento + documento_conciliacion', en: new Date().toISOString(), estado: 'al_dia' as const }
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-DOC"
        titulo="Documentos"
        migas={[{ etiqueta: 'Conciliación' }]}
        descripcion={
          edita
            ? 'Lo que la carga no pudo decidir sola. Corrige el documento en su ficha y saca el punto con «Resolver»: la decisión queda en la auditoría y se puede reabrir.'
            : 'Lo que la carga no pudo decidir sola, punto por punto. Lo resuelve quien edita documentos.'
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {conteos.map(([m, n]) => (
          <Kpi key={m} titulo={ETIQUETAS_MOTIVO[m]} valor={numero(n)} unidad="pendientes" comparacion={{ texto: TEXTO[m] }} sello={sello} href={`${RUTA}?f.motivo=${m}`} />
        ))}
      </div>
      <Segmentos
        etiqueta="Qué puntos ver"
        activa={todo ? 'todo' : 'pendientes'}
        opciones={[
          { valor: 'pendientes', etiqueta: 'Pendientes', href: RUTA, n: conteos.reduce((s, [, n]) => s + n, 0) },
          { valor: 'todo', etiqueta: 'Con lo ya decidido', href: `${RUTA}?ver=todo` },
        ]}
      />
      <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} alAccion={edita ? resolverDesdeCola : undefined} vacio="La cola está vacía con estos filtros." />
    </>
  )
}
