import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ESTADOS_ESCENARIO, NIVELES, fecha, fechaHora, hoy } from '@/components/sistema/procesos/comun'
import { leerCatalogo, leerFilasDeEscenario, leerPlazas, leerProcesos, leerSolicitudes } from '@/components/sistema/procesos/datos'
import { ArbolEscenario, EnviarEscenario, type NodoEscenario } from '@/components/sistema/procesos/escenario'
import { LineaSolicitud } from '@/components/sistema/procesos/vistas'
import { Segmentos } from '@/components/sistema/procesos/piezas-r2'
import { MapaLienzo } from '@/components/sistema/lienzo/MapaLienzo'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { descartarEscenario } from '@/app/sistema/nucleo/procesos/escenarios/acciones'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Escenario · Procesos' }

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

const TONO_ESTADO: Record<string, string> = {
  borrador: 'bg-[#f1edfa] text-[#5a3f9e]',
  en_aprobacion: 'bg-[#fdf4e3] text-[#8a5a12]',
  aprobado: 'bg-[#eaf2fb] text-[#2f5f9a]',
  publicado: 'bg-[#e7f5ee] text-[#1f6f4b]',
  descartado: 'bg-[#eef0f3] text-marca-600',
}

/**
 * Un escenario de procesos: el lienzo en modo escenario (en borrador y con
 * permiso se arrastra para mover y «⋯» agrega, renombra o retira), la lista de
 * cambios contra la realidad (`sgc.comparar_escenario_procesos`) y el envío a
 * aprobación con fecha. `?vista=lista` da el árbol en lista (teléfono).
 */
