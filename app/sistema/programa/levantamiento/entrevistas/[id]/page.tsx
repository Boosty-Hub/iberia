import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { esEditor, puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_ENTREVISTA, hallazgosPorEstado, internasDeEntrevistas } from '@/lib/contacto'
import { fechaCorta, numero } from '@/lib/plataforma/formato'
import { SERIES_SESION } from '@/lib/plataforma/tablas-programa'
import { ESTADOS_ENTREVISTA, ESTADOS_HALLAZGO, ROLES_PARTICIPANTE, SEDES, TIPOS_SESION, type EstadoEntrevista, type RolParticipante, type Sede, type TipoSesion } from '@/lib/types'
import { formatBytes, nombreSesion } from '@/lib/utils'
import { CabeceraModulo, BOTON_CABECERA } from '@/components/sistema/ui/cabecera-modulo'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { Seccion } from '@/components/sistema/programa/piezas'
import { ImportadorFireflies } from '@/components/importador-fireflies'
import { Transcripcion } from '@/components/transcripcion'
import { eliminarEntrevista } from '../acciones'

export async function generateMetadata({ params }: PageProps<'/sistema/programa/levantamiento/entrevistas/[id]'>): Promise<Metadata> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: 'Sesión' }
  const supabase = await createClient()
  const { data } = await supabase.from('entrevistas').select('codigo, titulo, entrevistado_nombre').eq('id', id).maybeSingle()
  return { title: data ? `${data.codigo} · ${nombreSesion(data)}` : 'Sesión' }
}

const TONO: Record<EstadoEntrevista, string> = {
  programada: 'bg-[#eef0f3] text-marca-600',
  realizada: 'bg-[#fdf4e3] text-[#8a5a12]',
  transcrita: 'bg-[#eaf2fb] text-[#2f5f9a]',
  analizada: 'bg-[#e7f5ee] text-[#1f6f4b]',
}

/** Solo lo que pinta la transcripción (sin `busqueda`, el tsvector, que dobla el peso). */
const CAMPOS_SEGMENTO = 'id, hablante, hablante_original, texto, inicio_segundos'
const TAMANO_PAGINA = 1000

/**
 * La transcripción entera, por páginas: Supabase corta cada consulta en 1.000
 * filas y FOR-002 tiene 2.723 turnos. La primera página trae el total; las demás
 * se piden a la vez.
 */
async function transcripcionCompleta(supabase: Awaited<ReturnType<typeof createClient>>, entrevistaId: string) {
  const pagina = (desde: number) =>
    supabase
      .from('transcripcion_segmentos')
      .select(CAMPOS_SEGMENTO, { count: desde === 0 ? 'exact' : undefined })
      .eq('entrevista_id', entrevistaId)
      .order('indice')
      .range(desde, desde + TAMANO_PAGINA - 1)
  const primera = await pagina(0)
  const total = primera.count ?? 0
  const resto = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(total / TAMANO_PAGINA) - 1) }, (_, i) => pagina((i + 1) * TAMANO_PAGINA)))
  return [primera, ...resto].flatMap((r) => r.data ?? [])
}

/** El jsonb de Fireflies puede traer string o arreglo; se normaliza a líneas. */
function comoLineas(valor: unknown): string[] {
  if (!valor) return []
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean)
  return String(valor)
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
}

/**
 * PRG-LEV · Una sesión a página completa: datos, participantes, compromisos,
 * archivos y la transcripción con su buscador.
 *
 * 🔒 **La transcripción es perímetro «solo Boosty»** (material de Iberia bajo
 * NDA): solo la ve, la busca y la importa el equipo (`esEditor`). Para el
 * cliente esa pieza no existe en la página. Lo mismo las notas del consultor y
 * los hallazgos sin validar.
 */
