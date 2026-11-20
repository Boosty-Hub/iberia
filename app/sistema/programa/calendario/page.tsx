import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { hoyCaracas } from '@/lib/plataforma/formato'
import { FRENTES, type Actividad } from '@/lib/calendario'
import { CalendarioIberia } from '@/components/calendario-iberia'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { PieContrato } from '@/components/sistema/programa/piezas'

export const metadata: Metadata = { title: 'Calendario · Plan y seguimiento' }

/**
 * PRG-PLN · Calendario de lo que viene después de la Fase 1: la Fase 2 ·
 * Aliviar (la línea tecnológica, noviembre de 2026 a abril de 2027) y New
 * Iberia (desarrollo organizacional y procesos con el señor Carlos, hasta
 * octubre de 2027). Las 78 actividades viven en `calendario_actividades`.
 *
 * ⚠️ **Lo lee Alberto**, que es administrador: nada de dinero en pantalla —los
 * montos de las propuestas no van aquí— y lo interno va en `PENDIENTES.md`.
 * Quien tiene `modulo:calendario` · editar marca estado, fecha confirmada y nota
 * (desde la agenda o desde la ficha de la actividad); el título, las fechas
 * previstas y el responsable se cambian en la base. El documento para Iberia
 * sale igual que antes: `npm run documento:calendario`.
 */
export default async function CalendarioPage({ searchParams }: PageProps<'/sistema/programa/calendario'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:calendario'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [{ data, error }] = await Promise.all([
    supabase
      .from('calendario_actividades')
      .select('id, ref, titulo, detalle, frente, tipo, estado, inicio, fin, fecha_confirmada, responsable, participantes, nota, orden')
      .order('inicio')
      .order('orden'),
    precargarMetricas(['programa_entregables'], ctx),
  ])
  const actividades = (data ?? []) as Actividad[]

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-PLN"
        migas={[{ etiqueta: 'Calendario' }]}
        descripcion={`Lo que viene de noviembre de 2026 a octubre de 2027, cuándo y con quién: ${actividades.length} actividades en ${FRENTES.length} frentes, la línea tecnológica de la Fase 2 y el desarrollo organizacional de New Iberia. Amanda (Boosty) coordina las agendas con cada área; las fechas «por agendar» y «por confirmar» se fijan con ellas.`}
      />
      {error ? (
        <p className="rounded-xl border border-[var(--borde)] bg-white p-6 text-center text-[13px] text-marca-600">No se pudo cargar el calendario. Recarga la página en un momento.</p>
      ) : actividades.length === 0 ? (
        <p className="rounded-xl border border-[var(--borde)] bg-white p-6 text-center text-[13px] text-marca-600">Todavía no hay actividades cargadas.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiMetrica clave="programa_entregables" ctx={ctx} sesion={sesion} />
            <KpiMetrica clave="programa_entregables" ctx={ctx} sesion={sesion} parte={{ detalle: 'proximos_30', titulo: 'Próximos 30 días', texto: 'entregables e hitos sin hacer que caen en el próximo mes' }} />
            <KpiMetrica clave="programa_entregables" ctx={ctx} sesion={sesion} parte={{ detalle: 'vencidos', titulo: 'Con la fecha pasada', texto: 'sin marcar como hechos: confirmar su estado' }} />
            <KpiMetrica clave="programa_entregables" ctx={ctx} sesion={sesion} parte={{ detalle: 'hechos', titulo: 'Hechos', deTotal: false, texto: 'entregables e hitos marcados como hechos' }} />
          </div>
          {/* «Hoy» se calcula en Caracas en el servidor: en Netlify corre en UTC. */}
          <CalendarioIberia actividades={actividades} hoy={hoyCaracas()} puedeEditar={puede(sesion, 'modulo:calendario', 'editar')} />
        </>
      )}
      <PieContrato>La nota de cada actividad es coordinación interna: no sale en el documento del calendario para Iberia.</PieContrato>
    </>
  )
}
