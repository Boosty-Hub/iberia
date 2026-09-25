import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  CircuitosDelNegocio,
  EspejoIberia,
  type ModuloIberia,
  type PuntoCircuito,
  type TextosCircuitos,
} from '@/components/circuitos-informe'
import { Markdown } from '@/components/markdown'
import { MarkdownPlegable } from '@/components/markdown-plegable'
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

/**
 * Las secciones que se pliegan por sus encabezados de nivel 2.
 *
 * Es una lista y no una propiedad de la sección a propósito: plegar es una
 * decisión de lectura de esta página, no un atributo del contenido. Si mañana
 * otra sección crece hasta ahí, se añade su slug y ya.
 */
const PLEGABLES = new Set(['fichas-procesos'])

/**
 * Las secciones que llevan una vista interactiva de los circuitos arriba de su
 * prosa. Van por slug por lo mismo que `PLEGABLES`: enseñar el dibujo es una
 * decisión de esta página. Y van más anchas: el anillo mide 1080 de ancho y a
 * la medida de lectura del resto se volvería ilegible.
 */
const CON_CIRCUITOS = new Set(['circuitos', 'arquitectura-ia'])

/**
 * El contenido de los circuitos sale de la base, no del código: el repositorio
 * es público y los textos son de Iberia. Lo siembra `sembrar:circuitos`.
 */
async function leerCircuitos() {
  const supabase = await createClient()
  const [{ data: puntos }, { data: modulos }, { data: textos }] = await Promise.all([
    supabase.from('informe_circuito_puntos').select('*').order('numero'),
    supabase.from('informe_modulos').select('*').order('numero'),
    supabase.from('informe_circuito_textos').select('clave, contenido'),
  ])
  return {
    puntos: (puntos ?? []) as unknown as PuntoCircuito[],
    modulos: (modulos ?? []) as unknown as ModuloIberia[],
    textos: Object.fromEntries((textos ?? []).map((t) => [t.clave, t.contenido])) as TextosCircuitos,
  }
}

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

export default async function SeccionInformePage({ params, searchParams }: PageProps<'/informe/[slug]'>) {
  const [{ slug }, consulta] = await Promise.all([params, searchParams])
  const { puedeEditar, visibles } = await leerSecciones()

  const i = visibles.findIndex((s) => s.slug === slug)
  if (i === -1) notFound()

  const seccion = visibles[i]
  const anterior = i > 0 ? visibles[i - 1] : null
  const siguiente = i < visibles.length - 1 ? visibles[i + 1] : null
  const escrita = Boolean(seccion.contenido_md?.trim())
  const conCircuitos = CON_CIRCUITOS.has(seccion.slug)
  const circuitos = conCircuitos ? await leerCircuitos() : null
  const pedido = (clave: string) => {
    const v = consulta[clave]
    return typeof v === 'string' ? v : undefined
  }

  return (
    <article
      className={`tarjeta mx-4 my-8 px-5 py-10 lg:mx-8 lg:my-10 lg:px-10 lg:py-12 ${conCircuitos ? 'max-w-6xl' : 'max-w-4xl'}`}
    >
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

      {/* La puerta al mapa interactivo. Va aquí y no dentro del markdown
          porque el renderizador descarta el HTML crudo: un botón escrito en el
          taller llegaría como texto. Y va por slug, igual que `PLEGABLES`:
          enseñar el mapa es una decisión de esta página, no un atributo del
          contenido. */}
      {seccion.slug === 'mapa-procesos' && escrita && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/informe/mapa-interactivo" className="btn-mapa">
            <span aria-hidden>▦</span> Visitar el mapa interactivo
          </Link>
          <span className="text-xs text-marca-400">
            Los veinte macroprocesos en un solo dibujo, y cada proceso lleva a su ficha.
          </span>
        </div>
      )}

      {/* Los circuitos van arriba de la prosa: la sección se lee mirando el
          dibujo, y el texto explica lo que el lector ya tiene delante. */}
      {circuitos && seccion.slug === 'circuitos' && (
        <CircuitosDelNegocio
          puntos={circuitos.puntos}
          modulos={circuitos.modulos}
          textos={circuitos.textos}
          inicial={pedido('punto')}
        />
      )}
      {circuitos && seccion.slug === 'arquitectura-ia' && (
        <EspejoIberia
          modulos={circuitos.modulos}
          puntos={circuitos.puntos}
          textos={circuitos.textos}
          inicial={pedido('modulo')}
        />
      )}

      {/* Solo el dibujo va ancho. La prosa vuelve a la medida de lectura del
          resto del informe: a todo el ancho salían 150 caracteres por línea. */}
      <div className={`py-8 ${conCircuitos ? 'max-w-[51rem]' : ''}`}>
        {escrita ? (
          // «Las fichas de proceso» son veinte macroprocesos y cincuenta mil
          // caracteres: de corrido no se leen. Se pliegan por nivel. El resto de
          // secciones va entera, que es como se lee un documento.
          PLEGABLES.has(seccion.slug) ? (
            <MarkdownPlegable contenido={seccion.contenido_md!} />
          ) : (
            <Markdown contenido={seccion.contenido_md!} />
          )
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
