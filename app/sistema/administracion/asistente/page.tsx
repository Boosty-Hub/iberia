import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { inicioDelMes, leerConfig, leerConsumo, leerModelosAdmin } from '@/lib/asistente/admin'
import { numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { ETIQUETA_MOTOR } from '@/lib/asistente/tipos'

export const metadata: Metadata = { title: 'Asistente de IA · Administración' }

const usd = (n: number | null | undefined) => `US$ ${numero(Number(n ?? 0), 2)}`

/**
 * Administración › Asistente de IA › Resumen: el gasto del mes contra el tope
 * de la empresa, quién lo usa, cuánto tarda la primera palabra y el consumo por
 * persona y por modelo. Cifras del registro de métricas; nunca el contenido.
 */
export default async function ResumenAsistentePage({ searchParams }: PageProps<'/sistema/administracion/asistente'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:asistente-admin'), searchParams])
  const ctx = await leerContexto(sp)
  const [config, consumo, catalogo] = await Promise.all([
    leerConfig(),
    leerConsumo(inicioDelMes()),
    leerModelosAdmin(),
    precargarMetricas(['asistente_gasto_mes', 'asistente_usuarios_activos', 'asistente_turnos_mes', 'asistente_primera_palabra'], ctx),
  ])
  const nombreModelo = new Map(catalogo.map((m) => [m.id, m.nombre]))

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-IA"
        titulo="Asistente de IA"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion={config ? `Motor activo: ${ETIQUETA_MOTOR[config.motor]} · ${config.encendido ? 'encendido para la empresa' : 'apagado por la administración'}. Cifras de uso, nunca el contenido de los chats.` : undefined}
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiMetrica clave="asistente_gasto_mes" ctx={ctx} sesion={sesion} sinTendencia />
        <KpiMetrica clave="asistente_usuarios_activos" ctx={ctx} sesion={sesion} sinTendencia />
        <KpiMetrica clave="asistente_turnos_mes" ctx={ctx} sesion={sesion} sinTendencia />
        <KpiMetrica clave="asistente_primera_palabra" ctx={ctx} sesion={sesion} sinTendencia />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="relative overflow-x-auto rounded-xl border border-[var(--borde)] bg-white">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-marca-900">Consumo del mes por persona</h2>
          </header>
          {consumo.personas.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-marca-400">Nadie ha usado el asistente este mes.</p>
          ) : (
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="bg-marca-50 text-left text-[12px] text-marca-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Persona</th>
                  <th className="px-3 py-2 text-right font-semibold">Turnos</th>
                  <th className="px-3 py-2 text-right font-semibold">Fallidos</th>
                  <th className="px-3 py-2 text-right font-semibold">Gasto</th>
                  <th className="px-3 py-2 text-right font-semibold">1.ª palabra p90</th>
                  <th className="px-4 py-2 text-right font-semibold">👍 / 👎</th>
                </tr>
              </thead>
              <tbody>
                {consumo.personas.map((p) => (
                  <tr key={p.perfil_id} className="border-t border-[var(--borde)]">
                    <td className="px-4 py-2 text-marca-900">{p.nombre}</td>
                    <td className="px-3 py-2 text-right">{numero(p.turnos)}</td>
                    <td className="px-3 py-2 text-right">{numero(p.fallidos)}</td>
                    <td className="px-3 py-2 text-right font-medium">{usd(p.costo_usd)}</td>
                    <td className="px-3 py-2 text-right">{p.primer_token_p90_ms ? `${numero(p.primer_token_p90_ms / 1000, 1)} s` : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {numero(p.a_favor)} / {numero(p.en_contra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="relative overflow-x-auto rounded-xl border border-[var(--borde)] bg-white">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-marca-900">Por modelo, este mes</h2>
          </header>
          {consumo.modelos.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-marca-400">Sin turnos este mes.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-marca-50 text-left text-[12px] text-marca-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Modelo</th>
                  <th className="px-3 py-2 text-right font-semibold">Turnos</th>
                  <th className="px-3 py-2 text-right font-semibold">Gasto</th>
                  <th className="px-4 py-2 text-right font-semibold">1.ª palabra p90</th>
                </tr>
              </thead>
              <tbody>
                {consumo.modelos.map((m) => (
                  <tr key={m.clave} className="border-t border-[var(--borde)]">
                    <td className="px-4 py-2 text-marca-800">{nombreModelo.get(m.clave) ?? m.clave}</td>
                    <td className="px-3 py-2 text-right">{numero(m.turnos)}</td>
                    <td className="px-3 py-2 text-right font-medium">{usd(m.costo_usd)}</td>
                    <td className="px-4 py-2 text-right">{m.primer_token_p90_ms ? `${numero(m.primer_token_p90_ms / 1000, 1)} s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-[var(--borde)] px-4 py-2.5 text-[11.5px] text-marca-500">
            Precios de lista de cada proveedor, cargados en el catálogo de modelos con su fecha de verificación. El gasto de un turno se reserva antes de correr y se cobra lo real al terminar.
          </p>
        </section>
      </div>
    </>
  )
}
