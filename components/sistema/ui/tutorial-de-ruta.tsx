import { createClient } from '@/lib/supabase/server'
import { BotonTutorial } from '@/components/sistema/ui/boton-tutorial'

/**
 * «Ver tutorial» para una página que no usa la cabecera de módulo (Usuarios, Roles y permisos: `EncabezadoPagina`).
 * Busca el video de esa ruta en `ui.tutorial` (la RLS pide el permiso de la página) y, si hay, pone el botón.
 */
export async function TutorialDeRuta({ ruta }: { ruta: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('ui').from('tutorial').select('ruta, titulo, descripcion, duracion_seg').eq('ruta', ruta)
  if (error || !data?.length) return null
  return <BotonTutorial tutoriales={data} pestanas={[{ etiqueta: data[0].titulo, href: ruta }]} />
}
