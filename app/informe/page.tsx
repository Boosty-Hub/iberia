import type { Metadata } from 'next'
import Link from 'next/link'
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
    // Solo las de tipo 'entrevista': las reuniones de comité, los recorridos y
    // las formaciones son sesiones del levantamiento, pero no cuentan contra las
    // ~25 entrevistas que compromete el programa. Rotularlas como entrevistas en
    // el documento que lee el cliente sería inflar el avance.
    supabase
      .from('entrevistas')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'entrevista'),
    supabase.from('hallazgos').select('id, estado'),
  ])

  const todas = secciones ?? []
  const conContenido = todas.filter((s) => s.contenido_md?.trim())
  const visibles = puedeEditar ? todas : conContenido

  const validados = (hallazgos ?? []).filter((h) => h.estado === 'validado').length
  const ultimaActualizacion = conContenido.reduce<string | null>(
    (max, s) => (!max || s.updated_at > max ? s.updated_at : max),
    null
  )

  if (visibles.length === 0) {
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

  const primera = visibles[0]

  return (
    // La portada se lee como un documento sobre la mesa: una hoja blanca con el
    // mismo borde y la misma curva que las tarjetas del resto del producto.
    <div className="tarjeta mx-4 my-8 max-w-4xl px-5 py-10 lg:mx-8 lg:my-10 lg:px-10 lg:py-14">
      <header className="border-b border-[var(--borde)] pb-10">
        <p className="rotulo mb-4">Programa de Adopción de IA · Fase 1</p>
        <h1 className="max-w-3xl text-3xl leading-tight font-bold tracking-tight text-marca-900 sm:text-4xl">
          Levantamiento del proceso y <span className="text-acento-600">arquitectura de IA</span>
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
            <dt className="text-xs tracking-wide text-marca-500 uppercase">Hallazgos validados</dt>
            <dd className="mt-1 text-2xl font-bold text-marca-800">{validados}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-marca-500 uppercase">Secciones</dt>
            <dd className="mt-1 text-2xl font-bold text-marca-800">
              {conContenido.length}
              {/* Quien escribe necesita ver cuánto falta; al lector de Iberia el
                  denominador no le dice nada, porque no ve las que están en blanco. */}
              {puedeEditar && (
                <span className="text-lg font-medium text-marca-400">
                  {' / '}
                  {visibles.length}
                </span>
              )}
            </dd>
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

      {/* El contenido. En pantalla ancha repite la barra lateral, y está bien:
          es la portada de un documento y una portada lleva su índice. En
          teléfono, donde la barra no existe, es la única forma de navegar. */}
      <div className="pt-10">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-marca-500 uppercase">
          Contenido
        </h2>

        {PARTES_INFORME_ORDEN.map((parte) => {
          const delParte = visibles.filter((s) => s.parte === parte)
          if (delParte.length === 0) return null

          return (
            <section key={parte} className="mt-8">
              <h3 className="mb-2 border-b border-[var(--borde)] pb-2 text-xs font-semibold tracking-[0.14em] text-acento-700 uppercase">
                {PARTES_INFORME[parte as ParteInforme]}
              </h3>

              <ol>
                {delParte.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/informe/${s.slug}`}
                      className="group flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--fondo)]"
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-xs text-marca-400">
                        {s.numero ?? '—'}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-marca-800 group-hover:text-acento-700">
                            {s.titulo}
                          </span>
                          {!s.contenido_md?.trim() && (
                            <span className="text-xs text-marca-400">Por escribir</span>
                          )}
                          {puedeEditar && !s.publicado && s.contenido_md?.trim() && (
                            <Insignia tono="ambar">Borrador</Insignia>
                          )}
                        </span>
                        {s.subtitulo && (
                          <span className="mt-0.5 block text-sm text-marca-500">{s.subtitulo}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}

        {primera && (
          <Link href={`/informe/${primera.slug}`} className="btn-acento mt-10">
            Empezar por {primera.titulo}
          </Link>
        )}
      </div>
    </div>
  )
}
