import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_CARGOS } from '@/lib/plataforma/tablas-organizacion'
import { editarCeldaCargo } from '@/app/sistema/nucleo/organizacion/celdas'
import { NuevoCargo } from '@/components/sistema/organizacion/nuevo-cargo'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Cargos · Organización' }

/**
 * El catálogo de cargos (Anexo D §4: «directo, con auditoría»): familia,
 * sinónimos y cuánto pesa cada uno en la estructura (plazas, dotación,
 * ocupantes). Nombre, familia, nivel, sinónimos y estado se editan en la celda;
 * lo demás, en la ficha. Un cargo no se borra: se desactiva.
 */
export default async function CargosPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/cargos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const ctx = await leerContexto(sp)
  const editar = puede(sesion, 'sistema:estructura', 'editar')
  const supabase = await createClient()
  const { data: familias } = await supabase.schema('control').from('catalogo').select('clave, etiqueta').eq('tipo', 'familia_cargo').eq('activo', true).order('orden')
  const opcFamilias = (familias ?? []).map((f) => ({ valor: f.clave, etiqueta: f.etiqueta }))
  const fuente = editar
    ? {
        ...TABLA_CARGOS,
        columnas: TABLA_CARGOS.columnas.map((c) =>
          c.clave === 'familia'
            ? { ...c, editable: true, opciones: [{ valor: '', etiqueta: 'Sin familia' }, ...opcFamilias] }
            : c.clave === 'activo'
              ? {
                  ...c,
                  editable: true,
                  opciones: [
                    { valor: 'activo', etiqueta: 'Activo' },
                    { valor: 'inactivo', etiqueta: 'Inactivo' },
                  ],
                }
              : ['nombre', 'nivel', 'sinonimos'].includes(c.clave)
                ? { ...c, editable: true }
                : c
        ),
      }
    : TABLA_CARGOS
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Cargos' }]}
        acciones={puede(sesion, 'sistema:estructura', 'crear') ? <NuevoCargo familias={opcFamilias} /> : undefined}
        descripcion={`El catálogo de cargos con lo que pesa cada uno en la estructura. ${editar ? 'Nombre, familia, nivel, sinónimos y estado se editan en la celda; el cambio queda en la auditoría. ' : ''}Un cargo no se borra: se desactiva.`}
      />
      <TablaServidor fuente={fuente} sp={sp} sesion={sesion} ctx={ctx} alEditar={editar ? editarCeldaCargo : undefined} vacio="No hay cargos con estos filtros." />
    </>
  )
}
