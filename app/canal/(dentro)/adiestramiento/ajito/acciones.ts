'use server'

import { contextoCharla, inicioDelDia, TOPE_DIARIO, tituloDe } from '@/lib/charla'

type Mandado =
  | { ok: true; charla: string; mensaje: string }
  | { ok: false; tope?: boolean }

/**
 * Guarda lo que la persona le dijo a Ajito, y nada más.
 *
 * Como en los ejercicios, **lo que dijo se guarda primero y aparte**: la
 * respuesta de Ajito la pide el navegador después (`contestar`), y si el modelo
 * se cae, lo que la persona escribió o habló no se pierde — queda con su botón
 * de reintentar.
 *
 * Sin conversación abierta, la abre: el primer mensaje le pone el título.
 */
export async function mandarAAjito(datos: FormData): Promise<Mandado> {
  const ctx = await contextoCharla()
  if (!ctx) return { ok: false }
  const { supabase, matricula, empleado } = ctx

  const texto = String(datos.get('texto') ?? '').trim().slice(0, 4000)
  const crudo = String(datos.get('entrada') ?? 'texto')
  const entrada = crudo === 'voz' || crudo === 'foto' ? crudo : 'texto'
  const media = String(datos.get('media_url') ?? '').trim() || null

  if (!texto && !(entrada === 'foto' && media)) return { ok: false }
  // Solo un archivo suyo, de su carpeta de la conversación.
  if (media && !media.startsWith(`respuestas/${empleado.id}/charla/`)) return { ok: false }

  const { count } = await supabase
    .from('charla_mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('matricula_id', matricula.id)
    .eq('de', 'persona')
    .gte('created_at', inicioDelDia())
  if ((count ?? 0) >= TOPE_DIARIO) return { ok: false, tope: true }

  let charla = String(datos.get('charla') ?? '').trim()
  if (charla) {
    const { data } = await supabase
      .from('charlas_ajito')
      .select('id')
      .eq('id', charla)
      .eq('matricula_id', matricula.id)
      .maybeSingle()
    if (!data) return { ok: false }
  } else {
    // El id se genera aquí: el `RETURNING` de un insert bajo RLS vuelve vacío
    // cuando la política de lectura todavía no te alcanza (ver AGENTS.md).
    charla = crypto.randomUUID()
    const { error } = await supabase.from('charlas_ajito').insert({
      id: charla,
      matricula_id: matricula.id,
      titulo: tituloDe(texto),
    })
    if (error) {
      console.error('[charla] no se abrió la conversación:', error.message)
      return { ok: false }
    }
  }

  const mensaje = crypto.randomUUID()
  const { error } = await supabase.from('charla_mensajes').insert({
    id: mensaje,
    charla_id: charla,
    matricula_id: matricula.id,
    de: 'persona',
    texto: texto || null,
    entrada,
    media_url: media,
  })
  if (error) {
    console.error('[charla] no se guardó el mensaje:', error.message)
    return { ok: false }
  }

  await supabase
    .from('charlas_ajito')
    .update({ actualizada_en: new Date().toISOString() })
    .eq('id', charla)

  return { ok: true, charla, mensaje }
}
