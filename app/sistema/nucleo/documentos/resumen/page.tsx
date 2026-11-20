import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
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
export default async function ResumenDocumentosPage({ searchParams }: PageProps<'/sistema/nucleo/documentos/resumen'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:documentos'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [docs] = await Promise.all([
    todosLosDocumentos(supabase),
    precargarMetricas(['documentos_vigentes', 'documentos_en_conciliacion', 'documentos_inventario'], ctx),
  ])
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
      {/* Las cifras salen del registro de métricas (`ui.metrica`): las mismas de Mi día. */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiMetrica clave="documentos_vigentes" ctx={ctx} sesion={sesion} titulo="Vigentes" />
        <KpiMetrica
          clave="documentos_vigentes"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'con_proceso', titulo: 'Vigentes con proceso', deTotal: true, texto: 'vinculados a un proceso · el clic abre los que no', href: '/sistema/nucleo/documentos?f.proceso_ref=%E2%88%85' }}
        />
        <KpiMetrica
          clave="documentos_en_conciliacion"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'sin_determinar', titulo: 'Sin determinar', texto: 'Estado por decidir en la conciliación', href: '/sistema/nucleo/documentos/conciliacion?f.motivo=sin_determinar' }}
        />
        <KpiMetrica
          clave="documentos_inventario"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'obsoleto', titulo: 'Obsoletos', texto: 'Confirmar que salen de circulación', href: `${BIBLIOTECA}&f.estado=obsoleto` }}
        />
        <KpiMetrica
          clave="documentos_inventario"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'datos_sensibles', titulo: 'Con datos sensibles', texto: 'Sanear antes de difundir', href: `${BIBLIOTECA}&f.datos_sensibles=true` }}
        />
        <KpiMetrica clave="documentos_en_conciliacion" ctx={ctx} sesion={sesion} titulo="En la cola de conciliación" />
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
