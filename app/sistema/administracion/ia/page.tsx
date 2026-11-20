import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoIa } from '@/lib/ia/servidor'
import { ETIQUETA_USO, type NivelIa } from '@/lib/ia/niveles'
import { fechaHora, numero, porcentaje } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'
import { CambioNivel, InterruptorCapacidad, InterruptorGeneral, TopeDiario } from '@/components/sistema/ia/gobierno'

export const metadata: Metadata = { title: 'Gobierno de IA · Administración' }

type PorCapacidad = {
  propuestas: number
  pendientes: number
  aceptadas: number
  rechazadas: number
  revertidas: number
  llamadas: number
  costo_mes_usd: number
  latencia_ms: number | null
  errores: number
  solicitud: { a: string; motivo: string; pedido_en: string; por: string | null } | null
}

type Tablero = {
  encendidas: number
  registradas: number
  tope_encendidas: number
  propuestas_semana: number
  decididas_30: number
  aceptadas_30: number
  aplicadas_n4_30: number
  revertidas_30: number
  costo_mes_usd: number
  costo_hoy_usd: number
  tope_diario_usd: number
  tope_mes_usd: number
  llamadas_mes: number
  general: { encendido: boolean; motivo: string | null; cambiado_en: string; por: string | null }
  por_capacidad: Record<string, PorCapacidad>
}

const usd = (n: number | null | undefined, d = 2) => `US$ ${numero(Number(n ?? 0), d)}`

/**
 * Gobierno de IA (NUC-GIA, Anexo E §7): el catálogo de capacidades con su
 * nivel, su techo, su dueño, sus métricas y su interruptor; el interruptor
 * general; el tope de gasto. Los perímetros no aparecen: allí la IA no existe.
 */
