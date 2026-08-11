import type { Metadata } from 'next'
import Link from 'next/link'
import { Markdown } from '@/components/markdown'
import { Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, PARTES_INFORME_ORDEN, type ParteInforme } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Informe · Levantamiento y Arquitectura de IA',
}

export default async function InformePage() {
  const { perfil } = await requerirSesion()
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  // RLS ya filtra: los lectores de Iberia solo reciben las secciones publicadas.
  const [{ data: secciones }, { count: entrevistas }, { data: hallazgos }] = await Promise.all([
    supabase
      .from('informe_secciones')
      .select('id, slug, numero, titulo, subtitulo, parte, contenido_md, publicado, updated_at')
      .order('orden'),
    supabase.from('entrevistas').select('id', { count: 'exact', head: true }),
    supabase.from('hallazgos').select('id, estado'),
  ])

  // Solo se muestran secciones con algo escrito: un índice lleno de vacíos no
  // es un informe.
  const conContenido = (secciones ?? []).filter((s) => s.contenido_md?.trim())

  const validados = (hallazgos ?? []).filter((h) => h.estado === 'validado').length

  const ultimaActualizacion = conContenido.reduce<string | null>(
    (max, s) => (!max || s.updated_at > max ? s.updated_at : max),
    null
  )

  if (conContenido.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-12 lg:px-8">
        <div className="tarjeta px-6 py-16 text-center">
          <p className="rotulo justify-center">Fase 1 · Entender</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-marca-900">
            El informe está en construcción
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-marca-600">
            Todavía no hay secciones publicadas. El levantamiento de procesos y el Documento de
            Arquitectura de IA se irán publicando a medida que avance el diagnóstico.
          </p>
          {puedeEditar && (
            <Link href="/dashboard/informe" className="btn-acento mt-6">
              Empezar a escribir
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    // El informe se lee como un documento sobre la mesa: una hoja blanca con
    // el mismo borde y la misma curva que las tarjetas del resto del producto.
    <div className="tarjeta mx-4 my-8 px-5 py-10 lg:mx-auto lg:my-12 lg:max-w-5xl lg:px-10 lg:py-14">
      {/* Portada */}
      <header className="border-b border-[var(--borde)] pb-10">
        <p className="rotulo mb-4">Programa de Adopción de IA · Fase 1</p>
        <h1 className="max-w-3xl text-3xl leading-tight font-bold tracking-tight text-marca-900 sm:text-4xl">
          Levantamiento del proceso y{' '}
          <span className="text-acento-600">arquitectura de IA</span>
        </h1>
        <p className="mt-4 max-w-2xl text-marca-600">
          El mapa del negocio con sus cuellos de botella: dónde interviene la IA y dónde no, en
          qué orden y con qué conexiones al núcleo. Es el instrumento con el que el comité de
          Industrias Iberia decide la Fase 2.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <dt className="text-xs tracking-wide text-marca-500 uppercase">Entrevistas</dt>
            <dd className="mt-1 text-2xl font-bold text-marca-800">{entrevistas ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-marca-500 uppercase">
              Hallazgos validados
            </dt>
            <dd className="mt-1 text-2xl font-bold text-marca-800">{validados}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-marca-500 uppercase">Secciones</dt>
            <dd className="mt-1 text-2xl font-bold text-marca-800">{conContenido.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-marca-500 uppercase">Actualizado</dt>
            <dd className="mt-1 text-sm font-medium text-marca-800">
              {ultimaActualizacion
                ? new Date(ultimaActualizacion).toLocaleDateString('es-VE', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </dd>
          </div>
        </dl>

        <p className="mt-8 border-l-2 border-acento-500 pl-4 text-sm text-marca-600">
          Preparado por Boosty Digital para Industrias Iberia. Documento confidencial: su
          contenido se usa exclusivamente para los fines del programa.
        </p>
      </header>

      <div className="gap-12 lg:flex lg:items-start">
        {/* Índice */}
        <nav
          aria-label="Índice del informe"
          className="mt-10 shrink-0 lg:sticky lg:top-20 lg:order-2 lg:mt-12 lg:w-60"
        >
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-marca-500 uppercase">
            Contenido
          </p>
          <ol className="space-y-1.5 border-l border-[var(--borde)] lg:border-l-0">
            {conContenido.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.slug}`}
                  className="flex gap-2 py-0.5 pl-3 text-sm text-marca-600 transition-colors hover:text-acento-700 lg:pl-0"
                >
                  {s.numero && (
                    <span className="shrink-0 font-mono text-xs text-marca-400">{s.numero}</span>
                  )}
                  <span>{s.titulo}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Secciones */}
        <div className="min-w-0 flex-1 lg:order-1">
          {PARTES_INFORME_ORDEN.map((parte) => {
            const delParte = conContenido.filter((s) => s.parte === parte)
            if (delParte.length === 0) return null

            return (
              <section key={parte}>
                {parte !== 'portada' && (
                  <h2 className="mt-14 mb-2 border-b border-[var(--borde)] pb-2 text-xs font-semibold tracking-[0.14em] text-acento-700 uppercase">
                    {PARTES_INFORME[parte as ParteInforme]}
                  </h2>
                )}

                {delParte.map((s) => (
                  <article
                    key={s.id}
                    id={s.slug}
                    className="scroll-mt-20 border-b border-[var(--borde)] py-10 last:border-b-0"
                  >
                    <div className="mb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.numero && (
                          <span className="font-mono text-xs text-acento-600">{s.numero}</span>
                        )}
                        {/* El borrador solo lo ve el equipo consultor. */}
                        {!s.publicado && <Insignia tono="ambar">Borrador</Insignia>}
                        {puedeEditar && (
                          <Link
                            href={`/dashboard/informe/${s.slug}`}
                            className="text-xs text-marca-400 hover:text-acento-700"
                          >
                            editar
                          </Link>
                        )}
                      </div>

                      <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-marca-800">
                        {s.titulo}
                      </h3>
                      {s.subtitulo && (
                        <p className="mt-1 text-marca-600">{s.subtitulo}</p>
                      )}
                    </div>

                    <Markdown contenido={s.contenido_md!} />
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
