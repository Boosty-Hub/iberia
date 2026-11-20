import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_ESCENARIOS } from '@/lib/plataforma/tablas-organizacion'
import { NuevoEscenario } from '@/components/sistema/organizacion/nuevo-escenario'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Escenarios · Organización' }

/**
 * Escenarios de estructura (Anexo E §9: «modo escenario global sobre el lienzo
 * y las tablas; lista de escenarios»). La tabla dice cuánto cambia cada uno
 * contra la realidad de su fecha base; la ficha abre el lienzo en modo
 * escenario (`?esc=`), muestra la lista de cambios y el costo 🔒, y lo envía a
 * aprobar con su fecha. Los de procesos viven en su módulo.
 */
export default async function EscenariosPage({ searchParams }: PageProps<'/sistema/nucleo/escenarios'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:escenarios'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Escenarios' }]}
        acciones={
          <>
            <Link href="/sistema/nucleo/procesos/escenarios" className={BOTON_CABECERA}>
              Escenarios de procesos
            </Link>
            {puede(sesion, 'sistema:escenarios', 'crear') && <NuevoEscenario abierto={sp.nuevo === '1'} />}
          </>
        }
        descripcion="Diseña la estructura como debería ser sin tocar la de hoy: altas, cierres y movimientos contra la realidad de su fecha base. Una fila abre su ficha; desde ahí, el lienzo en modo escenario, la comparación y el envío a aprobación."
      />
      <TablaServidor
        fuente={TABLA_ESCENARIOS}
        sp={sp}
        sesion={sesion}
        ctx={ctx}
        vacio="No hay escenarios con estos filtros."
      />
    </>
  )
}
