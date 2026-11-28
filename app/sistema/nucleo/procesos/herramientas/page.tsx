import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { HERRAMIENTAS_SGC } from '@/lib/plataforma/dominios'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'

export const metadata: Metadata = { title: 'Herramientas del SGC · Procesos' }

/** Lo que antes eran pestañas de Procesos, fuera del camino de quien busca un proceso (rediseño del 28-nov-2026). */
export default async function HerramientasPage() {
  const sesion = await requerirPermiso('sistema:procesos')
  const lista = HERRAMIENTAS_SGC.filter((h) => !h.recurso || puede(sesion, h.recurso as Parameters<typeof puede>[1]))
  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="NUC-PRO" titulo="Procesos" migas={[{ etiqueta: 'Mapa', href: '/sistema/nucleo/procesos' }, { etiqueta: 'Herramientas del SGC' }]} />
      <p className="mb-3 max-w-3xl text-[13px] text-marca-500">
        Para quien administra el Sistema de Gestión de la Calidad. El día a día se hace desde el mapa: macroproceso, proceso y documento.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
        {lista.map((h) => (
          <Link key={h.href} href={h.href} className="grid gap-1 rounded-xl border border-[var(--borde)] bg-white p-4 shadow-[var(--sombra-tarjeta)] hover:border-acento-200">
            <b className="text-sm">{h.etiqueta}</b>
            <span className="text-[13px] text-marca-500">{h.descripcion}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
