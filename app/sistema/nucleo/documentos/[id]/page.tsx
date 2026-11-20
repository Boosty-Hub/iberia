import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAlerta, IconoAtras } from '@/components/iconos'
import { Insignia } from '@/components/ui'
import { DESTINOS_DOCUMENTO, ESTADOS_DOCUMENTO, PERIMETROS, TONO_DOCUMENTO, enOrdenDeArbol, etiquetaSangrada, fecha, fechaHora } from '@/components/sistema/procesos/comun'
import { leerProcesos } from '@/components/sistema/procesos/datos'
import { nombresDeTipo } from '@/components/sistema/procesos/documentos'
import { EditarDocumento } from '@/components/sistema/procesos/editar-documento'
import { Seccion } from '@/components/sistema/procesos/piezas'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Documento · Plataforma Iberia' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAMPOS_AUDITADOS: Record<string, string> = {
  estado: 'Estado',
  proceso_ref: 'Proceso',
  familia: 'Familia',
  destino: 'Destino',
  nota: 'Nota',
  alias: 'Alias',
}

/**
 * La ficha de un documento del inventario: metadatos, alias, archivos de origen
 * (solo las rutas: los archivos no están en el almacenamiento de la
 * plataforma), aviso de datos sensibles y proceso. Con `sistema:documentos`
 * editar se corrigen los metadatos; cada corrección queda en la auditoría.
 */
