import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_HISTORIAL_ORG } from '@/lib/plataforma/tablas-organizacion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Historial · Organización' }

/**
 * Historial de la estructura: la auditoría de `org.*` (y de los parámetros y la
 * conciliación), de solo inserción y encadenada, con el objeto por su nombre y
 * el cambio escrito para leerse («Dotación: 2 → 3 · Vigencia: desde …»). Lo
 * que es perímetro de nómina sale solo con `sistema:costos`: la base lo filtra.
 */
export default async function HistorialPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/historial'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:auditoria'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Historial' }]}
        descripcion={`Quién cambió qué y cuándo en la estructura, el plan, las requisiciones y los escenarios. Nada se borra: un cambio cierra la versión anterior y abre otra.${puede(sesion, 'sistema:costos') ? ' Incluye lo del perímetro de nómina (🔒).' : ''}`}
      />
      <TablaServidor fuente={TABLA_HISTORIAL_ORG} sp={sp} sesion={sesion} ctx={ctx} vacio="Sin cambios con estos filtros." />
    </>
  )
}
