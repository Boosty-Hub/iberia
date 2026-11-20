import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_FORMACION_PERSONAS } from '@/lib/plataforma/tablas-formacion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { VistasAvance } from '@/components/sistema/formacion/vistas-avance'

export const metadata: Metadata = { title: 'Avance por persona · Formación' }

/**
 * El avance por persona, lección por lección (`ui.formacion_personas()`, con la
 * RLS de `matriculas`: solo el equipo ve a los demás). Son nombres y avances,
 * lo mismo que dice el padrón, así que se abre con su casilla
 * (`modulo:empleados` · editar). Las respuestas no salen nunca. La fila abre la
 * ficha de la persona.
 */
export default async function FormacionAvancePersonasPage({ searchParams }: PageProps<'/sistema/nucleo/formacion/avance/personas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:empleados', 'editar'), searchParams])
  const ctx = await leerContexto(sp)
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-FOR"
        migas={[{ etiqueta: 'Avance', href: '/sistema/nucleo/formacion/avance' }, { etiqueta: 'Por persona' }]}
        descripcion="Cada matrícula con sus lecciones: ✓ terminada, «va» empezada. «Días sin volver» es lo que mira el empujón. Lo que respondió cada quien no sale aquí."
      />
      <VistasAvance activa="personas" porPersona />
      <TablaServidor fuente={TABLA_FORMACION_PERSONAS} sp={sp} sesion={sesion} ctx={ctx} vacio="Nadie matriculado con estos filtros." />
    </>
  )
}
