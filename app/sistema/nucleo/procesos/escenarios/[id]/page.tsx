import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAlerta, IconoAtras, IconoCheck } from '@/components/iconos'
import { Insignia } from '@/components/ui'
import { ESTADOS_ESCENARIO, NIVELES, TONO_ESCENARIO, fecha, fechaHora, hoy } from '@/components/sistema/procesos/comun'
import { leerCatalogo, leerFilasDeEscenario, leerPlazas, leerProcesos, leerSolicitudes } from '@/components/sistema/procesos/datos'
import { ArbolEscenario, EnviarEscenario, type NodoEscenario } from '@/components/sistema/procesos/escenario'
import { Seccion } from '@/components/sistema/procesos/piezas'
import { LineaSolicitud } from '@/components/sistema/procesos/vistas'
import { descartarEscenario } from '@/app/sistema/nucleo/procesos/escenarios/acciones'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Escenario de procesos · Plataforma Iberia' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RUTA = '/sistema/nucleo/procesos/escenarios'

const CAMPOS: Record<string, string> = {
  nombre: 'Nombre',
  padre: 'Cuelga de',
  dueno: 'Dueño',
  tipo: 'Tipo',
  estado_operativo: 'Estado operativo',
  codigos: 'Códigos',
  ficha: 'Ficha PHVA',
  orden: 'Orden',
}

/**
 * Un escenario de procesos: su árbol editable, la comparación contra la
 * realidad de hoy (altas, bajas y cambios, calculada en la base por
 * `sgc.comparar_escenario_procesos`) y el envío a aprobación con fecha.
 */
