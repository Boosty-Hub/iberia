import 'server-only'
import type { Database } from '@/lib/database.types'
import type { createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>
type FilaCertificado = Database['public']['Tables']['certificados']['Row']

/**
 * Da una lección por terminada y, si era la que faltaba, emite el certificado.
 *
 * Lo usan dos sitios: «Terminar la lección» y **el turno del certificado de la
 * lección 8**, que se abre con «Ya está. Terminaste las nueve». Desde el 27 de
 * septiembre de 2026 el certificado sale ahí mismo, en pantalla, debajo de ese
 * audio: llegar a ese turno es terminar el curso, no la despedida de después.
 *
 * La emisión la decide `emitir_mi_certificado()`, que cuenta las lecciones por
 * su cuenta —no se fía de esta cuenta de aquí— y devuelve el mismo certificado
 * si ya existía, así que pasar dos veces no da dos códigos. Si algo falla, la
 * lección igual queda terminada: perder el avance por no poder emitir un papel
 * sería el peor de los dos males.
 */
export async function cerrarLeccion(
  supabase: Cliente,
  { cursoId, matricula, leccionId }: {
    cursoId: string
    matricula: { id: string; completado_en: string | null }
    leccionId: string
  }
): Promise<{ termino: boolean; certificado: FilaCertificado | null }> {
  const ahora = new Date().toISOString()

  await supabase.from('avances').upsert(
    { matricula_id: matricula.id, leccion_id: leccionId, estado: 'completada', completada_en: ahora },
    { onConflict: 'matricula_id,leccion_id' }
  )

  // ¿Quedó alguna sin terminar? Si no, el curso está completo.
  const [{ count: totalLecciones }, { count: completadas }] = await Promise.all([
    supabase
      .from('lecciones')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', cursoId)
      .eq('activa', true),
    supabase
      .from('avances')
      .select('id', { count: 'exact', head: true })
      .eq('matricula_id', matricula.id)
      .eq('estado', 'completada'),
  ])

  const termino = (completadas ?? 0) >= (totalLecciones ?? 0)

  await supabase
    .from('matriculas')
    .update({
      estado: termino ? 'completado' : 'en_curso',
      completado_en: termino ? (matricula.completado_en ?? ahora) : null,
      ultimo_toque: ahora,
    })
    .eq('id', matricula.id)

  // La fila emitida se devuelve: quien la necesite en el mismo render no puede
  // volver a pedirla. ⚠️ Next memoriza los GET idénticos dentro de un render, así
  // que el `select` de después de emitir devolvía la respuesta vacía del de antes,
  // y la lección 8 decía «se está preparando» con el certificado ya emitido.
  let certificado: FilaCertificado | null = null
  if (termino) {
    const { data, error } = await supabase.rpc('emitir_mi_certificado', { p_matricula: matricula.id })
    if (error) console.error('[certificado] no se pudo emitir:', error.message)
    certificado = data ?? null
  }

  return { termino, certificado }
}