export default async function GobiernoIaPage() {
  const sesion = await requerirPermiso('sistema:ia')
  const edita = puede(sesion, 'sistema:ia', 'editar')
  const supabase = await createClient()
  const [{ data }, catalogo] = await Promise.all([supabase.schema('ia').rpc('tablero'), catalogoIa()])
  const t = data as unknown as Tablero | null
  if (!t) return <p className="text-marca-500">No se pudo leer el tablero de la IA.</p>

  const aceptacion = t.decididas_30 ? (t.aceptadas_30 / t.decididas_30) * 100 : null
  const baseReversion = t.aceptadas_30 + t.aplicadas_n4_30
  const reversion = baseReversion ? (t.revertidas_30 / baseReversion) * 100 : null
  const sello = { fuente: 'ia.propuesta · ia.actividad', en: new Date().toISOString(), estado: 'al_dia' as const }
  const general = t.general?.encendido ?? false

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-GIA"
        migas={[{ etiqueta: 'Capacidades' }]}
        descripcion="Cada capacidad de IA con su nivel (N0–N4), su techo, su dueño y su interruptor. Toda capacidad nace apagada y se enciende de a una; subir un nivel pasa por aprobación, bajar y apagar es inmediato. La IA propone; las personas deciden."
      />

      <div className="mb-3">
        <InterruptorGeneral
          encendido={general}
          puedeEditar={edita}
          detalle={t.general?.cambiado_en ? `Último cambio: ${fechaHora(t.general.cambiado_en)}${t.general.por ? ` · ${t.general.por}` : ''}${t.general.motivo ? ` · «${t.general.motivo}»` : ''}` : null}
        />
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <Kpi
          titulo="Capacidades encendidas"
          valor={`${t.encendidas} de ${t.tope_encendidas}`}
          comparacion={{ texto: `tope de la Fase 2 (D-13) · ${t.registradas} registradas` }}
          sello={{ ...sello, fuente: 'ia.capacidad' }}
        />
        <Kpi
          titulo="Propuestas esta semana"
          valor={numero(t.propuestas_semana)}
          comparacion={{ texto: `aceptación ${aceptacion === null ? '—' : porcentaje(aceptacion, 0)} · reversión ${reversion === null ? '—' : porcentaje(reversion, 0)} (30 días)` }}
          sello={sello}
          href="/sistema/administracion/ia/actividad"
        />
        <Kpi
          titulo="Costo del mes"
          valor={usd(t.costo_mes_usd)}
          comparacion={{ texto: `tope del mes ${usd(t.tope_mes_usd, 0)} · ${numero(t.llamadas_mes)} llamadas al modelo` }}
          sello={{ fuente: 'ia.actividad · precios de lista', en: new Date().toISOString(), estado: 'al_dia', detalle: 'Tokens × precio de lista de Opus 5.5 (US$ 4 / 20 por millón). Se concilia con la consola del proveedor.' }}
        />
        <div className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h3 className="text-[12px] font-semibold text-marca-500">Gasto de hoy</h3>
          <p className="mt-1.5 text-[24px] leading-none font-bold text-marca-900 tabular-nums">{usd(t.costo_hoy_usd, 3)}</p>
          <p className="mt-1.5 text-[12px] text-marca-500 tabular-nums">tope diario {usd(t.tope_diario_usd)} · al llegar, la IA vuelve al camino manual hasta mañana</p>
          <TopeDiario tope={t.tope_diario_usd} puedeEditar={edita} />
        </div>
      </div>

      <section className="rounded-xl border border-[var(--borde)] bg-white">
        <h2 className="border-b border-[var(--borde)] px-3 py-2.5 text-[13px] font-semibold text-marca-900">Catálogo de capacidades · módulos de la Etapa 1</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[12.5px]" data-catalogo-ia>
            <thead className="bg-[#fafbfc] text-left text-[11.5px] text-marca-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Código</th>
                <th className="px-3 py-2 font-semibold">Qué hace</th>
                <th className="px-3 py-2 font-semibold">Nivel</th>
                <th className="px-3 py-2 font-semibold">Techo</th>
                <th className="px-3 py-2 font-semibold">Dueño</th>
                <th className="px-3 py-2 text-right font-semibold">Propuestas 30 d</th>
                <th className="px-3 py-2 text-right font-semibold">Aceptación</th>
                <th className="px-3 py-2 text-right font-semibold">Costo mes</th>
                <th className="px-3 py-2 font-semibold">Interruptor</th>
              </tr>
            </thead>
            <tbody>
              {catalogo.map((c) => {
                const m = t.por_capacidad[c.codigo]
                const decididas = (m?.aceptadas ?? 0) + (m?.rechazadas ?? 0)
                return (
                  <tr key={c.codigo} className="border-t border-[#eef0f3] align-top" data-capacidad={c.codigo}>
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-marca-700">{c.codigo}</td>
                    <td className="w-[38%] min-w-[320px] px-3 py-2">
                      <p className="font-medium text-marca-900">{c.nombre}</p>
                      <p className="line-clamp-2 text-[11.5px] text-marca-500" title={c.que_hace}>
                        {ETIQUETA_USO[c.uso]} · {c.que_hace}
                      </p>
                      {c.nota && (
                        <p className="line-clamp-1 text-[11px] text-marca-400" title={c.nota}>
                          {c.nota}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <NivelIA nivel={c.nivel_actual as NivelIa} />
                      <div className="mt-1">
                        <CambioNivel codigo={c.codigo} nivel={c.nivel_actual as NivelIa} techo={c.techo as NivelIa} puedeEditar={edita} pendiente={m?.solicitud?.a ?? null} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <NivelIA nivel={c.techo as NivelIa} />
                    </td>
                    <td className="min-w-[150px] px-3 py-2 text-marca-700">{c.dueno_cargo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {numero(m?.propuestas ?? 0)}
                      {m?.pendientes ? <span className="block text-[11px] text-marca-400">{m.pendientes} pendientes</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {decididas ? porcentaje(((m?.aceptadas ?? 0) / decididas) * 100, 0) : '—'}
                      {m?.revertidas ? <span className="block text-[11px] text-marca-400">{m.revertidas} deshechas</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m?.costo_mes_usd ? usd(m.costo_mes_usd, 3) : '—'}
                      {m?.latencia_ms ? <span className="block text-[11px] text-marca-400">{numero(m.latencia_ms / 1000, 1)} s prom.</span> : null}
                      {m?.errores ? <span className="block text-[11px] text-[#a3241f]">⚠ {m.errores} error(es)</span> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <InterruptorCapacidad codigo={c.codigo} encendida={c.encendida} nivel={c.nivel_actual as NivelIa} puedeEditar={edita} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--borde)] px-3 py-2 text-[11.5px] text-marca-500">
          Los perímetros —nómina, servicio médico, investigaciones de PCP y fórmulas— no tienen capacidades: allí la IA no existe, no está «apagada». Subir de nivel pide
          evidencia y la doble aprobación de la ruta «nivel_ia»; N3 y N4 además piden al comité de gobierno de IA (Q-03).
        </p>
      </section>
    </>
  )
}
