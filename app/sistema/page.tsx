import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ESTADO_SOLICITUD, TIPO_OBJETO, enlaceObjeto } from '@/components/sistema/flujo/formato'
import { fechaLarga, hace, numero, porcentaje, sumarDias, tasa, variacion } from '@/lib/plataforma/formato'
import { leerContexto, tasasDelDia } from '@/lib/plataforma/servidor'
import { misPendientes } from '@/components/sistema/shell/acciones'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { TONO_CHIP } from '@/lib/plataforma/ficha-tipos'
import { Aviso } from '@/components/ui'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mi día · Plataforma Iberia' }

const TONO_SOLICITUD = { neutro: 'neutro', marca: 'neutro', acento: 'rojo', rojo: 'rojo', ambar: 'ambar', verde: 'verde' } as const

/**
 * «Mi día» (Anexo E §2.9): la portada de cada quien. Lo que me toca decidir, lo
 * que pedí y las cifras de mi alcance, cada una con su fuente. Se abre con
 * cualquier sesión: cada bloque sale solo si su permiso alcanza, y la RLS
 * decide lo que de verdad se lee.
 */
export default async function MiDiaPage({ searchParams }: PageProps<'/sistema'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const org = supabase.schema('org')
  const sgc = supabase.schema('sgc')
  const ahora = new Date().toISOString()
  const verEstructura = puede(sesion, 'sistema:estructura')
  const verProcesos = puede(sesion, 'sistema:procesos')
  const verDocumentos = puede(sesion, 'sistema:documentos')
  const verRequisiciones = puede(sesion, 'sistema:requisiciones') || puede(sesion, 'sistema:requisiciones', 'crear')

  /** Dotación: se suma todo, de mil en mil (nunca se asume que caben en una página). */
  const dotacion = async () => {
    let dot = 0
    let ocu = 0
    let exc = 0
    let plazas = 0
    for (let d = 0; d < 20000; d += 1000) {
      const { data } = await supabase.schema('ui').rpc('plazas', { p_al: ctx.al }).select('ref, dotacion, ocupadas, exceso').order('ref').range(d, d + 999)
      const filas = data ?? []
      for (const f of filas) {
        dot += f.dotacion ?? 0
        ocu += f.ocupadas ?? 0
        exc += f.exceso ?? 0
      }
      plazas += filas.length
      if (filas.length < 1000) break
    }
    return { dot, ocu, exc, plazas }
  }

  const [pendientes, mias, t, serie, dot, procTotal, procFicha, docVig, docTotal, reqAbiertas] = await Promise.all([
    misPendientes().catch(() => []),
    supabase
      .schema('flujo')
      .from('solicitud')
      .select('id, tipo_objeto, objeto_id, titulo, estado, paso_actual, creado_en, paso(orden, nombre)')
      .eq('creado_por', sesion.userId)
      .order('creado_en', { ascending: false })
      .range(0, 7),
    tasasDelDia(sesion),
    supabase.schema('control').rpc('serie_tasas', { p_desde: sumarDias(ctx.al, -29), p_hasta: ctx.al }),
    verEstructura ? dotacion() : null,
    verProcesos ? sgc.from('proceso').select('id', { count: 'exact', head: true }).is('escenario_id', null).eq('estado', 'vigente') : null,
    verProcesos ? sgc.from('proceso').select('id', { count: 'exact', head: true }).is('escenario_id', null).eq('estado', 'vigente').neq('ficha', '{}') : null,
    verDocumentos ? sgc.from('documento').select('id', { count: 'exact', head: true }).eq('estado', 'vigente') : null,
    verDocumentos ? sgc.from('documento').select('id', { count: 'exact', head: true }) : null,
    verRequisiciones ? org.from('requisicion').select('id', { count: 'exact', head: true }).in('estado', ['en_aprobacion', 'aprobada', 'en_seleccion']) : null,
  ])

  const nombre = (sesion.perfil.nombre_completo || sesion.email).split(' ')[0]
  const horaCcs = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false }).format(new Date()))
  const saludo = horaCcs < 12 ? 'Buenos días' : horaCcs < 19 ? 'Buenas tardes' : 'Buenas noches'
  const usdSerie = (serie.data ?? []).map((f) => (f.usd === null ? null : Number(f.usd)))
  const vUsd = t?.usd && t.usdAnterior ? variacion(((t.usd - t.usdAnterior) / t.usdAnterior) * 100) : null
  const pedidas = mias.data ?? []

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo={`${saludo}, ${nombre}`}
        descripcion={`${fechaLarga(ctx.al)} · lo que te toca decidir, lo que pediste y tus cifras, cada una con su fuente.`}
      />

      {sp.aviso === 'sin-permiso' && (
        <div className="mb-3">
          <Aviso tono="ambar">Esa pantalla no está al alcance {sesion.vistaComo ? 'del rol que estás previsualizando' : 'de tu rol'}.</Aviso>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        {dot && (
          <Kpi
            titulo="Dotación"
            valor={`${numero(dot.ocu)} / ${numero(dot.dot)}`}
            comparacion={{ texto: `${numero(Math.max(dot.dot - dot.ocu, 0))} por cubrir · ${numero(dot.exc)} por encima · ${numero(dot.plazas)} plazas` }}
            sello={{ fuente: 'Organización (plazas y titulares)', en: ahora }}
            href="/sistema/nucleo/organizacion/plazas"
          />
        )}
        {procTotal && (
          <Kpi
            titulo="Procesos con ficha"
            valor={`${numero(procFicha?.count ?? 0)} / ${numero(procTotal.count ?? 0)}`}
            comparacion={{ texto: procTotal.count ? `${porcentaje(((procFicha?.count ?? 0) / procTotal.count) * 100, 0)} de los vigentes tienen su ficha PHVA` : 'Sin procesos vigentes' }}
            sello={{ fuente: 'Procesos (SGC)', en: ahora }}
            href="/sistema/nucleo/procesos"
          />
        )}
        {docVig && (
          <Kpi
            titulo="Documentos vigentes"
            valor={numero(docVig.count ?? 0)}
            comparacion={{ texto: `de ${numero(docTotal?.count ?? 0)} en el inventario que puedes ver` }}
            sello={{ fuente: 'Inventario documental', en: ahora }}
            href="/sistema/nucleo/documentos"
          />
        )}
        {reqAbiertas && (
          <Kpi
            titulo="Requisiciones abiertas"
            valor={numero(reqAbiertas.count ?? 0)}
            comparacion={{ texto: 'En aprobación, aprobadas o en selección' }}
            sello={{ fuente: 'Requisiciones de personal', en: ahora }}
            href="/sistema/nucleo/organizacion/requisiciones"
          />
        )}
        <Kpi
          titulo="BCV · dólar"
          valor={tasa(t?.usd)}
          unidad="Bs"
          comparacion={t?.usd ? { texto: `${vUsd ? `${vUsd.texto} · ` : ''}vale desde ${fechaLarga(t.usdFechaValor)}` } : null}
          serie={usdSerie}
          escalones
          sello={{ fuente: 'bcv.org.ve', en: t?.usdCapturada, estado: t?.usd ? 'al_dia' : 'sin_dato' }}
          href={puede(sesion, 'sistema:tasas') ? '/sistema/finanzas/tasas' : undefined}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="te-toca">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--borde)] px-4 py-2.5">
            <h2 id="te-toca" className="text-[13px] font-semibold text-marca-900">
              Te toca decidir <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600">{pendientes.length}</span>
            </h2>
            <Link href="/sistema/bandeja" className="text-xs font-semibold text-acento-700 hover:underline">
              Mis aprobaciones
            </Link>
          </header>
          {!pendientes.length ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-marca-400">No tienes nada por decidir. Cuando una solicitud llegue a un paso tuyo, aparece aquí y en la campana.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#fafbfc] text-left text-[11px] text-marca-500">
                    <th className="px-4 py-2 font-semibold">Qué</th>
                    <th className="px-2 py-2 font-semibold">Tu paso</th>
                    <th className="px-2 py-2 font-semibold">Espera</th>
                    <th className="px-2 py-2 font-semibold">Pidió</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pendientes.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-t border-[#eef0f3]">
                      <td className="max-w-[22rem] truncate px-4 py-2 text-marca-900">{p.titulo}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-marca-600">{p.paso}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-marca-600">{hace(p.desde)}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-marca-600">{p.pidio ?? '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <Link href={p.href ?? '/sistema/bandeja'} className="inline-flex h-7 items-center rounded-md border border-[var(--borde)] px-2.5 text-xs font-medium hover:bg-marca-50">
                          Revisar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="lo-que-pedi">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 id="lo-que-pedi" className="text-[13px] font-semibold text-marca-900">
              Lo que pedí
            </h2>
          </header>
          {!pedidas.length ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-marca-400">No has enviado nada a aprobación.</p>
          ) : (
            <ul>
              {pedidas.map((s) => {
                const est = ESTADO_SOLICITUD[s.estado] ?? { etiqueta: s.estado, tono: 'neutro' as const }
                const pasos = (s.paso ?? []) as unknown as { orden: number; nombre: string }[]
                const actual = pasos.find((x) => x.orden === s.paso_actual)
                const href = enlaceObjeto(s.tipo_objeto, s.objeto_id)
                const cuerpo = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-marca-900">{s.titulo}</span>
                      <span className="block truncate text-[11.5px] text-marca-400">
                        {TIPO_OBJETO[s.tipo_objeto] ?? s.tipo_objeto} · {hace(s.creado_en)}
                        {actual && s.estado === 'en_curso' ? ` · va en: ${actual.nombre}` : ''}
                      </span>
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', TONO_CHIP[TONO_SOLICITUD[est.tono]])}>{est.etiqueta}</span>
                  </>
                )
                return (
                  <li key={s.id} className="border-t border-[#eef0f3] first:border-0">
                    {href ? (
                      <Link href={href} className="flex items-center gap-3 px-4 py-2 hover:bg-[#f8f9fb]">
                        {cuerpo}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2">{cuerpo}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
