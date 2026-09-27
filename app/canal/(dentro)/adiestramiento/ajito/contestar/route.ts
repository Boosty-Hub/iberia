import { NextResponse, type NextRequest } from 'next/server'
import type { FamiliaOficio } from '@/lib/adiestramiento'
import { conversar, type Charla, type MensajeCharla } from '@/lib/ajito'
import { contextoCharla } from '@/lib/charla'
import { NO_VA } from '@/lib/dibujar'
import { BUCKET_RESPUESTAS } from '@/lib/storage'

export const maxDuration = 60

/** Lo que Ajito recuerda de la conversación. Más atrás, se le olvida. */
const MEMORIA = 24

/** Claude no abre HEIC. Un iPhone por la cámara del navegador manda JPEG. */
const IMAGENES: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

/**
 * Ajito contesta un mensaje de la conversación.
 *
 * Se llama con el mensaje de la persona ya guardado (`mandarAAjito`). Es
 * idempotente: si Ajito ya contestó ese mensaje, devuelve lo que dijo y no le
 * vuelve a preguntar al modelo.
 *
 * Si lo que pide es un dibujo, no contesta todavía: devuelve `falta: 'dibujo'`
 * y el navegador llama a `dibujar`, que lo pasa por el filtro y el generador de
 * la lección 4 —dibujar tarda lo suyo, y todo en una sola petición rozaría lo
 * que aguanta una función de Netlify—. Después vuelve aquí, y Ajito comenta el
 * dibujo que ya tiene delante.
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
    .select('*')
    .eq('id', id)
    .eq('matricula_id', matricula.id)
    .eq('de', 'persona')
    .maybeSingle()
  if (!suyo) return NextResponse.json({ error: 'No hay mensaje' }, { status: 404 })

  // Lo que Ajito ya dijo después de este mensaje: su respuesta, o el dibujo que
  // hizo y todavía no comentó.
  const { data: siguiente } = await supabase
    .from('charla_mensajes')
    .select('id, texto, media_url, audio')
    .eq('charla_id', suyo.charla_id)
    .eq('de', 'ajito')
    .gt('created_at', suyo.created_at)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (siguiente?.texto) {
    return NextResponse.json({ id: siguiente.id, texto: siguiente.texto, dibujo: Boolean(siguiente.media_url), audio: Boolean(siguiente.audio) })
  }

  const guardar = async (texto: string) => {
    if (siguiente) {
      await supabase.from('charla_mensajes').update({ texto, fallo_en: null }).eq('id', siguiente.id)
      return siguiente.id
    }
    const nuevo = crypto.randomUUID()
    await supabase.from('charla_mensajes').insert({
      id: nuevo,
      charla_id: suyo.charla_id,
      matricula_id: matricula.id,
      de: 'ajito',
      texto,
      entrada: 'texto',
    })
    return nuevo
  }

  // El filtro dijo que ese dibujo no: se contesta con el texto del guion, el
  // mismo de la lección 4, sin preguntarle al modelo.
  if (suyo.dibujo_veredicto === 'persona' || suyo.dibujo_veredicto === 'no_va') {
    const texto = NO_VA[suyo.dibujo_veredicto]
    const nuevo = await guardar(texto)
    return NextResponse.json({ id: nuevo, texto, dibujo: false, audio: false })
  }
  // Pidió un dibujo y todavía no se hizo.
  if (suyo.pedido_dibujo && !suyo.dibujo_veredicto) {
    return NextResponse.json({ falta: 'dibujo' })
  }

  // --- la memoria ---------------------------------------------------------------

  const { data: antes } = await supabase
    .from('charla_mensajes')
    .select('de, texto, entrada, media_url, pedido_dibujo, created_at')
    .eq('charla_id', suyo.charla_id)
    .lte('created_at', suyo.created_at)
    .order('created_at', { ascending: false })
    .limit(MEMORIA)

  const orden = (antes ?? []).reverse()
  // El pedido de dibujo vive en el mensaje de la persona; el dibujo, en el de
  // Ajito que lo sigue. Para la memoria, el pedido se le pega al dibujo.
  const historia: MensajeCharla[] = orden
    .filter((m) => m.texto || m.media_url)
    .map((m, i, todos) => ({
      de: m.de as MensajeCharla['de'],
      texto: m.texto,
      entrada: m.entrada as MensajeCharla['entrada'],
      dibujo: m.de === 'ajito' && m.media_url ? (todos[i - 1]?.pedido_dibujo ?? 'lo que te pidió') : null,
    }))
    .filter((m) => m.texto || m.dibujo || (m.de === 'persona' && m.entrada === 'foto'))

  // --- la imagen: la foto que mandó, o el dibujo que Ajito acaba de hacer ------

  const bajar = async (ruta: string) => {
    const { data } = await supabase.storage.from(BUCKET_RESPUESTAS).download(ruta)
    return data ? Buffer.from(await data.arrayBuffer()).toString('base64') : null
  }

  let imagen: Charla['imagen']
  let imagenEsDibujo = false
  if (siguiente?.media_url) {
    const base64 = await bajar(siguiente.media_url)
    if (base64) {
      imagen = { base64, tipo: 'image/webp' }
      imagenEsDibujo = true
    }
  } else if (suyo.entrada === 'foto' && suyo.media_url) {
    const tipo = IMAGENES[suyo.media_url.split('.').pop()?.toLowerCase() ?? '']
    if (!tipo) {
      const texto =
        'Esa foto me llegó en un formato que no puedo abrir, así que no la pude ver. ' +
        'Tómala con la cámara desde aquí mismo, que así sí me llega.'
      const nuevo = await guardar(texto)
      return NextResponse.json({ id: nuevo, texto, dibujo: false, audio: false })
    }
    const base64 = await bajar(suyo.media_url)
    if (base64) imagen = { base64, tipo }
  }

  // --- Ajito ------------------------------------------------------------------------

  const dicho = await conversar({
    nombre: matricula.nombre_corto ?? empleado.nombre_completo.split(' ')[0],
    familia: matricula.familia_oficio as FamiliaOficio,
    historia,
    imagen,
    imagenEsDibujo,
    puedeDibujar: !imagenEsDibujo,
  })

  if (!dicho.ok) {
    console.error(`[charla] ${dicho.motivo}:`, dicho.detalle ?? '')
    await supabase.from('charla_mensajes').update({ fallo_en: new Date().toISOString() }).eq('id', suyo.id)
    return NextResponse.json({ error: 'Ajito no pudo contestar', motivo: dicho.motivo }, { status: 502 })
  }

  if ('dibujar' in dicho) {
    await supabase.from('charla_mensajes').update({ pedido_dibujo: dicho.dibujar }).eq('id', suyo.id)
    return NextResponse.json({ falta: 'dibujo' })
  }

  const nuevo = await guardar(dicho.texto)
  if (suyo.fallo_en) await supabase.from('charla_mensajes').update({ fallo_en: null }).eq('id', suyo.id)
  return NextResponse.json({ id: nuevo, texto: dicho.texto, dibujo: Boolean(siguiente?.media_url), audio: false })
}
