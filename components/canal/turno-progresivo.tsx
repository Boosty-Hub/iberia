'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { AudioAjito } from '@/components/canal/audio-ajito'

/** Lo que el turno necesita de cada audio para pintarlo. */
export type AudioDelTurno = {
  id: string
  src: string
  etiqueta: string
  segundos: number | null
  orden?: { numero: number; total: number }
  /** Si ya lo oyó —al menos la mitad— otro día. */
  oido: boolean
  alOir?: () => void | Promise<void>
}

/**
 * Un turno de la lección que se va abriendo a medida que se oye.
 *
 * Un turno puede traer dos o tres audios seguidos —el cierre de la lección 5
 * trae dos y la ficha—, y hasta el 27 de septiembre de 2026 salían todos de una:
 * la gente veía el segundo antes de oír el primero, y los botones antes de oír
 * nada. Ahora **cada cosa aparece cuando se ha oído al menos la mitad del audio
 * de antes**: el siguiente audio, lo que acompaña, y al final los botones o el
 * ejercicio. La mitad cuenta el tiempo que sonó, no dónde está la barra —
 * arrastrarla no cuenta— y queda guardada, así que al recargar no hay que oírlo
 * otra vez.
 *
 * Solo el turno actual va por partes. Los de arriba ya se pasaron y salen
 * enteros, igual que un turno cuyo ejercicio ya se contestó.
 *
 * Y el audio que toca oír lleva **la manito**: una mano que toca el play, para
 * que quien nunca ha usado esto entienda qué hacer. Se va apenas suena.
 */
export function TurnoProgresivo({
  activo,
  antes,
  segmentos,
  final,
}: {
  /** Si es el turno actual y todavía está por pasarse. */
  activo: boolean
  /** Lo que va antes del primer audio, si hay algo. */
  antes: ReactNode
  /** Cada audio con lo que viene detrás de él hasta el próximo audio. */
  segmentos: { audio: AudioDelTurno; resto: ReactNode }[]
  /** Los botones o el ejercicio: lo último del turno. */
  final: ReactNode
}) {
  const [oidos, setOidos] = useState(
    () => new Set(segmentos.filter((s) => s.audio.oido).map((s) => s.audio.id))
  )
  const oyo = (id: string) =>
    setOidos((antes) => (antes.has(id) ? antes : new Set(antes).add(id)))

  // Hasta dónde se ve: el primero siempre, y cada uno más si el de antes se oyó.
  let visibles = segmentos.length
  if (activo) {
    visibles = Math.min(1, segmentos.length)
    while (visibles < segmentos.length && oidos.has(segmentos[visibles - 1].audio.id)) visibles++
  }
  const ultimo = segmentos[segmentos.length - 1]
  const cierreVisible = !activo || !ultimo || oidos.has(ultimo.audio.id)

  // La manito va en el primero de los visibles que falta por oír.
  const invitado = activo
    ? segmentos.slice(0, visibles).find((s) => !oidos.has(s.audio.id))?.audio.id
    : undefined

  return (
    <section className="space-y-3">
      {antes}
      {segmentos.slice(0, visibles).map(({ audio, resto }) => (
        <Fragment key={audio.id}>
          <AudioAjito
            src={audio.src}
            etiqueta={audio.etiqueta}
            segundos={audio.segundos}
            orden={audio.orden}
            oido={audio.oido}
            alOir={audio.alOir}
            alMitad={() => oyo(audio.id)}
            invitar={audio.id === invitado}
          />
          {resto}
        </Fragment>
      ))}
      {cierreVisible && final}
    </section>
  )
}
