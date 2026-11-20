import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_DOCUMENTOS, TABLA_DOCUMENTOS_VIGENTES } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { Segmentos } from '@/components/sistema/procesos/piezas-r2'

export const metadata: Metadata = { title: 'Biblioteca · Documentos' }

/**
 * La biblioteca del SGC (NUC-DOC · Explorar): vigentes por defecto, o todo el
 * inventario con `?ver=todos`. Filtros en chips por estado, tipo YY y proceso
 * XX (con sus nombres), proceso vinculado, macroproceso, familia, perímetro y
 * datos sensibles; búsqueda sin tildes por código, alias y título. La fila abre
 * la ficha del documento.
 *
 * Los documentos de perímetro (nómina, médico, PCP, fórmulas) solo existen
 * para quien tiene `sistema:perimetros`: lo cierra la RLS, no esta página.
 */
export default async function DocumentosPage({ searchParams }: PageProps<'/sistema/nucleo/documentos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:documentos'), searchParams])
  const ctx = await leerContexto(sp)
  const todos = sp.ver === 'todos'
  const fuente = todos ? TABLA_DOCUMENTOS : TABLA_DOCUMENTOS_VIGENTES
  const vePerimetros = puede(sesion, 'sistema:perimetros')
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-DOC"
        titulo="Documentos"
        migas={[{ etiqueta: 'Biblioteca' }]}
        descripcion={`El inventario del SGC: código, versión, estado, tipo, proceso y alias. Busca por código (también los viejos), alias o título, sin importar tildes.${vePerimetros ? '' : ' Los documentos de perímetro no están a tu alcance.'}`}
      />
      <Segmentos
        etiqueta="Qué documentos ver"
        activa={todos ? 'todos' : 'vigentes'}
        opciones={[
          { valor: 'vigentes', etiqueta: 'Vigentes', href: '/sistema/nucleo/documentos' },
          { valor: 'todos', etiqueta: 'Todo el inventario', href: '/sistema/nucleo/documentos?ver=todos' },
        ]}
      />
      <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} vacio="Nada coincide con esa búsqueda." />
    </>
  )
}
