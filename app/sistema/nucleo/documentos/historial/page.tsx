import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_HISTORIAL_DOCUMENTOS } from '@/lib/plataforma/tablas-procesos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Historial · Documentos' }

/**
 * Quién corrigió qué en el inventario de documentos y qué se decidió en la
 * conciliación (`ui.historial_documentos`, sobre `control.auditoria`). Lo ve
 * quien tiene el permiso de auditoría, y el perímetro sigue cerrado.
 */
export default async function HistorialDocumentosPage({ searchParams }: PageProps<'/sistema/nucleo/documentos/historial'>) {
  await requerirPermiso('sistema:documentos')
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:auditoria'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-DOC"
        titulo="Documentos"
        migas={[{ etiqueta: 'Historial' }]}
        descripcion="Cada corrección de metadatos y cada decisión de la conciliación, con quién y cuándo. La carga inicial sale como «Sistema». Una fila abre la ficha del documento."
      />
      <TablaServidor fuente={TABLA_HISTORIAL_DOCUMENTOS} sp={sp} sesion={sesion} ctx={ctx} vacio="Sin cambios con estos filtros." />
    </>
  )
}
