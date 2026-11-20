import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ImportarEntrevistas } from '@/components/importar-entrevistas'
import { CabeceraModulo, BOTON_CABECERA } from '@/components/sistema/ui/cabecera-modulo'

export const metadata: Metadata = { title: 'Importar de Fireflies · Levantamiento' }

/**
 * PRG-LEV · Importar sesiones sueltas de Fireflies. Para el levantamiento con
 * los hablantes por nombre se usa `npm run importar:transcripciones`: el
 * importador de la interfaz los deja como «speaker 2».
 */
export default async function ImportarSesionesPage() {
  const sesion = await requerirPermiso('modulo:entrevistas', 'crear')
  const supabase = await createClient()
  const { data: areas } = await supabase.from('areas').select('id, nombre, slug, tipo').order('orden')
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        titulo="Importar de Fireflies"
        migas={[{ etiqueta: 'Entrevistas', href: '/sistema/programa/levantamiento/entrevistas' }, { etiqueta: 'Importar' }]}
        descripcion="Carga los archivos de Fireflies y el sistema arma cada sesión: entrevistado, cargo, área, sede, fecha, duración, resumen y transcripción completa. Los hablantes quedan como los nombró Fireflies: para citarlos en el informe hay que identificarlos."
        acciones={
          <Link href="/sistema/programa/levantamiento/entrevistas/nueva" className={BOTON_CABECERA}>
            Crear a mano
          </Link>
        }
      />
      <div className="max-w-4xl">
        <ImportarEntrevistas areas={areas ?? []} />
      </div>
    </>
  )
}