export default async function EscenarioPage({ params, searchParams }: PageProps<'/sistema/nucleo/procesos/escenarios/[id]'>) {
  await requerirPermiso('sistema:procesos')
  const [sesion, { id }, consulta] = await Promise.all([requerirPermiso('sistema:escenarios'), params, searchParams])
  if (!UUID.test(id)) notFound()
  const supabase = await createClient()

  const { data: e } = await supabase.schema('org').from('escenario').select('*').eq('id', id).eq('alcance', 'procesos').maybeSingle()
  if (!e) notFound()
  const vista = consulta.vista === 'lista' ? 'lista' : 'lienzo'
  const editable = e.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar') && puede(sesion, 'sistema:procesos', 'editar')

  const [filasLienzo, filas, { data: comparacion }, { vigentes }, plazas, catalogo, solicitudes] = await Promise.all([
    vista === 'lienzo' ? supabase.schema('sgc').rpc('lienzo', { p_fecha: hoy(), p_escenario: id }) : Promise.resolve({ data: null, error: null }),
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
    { clave: 'alta', titulo: 'Se agregan', simbolo: '＋', lista: cambios.filter((c) => c.cambio === 'alta') },
    { clave: 'baja', titulo: 'Se retiran', simbolo: '−', lista: cambios.filter((c) => c.cambio === 'baja') },
    { clave: 'cambio', titulo: 'Cambian', simbolo: '↻', lista: cambios.filter((c) => c.cambio === 'cambio') },
  ]
  const conBorrador = cambios.filter((c) => c.borrador_abierto)
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
  const raiz = e.proceso_raiz_ref ? (nombreReal.get(e.proceso_raiz_ref) ?? nombreEsc.get(e.proceso_raiz_ref) ?? 'un proceso') : null

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo={`Escenario · ${e.nombre}`}
        migas={[{ etiqueta: 'Escenarios', href: RUTA }, { etiqueta: e.nombre }]}
        acciones={
          <>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TONO_ESTADO[e.estado] ?? TONO_ESTADO.descartado)}>{ESTADOS_ESCENARIO[e.estado] ?? e.estado}</span>
            <Link href={`/sistema/nucleo/procesos?esc=${e.id}`} className={BOTON_CABECERA}>
              ◆ Abrir en el mapa
            </Link>
          </>
        }
        descripcion={
          <>
            {raiz ? `Copia de «${raiz}»` : 'Copia del catálogo completo'}, tomada el {fecha(e.fecha_base)}
            {e.vigente_desde && <> · rige desde el {fecha(e.vigente_desde)}</>}. {e.descripcion}
          </>
        }
      />

      {typeof consulta.error === 'string' && <p role="alert" className="mb-3 rounded-lg bg-[#fbeceb] px-3 py-2 text-[12.5px] text-[#a3241f]">{consulta.error}</p>}
      {consulta.enviado === '1' && <p role="status" className="mb-3 rounded-lg bg-[#e7f5ee] px-3 py-2 text-[12.5px] text-[#1f6f4b]">✓ Enviado a aprobación. Al aprobarse, se publica solo con su fecha.</p>}
      {e.estado === 'publicado' && (
        <p className="mb-3 rounded-lg bg-[#e7f5ee] px-3 py-2 text-[12.5px] text-[#1f6f4b]">
          Publicado el {fechaHora(e.publicado_en)}. El escenario queda cerrado como evidencia; sus cambios ya están en el catálogo
          {e.vigente_desde && e.vigente_desde > hoy() ? ` y entran en vigor el ${fecha(e.vigente_desde)}` : ''}.
        </p>
      )}

      <Segmentos
        etiqueta="Cómo ver el escenario"
        activa={vista}
        opciones={[
          { valor: 'lienzo', etiqueta: 'Lienzo', href: `${RUTA}/${id}` },
          { valor: 'lista', etiqueta: 'Lista', href: `${RUTA}/${id}?vista=lista` },
        ]}
      />
      {vista === 'lienzo' ? (
        filasLienzo.error ? (
          <p className="rounded-lg bg-[#fbeceb] px-3 py-2 text-[12.5px] text-[#a3241f]">No se pudo leer el escenario: {filasLienzo.error.message}</p>
        ) : (
          <MapaLienzo filas={filasLienzo.data ?? []} estados={catalogo.estados} escenario={{ id: e.id, nombre: e.nombre, editable }} />
        )
      ) : (
        <ArbolEscenario escenario={id} nodos={nodos} plazas={plazas.map((p) => ({ valor: p.ref, etiqueta: p.etiqueta }))} estados={catalogo.estados} editable={editable} />
      )}
      <p className="mt-2 text-[11.5px] text-marca-500">
        {editable
          ? 'Arrastra un proceso sobre otro para cambiar de dónde cuelga, o usa «⋯» para agregar, renombrar o retirar. Nada toca la realidad hasta que se publique.'
          : `Solo lectura: el escenario ${e.estado === 'borrador' ? 'pide permiso de edición' : 'ya no está en edición'}.`}
      </p>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 className="text-[13px] font-semibold text-marca-900">Cambios contra la realidad de hoy · {cambios.length}</h2>
          {conBorrador.length > 0 && (
            <p className="mt-2 rounded-lg bg-[#fdf4e3] px-2.5 py-2 text-[12px] text-[#8a5a12]">
              ⚠ {conBorrador.length === 1 ? 'Un proceso' : `${conBorrador.length} procesos`} de este escenario {conBorrador.length === 1 ? 'tiene' : 'tienen'} un borrador abierto en la
              realidad: hay que cerrarlo antes de enviar.
            </p>
          )}
          {cambios.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-marca-400">{e.estado === 'publicado' ? 'Ya no hay diferencias: lo publicado es la realidad.' : 'Sin diferencias todavía.'}</p>
          ) : (
            <div className="mt-2 grid gap-3 lg:grid-cols-3">
              {grupos.map((g) => (
                <div key={g.clave} className="min-w-0">
                  <p className="mb-1 text-[11px] font-semibold tracking-wide text-marca-500 uppercase">
                    <span aria-hidden>{g.simbolo}</span> {g.titulo} · {g.lista.length}
                  </p>
                  {g.lista.length ? (
                    <ul className="divide-y divide-[#eef0f3]">
                      {g.lista.map((c) => (
                        <li key={c.ref} className="py-1.5 text-[12.5px]">
                          <p className="text-marca-900">
                            {c.nombre} <span className="text-[11px] text-marca-400">· {NIVELES[c.nivel]}</span>
                          </p>
                          {g.clave === 'alta' && (
                            <p className="text-[11.5px] text-marca-500">
                              Bajo «{valor('despues', 'padre', c.despues as Record<string, unknown>)}» · {valor('despues', 'dueno', c.despues as Record<string, unknown>)}
                            </p>
                          )}
                          {g.clave === 'cambio' &&
                            c.campos.map((k) => {
                              const a = valor('antes', k, c.antes as Record<string, unknown> | null)
                              const d = valor('despues', k, c.despues as Record<string, unknown>)
                              return (
                                <p key={k} className="text-[11.5px] text-marca-600">
                                  <span className="font-medium">{CAMPOS[k] ?? k}:</span>{' '}
                                  {a === null ? 'cambia' : (
                                    <>
                                      <span className="line-through decoration-marca-400">{a}</span> → <span className="text-[#1f6f4b]">{d}</span>
                                    </>
                                  )}
                                </p>
                              )
                            })}
                          {c.borrador_abierto && <p className="text-[11.5px] text-[#8a5a12]">⚠ Tiene un borrador abierto en la realidad.</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-marca-400">—</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3">
          {e.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar') && (
            <section className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
              <h2 className="mb-1 text-[13px] font-semibold text-marca-900">Enviar a aprobación</h2>
              <p className="mb-3 text-[11.5px] text-marca-500">
                Ruta «Escenario de procesos»: revisa la Coordinación del SGC y aprueba la Gerencia de Calidad y Desarrollo. Al aprobarse, se publica con la fecha que elijas.
              </p>
              <EnviarEscenario escenario={id} hoy={hoy()} cambios={cambios.length} />
              <form action={descartarEscenario} className="mt-3 border-t border-[var(--borde)] pt-3">
                <input type="hidden" name="escenario" value={id} />
                <button type="submit" className="btn-peligro h-9 px-3 text-xs">
                  Descartar el escenario
                </button>
              </form>
            </section>
          )}
          {solicitudes.length > 0 && (
            <section className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
              <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Aprobación</h2>
              <div className="space-y-3">
                {solicitudes.map((s) => (
                  <LineaSolicitud key={s.id} solicitud={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
