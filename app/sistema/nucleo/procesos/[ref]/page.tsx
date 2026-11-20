import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { PESTANAS } from '@/lib/plataforma/dominios'
import { fichaProceso } from '@/lib/plataforma/fichas/procesos'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FichaObjeto } from '@/components/sistema/ui/ficha-objeto'

export const metadata: Metadata = { title: 'Ficha de proceso · Procesos' }

/**
 * La ficha PHVA de un proceso a página completa: la misma `FichaObjeto` del
 * panel (Datos, Ficha PHVA, Ciclo, Relaciones, Línea de tiempo, Documentos,
 * Aprobaciones, IA), con espacio para trabajarla. Editar un campo abre el
 * borrador; «Enviar a revisión» abre la solicitud. Reemplaza la ficha de la
 * Etapa 1, y es a donde llevan los enlaces de la bandeja.
 */
export default async function FichaProcesoPage({ params }: PageProps<'/sistema/nucleo/procesos/[ref]'>) {
  const [sesion, { ref }] = await Promise.all([requerirPermiso('sistema:procesos'), params])
  const ficha = await fichaProceso(sesion, ref)
  if (!ficha) notFound()
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Catálogo', href: '/sistema/nucleo/procesos/catalogo' }, { etiqueta: ficha.titulo }]}
        // La ficha vive debajo de la ruta del mapa: sin esto, «Mapa» salía como pestaña activa.
        pestanas={(PESTANAS['NUC-PRO'] ?? []).map((p) => (p.href === '/sistema/nucleo/procesos' ? { ...p, href: '/sistema/nucleo/procesos?vista=lienzo' } : p))}
        acciones={
          <Link href={`/sistema/nucleo/procesos/${ref}/imprimir`} className={BOTON_CABECERA}>
            Versión para imprimir
          </Link>
        }
      />
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <FichaObjeto ficha={ficha} variante="pagina" />
      </div>
    </>
  )
}
