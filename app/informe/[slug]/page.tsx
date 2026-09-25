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
import { IconoEditar } from '@/components/iconos'
import { IndiceSeccion } from '@/components/informe/indice-seccion'
import { Markdown } from '@/components/markdown'
import { MarkdownPlegable } from '@/components/markdown-plegable'
import { Insignia } from '@/components/ui'
import { esEditor, puede, requerirSesion } from '@/lib/auth'
import { encabezadosDe, minutosDeLectura } from '@/lib/encabezados'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, type ParteInforme } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Una sección del informe, una página.
 *
 * El índice del documento vive en el layout; aquí va la sección, su propio
 * índice («En esta sección») y las flechas para pasar a la siguiente: un
 * documento se lee de corrido, y obligar a volver al índice lo rompe.
 *
 * **La maqueta, de ancho a estrecho.** La hoja se centra en su columna, con una
 * medida de lectura fija; a partir de 1400 px sale a su lado el índice de la
 * sección, pegado al hacer scroll. Antes la hoja iba pegada a la izquierda y en
 * una pantalla de 1920 dejaba 736 px vacíos a la derecha. Por debajo, el índice
 * de la sección va plegado arriba del texto, y en teléfono la hoja ocupa el
 * ancho entero: con margen y relleno a los dos lados, el texto se quedaba en
 * 318 px de 390.
 */

/**
 * Las secciones que se pliegan por sus encabezados de nivel 2.
 *
 * Es una lista y no una propiedad de la sección a propósito: plegar es una
 * decisión de lectura de esta página, no un atributo del contenido.
 */
const PLEGABLES = new Set(['fichas-procesos'])

/**
 * Las secciones que llevan una vista interactiva de los circuitos arriba de su
 * prosa. Van por slug por lo mismo que `PLEGABLES`. Su hoja es más ancha —el
 * anillo mide 1080— y su índice lateral sale más tarde, cuando cabe al lado del
 * dibujo sin encogerlo.
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

/** Las secciones que el usuario puede ver, ya filtradas por RLS y por su rol. */
async function leerSecciones() {
  const sesion = await requerirSesion()
  const quienEscribe = esEditor(sesion.perfil)
  const supabase = await createClient()

  const { data } = await supabase
    .from('informe_secciones')
    .select('id, slug, numero, titulo, subtitulo, parte, contenido_md, publicado, updated_at')
    .order('orden')

  const todas = (data ?? []).filter((s) => puede(sesion, `informe:${s.slug}`))
  return {
    sesion,
    quienEscribe,
    // Un lector de Iberia no llega a una sección en blanco ni por la URL: para
    // él no existe. Quien escribe sí, que es de lo que vive el armazón.
    visibles: quienEscribe ? todas : todas.filter((s) => s.contenido_md?.trim()),
  }
}

