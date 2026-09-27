import { NextResponse, type NextRequest } from 'next/server'
import { contextoCharla } from '@/lib/charla'
import { hablar } from '@/lib/hablar'
import { BUCKET_RESPUESTAS, rutaCharla } from '@/lib/storage'
import { vozDe } from '@/lib/voz'

/**
 * Pone a hablar lo que Ajito contestó en la conversación, con la voz que la
 * persona eligió para el curso: un solo Ajito.
 *
 * Va aparte de `contestar` para que el texto salga en cuanto está: la voz llega
 * uno o dos segundos después, y se pinta cuando llega. Si falla, el texto se
 * queda y el siguiente toque vuelve a intentarlo.
 */
export async function POST(peticion: NextRequest) {
  const ctx = await contextoCharla()
  if (!ctx) return NextResponse.json({ error: 'Sin acceso a la conversación' }, { status: 403 })
  const { supabase, matricula, empleado } = ctx

  const cuerpo = (await peticion.json().catch(() => null)) as { mensaje?: string } | null
  const id = String(cuerpo?.mensaje ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })

  const { data: dicho } = await supabase
    .from('charla_mensajes')
    .select('id, texto, audio')
    .eq('id', id)
    .eq('matricula_id', matricula.id)
    .eq('de', 'ajito')
    .maybeSingle()
  if (!dicho?.texto) return NextResponse.json({ error: 'No hay nada que decir' }, { status: 404 })
  if (dicho.audio) return NextResponse.json({ audio: true })

  const hablado = await hablar(dicho.texto, vozDe(matricula.voz))
  if (!hablado.ok) {
    console.error('[charla] síntesis fallida:', hablado.detalle ?? hablado.motivo)
    return NextResponse.json({ error: 'No se pudo poner la voz' }, { status: 502 })
  }

  const ruta = rutaCharla(empleado.id, 'ajito', 'mp3')
  const { error } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .upload(ruta, hablado.mp3, { contentType: 'audio/mpeg', upsert: false })
  if (error) return NextResponse.json({ error: 'No se pudo guardar la voz' }, { status: 502 })

  await supabase.from('charla_mensajes').update({ audio: ruta }).eq('id', dicho.id)
  return NextResponse.json({ audio: true })
}
