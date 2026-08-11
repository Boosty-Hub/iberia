import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  IconoArchivos,
  IconoAtras,
  IconoBasura,
  IconoEditar,
  IconoHallazgos,
  IconoMas,
  IconoReloj,
  IconoSede,
} from '@/components/iconos'
import { ImportadorFireflies } from '@/components/importador-fireflies'
import { Transcripcion } from '@/components/transcripcion'
import { Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatBytes, formatFecha, nombreSesion } from '@/lib/utils'
import {
  ESTADOS_ENTREVISTA,
  ESTADOS_HALLAZGO,
  ROLES_PARTICIPANTE,
  SEDES,
  TIPOS_HALLAZGO,
  TIPOS_SESION,
  type EstadoEntrevista,
  type EstadoHallazgo,
  type RolParticipante,
  type Sede,
  type TipoHallazgo,
  type TipoSesion,
} from '@/lib/types'
import { eliminarEntrevista } from '../acciones'

export async function generateMetadata({
  params,
}: PageProps<'/dashboard/entrevistas/[id]'>): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('entrevistas')
    .select('codigo, titulo, entrevistado_nombre')
    .eq('id', id)
    .maybeSingle()

  return { title: data ? `${data.codigo} · ${nombreSesion(data)}` : 'Sesión' }
}

const TONO_ESTADO: Record<EstadoEntrevista, 'neutro' | 'ambar' | 'marca' | 'verde'> = {
  programada: 'neutro',
  realizada: 'ambar',
  transcrita: 'marca',
  analizada: 'verde',
}

const TONO_HALLAZGO: Record<EstadoHallazgo, 'neutro' | 'ambar' | 'verde'> = {
  propuesto: 'ambar',
  validado: 'verde',
  descartado: 'neutro',
}

