import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { BOLSA_MENSUAL, LO_QUE_TRAJO_EL_MES, consumeBolsa, mesDe, nombreMes } from '@/lib/programa'
import { ESTADOS_ACTIVIDAD, FRENTE, esHito, type EstadoActividad, type Frente, type TipoActividad } from '@/lib/calendario'
import { fechaCorta, hoyCaracas } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { Seccion } from '@/components/sistema/programa/piezas'
import { diasHasta } from '@/components/sistema/programa/consumos'

export const metadata: Metadata = { title: 'Resumen · Plan y seguimiento' }

/**
 * PRG-PLN · Resumen: cómo va el programa en cuatro cifras del registro de
 * métricas (horas del mes contra la referencia de 107 h —en horas, nunca en
 * dinero—, sesiones de trabajo, entregables próximos y vencidos) y lo que viene.
 *
 * ⚠️ Lo lee Iberia. Quien solo tiene el calendario (sin `modulo:programa`) entra
 * directo al Calendario.
 */
export default async function ProgramaResumenPage({ searchParams }: PageProps<'/sistema/programa'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  if (!puede(sesion, 'modulo:programa')) {
    redirect(puede(sesion, 'modulo:calendario') ? '/sistema/programa/calendario' : '/sistema?aviso=sin-permiso')
  }
  const ctx = await leerContexto(sp)
  const verCalendario = puede(sesion, 'modulo:calendario')
  const supabase = await createClient()
  const hoy = hoyCaracas()

  const [{ data: actividades }] = await Promise.all([
    verCalendario
      ? supabase.from('calendario_actividades').select('ref, titulo, frente, tipo, estado, inicio, fin, fecha_confirmada, responsable, orden').neq('estado', 'hecho').order('inicio').order('orden')
      : Promise.resolve({ data: [] as never[] }),
    precargarMetricas(['programa_horas_mes', 'programa_sesiones', 'programa_entregables'], ctx),
  ])

  // Lo que viene: entregables e hitos sin hacer, por la fecha que cuenta.
  const fechaDe = (a: { fecha_confirmada: string | null; fin: string | null; inicio: string }) => a.fecha_confirmada ?? a.fin ?? a.inicio
  const proximos = (actividades ?? [])
    .filter((a) => esHito(a.tipo as TipoActividad))
    .map((a) => ({ ...a, fecha: fechaDe(a) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 8)
  const meses = Object.keys(LO_QUE_TRAJO_EL_MES)
    .map((m) => `${m}-01`)
    .filter((m) => consumeBolsa(m) && m <= mesDe(hoy))
    .reverse()

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-PLN"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion="Cómo va el programa: las horas que el equipo de Boosty le ha dedicado contra la referencia del contrato, las sesiones de trabajo y lo que viene en el calendario de la Fase 2 y New Iberia."
      />
      {/* Las cifras salen del registro de métricas (`ui.metrica`): las mismas de Mi día. */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="programa_horas_mes" ctx={ctx} sesion={sesion} />
        <KpiMetrica clave="programa_sesiones" ctx={ctx} sesion={sesion} sinTendencia />
        <KpiMetrica
          clave="programa_entregables"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'proximos_30', titulo: 'Entregables próximos', texto: 'en los próximos 30 días · el clic abre el calendario' }}
        />
        <KpiMetrica
          clave="programa_entregables"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'vencidos', titulo: 'Con la fecha pasada', texto: 'entregables o hitos sin marcar como hechos' }}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Seccion
          titulo="Lo que trajo cada mes"
          descripcion={
            <>
              La referencia es de <strong>{BOLSA_MENSUAL} horas al mes</strong> y se administra <strong>como promedio dentro de la fase</strong>: unos meses van por encima y otros por debajo. El detalle, mes a mes y perfil por perfil, está en{' '}
              <Link href="/sistema/programa/consumos" className="text-acento-700 underline underline-offset-2">
                Consumos
              </Link>
              .
            </>
          }
        >
          <ul className="space-y-1.5 text-[12.5px] text-marca-700">
            {meses.map((m) => (
              <li key={m}>
                <strong className="font-semibold first-letter:uppercase">{nombreMes(m).replace(/ de \d{4}$/, '')}</strong> trajo {LO_QUE_TRAJO_EL_MES[m.slice(0, 7)]}.
              </li>
            ))}
          </ul>
        </Seccion>

        {verCalendario && (
          <Seccion
            titulo="Lo que viene"
            descripcion="Los próximos entregables e hitos del calendario sin hacer, por la fecha confirmada (o la prevista si todavía no se confirma)."
            acciones={
              <Link href="/sistema/programa/calendario" className="text-[12px] font-medium text-acento-700 hover:underline">
                Ver el calendario
              </Link>
            }
          >
            {proximos.length ? (
              <ul className="divide-y divide-[#eef0f3]">
                {proximos.map((a) => {
                  const dias = diasHasta(a.fecha, hoy)
                  return (
                    <li key={a.ref} className="flex items-start gap-3 py-2">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: FRENTE[a.frente as Frente]?.color }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <BotonFicha tipo="actividad" id={a.ref} className="text-[13px] font-medium text-marca-900">
                          {a.titulo}
                        </BotonFicha>
                        <p className="text-[11.5px] text-marca-500">
                          {FRENTE[a.frente as Frente]?.nombre} · {a.responsable || '—'} · {ESTADOS_ACTIVIDAD[a.estado as EstadoActividad]?.nombre}
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-[12px] text-marca-700 tabular-nums">
                        {fechaCorta(a.fecha)}
                        <span className="block text-[11px] text-marca-500">{dias > 0 ? `faltan ${dias} días` : dias === 0 ? 'hoy' : `pasó hace ${-dias} días`}</span>
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="py-3 text-[12.5px] text-marca-400">No quedan entregables por hacer en el calendario.</p>
            )}
          </Seccion>
        )}
      </div>
    </>
  )
}
