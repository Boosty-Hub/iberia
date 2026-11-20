import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, porcentaje } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { BarrasApiladas } from '@/components/sistema/procesos/piezas-r2'
import { todosLosDocumentos } from '@/components/sistema/procesos/datos-r2'

export const metadata: Metadata = { title: 'Resumen · Documentos' }

const BIBLIOTECA = '/sistema/nucleo/documentos?ver=todos'
const TRAMOS = [
  { clave: 'vigente', etiqueta: 'vigente', simbolo: '✓', color: '#1f8a5b' },
  { clave: 'sin_determinar', etiqueta: 'sin determinar o borrador', simbolo: '?', color: '#e3b25a' },
  { clave: 'obsoleto', etiqueta: 'obsoleto o retirado', simbolo: '–', color: '#c4c9d0' },
]

/**
 * Resumen de Documentos (NUC-DOC): cuánto del inventario está vigente, cuánto
 * cuelga de un proceso, cuánto espera en la mesa de conciliación y dónde se
 * concentra, por tipo y por macroproceso. Sale de `ui.documentos()` con la RLS
 * de quien mira: sin `sistema:perimetros`, el perímetro no cuenta.
 */
export default async function ResumenDocumentosPage() {
  const sesion = await requerirPermiso('sistema:documentos')
  const supabase = await createClient()
  const [docs, { data: ultimo }] = await Promise.all([
    todosLosDocumentos(supabase),
    supabase.schema('sgc').from('documento').select('creado_en').order('creado_en', { ascending: false }).limit(1).maybeSingle(),
  ])
  const sello = { fuente: 'inventario del SGC (sgc.documento)', en: ultimo?.creado_en ?? null, estado: 'al_dia' as const }
  const vigentes = docs.filter((d) => d.estado === 'vigente')
  const conProceso = vigentes.filter((d) => d.proceso_ref).length
  const sinDet = docs.filter((d) => d.estado === 'sin_determinar').length
  const obsoletos = docs.filter((d) => d.estado === 'obsoleto').length
  const sensibles = docs.filter((d) => d.datos_sensibles).length
  const repetidos = docs.filter((d) => d.codigo_repetido).length
  const enCola = docs.reduce((s, d) => s + (d.pendientes ?? 0), 0)
  const tramo = (estado: string) => (estado === 'vigente' ? 'vigente' : estado === 'obsoleto' || estado === 'retirado' ? 'obsoleto' : 'sin_determinar')

  const agrupar = (clave: (d: (typeof docs)[number]) => string | null, etiqueta: (d: (typeof docs)[number]) => string, href: (k: string) => string) => {
    const m = new Map<string, { etiqueta: string; valores: Record<string, number> }>()
    for (const d of docs) {
      const k = clave(d) ?? '∅'
      const g = m.get(k) ?? { etiqueta: k === '∅' ? 'Sin dato' : etiqueta(d), valores: { vigente: 0, sin_determinar: 0, obsoleto: 0 } }
      g.valores[tramo(d.estado)]++
      m.set(k, g)
    }
    return [...m.entries()]
      .map(([k, g]) => ({ clave: k, etiqueta: g.etiqueta, href: href(k), valores: g.valores, total: Object.values(g.valores).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
  }
  const porMacro = agrupar(
    (d) => d.macro_ref,
    (d) => d.macro ?? 'Sin macroproceso',
    (k) => `${BIBLIOTECA}&f.macro=${encodeURIComponent(docs.find((d) => d.macro_ref === k)?.macro ?? '∅')}`
  )
  const porTipo = agrupar(
    (d) => d.tipo_yy,
    (d) => d.tipo_etiqueta ?? `Tipo ${d.tipo_yy}`,
    (k) => `${BIBLIOTECA}&f.tipo_yy=${encodeURIComponent(k)}`
  ).slice(0, 12)

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-DOC"
        titulo="Documentos"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion={`El inventario del SGC en cifras: vigentes, vinculados a un proceso y lo que espera en la conciliación.${puede(sesion, 'sistema:perimetros') ? '' : ' Los documentos de perímetro no cuentan: no están a tu alcance.'}`}
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Vigentes" valor={numero(vigentes.length)} unidad={`de ${numero(docs.length)}`} comparacion={{ texto: `${porcentaje(docs.length ? (vigentes.length / docs.length) * 100 : 0)} del inventario` }} sello={sello} href="/sistema/nucleo/documentos" />
        <Kpi
          titulo="Vigentes con proceso"
          valor={numero(conProceso)}
          unidad={`de ${numero(vigentes.length)}`}
          comparacion={{ texto: `${numero(vigentes.length - conProceso)} vigentes sin proceso vinculado` }}
          sello={sello}
          href="/sistema/nucleo/documentos?f.proceso_ref=%E2%88%85"
        />
        <Kpi titulo="Sin determinar" valor={numero(sinDet)} comparacion={{ texto: 'Estado por decidir en la conciliación' }} sello={sello} href="/sistema/nucleo/documentos/conciliacion?f.motivo=sin_determinar" />
        <Kpi titulo="Obsoletos" valor={numero(obsoletos)} comparacion={{ texto: 'Confirmar que salen de circulación' }} sello={sello} href={`${BIBLIOTECA}&f.estado=obsoleto`} />
        <Kpi titulo="Con datos sensibles" valor={numero(sensibles)} comparacion={{ texto: `${numero(repetidos)} con código reutilizado` }} sello={sello} href={`${BIBLIOTECA}&f.datos_sensibles=true`} />
        <Kpi titulo="En la cola de conciliación" valor={numero(enCola)} comparacion={{ texto: 'Puntos por decidir' }} sello={{ ...sello, fuente: 'sgc.documento + documento_conciliacion' }} href="/sistema/nucleo/documentos/conciliacion" />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Por macroproceso del proceso vinculado</h2>
          <BarrasApiladas filas={porMacro} tramos={TRAMOS} titulo="Documentos por macroproceso y estado" />
        </section>
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Por tipo de documento (YY) · los 12 con más</h2>
          <BarrasApiladas filas={porTipo} tramos={TRAMOS} titulo="Documentos por tipo y estado" />
        </section>
      </div>
    </>
  )
}
