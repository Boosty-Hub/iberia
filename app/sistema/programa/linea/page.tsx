import type { Metadata } from 'next'
import { esEditor, puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hoyCaracas } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Hilo, PieContrato, Seccion, type Evento } from '@/components/sistema/programa/piezas'

export const metadata: Metadata = { title: 'Línea de tiempo · Plan y seguimiento' }

/**
 * PRG-PLN · Línea de tiempo de la Fase 1: los hitos (`hitos`) y las sesiones del
 * levantamiento (la vista `linea_de_tiempo` las lee de `entrevistas`: no se
 * copian). Partida en dos y en sentidos opuestos: lo que viene, de más cerca a
 * más lejos; lo hecho, de lo último a lo primero.
 *
 * «Lo que viene» es lo que no se ha hecho, no lo que tiene fecha futura. La marca
 * «en riesgo» es juicio de seguimiento interno: solo la ve el equipo.
 */
export default async function LineaProgramaPage() {
  const sesion = await requerirPermiso('modulo:programa')
  const supabase = await createClient()
  const { data } = await supabase.from('linea_de_tiempo').select('*').order('fecha', { ascending: false }).range(0, 1999)
  const eventos = (data ?? []) as Evento[]
  const hoy = hoyCaracas()

  // Con dos entradas el mismo día, el vencimiento de contrato va de último.
  const orden = (e: Evento) => `${e.fecha}-${e.tipo === 'contrato' ? '1' : '0'}`
  const yaOcurrio = (e: Evento) => (e.fecha ?? '') <= hoy && (e.estado === 'hecho' || e.estado === 'cancelado')
  const porVenir = eventos.filter((e) => !yaOcurrio(e)).sort((a, b) => orden(a).localeCompare(orden(b)))
  const hecho = eventos.filter(yaOcurrio)
  const verRiesgo = esEditor(sesion.perfil)
  const abrirSesiones = puede(sesion, 'modulo:entrevistas')

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-PLN"
        migas={[{ etiqueta: 'Línea de tiempo' }]}
        descripcion="El calendario de la Fase 1: cada entrevista, recorrido y formación con su fecha, y los hitos del contrato. Una sesión abre su ficha."
      />
      <div className="grid gap-3 xl:grid-cols-2">
        <Seccion titulo="Lo que viene" descripcion="Lo que no se ha hecho todavía, de más cerca a más lejos. Lo que tenía fecha y no se hizo sale como «Pendiente».">
          <Hilo eventos={porVenir} marcarRiesgo={verRiesgo} abrirSesiones={abrirSesiones} />
        </Seccion>
        <Seccion titulo="Lo hecho" descripcion={`${hecho.length} ${hecho.length === 1 ? 'entrada' : 'entradas'}, de la más reciente a la primera.`}>
          <Hilo eventos={hecho} marcarRiesgo={verRiesgo} abrirSesiones={abrirSesiones} />
        </Seccion>
      </div>
      <PieContrato>Las sesiones salen del levantamiento (no se copian a los hitos): dos listas de lo mismo dicen cosas distintas en dos semanas.</PieContrato>
    </>
  )
}
