import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAlerta, IconoAtras, IconoEditar } from '@/components/iconos'
import { Insignia } from '@/components/ui'
import {
  ESTADOS_DOCUMENTO,
  ESTADOS_SOLICITUD,
  NIVELES,
  TIPOS_CRUCE,
  TONO_DOCUMENTO,
  comparar,
  fecha,
  fechaHora,
  fichaVacia,
  normalizarFicha,
  vigenciaTexto,
} from '@/components/sistema/procesos/comun'
import {
  COLUMNAS_PROCESO,
  activarProgramados,
  leerCatalogo,
  leerPlazas,
  leerProcesos,
  leerSolicitudes,
  type FilaProceso,
} from '@/components/sistema/procesos/datos'
import { CrearHijo, MoverNodo } from '@/components/sistema/procesos/formularios'
import { Codigos, InsigniaEstadoOperativo, InsigniaVersion, Seccion } from '@/components/sistema/procesos/piezas'
import { Diferencias, FichaVista, LineaSolicitud } from '@/components/sistema/procesos/vistas'
import { abrirBorrador } from '@/app/sistema/nucleo/procesos/acciones'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Ficha de proceso · Plataforma Iberia' }

const RUTA = '/sistema/nucleo/procesos'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * La ficha de un proceso: cabecera (códigos, tipo, estado, dueño, versión),
 * ficha PHVA ampliada, subprocesos, documentos que cuelgan de él, cruce con el
 * inventario de la Fase 1 e historial de versiones con sus aprobaciones.
 *
 * Se lee la versión vigente; con `?version=<id>` se lee cualquier otra del
 * historial. Editar abre un borrador: la vigente no se toca nunca.
 */