export default async function EscenarioPage({ params, searchParams }: PageProps<'/sistema/nucleo/procesos/escenarios/[id]'>) {
  await requerirPermiso('sistema:procesos')
  const [sesion, { id }, consulta] = await Promise.all([requerirPermiso('sistema:escenarios'), params, searchParams])
  if (!UUID.test(id)) notFound()
  const supabase = await createClient()

  const { data: e } = await supabase.schema('org').from('escenario').select('*').eq('id', id).eq('alcance', 'procesos').maybeSingle()
  if (!e) notFound()

  const [filas, { data: comparacion }, { vigentes }, plazas, catalogo, solicitudes] = await Promise.all([
    leerFilasDeEscenario(supabase, id),
    supabase.schema('sgc').rpc('comparar_escenario_procesos', { p_escenario: id }),
    leerProcesos(supabase),
    leerPlazas(supabase),
    leerCatalogo(supabase),
    leerSolicitudes(supabase, 'escenario_procesos', [id]),
  ])
  const cambios = comparacion ?? []
  const cambioDe = new Map(cambios.map((c) => [c.ref, c.cambio as 'alta' | 'baja' | 'cambio']))
  const etiquetaPlaza = new Map(plazas.map((p) => [p.ref, p.etiqueta]))
  const nombreReal = new Map(vigentes.map((v) => [v.ref, v.nombre]))
  const nombreEsc = new Map(filas.map((f) => [f.ref, f.nombre]))

  const editable = e.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar') && puede(sesion, 'sistema:procesos', 'editar')
  const nodos: NodoEscenario[] = filas.map((f) => ({
    id: f.id,
    ref: f.ref,
    padre_ref: f.padre_ref,
    nivel: f.nivel,
    nombre: f.nombre,
    estado: f.estado,
    estado_operativo: f.estado_operativo,
    dueno_plaza_ref: f.dueno_plaza_ref,
    dueno: (f.dueno_plaza_ref && etiquetaPlaza.get(f.dueno_plaza_ref)) || f.dueno_texto,
    cambio: cambioDe.get(f.ref) ?? null,
  }))

  const valor = (lado: 'antes' | 'despues', campo: string, j: Record<string, unknown> | null) => {
    if (!j) return '—'
    const ref = (k: string) => (j[k] as string | null) ?? null
    switch (campo) {
      case 'nombre':
        return String(j.nombre ?? '—')
      case 'padre': {
        const r = ref('padre_ref')
        return r ? ((lado === 'antes' ? nombreReal.get(r) : nombreEsc.get(r)) ?? nombreReal.get(r) ?? 'Proceso nuevo') : 'Nivel superior'
      }
      case 'dueno': {
        const r = ref('dueno_plaza_ref')
        return (r && etiquetaPlaza.get(r)) || (j.dueno_texto as string) || 'Sin dueño'
      }
      case 'tipo':
        return catalogo.tipos[String(j.tipo)] ?? String(j.tipo ?? '—')
      case 'estado_operativo':
        return catalogo.estados[String(j.estado_operativo)] ?? String(j.estado_operativo)
      case 'codigos':
        return [j.codigo_sgc, j.codigo_informe && `Inf. ${j.codigo_informe}`].filter(Boolean).join(' · ') || '—'
      default:
        return null
    }
  }

  const grupos = [
    { clave: 'alta', titulo: 'Se agregan', lista: cambios.filter((c) => c.cambio === 'alta') },
    { clave: 'baja', titulo: 'Se retiran', lista: cambios.filter((c) => c.cambio === 'baja') },
    { clave: 'cambio', titulo: 'Cambian', lista: cambios.filter((c) => c.cambio === 'cambio') },
  ]
  const conBorrador = cambios.filter((c) => c.borrador_abierto)

  return (
    <>
      <Link href={RUTA} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Escenarios de procesos
      </Link>
      <header className="mb-6">
        <p className="rotulo mb-2">Escenario de procesos</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-marca-900">{e.nombre}</h1>
            <p className="mt-1 text-sm text-marca-600">
              {e.proceso_raiz_ref ? `Copia de «${nombreReal.get(e.proceso_raiz_ref) ?? nombreEsc.get(e.proceso_raiz_ref) ?? 'un proceso'}»` : 'Copia del catálogo completo'} ·
              tomada el {fecha(e.fecha_base)}
              {e.vigente_desde && <> · rige desde el {fecha(e.vigente_desde)}</>}
            </p>
            {e.descripcion && <p className="mt-1 max-w-2xl text-sm text-marca-700">{e.descripcion}</p>}
            <Link
              href={`/sistema/nucleo/procesos?esc=${e.id}`}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#d9cff0] bg-[#f7f4fd] px-3.5 text-sm font-semibold text-[#6b4fb3] hover:bg-[#f1edfa]"
            >
              ◆ {e.estado === 'borrador' ? 'Editar en el mapa' : 'Ver en el mapa'}
            </Link>
          </div>
          <Insignia tono={TONO_ESCENARIO[e.estado] ?? 'neutro'}>{ESTADOS_ESCENARIO[e.estado] ?? e.estado}</Insignia>
        </div>
      </header>

      {typeof consulta.error === 'string' && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-acento-200 bg-acento-50 px-4 py-3 text-sm text-acento-800">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          {consulta.error}
        </p>
      )}
      {consulta.enviado === '1' && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Enviado a aprobación. Al aprobarse, se publica solo con su fecha.
        </p>
      )}
      {e.estado === 'publicado' && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Publicado el {fechaHora(e.publicado_en)}. El escenario queda cerrado como evidencia; sus cambios ya están en el catálogo
          {e.vigente_desde && e.vigente_desde > hoy() ? ` y entran en vigor el ${fecha(e.vigente_desde)}` : ''}.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <h2 className="mb-3 text-lg font-semibold text-marca-900">Árbol del escenario</h2>
          {editable ? (
            <p className="mb-3 text-sm text-marca-600">Renombra, agrega, mueve, retira o cambia el dueño. Nada de esto toca la realidad hasta publicarse.</p>
          ) : (
            <p className="mb-3 text-sm text-marca-600">Solo lectura: el escenario {e.estado === 'borrador' ? 'pide permiso de edición' : 'ya no está en edición'}.</p>
          )}
          <ArbolEscenario
            escenario={id}
            nodos={nodos}
            plazas={plazas.map((p) => ({ valor: p.ref, etiqueta: p.etiqueta }))}
            estados={catalogo.estados}
            editable={editable}
          />
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Seccion titulo={`Comparado con la realidad de hoy (${cambios.length})`}>
            {conBorrador.length > 0 && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {conBorrador.length === 1 ? 'Un proceso' : `${conBorrador.length} procesos`} de este escenario {conBorrador.length === 1 ? 'tiene' : 'tienen'} un
                borrador abierto en la realidad: hay que cerrarlo antes de enviar.
              </p>
            )}
            {cambios.length === 0 ? (
              <p className="text-sm text-marca-500">{e.estado === 'publicado' ? 'Ya no hay diferencias: lo publicado es la realidad.' : 'Sin diferencias todavía.'}</p>
            ) : (
              <div className="space-y-4">
                {grupos
                  .filter((g) => g.lista.length)
                  .map((g) => (
                    <div key={g.clave}>
                      <p className="mb-1.5 text-xs font-semibold tracking-wide text-marca-500 uppercase">
                        {g.titulo} ({g.lista.length})
                      </p>
                      <ul className="divide-y divide-[var(--borde)]">
                        {g.lista.map((c) => (
                          <li key={c.ref} className="py-2 text-sm">
                            <p className="text-marca-800">
                              {c.nombre} <span className="text-xs text-marca-400">· {NIVELES[c.nivel]}</span>
                            </p>
                            {g.clave === 'alta' && (
                              <p className="text-xs text-marca-500">
                                Bajo «{valor('despues', 'padre', c.despues as Record<string, unknown>)}» · {valor('despues', 'dueno', c.despues as Record<string, unknown>)}
                              </p>
                            )}
                            {g.clave === 'cambio' &&
                              c.campos.map((k) => {
                                const a = valor('antes', k, c.antes as Record<string, unknown> | null)
                                const d = valor('despues', k, c.despues as Record<string, unknown>)
                                return (
                                  <p key={k} className="mt-0.5 text-xs text-marca-600">
                                    <span className="font-medium">{CAMPOS[k] ?? k}:</span>{' '}
                                    {a === null ? (
                                      'cambia'
                                    ) : (
                                      <>
                                        <span className="line-through decoration-marca-400">{a}</span> → <span className="text-emerald-800">{d}</span>
                                      </>
                                    )}
                                  </p>
                                )
                              })}
                            {c.borrador_abierto && <p className="mt-0.5 text-xs text-amber-800">Tiene un borrador abierto en la realidad.</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Seccion>

          {e.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar') && (
            <Seccion titulo="Enviar a aprobación">
              <p className="mb-3 text-xs text-marca-500">
                Ruta «Escenario de procesos»: revisa la Coordinación del SGC y aprueba la Gerencia de Calidad y Desarrollo. Al aprobarse, se publica con la fecha
                que elijas y lo de antes queda cerrado, no borrado.
              </p>
              <EnviarEscenario escenario={id} hoy={hoy()} cambios={cambios.length} />
              <form action={descartarEscenario} className="mt-4 border-t border-[var(--borde)] pt-4">
                <input type="hidden" name="escenario" value={id} />
                <button type="submit" className="btn-peligro h-9 px-3 text-xs">
                  Descartar el escenario
                </button>
              </form>
            </Seccion>
          )}

          {solicitudes.length > 0 && (
            <Seccion titulo="Aprobación">
              <div className="space-y-3">
                {solicitudes.map((s) => (
                  <LineaSolicitud key={s.id} solicitud={s} />
                ))}
              </div>
            </Seccion>
          )}
        </div>
      </div>
    </>
  )
}
