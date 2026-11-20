import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { fechaHora, fechaLarga } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { comparacionMetrica, hrefMetrica, precargarMetricas, puedeVerMetrica, valorMetrica, type Metrica } from '@/lib/plataforma/metricas'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { IconoCandadito } from '@/components/sistema/shell/iconos'

export const metadata: Metadata = { title: 'Métricas · Datos' }

const MODULO: Record<string, string> = {
  'NUC-ORG': 'Organización',
  'NUC-PRO': 'Procesos',
  'NUC-DOC': 'Documentos',
  'FIN-TAS': 'Tasas de cambio',
}

/**
 * El registro de métricas (DAT-SEM, semilla; capítulo 03 §13): cada cifra de
 * la plataforma con su definición en palabras, su dueño, su fuente, la función
 * que la calcula y su valor de hoy para quien mira. Lo que la pantalla muestra
 * es lo mismo que pintan Mi día y cada Resumen: todos leen de aquí.
 *
 * Las cifras que tu rol no alcanza salen con su definición y un candado, sin
 * valor: la base no lo manda.
 */
export default async function MetricasPage({ searchParams }: PageProps<'/sistema/datos/metricas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:inicio'), searchParams])
  const ctx = await leerContexto(sp)
  const lista = await precargarMetricas(null, ctx)
  const grupos = new Map<string, Metrica[]>()
  for (const m of lista) {
    const g = m.modulo ? (MODULO[m.modulo] ?? m.modulo) : 'Lo tuyo (Mi día)'
    grupos.set(g, [...(grupos.get(g) ?? []), m])
  }
  const visibles = lista.filter((m) => puedeVerMetrica(sesion, m)).length

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="DAT-SEM"
        titulo="Métricas"
        migas={[{ etiqueta: 'Registro' }]}
        descripcion={`Cada cifra de la plataforma se define una sola vez, aquí: qué cuenta, quién responde por ella y de dónde sale. Valores al ${fechaLarga(ctx.al)}, con tu acceso (${visibles} de ${lista.length}).`}
      />

      <p className="mb-3 rounded-lg border border-[var(--borde)] bg-white px-3 py-2 text-[12px] text-marca-600">
        Es la semilla de la capa semántica (DAT-SEM): hoy cada métrica es una función de la base con su definición escrita. Cuando llegue el espejo de JD, las de
        venta, cartera e inventario se suman con versión, metas y certificación del dueño.
      </p>

      <div className="flex flex-col gap-4">
        {[...grupos.entries()].map(([grupo, ms]) => (
          <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
            <h2 id={`grupo-${grupo}`} className="mb-2 text-[13px] font-semibold text-marca-900">
              {grupo} <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] font-normal text-marca-600">{ms.length}</span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {ms.map((m) => {
                const ve = puedeVerMetrica(sesion, m)
                const v = valorMetrica(m)
                const href = hrefMetrica(m, ctx)
                const comp = ve ? comparacionMetrica(m) : null
                return (
                  <li key={m.clave} id={m.clave} className="min-w-0 scroll-mt-16 rounded-xl border border-[var(--borde)] bg-white p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <h3 className="text-[13.5px] font-semibold text-marca-900">{m.nombre}</h3>
                        <p className="font-mono text-[10.5px] text-marca-400">
                          {m.clave} · v{m.version}
                        </p>
                      </div>
                      <div className="text-right">
                        {!ve ? (
                          <p className="inline-flex items-center gap-1 text-[12px] text-marca-500">
                            <IconoCandadito className="h-3.5 w-3.5" aria-hidden /> Fuera de tu acceso
                          </p>
                        ) : m.error ? (
                          <p className="text-[12px] text-[#a3241f]">No se pudo calcular</p>
                        ) : (
                          <p className="text-[20px] leading-none font-bold text-marca-900 tabular-nums">
                            {v.valor}
                            {v.unidad && <span className="ml-1 text-[12.5px] font-semibold text-marca-600">{v.unidad}</span>}
                          </p>
                        )}
                        {comp && <p className="mt-1 max-w-[18rem] text-[11px] text-marca-500 tabular-nums">{comp}</p>}
                      </div>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-marca-700">{m.definicion}</p>
                    <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11.5px]">
                      <dt className="text-marca-400">Dueño</dt>
                      <dd className="text-marca-700">{m.dueno ?? 'Cada persona (es lo suyo)'}</dd>
                      <dt className="text-marca-400">Fuente</dt>
                      <dd className="text-marca-700">{m.fuente}</dd>
                      <dt className="text-marca-400">Unidad</dt>
                      <dd className="text-marca-700">{m.unidad}</dd>
                      <dt className="text-marca-400">Fecha</dt>
                      <dd className="text-marca-700">{m.con_fecha ? 'Sigue a «Datos al»' : 'Estado de hoy (no tiene historia por fecha)'}{m.con_escenario ? ' · respeta el escenario' : ''}</dd>
                      <dt className="text-marca-400">Cálculo</dt>
                      <dd className="font-mono text-[11px] break-all text-marca-600">
                        {m.clave === 'procesos_validados' ? 'ui.m_procesos_validados (cuenta solicitudes que la RLS no deja abrir)' : `ui.m_${m.clave}`}
                        {ve && m.ms !== null ? ` · ${m.ms} ms` : ''}
                        {ve && m.calculado_en ? ` · ${fechaHora(m.calculado_en)}` : ''}
                      </dd>
                    </dl>
                    {href && ve && (
                      <Link href={href} className="mt-2 inline-flex text-[12px] font-semibold text-acento-700 hover:underline">
                        Abrir la tabla que la origina ›
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
