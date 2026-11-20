import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import {
  BOLSA_MENSUAL,
  CUOTA,
  ENTREGABLES,
  ENTREGABLE_NOTA,
  IMPUTACIONES,
  IMPUTACION_DETALLE,
  IMPUTACION_TITULO,
  LO_QUE_TRAJO_EL_MES,
  ORDEN_ENTREGABLES,
  ORDEN_PERFILES,
  PERFILES,
  PERFIL_CORTO,
  PERFIL_ROL,
  PERFIL_TRABAJO,
  VENCE,
  consumeBolsa,
  nombreMes,
} from '@/lib/programa'
import { fechaCorta } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Casilla, PieContrato, Seccion } from '@/components/sistema/programa/piezas'
import { NOTA_EQUIPO, calcularConsumos, diasHasta, horas } from '@/components/sistema/programa/consumos'
import { FormularioHoras } from './formulario-horas'

export const metadata: Metadata = { title: 'Consumos · Plan y seguimiento' }

/**
 * PRG-PLN · Consumos: el reporte mensual de la cláusula 8 en pantalla. El cuadro
 * mes × perfil con su cuota, lo que trajo cada mes, quién dedicó las horas y en
 * qué se fueron. Se mudó de `/dashboard/programa` sin cambiar una regla:
 *
 * ⚠️ **Lo lee Iberia.** Nada de dinero (ni tarifas, ni valor consumido, ni fee).
 * Nada de alarmas: la diferencia contra la cuota se escribe, no se pinta. Cargar
 * horas e hitos sigue siendo solo de editores (`modulo:programa` · crear).
 */
