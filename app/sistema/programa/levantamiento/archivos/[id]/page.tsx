import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaCorta } from '@/lib/plataforma/formato'
import { CATEGORIAS_ARCHIVO, type CategoriaArchivo } from '@/lib/types'
import { formatBytes } from '@/lib/utils'
import { CabeceraModulo, BOTON_CABECERA } from '@/components/sistema/ui/cabecera-modulo'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { VisorArchivo } from '@/components/previa-archivo'
import { eliminarArchivo } from '../acciones'

export const metadata: Metadata = { title: 'Archivo · Levantamiento' }

/**
 * PRG-LEV · Ver un archivo del expediente sin descargarlo: el visor lee los
 * bytes de `[id]/ver` (mismo origen, `inline`, sin caché). Lo que el navegador
 * no abre (hojas de cálculo, Office) se dice, con la descarga firmada de 60 s.
 */
export default async function ArchivoPage({ params }: PageProps<'/sistema/programa/levantamiento/archivos/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('modulo:archivos'), params])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: a } = await supabase
    .from('archivos')
    .select('id, nombre, descripcion, mime_type, tamano_bytes, categoria, confidencial, created_at, areas(nombre), entrevistas(id, codigo)')
    .eq('id', id)
    .maybeSingle()
  if (!a) notFound()
  const eliminar = puede(sesion, 'modulo:archivos', 'eliminar')

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        titulo={a.nombre}
        migas={[{ etiqueta: 'Archivos', href: '/sistema/programa/levantamiento/archivos' }, { etiqueta: 'Ver' }]}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{CATEGORIAS_ARCHIVO[a.categoria as CategoriaArchivo] ?? a.categoria}</span>
            {a.areas?.nombre && <span>{a.areas.nombre}</span>}
            {a.entrevistas && puede(sesion, 'modulo:entrevistas') && (
              <BotonFicha tipo="entrevista" id={a.entrevistas.id} className="font-mono text-acento-700">
                {a.entrevistas.codigo}
              </BotonFicha>
            )}
            <span>{formatBytes(a.tamano_bytes)}</span>
            <span>Subido el {fechaCorta(a.created_at)}</span>
            {a.confidencial && <span className="rounded-full bg-[#fdf4e3] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a12]">Confidencial</span>}
          </span>
        }
        acciones={
          <>
            {/* Enlace simple, no `Link`: la ruta firma una URL de 60 s y no se precarga. */}
            <a href={`/sistema/programa/levantamiento/archivos/${id}/descargar`} className={BOTON_CABECERA}>
              Descargar
            </a>
            {eliminar && (
              <form action={eliminarArchivo}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="volver" value="lista" />
                <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-acento-300 bg-white px-2.5 text-xs font-medium text-acento-700 hover:bg-acento-50">
                  Eliminar
                </button>
              </form>
            )}
          </>
        }
      />
      {a.descripcion && <p className="mb-2 max-w-3xl text-[12.5px] text-marca-600">{a.descripcion}</p>}
      <div tabIndex={0} role="region" aria-label={`Contenido de ${a.nombre}`} className="h-[calc(100dvh-14rem)] min-h-[420px] overflow-auto rounded-xl border border-[var(--borde)] bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500">
        <VisorArchivo id={a.id} nombre={a.nombre} mime={a.mime_type} />
      </div>
    </>
  )
}
