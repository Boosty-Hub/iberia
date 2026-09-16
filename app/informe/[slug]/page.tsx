import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/markdown'
import { Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, type ParteInforme } from '@/lib/types'

/**
 * Una sección del informe, una página.
 *
 * El índice vive en el layout, así que acá solo va la sección y las flechas
 * para pasar a la siguiente: un documento se lee de corrido, y obligar a volver
 * al índice entre sección y sección lo rompe.
 */

/** Las secciones que el usuario puede ver, ya filtradas por RLS. */
async function leerSecciones() {
  const { perfil } = await requerirSesion()
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const { data } = await supabase
    .from('informe_secciones')
    .select('id, slug, numero, titulo, subtitulo, parte, contenido_md, publicado, updated_at')
    .order('orden')

  const todas = data ?? []
  return {
    puedeEditar,
    // Un lector de Iberia no llega a una sección en blanco ni por la URL: para
    // él no existe. Quien escribe sí, que es de lo que vive el armazón.
    visibles: puedeEditar ? todas : todas.filter((s) => s.contenido_md?.trim()),
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/informe/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const { visibles } = await leerSecciones()
  const seccion = visibles.find((s) => s.slug === slug)

  return {
    title: seccion ? `${seccion.titulo} · Informe` : 'Informe',
  }
}

export default async function SeccionInformePage({ params }: PageProps<'/informe/[slug]'>) {
  const { slug } = await params
  const { puedeEditar, visibles } = await leerSecciones()

  const i = visibles.findIndex((s) => s.slug === slug)
  if (i === -1) notFound()

  const seccion = visibles[i]
  const anterior = i > 0 ? visibles[i - 1] : null
  const siguiente = i < visibles.length - 1 ? visibles[i + 1] : null
  const escrita = Boolean(seccion.contenido_md?.trim())

  return (
    <article className="tarjeta mx-4 my-8 max-w-4xl px-5 py-10 lg:mx-8 lg:my-10 lg:px-10 lg:py-12">
      <header className="border-b border-[var(--borde)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/informe" className="text-xs text-marca-400 hover:text-acento-700">
            Informe
          </Link>
          <span className="text-xs text-marca-300">/</span>
          <span className="text-xs text-marca-500">
            {PARTES_INFORME[seccion.parte as ParteInforme]}
          </span>
          {seccion.numero && (
            <span className="font-mono text-xs text-acento-600">{seccion.numero}</span>
          )}
          {/* El borrador solo lo ve el equipo consultor. */}
          {!seccion.publicado && <Insignia tono="ambar">Borrador</Insignia>}
          {puedeEditar && (
            <Link
              href={`/dashboard/informe/${seccion.slug}`}
              className="text-xs text-marca-400 hover:text-acento-700"
            >
              editar
            </Link>
          )}
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-marca-900">{seccion.titulo}</h1>
        {seccion.subtitulo && <p className="mt-2 text-marca-600">{seccion.subtitulo}</p>}
      </header>

      <div className="py-8">
        {escrita ? (
          <Markdown contenido={seccion.contenido_md!} />
        ) : (
          // Solo la ve un editor: `visibles` no le entrega secciones vacías al
          // lector de Iberia.
          <div className="rounded-xl border border-dashed border-[var(--borde)] px-6 py-12 text-center">
            <p className="text-sm text-marca-400">Esta sección está por escribir.</p>
            {puedeEditar && (
              <Link href={`/dashboard/informe/${seccion.slug}`} className="btn-acento mt-5">
                Escribirla
              </Link>
            )}
          </div>
        )}
      </div>

      <nav
        aria-label="Secciones contiguas"
        className="flex flex-wrap items-stretch justify-between gap-3 border-t border-[var(--borde)] pt-6"
      >
        {anterior ? (
          <Link
            href={`/informe/${anterior.slug}`}
            className="group min-w-0 flex-1 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--fondo)]"
          >
            <span className="block text-xs text-marca-400">← Anterior</span>
            <span className="block truncate text-sm font-semibold text-marca-700 group-hover:text-acento-700">
              {anterior.titulo}
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}

        {siguiente ? (
          <Link
            href={`/informe/${siguiente.slug}`}
            className="group min-w-0 flex-1 rounded-xl px-3 py-2 text-right transition-colors hover:bg-[var(--fondo)]"
          >
            <span className="block text-xs text-marca-400">Siguiente →</span>
            <span className="block truncate text-sm font-semibold text-marca-700 group-hover:text-acento-700">
              {siguiente.titulo}
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </article>
  )
}
