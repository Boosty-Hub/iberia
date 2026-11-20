import type { Metadata } from 'next'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { FormularioEntrevista } from '@/components/formulario-entrevista'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { crearEntrevista } from '../acciones'

export const metadata: Metadata = { title: 'Nueva sesión · Levantamiento' }

/**
 * PRG-LEV · Registrar una sesión a mano. La transcripción de Fireflies se
 * importa después, desde la sesión.
 */
export default async function NuevaSesionPage() {
  const sesion = await requerirPermiso('modulo:entrevistas', 'crear')
  const supabase = await createClient()
  const { data: areas } = await supabase.from('areas').select('id, nombre, tipo').order('orden')
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        titulo="Nueva sesión"
        migas={[{ etiqueta: 'Entrevistas', href: '/sistema/programa/levantamiento/entrevistas' }, { etiqueta: 'Nueva' }]}
        descripcion="Registra la sesión con sus datos básicos. La transcripción de Fireflies se importa después, desde la sesión."
      />
      <div className="max-w-4xl">
        <FormularioEntrevista accion={crearEntrevista} areas={areas ?? []} cancelarHref="/sistema/programa/levantamiento/entrevistas" />
      </div>
    </>
  )
}