export default async function DocumentoPage({ params }: PageProps<'/sistema/nucleo/documentos/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('sistema:documentos'), params])
  if (!UUID.test(id)) notFound()
  const supabase = await createClient()

  // La RLS decide: un documento de perímetro, sin el permiso, no existe.
  const { data: d } = await supabase.schema('sgc').from('documento').select('*').eq('id', id).maybeSingle()
  if (!d) notFound()

  const veProcesos = puede(sesion, 'sistema:procesos')
  const puedeEditar = puede(sesion, 'sistema:documentos', 'editar')
  const [tipos, procesos, { data: opciones }, { data: cambios }] = await Promise.all([
    nombresDeTipo(supabase),
    veProcesos ? leerProcesos(supabase).then((r) => r.vigentes) : Promise.resolve([]),
    puedeEditar ? supabase.schema('sgc').rpc('opciones_documentos') : Promise.resolve({ data: [] }),
    puede(sesion, 'sistema:auditoria')
      ? supabase
          .schema('control')
          .from('auditoria')
          .select('id, accion, antes, despues, actor, en')
          .eq('esquema', 'sgc')
          .eq('tabla', 'documento')
          .eq('registro_id', id)
          .eq('accion', 'UPDATE')
          .order('id', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])
  const proceso = d.proceso_ref ? procesos.find((p) => p.ref === d.proceso_ref) : undefined
  const nombreProceso = new Map(procesos.map((p) => [p.ref, p.nombre]))
  const actores = [...new Set((cambios ?? []).map((c) => c.actor).filter(Boolean))] as string[]
  const { data: nombres } = actores.length ? await supabase.schema('flujo').rpc('nombres', { p_ids: actores }) : { data: [] }
  const nombreActor = new Map((nombres ?? []).map((n) => [n.id, n.nombre]))

  const opcionesProceso = enOrdenDeArbol(procesos.filter((p) => p.nivel <= 2)).map((p) => ({ valor: p.ref, etiqueta: etiquetaSangrada(p) }))
  const familias = (opciones ?? []).filter((o) => o.campo === 'familia' && o.valor).map((o) => o.valor!) as string[]

  const legible = (campo: string, v: unknown) => {
    if (v == null || v === '') return '—'
    if (campo === 'estado') return ESTADOS_DOCUMENTO[String(v)] ?? String(v)
    if (campo === 'destino') return DESTINOS_DOCUMENTO[String(v)] ?? String(v)
    if (campo === 'proceso_ref') return nombreProceso.get(String(v)) ?? 'Proceso no vigente'
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
    return String(v)
  }

  const dato = (etiqueta: string, valor: React.ReactNode, mono = false) => (
    <div>
      <dt className="text-xs text-marca-500">{etiqueta}</dt>
      <dd className={mono ? 'font-mono text-sm text-marca-800' : 'text-sm text-marca-800'}>{valor ?? '—'}</dd>
    </div>
  )

  return (
    <>
      <Link href="/sistema/nucleo/documentos" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Biblioteca
      </Link>
      <header className="mb-6">
        <p className="rotulo mb-2">Documento</p>
        <p className="font-mono text-sm text-marca-600">{d.codigo}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-marca-900">{d.titulo}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Insignia tono={TONO_DOCUMENTO[d.estado] ?? 'neutro'}>{ESTADOS_DOCUMENTO[d.estado] ?? d.estado}</Insignia>
          {d.perimetro !== 'general' && <Insignia tono="marca">Perímetro: {PERIMETROS[d.perimetro] ?? d.perimetro}</Insignia>}
          {d.tipo_yy && <Insignia tono="neutro">{tipos.get(d.tipo_yy) ?? `Tipo ${d.tipo_yy}`}</Insignia>}
        </div>
      </header>

      {d.datos_sensibles && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Contiene datos personales o credenciales.</strong> No se publica ni se difunde hasta sanearlo; si trae claves, se reportan a TI para
            rotarlas.
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Seccion titulo="Metadatos">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {dato('Código', d.codigo, true)}
              {dato('Proceso (XX)', d.proceso_xx)}
              {dato('Tipo (YY)', d.tipo_yy ? `${d.tipo_yy}${tipos.get(d.tipo_yy) ? ` · ${tipos.get(d.tipo_yy)}` : ''}` : null)}
              {dato('Versión', d.version)}
              {dato('Fecha', d.fecha ? fecha(d.fecha) : null)}
              {dato('Familia', d.familia)}
              {dato('Destino en la plataforma', d.destino ? DESTINOS_DOCUMENTO[d.destino] : 'Sin decidir')}
              {dato(
                'Proceso vinculado',
                proceso ? (
                  <Link href={`/sistema/nucleo/procesos/${proceso.ref}`} className="text-acento-700 hover:underline">
                    {proceso.nombre}
                  </Link>
                ) : d.proceso_ref ? (
                  veProcesos ? 'Proceso no vigente' : 'Vinculado (sin acceso a procesos)'
                ) : (
                  'Sin proceso'
                ),
              )}
              <div className="sm:col-span-2">{dato('Evidencia del estado', d.evidencia_estado)}</div>
              {d.nota && <div className="sm:col-span-2">{dato('Nota', d.nota)}</div>}
            </dl>
          </Seccion>

          <Seccion titulo={`Alias (${d.alias.length})`}>
            {d.alias.length ? (
              <ul className="flex flex-wrap gap-2">
                {d.alias.map((a: string) => (
                  <li key={a} className="rounded-lg bg-marca-100 px-2.5 py-1 font-mono text-xs text-marca-700">
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-marca-500">Sin alias registrados.</p>
            )}
          </Seccion>

          <Seccion titulo={`Archivos de origen (${d.archivos.length})`}>
            <p className="mb-2 text-xs text-marca-500">Rutas del levantamiento. Los archivos no están cargados en la plataforma.</p>
            {d.archivos.length ? (
              <ul className="space-y-1.5">
                {d.archivos.map((a: string) => (
                  <li key={a} className="rounded-lg bg-marca-50 px-3 py-1.5 font-mono text-[11px] break-all text-marca-700">
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-marca-500">Sin archivo propio: solo citado en un listado o anexo.</p>
            )}
          </Seccion>

          {(cambios ?? []).length > 0 && (
            <Seccion titulo="Correcciones registradas">
              <ul className="divide-y divide-[var(--borde)]">
                {(cambios ?? []).map((c) => {
                  const antes = (c.antes ?? {}) as Record<string, unknown>
                  const despues = (c.despues ?? {}) as Record<string, unknown>
                  const campos = Object.keys(CAMPOS_AUDITADOS).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
                  if (!campos.length) return null
                  return (
                    <li key={c.id} className="py-2.5 text-sm">
                      <p className="text-xs text-marca-500">
                        {fechaHora(c.en)}
                        {c.actor && nombreActor.get(c.actor) && <> · {nombreActor.get(c.actor)}</>}
                      </p>
                      {campos.map((k) => (
                        <p key={k} className="mt-0.5 text-marca-700">
                          <span className="font-medium">{CAMPOS_AUDITADOS[k]}:</span> {legible(k, antes[k])} → {legible(k, despues[k])}
                        </p>
                      ))}
                    </li>
                  )
                })}
              </ul>
            </Seccion>
          )}
        </div>

        <div>
          {puedeEditar ? (
            <Seccion titulo="Corregir metadatos">
              <p className="mb-4 text-xs text-marca-500">
                El código y el título se corrigen con motivo, y el contenido llega con la biblioteca de ciclo completo. Cada corrección queda en la auditoría.
              </p>
              <EditarDocumento
                doc={{ id: d.id, estado: d.estado, proceso_ref: d.proceso_ref, familia: d.familia, destino: d.destino, nota: d.nota, alias: d.alias }}
                procesos={opcionesProceso}
                familias={familias}
              />
            </Seccion>
          ) : (
            <Seccion titulo="Solo lectura">
              <p className="text-sm text-marca-500">Para corregir metadatos hace falta el permiso de editar documentos.</p>
            </Seccion>
          )}
        </div>
      </div>
    </>
  )
}
