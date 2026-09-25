import type { Metadata } from 'next'
import Link from 'next/link'
import { Insignia } from '@/components/ui'
import { esEditor, puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, PARTES_INFORME_ORDEN, type ParteInforme } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Informe · Levantamiento y Arquitectura de IA',
}

/**
 * La portada del informe.
 *
 * Se lee como la tapa de un documento: el título, cuánto se cubrió y el
 * contenido. **El contenido va en tarjetas por parte, en rejilla**: en una sola
 * columna de 896 px pegada a la izquierda, una pantalla de 1920 dejaba vacío
 * casi la mitad del ancho, y en teléfono la lista era la única navegación — lo
 * sigue siendo, junto al botón de menú de la cabecera.
 */
export default async function InformePage() {
  const sesion = await requerirSesion()
  const quienEscribe = esEditor(sesion.perfil)
  const supabase = await createClient()

  // RLS ya filtra por publicado y por la casilla «ver» de cada rol.
  const [{ data: secciones }, { count: entrevistas }, { data: hallazgos }] = await Promise.all([
    supabase
      .from('informe_secciones')
      .select('id, slug, numero, titulo, subtitulo, parte, contenido_md, publicado, updated_at')
      .order('orden'),
    // Solo las de tipo 'entrevista': las reuniones de comité, los recorridos y
    // las formaciones son sesiones del levantamiento, pero no cuentan contra las
    // ~25 entrevistas que compromete el programa. Rotularlas como entrevistas en
    // el documento que lee el cliente sería inflar el avance.
    supabase.from('entrevistas').select('id', { count: 'exact', head: true }).eq('tipo', 'entrevista'),
    supabase.from('hallazgos').select('id, estado'),
  ])

  const todas = (secciones ?? []).filter((s) => puede(sesion, `informe:${s.slug}`))
  const conContenido = todas.filter((s) => s.contenido_md?.trim())
  const visibles = quienEscribe ? todas : conContenido

  const validados = (hallazgos ?? []).filter((h) => h.estado === 'validado').length
  const ultimaActualizacion = conContenido.reduce<string | null>(
    (max, s) => (!max || s.updated_at > max ? s.updated_at : max),
    null
  )

  if (visibles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
        <div className="tarjeta px-6 py-16 text-center">
          <p className="rotulo justify-center">Fase 1 · Entender</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-marca-900">
            El informe está en construcción
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-marca-600">
            Todavía no hay secciones publicadas. El levantamiento de procesos y el Documento de
            Arquitectura de IA se irán publicando a medida que avance el diagnóstico.
          </p>
          {quienEscribe && puede(sesion, 'modulo:informe') && (
            <Link href="/dashboard/informe" className="btn-acento mt-6">
              Empezar a escribir
            </Link>
          )}
        </div>
      </div>
    )
  }

  const primera = visibles[0]
  const cifras = [
    { rotulo: 'Entrevistas', valor: String(entrevistas ?? 0) },
    { rotulo: 'Hallazgos validados', valor: String(validados) },
    {
      rotulo: 'Secciones',
      // Quien escribe necesita ver cuánto falta; al lector de Iberia el
      // denominador no le dice nada, porque no ve las que están en blanco.
      valor: quienEscribe ? `${conContenido.length} / ${visibles.length}` : String(conContenido.length),
    },
    {
      rotulo: 'Actualizado',
      valor: ultimaActualizacion
        ? new Date(ultimaActualizacion).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
      pequena: true,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1200px] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <header className="hoja-informe portada-cabecera">
        <p className="rotulo mb-4">Programa de Adopción de IA · Fase 1</p>
        <h1 className="max-w-3xl text-[2rem] leading-[1.15] font-bold tracking-tight text-balance text-marca-900 sm:text-5xl">
          Levantamiento del proceso y <span className="text-acento-600">arquitectura de IA</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-pretty text-marca-600 sm:text-lg">
          El mapa del negocio con sus cuellos de botella: dónde interviene la IA y dónde no, en qué orden
          y con qué conexiones al núcleo. Es el instrumento con el que el comité de Industrias Iberia
          decide la Fase 2.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cifras.map((c) => (
            <div key={c.rotulo} className="rounded-xl border border-[var(--borde)] bg-[var(--fondo)] px-4 py-3">
              <dt className="text-[11px] font-medium tracking-wide text-marca-500 uppercase">{c.rotulo}</dt>
              <dd
                className={
                  c.pequena
                    ? 'mt-1.5 text-sm font-semibold text-marca-800'
                    : 'mt-1 text-2xl font-bold tabular-nums text-marca-800'
                }
              >
                {c.valor}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col gap-4 border-t border-[var(--borde)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl border-l-2 border-acento-500 pl-4 text-sm text-pretty text-marca-600">
            Preparado por Boosty Digital para Industrias Iberia. Documento confidencial: su contenido se
            usa exclusivamente para los fines del programa.
          </p>
          {primera && (
            <Link href={`/informe/${primera.slug}`} className="btn-acento shrink-0">
              Empezar a leer
            </Link>
          )}
        </div>
      </header>

      {/* El contenido. En pantalla ancha repite la barra lateral, y está bien:
          es la portada de un documento y una portada lleva su índice. */}
      <section aria-labelledby="contenido" className="px-4 pt-10 pb-6 sm:px-0">
        <h2 id="contenido" className="text-xs font-semibold tracking-[0.14em] text-marca-500 uppercase">
          Contenido
        </h2>

        {PARTES_INFORME_ORDEN.map((parte) => {
          const delParte = visibles.filter((s) => s.parte === parte)
          if (delParte.length === 0) return null

          return (
            <div key={parte} className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-acento-700">
                {PARTES_INFORME[parte as ParteInforme]}
              </h3>
              <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {delParte.map((s) => {
                  const escrita = Boolean(s.contenido_md?.trim())
                  return (
                    <li key={s.id}>
                      <Link href={`/informe/${s.slug}`} className="tarjeta-seccion group">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-acento-600">{s.numero ?? '—'}</span>
                          {!escrita && <span className="text-xs text-marca-400">Por escribir</span>}
                          {quienEscribe && !s.publicado && escrita && <Insignia tono="ambar">Borrador</Insignia>}
                        </span>
                        <span className="mt-2 block font-semibold text-balance text-marca-900 group-hover:text-acento-700">
                          {s.titulo}
                        </span>
                        {s.subtitulo && (
                          <span className="mt-1 block text-sm text-pretty text-marca-500">{s.subtitulo}</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </section>
    </div>
  )
}
