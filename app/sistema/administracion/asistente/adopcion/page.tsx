import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { inicioDelMes, leerConsumo } from '@/lib/asistente/admin'
import { CATEGORIAS } from '@/lib/asistente/tipos'
import { numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'

export const metadata: Metadata = { title: 'Adopción · Asistente de IA' }

/**
 * Adopción: quién lo usa, para qué tipo de trabajo (la categoría que pone
 * Haiku a cada turno; nunca el contenido), con qué calificación y cómo va por
 * día. Lo que no se mide se convierte en entusiasmo tecnológico.
 */
export default async function AdopcionPage({ searchParams }: PageProps<'/sistema/administracion/asistente/adopcion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:asistente-admin'), searchParams])
  const ctx = await leerContexto(sp)
  const [consumo] = await Promise.all([leerConsumo(inicioDelMes()), precargarMetricas(['asistente_usuarios_activos', 'asistente_turnos_mes'], ctx)])
  const maxCat = Math.max(1, ...consumo.categorias.map((c) => c.turnos))
  const maxDia = Math.max(1, ...consumo.dias.map((d) => d.turnos))

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="NUC-IA" titulo="Asistente de IA" migas={[{ etiqueta: 'Adopción' }]} descripcion="Para qué se usa y cómo lo califican. La categoría de cada turno la asigna un modelo chico; del chat no se guarda nada aquí." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiMetrica clave="asistente_usuarios_activos" ctx={ctx} sesion={sesion} sinTendencia />
        <KpiMetrica clave="asistente_turnos_mes" ctx={ctx} sesion={sesion} sinTendencia />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-marca-900">Para qué lo usan · este mes</h2>
          {consumo.categorias.length === 0 ? (
            <p className="text-[13px] text-marca-400">Sin turnos este mes.</p>
          ) : (
            <ul className="space-y-2">
              {consumo.categorias.map((c) => (
                <li key={c.clave} className="grid grid-cols-[140px_1fr_64px] items-center gap-3 text-[12.5px]">
                  <span className="truncate text-marca-700">{CATEGORIAS[c.clave] ?? c.clave}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-marca-100">
                    <span className="block h-full rounded-full bg-marca-600" style={{ width: `${(c.turnos / maxCat) * 100}%` }} />
                  </span>
                  <span className="text-right text-marca-600">{numero(c.turnos)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-marca-900">Turnos por día · este mes</h2>
          {consumo.dias.length === 0 ? (
            <p className="text-[13px] text-marca-400">Sin turnos este mes.</p>
          ) : (
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Turnos por día del mes">
              {consumo.dias.map((d) => (
                <div key={d.clave} className="flex flex-1 flex-col items-center gap-1" title={`${d.clave}: ${d.turnos} turnos`}>
                  <span className="w-full rounded-t bg-acento-500/80" style={{ height: `${Math.max(4, (d.turnos / maxDia) * 128)}px` }} />
                  <span className="text-[10.5px] text-marca-400">{d.clave.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