/** El jsonb de Fireflies puede traer string o arreglo; se normaliza a líneas. */
function comoLineas(valor: unknown): string[] {
  if (!valor) return []
  if (Array.isArray(valor)) {
    return valor.map((v) => String(v).trim()).filter(Boolean)
  }
  return String(valor)
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export default async function EntrevistaPage({
  params,
}: PageProps<'/dashboard/entrevistas/[id]'>) {
  const [{ perfil }, { id }] = await Promise.all([requerirSesion(), params])
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const { data: entrevista } = await supabase
    .from('entrevistas')
    .select('*, areas(id, nombre)')
    .eq('id', id)
    .maybeSingle()

  if (!entrevista) notFound()

  const [{ data: segmentos }, { data: hallazgos }, { data: archivos }, { data: participantes }] =
    await Promise.all([
    supabase
      .from('transcripcion_segmentos')
      .select('*')
      .eq('entrevista_id', id)
      .order('indice'),
    supabase
      .from('hallazgos')
      .select('id, titulo, tipo, estado, impacto')
      .eq('entrevista_id', id)
      .order('created_at', { ascending: false }),
      supabase
        .from('archivos')
        .select('id, nombre, tamano_bytes, mime_type')
        .eq('entrevista_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('sesion_participantes')
        .select('id, rol, etiqueta_hablante, personas(id, nombre_completo, cargo, organizacion)')
        .eq('entrevista_id', id),
    ])

  const meta = (entrevista.fireflies_meta ?? {}) as Record<string, unknown>
  const acciones = comoLineas(meta.action_items ?? meta.actionItems)
  const palabrasClave = comoLineas(meta.keywords)
  // Participantes que declaró el propio archivo de Fireflies, si los trajo.
  const participantesFireflies = comoLineas(meta.participantes)

  // Hablantes de la transcripción que todavía no tienen persona asignada.
  const hablantesSinIdentificar = [
    ...new Set(
      (segmentos ?? [])
        .map((s) => s.hablante_original ?? s.hablante)
        .filter((h): h is string => !!h && /^speaker/i.test(h))
    ),
  ].sort()

  const datos: { etiqueta: string; valor: React.ReactNode }[] = [
    { etiqueta: 'Área', valor: entrevista.areas?.nombre ?? '—' },
    {
      etiqueta: 'Sede',
      valor: entrevista.sede ? (
        <span className="inline-flex items-center gap-1">
          <IconoSede className="h-3.5 w-3.5" />
          {SEDES[entrevista.sede as Sede]}
        </span>
      ) : (
        '—'
      ),
    },
    { etiqueta: 'Fecha', valor: formatFecha(entrevista.fecha_entrevista) },
    {
      etiqueta: 'Duración',
      valor: entrevista.duracion_minutos ? (
        <span className="inline-flex items-center gap-1">
          <IconoReloj className="h-3.5 w-3.5" />
          {entrevista.duracion_minutos} min
        </span>
      ) : (
        '—'
      ),
    },
    { etiqueta: 'Entrevistador', valor: entrevista.entrevistador ?? '—' },
  ]

  return (
    <>
      <Link
        href="/dashboard/entrevistas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-marca-500 hover:text-acento-700"
      >
        <IconoAtras className="h-4 w-4" />
        Entrevistas
      </Link>

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo mb-2">
            {entrevista.codigo}
            {entrevista.tipo !== 'entrevista' &&
              ` · ${TIPOS_SESION[entrevista.tipo as TipoSesion]}`}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-marca-800">
            {nombreSesion(entrevista)}
          </h1>
          {entrevista.entrevistado_cargo && (
            <p className="mt-1 text-sm text-marca-600">{entrevista.entrevistado_cargo}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Insignia tono={TONO_ESTADO[entrevista.estado as EstadoEntrevista]}>
            {ESTADOS_ENTREVISTA[entrevista.estado as EstadoEntrevista]}
          </Insignia>

          {puedeEditar && (
            <>
              <Link href={`/dashboard/entrevistas/${id}/editar`} className="btn-neutro">
                <IconoEditar className="h-4 w-4" />
                Editar
              </Link>
              <form action={eliminarEntrevista}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="btn-peligro">
                  <IconoBasura className="h-4 w-4" />
                  Eliminar
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          {entrevista.resumen && (
            <section className="tarjeta p-5">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">Resumen</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-marca-700">
                {entrevista.resumen}
              </p>
            </section>
          )}

          {entrevista.notas_consultor && (
            <section className="tarjeta border-l-2 border-l-acento-500 p-5">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">
                Notas del consultor
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-marca-700">
                {entrevista.notas_consultor}
              </p>
            </section>
          )}

          {puedeEditar && (
            <ImportadorFireflies
              entrevistaId={id}
              tieneResumen={!!entrevista.resumen}
              segmentosActuales={segmentos?.length ?? 0}
            />
          )}

          <Transcripcion
            segmentos={segmentos ?? []}
            entrevistaId={id}
            puedeEditar={puedeEditar}
          />
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          <section className="tarjeta p-5">
            <h2 className="mb-3 text-sm font-semibold text-marca-800">Datos</h2>
            <dl className="space-y-2.5 text-sm">
              {datos.map(({ etiqueta, valor }) => (
                <div key={etiqueta} className="flex items-baseline justify-between gap-3">
                  <dt className="text-marca-500">{etiqueta}</dt>
                  <dd className="text-right font-medium text-marca-800">{valor}</dd>
                </div>
              ))}
            </dl>

            {entrevista.fireflies_url && (
              <a
                href={entrevista.fireflies_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block truncate text-xs text-acento-700 hover:underline"
              >
                Ver en Fireflies →
              </a>
            )}
          </section>

          {/* Participantes identificados: es lo que permite citar la sesión
              con nombre y cargo en el informe. */}
          {(participantes?.length ?? 0) > 0 && (
            <section className="tarjeta p-5">
              <h2 className="mb-3 text-sm font-semibold text-marca-800">
                Participantes
                <span className="ml-1.5 text-xs font-normal text-marca-500">
                  {participantes!.length}
                </span>
              </h2>
              <ul className="space-y-2.5">
                {participantes!.map((p) => (
                  <li key={p.id} className="text-sm">
                    <p className="font-medium text-marca-800">
                      {p.personas?.nombre_completo}
                      {p.personas?.organizacion !== 'iberia' && (
                        <span className="ml-1.5 text-xs font-normal text-marca-400">
                          (externo)
                        </span>
                      )}
                    </p>
                    {p.personas?.cargo && (
                      <p className="text-xs text-marca-500">{p.personas.cargo}</p>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {p.rol !== 'participante' && (
                        <Insignia tono="neutro">
                          {ROLES_PARTICIPANTE[p.rol as RolParticipante]}
                        </Insignia>
                      )}
                      {p.etiqueta_hablante && (
                        <span className="font-mono text-[11px] text-marca-400">
                          {p.etiqueta_hablante}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>

              {hablantesSinIdentificar.length > 0 && (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Sin identificar: {hablantesSinIdentificar.join(', ')}. Mientras no
                  tengan nombre, lo que dijeron no se puede citar en el informe.
                </p>
              )}
            </section>
          )}

          {/* Solo si Fireflies los trajo y no hay identificación propia. */}
          {(participantes?.length ?? 0) === 0 && participantesFireflies.length > 0 && (
            <section className="tarjeta p-5">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">
                Participantes según Fireflies
              </h2>
              <ul className="space-y-1 text-sm text-marca-700">
                {participantesFireflies.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {acciones.length > 0 && (
            <section className="tarjeta p-5">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">
                Compromisos de la reunión
              </h2>
              <ul className="space-y-1.5 text-sm text-marca-700">
                {acciones.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {palabrasClave.length > 0 && (
            <section className="tarjeta p-5">
              <h2 className="mb-2.5 text-sm font-semibold text-marca-800">Palabras clave</h2>
              <div className="flex flex-wrap gap-1.5">
                {palabrasClave.map((k) => (
                  <Insignia key={k} tono="neutro">
                    {k}
                  </Insignia>
                ))}
              </div>
            </section>
          )}

          {/* Hallazgos */}
          <section className="tarjeta">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--borde)] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-marca-800">
                Hallazgos
                <span className="ml-1.5 text-xs font-normal text-marca-500">
                  {hallazgos?.length ?? 0}
                </span>
              </h2>
              {puedeEditar && (
                <Link
                  href={{
                    pathname: '/dashboard/hallazgos/nuevo',
                    query: { entrevista: id },
                  }}
                  className="text-xs font-medium text-acento-700 hover:underline"
                >
                  <IconoMas className="inline h-3.5 w-3.5" /> Añadir
                </Link>
              )}
            </div>

            {!hallazgos?.length ? (
              <p className="px-5 py-6 text-center text-xs text-marca-500">
                Sin hallazgos todavía. Marca una cita en la transcripción con el icono{' '}
                <IconoHallazgos className="inline h-3.5 w-3.5" />.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--borde)]">
                {hallazgos.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/dashboard/hallazgos/${h.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-marca-50/40"
                    >
                      <p className="text-sm font-medium text-marca-800">{h.titulo}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Insignia tono="marca">
                          {TIPOS_HALLAZGO[h.tipo as TipoHallazgo]}
                        </Insignia>
                        <Insignia tono={TONO_HALLAZGO[h.estado as EstadoHallazgo]}>
                          {ESTADOS_HALLAZGO[h.estado as EstadoHallazgo]}
                        </Insignia>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Archivos vinculados */}
          {!!archivos?.length && (
            <section className="tarjeta">
              <div className="border-b border-[var(--borde)] px-5 py-3.5">
                <h2 className="text-sm font-semibold text-marca-800">
                  Archivos vinculados
                  <span className="ml-1.5 text-xs font-normal text-marca-500">
                    {archivos.length}
                  </span>
                </h2>
              </div>
              <ul className="divide-y divide-[var(--borde)]">
                {archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                    <IconoArchivos className="h-4 w-4 shrink-0 text-marca-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-marca-700">
                      {a.nombre}
                    </span>
                    <span className="shrink-0 text-xs text-marca-400">
                      {formatBytes(a.tamano_bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
