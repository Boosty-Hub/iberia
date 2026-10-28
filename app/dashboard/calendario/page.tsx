import type { Metadata } from 'next'
import { CalendarioIberia } from '@/components/calendario-iberia'
import { EncabezadoPagina, EstadoVacio, Metrica } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { esHito, type Actividad } from '@/lib/calendario'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Calendario · Fase 2 y New Iberia' }

/**
 * El calendario de lo que viene después de la Fase 1: la Fase 2 · Aliviar —la
 * línea tecnológica, noviembre de 2026 a abril de 2027— y New Iberia —desarrollo
 * organizacional y procesos con el señor Carlos, hasta octubre de 2027—.
 *
 * ⚠️ **Lo lee Alberto**, que es administrador. Las mismas reglas que Consumos:
 * nada de dinero en pantalla —los montos de las dos propuestas no van aquí— y lo
 * interno va en `PENDIENTES.md`, no en el detalle de una actividad.
 */
export default async function PaginaCalendario() {
  const sesion = await requerirPermiso('modulo:calendario')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('calendario_actividades')
    .select(
      'id, titulo, detalle, frente, tipo, estado, inicio, fin, fecha_confirmada, responsable, participantes, nota, orden'
    )
    .order('inicio')
    .order('orden')

  const actividades = (data ?? []) as Actividad[]
  // El día de hoy en Venezuela, no el del servidor: en Netlify corre en UTC y a
  // las 8 de la noche de Caracas ya sería mañana.
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())

  const entregables = actividades.filter((a) => esHito(a.tipo)).length
  const porConfirmar = actividades.filter((a) => a.estado === 'por_confirmar').length
  const hechas = actividades.filter((a) => a.estado === 'hecho').length

  return (
    <>
      <EncabezadoPagina
        rotulo="Fase 2 y New Iberia"
        titulo="Calendario del proyecto"
        descripcion={
          <>
            Lo que viene de noviembre de 2026 a octubre de 2027, cuándo y con quién: la línea
            tecnológica de la Fase 2 y el desarrollo organizacional de New Iberia. Amanda (Boosty)
            coordina las agendas con Martha Fuentes, Milagro Salas y Luz. Las fechas «por agendar» y
            «por confirmar» se fijan con cada área.
          </>
        }
      />

      {error ? (
        <EstadoVacio titulo="No se pudo cargar el calendario" descripcion="Recarga la página en un momento." />
      ) : actividades.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay actividades cargadas"
          descripcion="Aparecerán aquí en cuanto se registren."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metrica valor={actividades.length} etiqueta="Actividades" />
            <Metrica valor={entregables} etiqueta="Entregables e hitos" />
            <Metrica valor={porConfirmar} etiqueta="Por confirmar" />
            <Metrica valor={hechas} etiqueta="Hechas" sufijo={`de ${actividades.length}`} />
          </div>
          <CalendarioIberia
            actividades={actividades}
            hoy={hoy}
            puedeEditar={puede(sesion, 'modulo:calendario', 'editar')}
          />
        </>
      )}
    </>
  )
}
