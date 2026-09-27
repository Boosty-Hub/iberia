import { NextResponse, type NextRequest } from 'next/server'
import { contextoCharla } from '@/lib/charla'
import { dibujar, revisarPedido } from '@/lib/dibujar'
import {
  BUCKET_ADIESTRAMIENTO,
  BUCKET_RESPUESTAS,
  RUTA_REFERENCIA_AJITO,
  RUTA_REFERENCIA_IBERIA,
  rutaCharla,
} from '@/lib/storage'

export const maxDuration = 60

/**
 * El dibujo que se le pidió a Ajito en la conversación.
 *
 * El mismo camino de la lección 4 (`[numero]/dibujar`): primero el filtro
 * —doscientas personas pidiendo dibujos sin nadie mirando—, después el
 * generador, con Ajito y el logo de Industrias Iberia de referencia si el pedido
 * los nombra. Lo que no va queda marcado en el mensaje, y `contestar` responde
 * con el «no va» del guion.
 *
 * El dibujo se guarda como un mensaje de Ajito sin texto todavía: el comentario
 * lo pone `contestar`, mirándolo.
 */
export async function POST(peticion: NextRequest) {
  const ctx = await contextoCharla()
  if (!ctx) return NextResponse.json({ error: 'Sin acceso a la conversación' }, { status: 403 })
  const { supabase, matricula, empleado } = ctx

  const cuerpo = (await peticion.json().catch(() => null)) as { mensaje?: string } | null
  const id = String(cuerpo?.mensaje ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })

  const { data: suyo } = await supabase
    .from('charla_mensajes')
    .select('id, charla_id, pedido_dibujo, dibujo_veredicto')
    .eq('id', id)
    .eq('matricula_id', matricula.id)
    .eq('de', 'persona')
    .maybeSingle()
  if (!suyo?.pedido_dibujo) return NextResponse.json({ error: 'No hay dibujo pedido' }, { status: 404 })
  if (suyo.dibujo_veredicto) return NextResponse.json({ listo: true })

  const veredicto = await revisarPedido(suyo.pedido_dibujo)
  if (!veredicto) {
    // Sin poder revisar no se dibuja: mejor un reintento que un dibujo sin filtro.
    return NextResponse.json({ error: 'No se pudo revisar el pedido', motivo: 'ocupado' }, { status: 502 })
  }
  if (veredicto !== 'va') {
    await supabase
      .from('charla_mensajes')
      .update({ dibujo_veredicto: veredicto === 'persona' ? 'persona' : 'no_va' })
      .eq('id', suyo.id)
    return NextResponse.json({ listo: true })
  }

  const bajar = async (ruta: string) =>
    (await supabase.storage.from(BUCKET_ADIESTRAMIENTO).download(ruta)).data ?? null
  const [ajito, iberia] = await Promise.all([
    /ajito/i.test(suyo.pedido_dibujo) ? bajar(RUTA_REFERENCIA_AJITO) : null,
    /iberia/i.test(suyo.pedido_dibujo) ? bajar(RUTA_REFERENCIA_IBERIA) : null,
  ])

  const hecho = await dibujar(suyo.pedido_dibujo, 'libre', { ajito, iberia })
  if (!hecho.ok) {
    if (hecho.motivo === 'rechazado') {
      await supabase.from('charla_mensajes').update({ dibujo_veredicto: 'no_va' }).eq('id', suyo.id)
      return NextResponse.json({ listo: true })
    }
    console.error(`[charla] dibujo ${hecho.motivo}:`, hecho.detalle ?? '')
    return NextResponse.json({ error: 'Ajito no pudo dibujar', motivo: hecho.motivo }, { status: 502 })
  }

  const ruta = rutaCharla(empleado.id, 'dibujo', 'webp')
  const { error } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .upload(ruta, hecho.bytes, { contentType: 'image/webp', upsert: false })
  if (error) {
    console.error('[charla] no se pudo guardar el dibujo:', error.message)
    return NextResponse.json({ error: 'No se pudo guardar el dibujo', motivo: 'fallo' }, { status: 502 })
  }

  await supabase.from('charla_mensajes').insert({
    id: crypto.randomUUID(),
    charla_id: suyo.charla_id,
    matricula_id: matricula.id,
    de: 'ajito',
    entrada: 'texto',
    media_url: ruta,
  })
  await supabase.from('charla_mensajes').update({ dibujo_veredicto: 'va' }).eq('id', suyo.id)

  return NextResponse.json({ listo: true, dibujo: true })
}