export default async function SesionPage({ params }: PageProps<'/sistema/programa/levantamiento/entrevistas/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('modulo:entrevistas'), params])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const editar = puede(sesion, 'modulo:entrevistas', 'editar')
  const eliminar = puede(sesion, 'modulo:entrevistas', 'eliminar')
  const equipo = esEditor(sesion.perfil)
  const supabase = await createClient()

  const { data: fila } = await supabase.from('entrevistas').select(`${COLUMNAS_ENTREVISTA}, areas(id, nombre)`).eq('id', id).maybeSingle()
  if (!fila) notFound()
  // Las notas y el enlace de Fireflies no salen de la tabla: solo el equipo los pide.
  const interna = equipo ? (await internasDeEntrevistas(supabase, [id])).get(id) : undefined
  const e = { ...fila, notas_consultor: interna?.notas_consultor ?? null, fireflies_url: interna?.fireflies_url ?? null }

  const [segmentos, { data: archivos }, { data: participantes }, hallazgos] = await Promise.all([
    equipo ? transcripcionCompleta(supabase, id) : Promise.resolve([]),
    puede(sesion, 'modulo:archivos')
      ? supabase.from('archivos').select('id, nombre, tamano_bytes, mime_type').eq('entrevista_id', id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; nombre: string; tamano_bytes: number | null; mime_type: string | null }[] }),
    supabase.from('sesion_participantes').select('id, rol, etiqueta_hablante, personas(id, nombre_completo, cargo, organizacion)').eq('entrevista_id', id),
    // La tabla de hallazgos es del equipo: a quien abre la sesión le llega la cuenta.
    hallazgosPorEstado(supabase, id),
  ])

  const meta = (e.fireflies_meta ?? {}) as Record<string, unknown>
  const compromisos = comoLineas(meta.action_items ?? meta.actionItems)
  const palabrasClave = comoLineas(meta.keywords)
  const participantesFireflies = comoLineas(meta.participantes)
  const sinIdentificar = [...new Set(segmentos.map((s) => s.hablante_original ?? s.hablante).filter((h): h is string => !!h && /^speaker/i.test(h)))].sort()
  const conteo = (est: string) => hallazgos.get(est) ?? 0
  const estado = e.estado as EstadoEntrevista

  const datos: [string, string][] = [
    ['Serie', SERIES_SESION[e.codigo.slice(0, 3)] ?? e.codigo.slice(0, 3)],
    ['Tipo', TIPOS_SESION[e.tipo as TipoSesion] ?? e.tipo],
    ['Área', e.areas?.nombre ?? '—'],
    ['Sede', e.sede ? (SEDES[e.sede as Sede] ?? e.sede) : '—'],
    ['Fecha', fechaCorta(e.fecha_entrevista)],
    ['Duración', e.duracion_minutos ? `${numero(e.duracion_minutos)} min` : '—'],
    ['Entrevistador', e.entrevistador ?? '—'],
  ]

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        titulo={nombreSesion(e)}
        migas={[{ etiqueta: 'Entrevistas', href: '/sistema/programa/levantamiento/entrevistas' }, { etiqueta: e.codigo }]}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO[estado] ?? TONO.programada}`}>{ESTADOS_ENTREVISTA[estado] ?? e.estado}</span>
            {e.entrevistado_cargo && <span>{e.entrevistado_cargo}</span>}
          </span>
        }
        acciones={
          editar || eliminar ? (
            <>
              {editar && (
                <Link href={`/sistema/programa/levantamiento/entrevistas/${id}/editar`} className={BOTON_CABECERA}>
                  Editar
                </Link>
              )}
              {eliminar && (
                <form action={eliminarEntrevista}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-acento-300 bg-white px-2.5 text-xs font-medium text-acento-700 hover:bg-acento-50">
                    Eliminar
                  </button>
                </form>
              )}
            </>
          ) : undefined
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Seccion titulo="Resumen">
            {e.resumen ? (
              <p className="text-[13px] leading-relaxed whitespace-pre-line text-marca-700">{e.resumen}</p>
            ) : (
              <p className="text-[12.5px] text-marca-500">Esta sesión no tiene resumen cargado. Lo que salió de ella se lee en el informe, en su punto del circuito.</p>
            )}
          </Seccion>
          {equipo && e.notas_consultor && (
            <Seccion titulo="Notas del consultor 🔒" className="border-l-2 border-l-acento-500">
              <p className="text-[13px] leading-relaxed whitespace-pre-line text-marca-700">{e.notas_consultor}</p>
            </Seccion>
          )}
          {editar && equipo && <ImportadorFireflies entrevistaId={id} tieneResumen={!!e.resumen} segmentosActuales={segmentos.length} />}
          {equipo && (
            <div id="transcripcion" className="min-w-0 scroll-mt-4">
              <p className="mb-1.5 text-[11.5px] text-marca-500">🔒 Transcripción · perímetro «solo Boosty»: material de Iberia bajo NDA que el cliente no ve en la plataforma.</p>
              <Transcripcion segmentos={segmentos} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Seccion titulo="Datos">
            <dl className="space-y-1.5 text-[12.5px]">
              {datos.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-marca-500">{k}</dt>
                  <dd className="text-right font-medium text-marca-800">{v}</dd>
                </div>
              ))}
            </dl>
            {e.fireflies_url && equipo && (
              <a href={e.fireflies_url} target="_blank" rel="noopener noreferrer" className="mt-3 block truncate text-[12px] text-acento-700 hover:underline">
                Ver en Fireflies <span className="sr-only">(abre en otra pestaña)</span>
              </a>
            )}
          </Seccion>

          <Seccion titulo={`Participantes · ${participantes?.length ?? 0}`}>
            {participantes?.length ? (
              <ul className="space-y-2">
                {participantes.map((p) => (
                  <li key={p.id} className="text-[12.5px]">
                    <p className="font-medium text-marca-800">
                      {p.personas?.nombre_completo}
                      {p.personas?.organizacion !== 'iberia' && <span className="ml-1.5 text-[11px] font-normal text-marca-500">(externo)</span>}
                    </p>
                    <p className="text-[11.5px] text-marca-500">
                      {[p.personas?.cargo, p.rol !== 'participante' ? ROLES_PARTICIPANTE[p.rol as RolParticipante] : null, equipo ? p.etiqueta_hablante : null].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            ) : participantesFireflies.length ? (
              <ul className="space-y-0.5 text-[12.5px] text-marca-700">
                {participantesFireflies.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-marca-400">Sin participantes identificados.</p>
            )}
            {equipo && sinIdentificar.length > 0 && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-900">
                Sin identificar: {sinIdentificar.join(', ')}. Mientras no tengan nombre, lo que dijeron no se puede citar en el informe.
              </p>
            )}
          </Seccion>

          <Seccion titulo="Hallazgos">
            <dl className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-marca-500">{ESTADOS_HALLAZGO.validado}</dt>
                <dd className="font-semibold text-marca-900 tabular-nums">{conteo('validado')}</dd>
              </div>
              {equipo && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-marca-500">{ESTADOS_HALLAZGO.propuesto} 🔒</dt>
                    <dd className="font-semibold text-marca-900 tabular-nums">{conteo('propuesto')}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-marca-500">{ESTADOS_HALLAZGO.descartado}</dt>
                    <dd className="font-semibold text-marca-900 tabular-nums">{conteo('descartado')}</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="mt-2 text-[11.5px] text-marca-500">Los hallazgos se leen en el informe, cada uno en su punto del circuito.</p>
          </Seccion>

          {compromisos.length > 0 && (
            <Seccion titulo="Compromisos de la reunión">
              <ul className="space-y-1 text-[12.5px] text-marca-700">
                {compromisos.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          {palabrasClave.length > 0 && (
            <Seccion titulo="Palabras clave">
              <div className="flex flex-wrap gap-1.5">
                {palabrasClave.map((k) => (
                  <span key={k} className="rounded-full bg-[#eef0f3] px-2 py-0.5 text-[11px] text-marca-700">
                    {k}
                  </span>
                ))}
              </div>
            </Seccion>
          )}

          {!!archivos?.length && (
            <Seccion titulo={`Archivos vinculados · ${archivos.length}`}>
              <ul className="divide-y divide-[#eef0f3]">
                {archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 py-1.5">
                    <BotonFicha tipo="archivo" id={a.id} className="min-w-0 flex-1 truncate text-[12.5px] text-marca-800">
                      {a.nombre}
                    </BotonFicha>
                    <span className="shrink-0 text-[11px] text-marca-500">{formatBytes(a.tamano_bytes)}</span>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
        </div>
      </div>
    </>
  )
}