export async function generateMetadata({ params }: PageProps<'/informe/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const { visibles } = await leerSecciones()
  const seccion = visibles.find((s) => s.slug === slug)
  return { title: seccion ? `${seccion.titulo} · Informe` : 'Informe' }
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function SeccionInformePage({ params, searchParams }: PageProps<'/informe/[slug]'>) {
  const [{ slug }, consulta] = await Promise.all([params, searchParams])
  const { sesion, quienEscribe, visibles } = await leerSecciones()

  const i = visibles.findIndex((s) => s.slug === slug)
  if (i === -1) notFound()

  const seccion = visibles[i]
  const anterior = i > 0 ? visibles[i - 1] : null
  const siguiente = i < visibles.length - 1 ? visibles[i + 1] : null
  const escrita = Boolean(seccion.contenido_md?.trim())
  const puedeEditarla = quienEscribe && puede(sesion, `informe:${seccion.slug}`, 'editar')
  const conCircuitos = CON_CIRCUITOS.has(seccion.slug)
  const plegable = PLEGABLES.has(seccion.slug)
  const circuitos = conCircuitos ? await leerCircuitos() : null
  // Las fichas ya tienen su subíndice en la columna izquierda, por nivel y por
  // ficha: un segundo índice con los mismos niveles a la derecha sería ruido.
  const indice = plegable ? [] : encabezadosDe(seccion.contenido_md)
  const minutos = minutosDeLectura(seccion.contenido_md)
  const pedido = (clave: string) => {
    const v = consulta[clave]
    return typeof v === 'string' ? v : undefined
  }

  // Desde qué ancho sale el índice a su columna: con el dibujo de los
  // circuitos, solo cuando cabe al lado sin encogerlo.
  const conLateral = indice.length >= 2
  const rejilla = conLateral
    ? conCircuitos
      ? 'min-[1760px]:grid min-[1760px]:grid-cols-[minmax(0,1fr)_232px] min-[1760px]:gap-10'
      : 'min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,1fr)_232px] min-[1400px]:gap-10'
    : ''
  const lateralVisible = conCircuitos ? 'min-[1760px]:block' : 'min-[1400px]:block'
  const plegadoOculto = conCircuitos ? 'min-[1760px]:hidden' : 'min-[1400px]:hidden'

  return (
    <div
      className={cn(
        'mx-auto w-full sm:px-6 sm:py-8 lg:px-8 lg:py-10',
        conCircuitos ? 'max-w-[1640px]' : conLateral ? 'max-w-[1200px]' : 'max-w-[960px]'
      )}
    >
      <div className={rejilla}>
        <article className={cn('hoja-informe', conCircuitos ? 'mx-auto w-full' : 'mx-auto w-full max-w-[840px]')}>
          <header className="border-b border-[var(--borde)] pb-6">
            <nav aria-label="Ruta" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
              <Link href="/informe" className="migas-enlace">
                Informe
              </Link>
              <span className="text-marca-300" aria-hidden>
                /
              </span>
              <span className="px-1 text-marca-500">{PARTES_INFORME[seccion.parte as ParteInforme]}</span>
              {seccion.numero && <span className="font-mono text-acento-600">{seccion.numero}</span>}
              {/* El borrador solo lo ve el equipo consultor. */}
              {!seccion.publicado && (
                <Insignia tono="ambar" className="ml-1">
                  Borrador
                </Insignia>
              )}
              {puedeEditarla && (
                <Link href={`/dashboard/informe/${seccion.slug}`} className="btn-neutro ml-auto h-9 px-3 text-xs">
                  <IconoEditar className="h-3.5 w-3.5" />
                  Editar
                </Link>
              )}
            </nav>

            <h1 className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight text-balance text-marca-900 sm:text-4xl">
              {seccion.titulo}
            </h1>
            {seccion.subtitulo && (
              <p className="mt-3 text-base text-pretty text-marca-600 sm:text-lg">{seccion.subtitulo}</p>
            )}
            {escrita && (
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-marca-400">
                <span>{minutos} min de lectura</span>
                <span>Actualizada el {fecha(seccion.updated_at)}</span>
              </p>
            )}
          </header>

          {/* La puerta al mapa interactivo. Va aquí y no dentro del markdown
              porque el renderizador descarta el HTML crudo. */}
          {seccion.slug === 'mapa-procesos' && escrita && puede(sesion, 'informe:mapa-interactivo') && (
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

          {conLateral && (
            <div className={cn('mt-6', plegadoOculto)}>
              <IndiceSeccion entradas={indice} variante="plegado" />
            </div>
          )}

          {/* Solo el dibujo va ancho: la prosa vuelve a la medida de lectura. */}
          <div className={cn('py-8', conCircuitos && 'mx-auto max-w-[760px]')}>
            {escrita ? (
              plegable ? (
                <MarkdownPlegable contenido={seccion.contenido_md!} />
              ) : (
                <Markdown contenido={seccion.contenido_md!} />
              )
            ) : (
              // Solo la ve un editor: `visibles` no le entrega secciones vacías al
              // lector de Iberia.
              <div className="rounded-xl border border-dashed border-[var(--borde)] px-6 py-12 text-center">
                <p className="text-sm text-marca-400">Esta sección está por escribir.</p>
                {puedeEditarla && (
                  <Link href={`/dashboard/informe/${seccion.slug}`} className="btn-acento mt-5">
                    Escribirla
                  </Link>
                )}
              </div>
            )}
          </div>

          <nav aria-label="Secciones contiguas" className="grid gap-3 border-t border-[var(--borde)] pt-6 sm:grid-cols-2">
            {anterior ? (
              <Link href={`/informe/${anterior.slug}`} className="contigua">
                <span className="text-xs text-marca-400">← Anterior</span>
                <span className="contigua-titulo">
                  {anterior.numero && <span className="font-mono text-marca-400">{anterior.numero}</span>}
                  {anterior.titulo}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {siguiente ? (
              <Link href={`/informe/${siguiente.slug}`} className="contigua sm:text-right">
                <span className="text-xs text-marca-400">Siguiente →</span>
                <span className="contigua-titulo sm:justify-end">
                  {siguiente.numero && <span className="font-mono text-marca-400">{siguiente.numero}</span>}
                  {siguiente.titulo}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
          </nav>
        </article>

        {conLateral && (
          <aside className={cn('hidden', lateralVisible)}>
            <div className="sticky top-[92px] max-h-[calc(100vh-120px)] overflow-y-auto">
              <IndiceSeccion entradas={indice} variante="lateral" />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
