import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_REQUISICIONES } from '@/lib/plataforma/tablas-organizacion'
import { BOTON_CABECERA, BOTON_CABECERA_PRINCIPAL, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Requisiciones · Organización' }

const RUTA = '/sistema/nucleo/organizacion/requisiciones'

/**
 * Requisiciones de personal (II-21-40-001 digital): la tabla de las que la
 * sesión puede ver —las suyas, las de su ruta, o todas con el permiso—, con
 * quién la tiene y cuántos días lleva ahí (lo que Recursos Humanos mira cada
 * mañana). La fila abre la ficha: Impacto · Ruta (con los botones para decidir)
 * · Lo que se pide · Costo 🔒.
 */
export default async function RequisicionesPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/requisiciones'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:requisiciones', 'crear'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [{ data }] = await Promise.all([
    supabase.schema('ui').rpc('requisiciones').select('estado, dias').range(0, 4999),
    precargarMetricas(['requisiciones_abiertas', 'mis_requisiciones'], ctx),
  ])
  const filas = data ?? []
  const cuenta = (f: (r: (typeof filas)[number]) => boolean) => filas.filter(f).length
  const viejas = cuenta((r) => r.estado === 'en_aprobacion' && (r.dias ?? 0) > 5)
  const sello = { fuente: 'Requisiciones y su ruta de aprobación', estado: 'al_dia' as const }
  const mio = sp['f.mia'] === 'si'
  const enlace = (q: string) => `${RUTA}${q ? `?${q}` : ''}`

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Requisiciones' }]}
        acciones={
          <>
            <Link href={enlace(mio ? '' : 'f.mia=si')} className={cn(BOTON_CABECERA, mio && 'border-[#2b2a28] font-semibold')} aria-pressed={mio}>
              {mio ? '✓ Solo las mías' : 'Solo las mías'}
            </Link>
            <Link href={`${RUTA}/nueva`} className={BOTON_CABECERA_PRINCIPAL}>
              + Nueva requisición
            </Link>
          </>
        }
        descripcion={
          puede(sesion, 'sistema:requisiciones')
            ? 'Todas las requisiciones, con el paso en que van, quién la tiene y cuántos días lleva ahí. Una fila abre su ficha con el impacto y la ruta.'
            : 'Las requisiciones que pediste y las que pasan por tu firma. Una fila abre su ficha con el impacto y la ruta.'
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="requisiciones_abiertas" ctx={ctx} sesion={sesion} parte={{ detalle: 'en_aprobacion', titulo: 'En aprobación', texto: 'en su ruta de firmas', href: enlace('f.estado=en_aprobacion') }} />
        <Kpi titulo="Más de 5 días en un paso" valor={numero(viejas)} comparacion={{ texto: 'en la ruta, sin decidir' }} sello={sello} href={enlace('f.estado=en_aprobacion&orden=dias&dir=desc')} />
        <KpiMetrica
          clave="requisiciones_abiertas"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'aprobada_o_seleccion', titulo: 'Aprobadas o en selección', texto: 'esperan candidato e ingreso', href: enlace('f.estado=aprobada&f.estado=en_seleccion') }}
        />
        <KpiMetrica clave="mis_requisiciones" ctx={ctx} sesion={sesion} titulo="Pedidas por mí, vivas" />
      </div>
      <TablaServidor fuente={TABLA_REQUISICIONES} sp={sp} sesion={sesion} ctx={ctx} vacio="No hay requisiciones con estos filtros." />
    </>
  )
}
