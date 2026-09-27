'use client'

import { useState } from 'react'
import { EntradaRespuesta } from '@/components/canal/entrada-respuesta'
import type { TipoEntrada } from '@/lib/adiestramiento'

/**
 * «Pedir otro dibujo», debajo de un «no va» de la lección 4.
 *
 * El guion lo pide así: la negativa no cierra el ejercicio. Quien pidió dibujar
 * a su supervisor oye que a las personas de verdad no se las dibuja, y aquí
 * mismo puede pedir otra cosa. El pedido nuevo es otra respuesta del mismo
 * ejercicio, y la página se queda con la última.
 */
export function OtroDibujo({
  numero,
  clave,
  entrada,
  esCampo,
}: {
  numero: number
  clave: string
  entrada: TipoEntrada
  esCampo: boolean
}) {
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="btn-canal btn-canal-rojo btn-canal-sigue mt-3 w-full"
      >
        Pedir otro dibujo
      </button>
    )
  }

  return <EntradaRespuesta numero={numero} clave={clave} entrada={entrada} esCampo={esCampo} dibuja />
}
