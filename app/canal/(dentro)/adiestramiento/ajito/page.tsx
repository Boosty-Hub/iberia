import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CharlaAjito, type MensajeVista } from '@/components/canal/charla-ajito'
import { contextoCharla } from '@/lib/charla'

export const metadata: Metadata = { title: 'Ajito' }

/** Lo que se pinta de una conversación larga. Lo de más atrás sigue guardado. */
const MOSTRADOS = 200

/**
 * La conversación libre con Ajito: «Preguntarle algo a Ajito», al final de la
 * lección 8 cuando `asistente_libre_activo` está encendido.
 *
 * Un chat como los de inteligencia artificial, con varias conversaciones: abre
 * la última, se empieza otra con «Nueva», y las anteriores quedan en la lista.
 * Se le escribe, se le habla o se le manda una foto; contesta escrito y hablado,
 * con la voz del curso, y dibuja si se le pide. Quién entra, en `lib/charla.ts`.
 */
export default async function AjitoPage({ searchParams }: PageProps<'/canal/adiestramiento/ajito'>) {
  const ctx = await contextoCharla()
  if (!ctx) notFound()
  const { supabase, matricula, curso } = ctx

  const { c, nueva } = await searchParams
  const pedida = typeof c === 'string' ? c : null

  const { data: charlas } = await supabase
    .from('charlas_ajito')
    .select('id, titulo, actualizada_en')
    .eq('matricula_id', matricula.id)
    .order('actualizada_en', { ascending: false })
    .limit(30)

  const actual =
    (pedida && charlas?.find((x) => x.id === pedida)?.id) || (nueva ? null : (charlas?.[0]?.id ?? null))

  const { data: filas } = actual
    ? await supabase
        .from('charla_mensajes')
        .select('id, de, texto, entrada, media_url, audio, pedido_dibujo, dibujo_veredicto, fallo_en, created_at')
        .eq('charla_id', actual)
        .order('created_at', { ascending: false })
        .limit(MOSTRADOS)
    : { data: [] }

  const mensajes: MensajeVista[] = (filas ?? []).reverse().map((m) => ({
    id: m.id,
    de: m.de as MensajeVista['de'],
    texto: m.texto,
    entrada: m.entrada as MensajeVista['entrada'],
    imagen: Boolean(m.media_url) && (m.de === 'ajito' || m.entrada === 'foto'),
    audio: Boolean(m.audio),
    fallo: Boolean(m.fallo_en),
  }))

  return (
    <CharlaAjito
      key={actual ?? 'nueva'}
      charla={actual}
      mensajes={mensajes}
      charlas={(charlas ?? []).map((x) => ({ id: x.id, titulo: x.titulo, cuando: x.actualizada_en }))}
      soloEditores={!curso.asistente_libre_activo}
    />
  )
}