export default async function FichaProcesoPage({ params, searchParams }: PageProps<'/sistema/nucleo/procesos/[ref]'>) {
  const [sesion, { ref }, consulta] = await Promise.all([requerirPermiso('sistema:procesos'), params, searchParams])
  if (!UUID.test(ref)) notFound()
  const supabase = await createClient()
  await activarProgramados(supabase)
  const sgc = supabase.schema('sgc')

  const [{ data: filas }, { vigentes, abiertos }, plazas, catalogo] = await Promise.all([
    sgc.from('proceso').select(COLUMNAS_PROCESO).eq('ref', ref).is('escenario_id', null).order('version', { ascending: false }),
    leerProcesos(supabase),
    leerPlazas(supabase),
    leerCatalogo(supabase),
  ])
  const versiones = (filas ?? []) as unknown as FilaProceso[]
  if (!versiones.length) notFound()

  const vigente = versiones.find((v) => v.estado === 'vigente') ?? null
  const abierto = versiones.find((v) => v.estado === 'borrador' || v.estado === 'en_revision') ?? null
  const pedida = typeof consulta.version === 'string' ? versiones.find((v) => v.id === consulta.version) : undefined
  const p = pedida ?? vigente ?? versiones.find((v) => v.estado === 'aprobada') ?? versiones[0]
  const ficha = normalizarFicha(p.ficha)

  const porRef = new Map(vigentes.map((v) => [v.ref, v]))
  const etiquetaPlaza = new Map(plazas.map((x) => [x.ref, x.etiqueta]))
  const migas: FilaProceso[] = []
  for (let r = p.padre_ref, i = 0; r && i < 6; i++) {
    const x = porRef.get(r)
    if (!x) break
    migas.unshift(x)
    r = x.padre_ref
  }
  const hijos = vigentes.filter((v) => v.padre_ref === ref)
  const hijosNuevos = [...abiertos.values()].filter((v) => v.padre_ref === ref && !porRef.has(v.ref))

  const [docs, { data: cruces }, solicitudes] = await Promise.all([
    sgc.rpc('buscar_documentos', { p_proceso: ref, p_limite: 30 }),
    sgc.from('proceso_cruce').select('id, tipo, confirmado, nota, codigo_sgc, informe_proceso_id, informe_macro_id').eq('proceso_ref', ref),
    leerSolicitudes(supabase, 'proceso', versiones.map((v) => v.id)),
  ])
  const procIds = [...new Set((cruces ?? []).map((c) => c.informe_proceso_id).filter(Boolean))] as string[]
  const macroIds = [...new Set((cruces ?? []).map((c) => c.informe_macro_id).filter(Boolean))] as string[]
  const [{ data: inf }, { data: macs }] = await Promise.all([
    procIds.length ? supabase.from('procesos').select('id, nombre, orden, estado, area').in('id', procIds) : Promise.resolve({ data: [] }),
    macroIds.length ? supabase.from('macroprocesos').select('id, nombre, nivel, numero').in('id', macroIds) : Promise.resolve({ data: [] }),
  ])
  const procInf = new Map((inf ?? []).map((x) => [x.id, x]))
  const macroInf = new Map((macs ?? []).map((x) => [x.id, x]))
  const listaDocs = docs.data ?? []
  const totalDocs = Number(listaDocs[0]?.total ?? 0)

  const puedeEditar = puede(sesion, 'sistema:procesos', 'editar')
  const puedeCrear = puede(sesion, 'sistema:procesos', 'crear')
  const solicitudDe = new Map<string, (typeof solicitudes)[number]>()
  for (const s of solicitudes) if (!solicitudDe.has(s.objeto_id)) solicitudDe.set(s.objeto_id, s)
  const nombreDe = (tipo: 'proceso' | 'plaza', r: string | null) =>
    !r ? '—' : tipo === 'proceso' ? (porRef.get(r)?.nombre ?? 'Proceso no vigente') : (etiquetaPlaza.get(r) ?? 'Plaza sin describir')
  const cambios = abierto && vigente ? comparar(vigente, abierto, nombreDe) : null

  const duenoPlaza = p.dueno_plaza_ref ? etiquetaPlaza.get(p.dueno_plaza_ref) : null
  const difiereDuenoFicha =
    ficha.dueno_segun_ficha &&
    !(duenoPlaza ?? p.dueno_texto ?? '').toLowerCase().includes(ficha.dueno_segun_ficha.toLowerCase())

  const candidatosMover = vigentes
    .filter((v) => v.nivel === p.nivel - 1)
    .map((v) => ({ valor: v.ref, etiqueta: `${v.codigo_sgc ?? v.codigo_informe ?? ''} ${v.nombre}`.trim() }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  const opcionesPlaza = plazas.map((x) => ({ valor: x.ref, etiqueta: x.etiqueta }))
  const opcionesEstado = Object.entries(catalogo.estados).map(([valor, etiqueta]) => ({ valor, etiqueta }))

  return (
    <>
      <nav className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-marca-500" aria-label="Ruta">
        <Link href={RUTA} className="inline-flex min-h-10 items-center gap-1.5 hover:text-acento-700">
          <IconoAtras className="h-4 w-4" />
          Mapa
        </Link>
        {migas.map((m) => (
          <span key={m.ref} className="inline-flex items-center gap-1.5">
            <span aria-hidden>/</span>
            <Link href={`${RUTA}/${m.ref}`} className="hover:text-acento-700 hover:underline">
              {m.nombre}
            </Link>
          </span>
        ))}
      </nav>

      {typeof consulta.error === 'string' && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-acento-200 bg-acento-50 px-4 py-3 text-sm text-acento-800">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          {consulta.error}
        </p>
      )}
      {consulta.descartado === '1' && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Se descartó el borrador.</p>
      )}

      <header className="mb-6">
        <p className="rotulo mb-2">{NIVELES[p.nivel] ?? 'Proceso'}</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-marca-900">{p.nombre}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Codigos sgc={p.codigo_sgc ? `${p.codigo_sgc}${p.generacion ? ` (${p.generacion})` : ''}` : null} informe={p.codigo_informe} className="text-xs" />
              {p.tipo && <Insignia tono="marca">{catalogo.tipos[p.tipo] ?? p.tipo}</Insignia>}
              <InsigniaEstadoOperativo estado={p.estado_operativo} etiquetas={catalogo.estados} siempre />
              <InsigniaVersion estado={p.estado} version={p.version} />
            </div>
          </div>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2">
              {abierto ? (
                <Link href={`${RUTA}/${ref}/editar`} className="btn-acento h-10">
                  <IconoEditar className="h-4 w-4" />
                  {abierto.estado === 'borrador' ? 'Seguir editando el borrador' : 'Ver la revisión en curso'}
                </Link>
              ) : vigente ? (
                <form action={abrirBorrador}>
                  <input type="hidden" name="ref" value={ref} />
                  <button type="submit" className="btn-acento h-10">
                    <IconoEditar className="h-4 w-4" />
                    Editar
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </div>
      </header>

      {pedida && pedida.id !== vigente?.id && (
        <p className="mb-4 rounded-xl border border-marca-200 bg-marca-50 px-4 py-3 text-sm text-marca-800">
          Estás viendo la versión {pedida.version} ({pedida.estado}).{' '}
          <Link href={`${RUTA}/${ref}`} className="font-semibold underline">
            Volver a la vigente
          </Link>
        </p>
      )}
      {!vigente && !pedida && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este proceso es nuevo: todavía no tiene versión vigente. Lo que ves es su {p.estado === 'en_revision' ? 'versión en revisión' : 'borrador'}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Seccion titulo="Datos del proceso" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-marca-500">Dueño</dt>
              <dd className="text-marca-800">
                {duenoPlaza ?? (p.dueno_plaza_ref ? 'Plaza fuera de tu alcance' : p.dueno_texto ? `${p.dueno_texto}` : 'Sin dueño asignado')}
                {!p.dueno_plaza_ref && p.dueno_texto && (
                  <span className="mt-0.5 block text-xs text-amber-800">Según la fuente; todavía no está casado con una plaza.</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-marca-500">Área según la fuente</dt>
              <dd className="text-marca-800">{p.area_texto ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-marca-500">Versión y vigencia</dt>
              <dd className="text-marca-800">
                Versión {p.version} · {vigenciaTexto(p.vigencia)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-marca-500">Cuelga de</dt>
              <dd className="text-marca-800">
                {p.padre_ref ? (
                  <Link href={`${RUTA}/${p.padre_ref}`} className="hover:text-acento-700 hover:underline">
                    {nombreDe('proceso', p.padre_ref)}
                  </Link>
                ) : (
                  'Es un macroproceso (nivel 0)'
                )}
              </dd>
            </div>
            {ficha.dueno_segun_ficha && difiereDuenoFicha && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-marca-500">Dueño según la hoja PHVA</dt>
                <dd className="text-marca-800">
                  {ficha.dueno_segun_ficha}
                  <span className="mt-0.5 block text-xs text-amber-800">No coincide con el dueño del catálogo: confirmar cuál vale hoy.</span>
                </dd>
              </div>
            )}
            {p.nota && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-marca-500">Nota</dt>
                <dd className="text-marca-700">{p.nota}</dd>
              </div>
            )}
            {p.fuente.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-marca-500">Fuente</dt>
                <dd className="font-mono text-xs break-all text-marca-600">{p.fuente.join(' · ')}</dd>
              </div>
            )}
          </dl>
        </Seccion>

        <Seccion titulo="Origen de la ficha">
          {ficha.origen ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-marca-500">Código de la hoja</dt>
                <dd className="font-mono text-marca-800">{ficha.origen.codigo ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-marca-500">Año</dt>
                <dd className="text-marca-800">{ficha.origen.anio ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-marca-500">Calidad del texto</dt>
                <dd className="text-marca-800">{ficha.origen.calidad ?? '—'}</dd>
              </div>
              {ficha.origen.archivo && (
                <div>
                  <dt className="text-xs text-marca-500">Archivo</dt>
                  <dd className="font-mono text-[11px] break-all text-marca-600">{ficha.origen.archivo}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-marca-500">
              {fichaVacia(ficha) ? 'Este proceso no tenía hoja PHVA en el levantamiento.' : 'Ficha redactada en la plataforma.'}
            </p>
          )}
          {ficha.nota_ficha && <p className="mt-3 rounded-lg bg-marca-50 px-3 py-2 text-xs text-marca-700">{ficha.nota_ficha}</p>}
        </Seccion>
      </div>

      {abierto && cambios && (
        <div className="mt-4">
          <Diferencias cambios={cambios} titulo={`Cambios del ${abierto.estado === 'borrador' ? 'borrador' : 'borrador en revisión'} (versión ${abierto.version})`} />
        </div>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold text-marca-900">Ficha PHVA</h2>
      {fichaVacia(ficha) ? (
        <p className="tarjeta p-5 text-sm text-marca-600">
          Este proceso todavía no tiene ficha. {puedeEditar && vigente && 'Pulsa «Editar» para redactarla en un borrador.'}
        </p>
      ) : (
        <FichaVista ficha={ficha} />
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Seccion titulo={`${NIVELES[p.nivel + 1] ?? 'Sub'}s (${hijos.length + hijosNuevos.length})`}>
          {hijos.length + hijosNuevos.length === 0 ? (
            <p className="text-sm text-marca-500">No tiene {(NIVELES[p.nivel + 1] ?? 'subproceso').toLowerCase()}s.</p>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {[...hijos, ...hijosNuevos].map((h) => (
                <li key={h.ref}>
                  <Link href={`${RUTA}/${h.ref}`} className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 hover:bg-marca-50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-marca-800">{h.nombre}</span>
                      <Codigos sgc={h.codigo_sgc} informe={h.codigo_informe} />
                    </span>
                    <InsigniaEstadoOperativo estado={h.estado_operativo} etiquetas={catalogo.estados} />
                    {h.estado !== 'vigente' && <InsigniaVersion estado={h.estado} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(puedeCrear || puedeEditar) && vigente && (
            <div className="mt-4 space-y-2 border-t border-[var(--borde)] pt-4">
              {puedeCrear && p.nivel < 3 && (
                <details className="group">
                  <summary className="btn-neutro h-10 cursor-pointer list-none">Agregar {(NIVELES[p.nivel + 1] ?? 'subproceso').toLowerCase()}</summary>
                  <div className="mt-3">
                    <CrearHijo padre={{ ref, nombre: p.nombre, nivel: p.nivel }} plazas={opcionesPlaza} estados={opcionesEstado} />
                  </div>
                </details>
              )}
              {puedeEditar && p.nivel > 0 && !abierto && (
                <details>
                  <summary className="btn-neutro h-10 cursor-pointer list-none">Mover este proceso a otro padre</summary>
                  <div className="mt-3">
                    <MoverNodo nodo={{ ref, padre_ref: p.padre_ref }} candidatos={candidatosMover} />
                  </div>
                </details>
              )}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Cruce con el inventario de la Fase 1" acciones={<Link href={`${RUTA}/cruce`} className="text-xs text-acento-700 hover:underline">Ver todos los cruces</Link>}>
          {(cruces ?? []).length === 0 ? (
            <p className="text-sm text-marca-500">Sin cruce registrado con el informe.</p>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {(cruces ?? []).map((c) => {
                const pr = c.informe_proceso_id ? procInf.get(c.informe_proceso_id) : null
                const mc = c.informe_macro_id ? macroInf.get(c.informe_macro_id) : null
                return (
                  <li key={c.id} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Insignia tono="marca">{TIPOS_CRUCE[c.tipo] ?? c.tipo}</Insignia>
                      {c.confirmado ? <Insignia tono="verde">Confirmado</Insignia> : <Insignia tono="ambar">Por confirmar</Insignia>}
                    </div>
                    <p className="mt-1 text-marca-800">
                      {pr?.nombre ??
                        mc?.nombre ??
                        (c.informe_proceso_id || c.informe_macro_id ? 'Proceso del informe (sin acceso al inventario de la Fase 1)' : 'Sin par en el informe')}
                      {mc && pr && <span className="text-marca-500"> · {mc.nivel} {mc.numero}. {mc.nombre}</span>}
                    </p>
                    {c.nota && <p className="mt-0.5 text-xs text-marca-500">{c.nota}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </Seccion>
      </div>

      <div id="documentos" className="mt-4 scroll-mt-20">
        <Seccion
          titulo={`Documentos vinculados (${totalDocs})`}
          acciones={
            totalDocs > 0 && (
              <Link href={`/sistema/nucleo/documentos?proceso=${ref}&estado=todos`} className="text-xs text-acento-700 hover:underline">
                Abrir en la biblioteca
              </Link>
            )
          }
        >
          {docs.error ? (
            <p className="text-sm text-marca-500">No tienes acceso a la biblioteca de documentos.</p>
          ) : listaDocs.length === 0 ? (
            <p className="text-sm text-marca-500">
              No hay documentos colgados directamente de este proceso{p.nivel === 0 && ' (los del SGC cuelgan de sus procesos de nivel 1)'}.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {listaDocs.map((d) => (
                <li key={d.id}>
                  <Link href={`/sistema/nucleo/documentos/${d.id}`} className="-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-marca-50">
                    <span className="w-28 shrink-0 font-mono text-xs text-marca-600">{d.codigo}</span>
                    <span className="min-w-0 flex-1 text-sm text-marca-800">{d.titulo}</span>
                    <Insignia tono={TONO_DOCUMENTO[d.estado] ?? 'neutro'}>{ESTADOS_DOCUMENTO[d.estado] ?? d.estado}</Insignia>
                  </Link>
                </li>
              ))}
              {totalDocs > listaDocs.length && (
                <li className="pt-2 text-xs text-marca-500">
                  Y {totalDocs - listaDocs.length} más.{' '}
                  <Link href={`/sistema/nucleo/documentos?proceso=${ref}&estado=todos`} className="text-acento-700 hover:underline">
                    Verlos todos
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Seccion>
      </div>

      <div className="mt-4">
        <Seccion titulo="Historial de versiones">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--borde)] text-xs text-marca-500">
                  <th className="py-2 pr-3 font-medium">Versión</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">Vigencia</th>
                  <th className="py-2 pr-3 font-medium">Creada</th>
                  <th className="py-2 font-medium">Aprobación</th>
                </tr>
              </thead>
              <tbody>
                {versiones.map((v) => {
                  const s = solicitudDe.get(v.id)
                  return (
                    <tr key={v.id} className="border-b border-[var(--borde)] last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`${RUTA}/${ref}?version=${v.id}`} className="font-medium text-marca-800 hover:text-acento-700 hover:underline">
                          v{v.version}
                        </Link>
                        {v.id === p.id && <span className="ml-1.5 text-xs text-marca-400">(en pantalla)</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <InsigniaVersion estado={v.estado} />
                      </td>
                      <td className="py-2 pr-3 text-marca-600">{vigenciaTexto(v.vigencia)}</td>
                      <td className="py-2 pr-3 text-marca-600">{v.creado_por ? fechaHora(v.creado_en) : fecha(v.creado_en)}</td>
                      <td className="py-2 text-marca-600">{s ? (ESTADOS_SOLICITUD[s.estado] ?? s.estado) : v.creado_por ? '—' : 'Carga inicial'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {solicitudes.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold tracking-wide text-marca-500 uppercase">Solicitudes de aprobación</p>
              {solicitudes.map((s) => (
                <LineaSolicitud key={s.id} solicitud={s} />
              ))}
            </div>
          )}
        </Seccion>
      </div>
    </>
  )
}
