import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_FORMACION_AVANCE } from '@/lib/plataforma/tablas-formacion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { VistasAvance } from '@/components/sistema/formacion/vistas-avance'

export const metadata: Metadata = { title: 'Avance · Formación' }

/**
 * El avance del curso por área y por oficio (`ui.formacion_avance()`): cuentas,
 * sin nombres ni respuestas. Lo lee el equipo y quien tiene la casilla de
 * Adiestramiento —la misma puerta del tablero viejo—. Por oficio es como
 * bifurcan los ejercicios: lo que cae en «General» recibe el genérico.
 */
export default async function FormacionAvancePage({ searchParams }: PageProps<'/sistema/nucleo/formacion/avance'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:adiestramiento'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-FOR"
        migas={[{ etiqueta: 'Avance' }]}
        descripcion="Matriculados, en curso y terminados por área y oficio, con el promedio de lecciones. Agrupa por área para ver a quién empujar sin leer lo que su gente contestó."
      />
      <VistasAvance activa="grupos" porPersona={puede(sesion, 'modulo:empleados', 'editar')} />
      <TablaServidor fuente={TABLA_FORMACION_AVANCE} sp={sp} sesion={sesion} ctx={ctx} vacio="Todavía no hay nadie matriculado." />
    </>
  )
}
