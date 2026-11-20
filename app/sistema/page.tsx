import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ESTADO_SOLICITUD, TIPO_OBJETO, enlaceObjeto } from '@/components/sistema/flujo/formato'
import { fechaLarga, hace } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, portadaDe, precargarMetricas } from '@/lib/plataforma/metricas'
import { misPendientes } from '@/components/sistema/shell/acciones'
import { MiDiaColaboracion } from '@/components/sistema/colaboracion/mi-dia'
import { PropuestasPendientes } from '@/components/sistema/ia/propuestas-pendientes'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TONO_CHIP } from '@/lib/plataforma/ficha-tipos'
import { Aviso } from '@/components/ui'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mi día · Plataforma Iberia' }

const TONO_SOLICITUD = { neutro: 'neutro', marca: 'neutro', acento: 'rojo', rojo: 'rojo', ambar: 'ambar', verde: 'verde' } as const

/**
 * «Mi día» (Anexo E §2.9 y §10 R5): la portada de cada quien. Lo que me toca
 * decidir, lo que pedí, mis tareas y menciones, y **las cifras de mi rol**, que
 * salen del registro de métricas (`ui.metrica`): la misma cifra dice lo mismo
 * aquí que en su módulo. Qué cifras ve cada rol se decide en Administración ›
 * Portadas (`ui.portada_rol`). Cada bloque sale solo si su permiso alcanza, y la
 * RLS decide lo que de verdad se lee.
 */
export default async function MiDiaPage({ searchParams }: PageProps<'/sistema'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const portada = await portadaDe(sesion)

  const [pendientes, mias] = await Promise.all([
    misPendientes().catch(() => []),
    supabase
      .schema('flujo')
      .from('solicitud')
      .select('id, tipo_objeto, objeto_id, titulo, estado, paso_actual, creado_en, paso(orden, nombre)')
      .eq('creado_por', sesion.userId)
      .order('creado_en', { ascending: false })
      .range(0, 7),
    // Las cifras de la portada, en una sola vuelta a la base.
    precargarMetricas(portada.claves, ctx),
  ])

  const nombre = (sesion.perfil.nombre_completo || sesion.email).split(' ')[0]
  const horaCcs = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', hour: 'numeric', hour12: false }).format(new Date()))
  const saludo = horaCcs < 12 ? 'Buenos días' : horaCcs < 19 ? 'Buenas tardes' : 'Buenas noches'
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
      {/* Los avisos del panel viejo (`requerirEditor`, `requerirAdmin`), que ahora cae aquí. */}
      {sp.aviso === 'solo-lectura' && (
        <div className="mb-3">
          <Aviso tono="ambar">Tu cuenta es de solo lectura: puedes consultar, pero no editar.</Aviso>
        </div>
      )}
      {sp.aviso === 'solo-admin' && (
        <div className="mb-3">
          <Aviso tono="ambar">Esa sección es exclusiva de los administradores del programa.</Aviso>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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

      <MiDiaColaboracion />

      {/* Lo que la IA propone y espera tu decisión (R4). Con la IA apagada no pinta nada. */}
      <div className="mt-3 empty:hidden">
        <PropuestasPendientes />
      </div>

      <section className="mt-4" aria-labelledby="mis-cifras">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="mis-cifras" className="text-[13px] font-semibold text-marca-900">
            Mis cifras
          </h2>
          <p className="text-[11.5px] text-marca-500">
            Del registro de métricas: la misma cifra dice lo mismo en su módulo.{' '}
            <Link href="/sistema/datos/metricas" className="font-semibold text-acento-700 hover:underline">
              Ver todas
            </Link>
            {puede(sesion, 'modulo:roles', 'editar') && (
              <>
                {' · '}
                <Link href="/sistema/administracion/portadas" className="font-semibold text-acento-700 hover:underline">
                  Elegir las de cada rol
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
          {portada.claves.map((clave) => (
            <KpiMetrica key={clave} clave={clave} ctx={ctx} sesion={sesion} />
          ))}
        </div>
      </section>
    </>
  )
}