export default async function ConsumosPage({ searchParams }: PageProps<'/sistema/programa/consumos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:programa'), searchParams])
  const ctx = await leerContexto(sp)
  const puedeCargar = puede(sesion, 'modulo:programa', 'crear')
  const supabase = await createClient()
  const [{ data: registros }] = await Promise.all([
    supabase.from('registros_horas').select('fecha, perfil, horas, persona, entregable, imputacion').order('fecha', { ascending: false }).range(0, 4999),
    precargarMetricas(['programa_horas_mes'], ctx),
  ])
  const c = calcularConsumos(registros ?? [])

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-PLN"
        migas={[{ etiqueta: 'Consumos' }]}
        descripcion="Las horas que el equipo de Boosty le ha dedicado al programa: mes a mes y perfil por perfil contra la cuota del contrato, quién las dedicó y en qué se fueron."
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <KpiMetrica clave="programa_horas_mes" ctx={ctx} sesion={sesion} />
        <Seccion titulo={`Dedicadas a la Fase 1: ${horas(c.totalHoras)}`}>
          <p className="text-[12.5px] leading-relaxed text-marca-700">
            El contrato dispone un equipo multidisciplinario con una referencia de <strong>{BOLSA_MENSUAL} horas al mes</strong>, que se administra{' '}
            <strong>como promedio dentro de la fase</strong>: unos meses van por encima y otros por debajo, y lo que cuenta es el conjunto.
          </p>
          <ul className="mt-2 space-y-1 text-[12.5px] text-marca-700">
            {c.meses
              .filter((m) => consumeBolsa(m) && m <= c.mesActual && LO_QUE_TRAJO_EL_MES[m.slice(0, 7)])
              .map((m) => (
                <li key={m}>
                  <strong className="font-semibold first-letter:uppercase">{nombreMes(m).replace(/ de \d{4}$/, '')}</strong> trajo {LO_QUE_TRAJO_EL_MES[m.slice(0, 7)]}.
                </li>
              ))}
          </ul>
        </Seccion>
      </div>

      <Seccion
        id="cuadro"
        titulo="Mes a mes, perfil por perfil"
        descripcion={`Cada perfil tiene su cuota mensual, y las cuatro suman las ${BOLSA_MENSUAL} horas de referencia. Debajo de cada cifra va la diferencia contra esa cuota, para ver en qué mes se pasa un perfil y en cuál se queda corto.`}
        className="mb-3"
      >
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Cuadro de horas por mes y perfil (se desplaza a lo ancho)">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <caption className="sr-only">Horas por mes y por perfil, con la diferencia contra la cuota de cada uno</caption>
            <thead>
              <tr className="border-b border-[var(--borde)] text-left text-[11px] tracking-[0.06em] text-marca-500 uppercase">
                <th scope="col" className="px-3 py-2 font-medium">
                  Mes
                </th>
                {ORDEN_PERFILES.map((p) => (
                  <th key={p} scope="col" className="px-3 py-2 text-right font-medium">
                    {PERFIL_CORTO[p]}
                    <span className="ml-1 font-normal tracking-normal normal-case">/{CUOTA[p]} h</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Total<span className="ml-1 font-normal tracking-normal normal-case">/{BOLSA_MENSUAL} h</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {c.meses.map((m) => {
                const fila = c.porMes.get(m)!
                const corrido = m <= c.mesActual
                // Lo previo a la firma se muestra pero no se mide contra la cuota.
                const cuenta = consumeBolsa(m)
                return (
                  <tr key={m} className="border-b border-[#eef0f3] last:border-0">
                    <th scope="row" className={`px-3 py-2 text-left align-top font-medium first-letter:uppercase ${corrido ? 'text-marca-800' : 'text-marca-400'}`}>
                      {nombreMes(m)}
                      {!cuenta && <span className="block text-[11px] font-normal text-marca-500">Etapa anterior</span>}
                    </th>
                    {ORDEN_PERFILES.map((p) => (
                      <Casilla key={p} horas={fila[p]} cuota={CUOTA[p]} mide={cuenta} corrido={corrido} />
                    ))}
                    <Casilla horas={c.totalDelMes(m)} cuota={BOLSA_MENSUAL} mide={cuenta} corrido={corrido} total />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-marca-500">
          Un perfil por encima de su cuota en un mes no se compensa con otro perfil: lo que se administra como promedio es <strong>el conjunto dentro de la fase</strong>, no la casilla del mes. Por eso lo que hay que leer es la columna del total y su acumulado.
        </p>
        {(c.totalPrevias > 0 || c.bolsasAparte.length > 0) && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {c.totalPrevias > 0 && (
              <div className="rounded-lg border border-[var(--borde)] p-3 text-[12.5px] text-marca-600">
                <p className="font-semibold text-marca-900">
                  {horas(c.totalPrevias)} {IMPUTACION_TITULO.fase_0}
                </p>
                <p className="mt-0.5">{IMPUTACION_DETALLE.fase_0}</p>
              </div>
            )}
            {c.bolsasAparte.map(({ imp, horas: h }) => (
              <div key={imp} className="rounded-lg border border-[var(--borde)] p-3 text-[12.5px] text-marca-600">
                <p className="font-semibold text-marca-900">
                  {horas(h)} {IMPUTACION_TITULO[imp] ?? IMPUTACIONES[imp]}
                </p>
                <p className="mt-0.5">{IMPUTACION_DETALLE[imp] ?? IMPUTACIONES[imp]}</p>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <div className="mb-3 grid gap-3 xl:grid-cols-2">
        <Seccion titulo="Quién dedicó las horas" descripcion={`Las ${horas(c.totalHoras)} de la Fase 1, por quien las trabajó.`}>
          <ul className="divide-y divide-[#eef0f3]">
            {c.gente.map(([nombre, ficha]) => (
              <li key={nombre} className="flex items-baseline gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-marca-900">{nombre}</p>
                  <p className="text-[11.5px] text-marca-500">
                    {nombre === 'Equipo Boosty'
                      ? NOTA_EQUIPO
                      : [...ficha.perfiles]
                          .sort((a, b) => ORDEN_PERFILES.indexOf(a) - ORDEN_PERFILES.indexOf(b))
                          .map((p) => PERFIL_TRABAJO[p])
                          .join(' · ')}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-semibold text-marca-900 tabular-nums">{horas(ficha.horas)}</p>
              </li>
            ))}
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] font-medium text-marca-600 select-none">Qué hace cada papel del equipo</summary>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {ORDEN_PERFILES.map((p) => (
                <div key={p} className="rounded-lg border border-[var(--borde)] p-2.5">
                  <dt className="text-[12.5px] font-medium text-marca-900">{PERFILES[p]}</dt>
                  <dd className="mt-0.5 text-[11.5px] text-marca-600">{PERFIL_ROL[p]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Seccion>

        <Seccion titulo="En qué se fueron" descripcion={`Las ${horas(c.totalHoras)} de la Fase 1 repartidas por entregable, cada uno con la fecha en que se compromete.`}>
          <ul className="divide-y divide-[#eef0f3]">
            {ORDEN_ENTREGABLES.map((e) => {
              const h = c.porEntregable.get(e) ?? 0
              const fuera = c.aparteDe.get(e) ?? 0
              const vence = VENCE[e]
              const dias = vence ? diasHasta(vence) : null
              return (
                <li key={e} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-marca-800">{ENTREGABLES[e]}</p>
                    <p className="text-[11.5px] text-marca-500">
                      {vence ? (
                        <>
                          Se entrega el {fechaCorta(vence)}
                          {dias !== null && dias >= 0 && ` · faltan ${dias} días`}
                        </>
                      ) : (
                        ENTREGABLE_NOTA.gestion
                      )}
                    </p>
                    {fuera > 0 && (
                      <p className="text-[11.5px] text-marca-500">
                        Más <strong>{horas(fuera)}</strong> que se facturan aparte, en la Fase 2.
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-marca-900 tabular-nums">{h ? horas(h) : '—'}</span>
                </li>
              )
            })}
          </ul>
        </Seccion>
      </div>

      {puedeCargar && (
        <Seccion id="cargar" titulo="Cargar horas e hitos" descripcion="Solo lo ve el equipo de Boosty. Cada partida dice de dónde sale su número, que es lo que permite corregirla después." className="mb-3">
          <FormularioHoras />
        </Seccion>
      )}

      <PieContrato>
        Fase 1 · Entender · contrato CONT-2026-08-0002, cláusula 8. Referencia de {BOLSA_MENSUAL} horas al mes, administradas como promedio dentro de la fase.
      </PieContrato>
    </>
  )
}
