'use client'

import { useState, useTransition } from 'react'
import { publicarEscudo } from '@/app/canal/(dentro)/adiestramiento/acciones'
import { Girando } from '@/components/canal/boton-sigue'

/**
 * «Publicarlo en el canal», debajo del escudo de la lección 4.
 *
 * Lo publica en el feed de Iberia —«Nuestra gente», «Este es el escudo que
 * construí con Ajito»— y sigue la lección. Hasta el 27 de septiembre de 2026 el
 * botón solo avanzaba, igual que «Solo para mí». Si no hay escudo que publicar
 * —el pedido no iba y no se pidió otro— lo dice, sin avanzar.
 */
export function PublicarEscudo({
  numero,
  turno,
  etiqueta,
}: {
  numero: number
  turno: number
  /** El rótulo sale del guion: «Publicarlo en el canal». */
  etiqueta: string
}) {
  const [publicando, iniciar] = useTransition()
  const [fallo, setFallo] = useState(false)

  function publicar() {
    const datos = new FormData()
    datos.set('numero', String(numero))
    datos.set('turno', String(turno))
    setFallo(false)
    iniciar(async () => {
      const { ok } = await publicarEscudo(datos)
      if (!ok) setFallo(true)
    })
  }

  return (
    <div className="min-w-[45%] flex-1 space-y-2">
      <button
        type="button"
        onClick={publicar}
        disabled={publicando}
        aria-busy={publicando}
        className="btn-canal btn-canal-rojo btn-canal-sigue w-full"
      >
        {publicando && <Girando />}
        {publicando ? 'Publicándolo…' : etiqueta}
      </button>
      {fallo && (
        <p className="rounded-xl bg-oro-300/25 px-3 py-2 text-[13px] leading-relaxed text-marca-700">
          No se pudo publicar. Si tu escudo no salió, pídelo otra vez arriba.
        </p>
      )}
    </div>
  )
}
