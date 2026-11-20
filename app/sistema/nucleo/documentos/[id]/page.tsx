import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { fichaDocumento } from '@/lib/plataforma/fichas/procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FichaObjeto } from '@/components/sistema/ui/ficha-objeto'

export const metadata: Metadata = { title: 'Documento · Documentos' }

/**
 * La ficha de un documento a página completa: la misma `FichaObjeto` del
 * panel, con los metadatos corregibles (cada corrección queda en la
 * auditoría), los alias, los archivos de origen por su nombre, el proceso, el
 * aviso de datos sensibles y su cola de conciliación. La RLS decide: un
 * documento de perímetro, sin el permiso, no existe.
 */
export default async function DocumentoPage({ params }: PageProps<'/sistema/nucleo/documentos/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('sistema:documentos'), params])
  const ficha = await fichaDocumento(sesion, id)
  if (!ficha) notFound()
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-DOC"
        titulo="Documentos"
        migas={[{ etiqueta: 'Biblioteca', href: '/sistema/nucleo/documentos' }, { etiqueta: ficha.codigo ?? ficha.titulo }]}
      />
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <FichaObjeto ficha={ficha} variante="pagina" />
      </div>
    </>
  )
}
