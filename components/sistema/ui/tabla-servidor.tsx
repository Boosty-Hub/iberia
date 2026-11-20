import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ContextoGlobal } from '@/lib/plataforma/servidor'
import { leerEstado } from '@/lib/plataforma/tabla'
import { consultarPagina, resumir, type FuenteTabla } from '@/lib/plataforma/tabla-servidor'
import { TablaDatos, type VistaTabla } from '@/components/sistema/ui/tabla-datos'

/**
 * La forma corta de usar `TablaDatos` desde una página: lee el estado de la URL,
 * consulta la página y el resumen en paralelo, trae las vistas de esta tabla y
 * pinta. La página solo exige su permiso y elige la fuente.
 */
export async function TablaServidor({
  fuente,
  sp,
  sesion,
  ctx,
  alEditar,
  alAccion,
  vacio,
}: {
  fuente: FuenteTabla
  sp: Record<string, string | string[] | undefined>
  sesion: Sesion
  ctx: ContextoGlobal
  alEditar?: (clave: string, columna: string, valor: string) => Promise<{ error?: string } | void>
  alAccion?: (clave: string, accion: string, texto: string) => Promise<{ error?: string; ficha?: string | null } | void>
  vacio?: string
}) {
  const estado = leerEstado(sp, fuente.columnas, { orden: fuente.orden.columna, dir: fuente.orden.dir, tamano: fuente.tamano })
  const supabase = await createClient()
  const [pagina, resumen, { data: vistas }] = await Promise.all([
    consultarPagina(fuente, estado, ctx),
    resumir(fuente, estado, ctx),
    supabase.schema('ui').from('vista').select('id, nombre, alcance, parametros, propietario').eq('tabla', fuente.id).order('alcance').order('nombre').range(0, 99),
  ])
  const esAdmin = sesion.rolReal.nivel === 'admin'
  const lista: VistaTabla[] = (vistas ?? []).map((v) => ({
    id: v.id,
    nombre: v.nombre,
    alcance: v.alcance as VistaTabla['alcance'],
    consulta: String((v.parametros as { consulta?: string } | null)?.consulta ?? ''),
    borrable: esAdmin || (v.propietario === sesion.userId && v.alcance !== 'bloqueada'),
  }))

  return (
    <TablaDatos
      id={fuente.id}
      columnas={fuente.columnas}
      filas={pagina.filas}
      claveFila={fuente.claveFila}
      ficha={fuente.ficha}
      total={pagina.total}
      totales={resumen.totales}
      grupos={resumen.grupos}
      opciones={resumen.opciones}
      estado={estado}
      conBusqueda={Boolean(fuente.busqueda)}
      vistas={lista}
      puedeCompartir={puede(sesion, fuente.recurso, fuente.accion ?? 'ver')}
      puedeBloquear={esAdmin}
      error={pagina.error}
      alEditar={alEditar}
      alAccion={alAccion}
      vacio={vacio}
    />
  )
}
