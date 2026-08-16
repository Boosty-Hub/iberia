'use client'

import { useState } from 'react'

/**
 * Copiar el texto de un recordatorio.
 *
 * Es el botón que hace que el empujón funcione **sin** la cuenta de WhatsApp
 * Business: se copia, se pega en el chat de la persona y se manda. Mientras la
 * integración con Meta no exista —y va a tardar—, este botón es el sistema.
 *
 * Confirma con un cambio de rótulo y no con un aviso: quien está mandando
 * cuarenta mensajes seguidos no quiere cerrar cuarenta avisos.
 */
export function CopiarMensaje({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles —o sin HTTPS— no hay a dónde ir: se
      // selecciona a mano del recuadro de arriba, que está a la vista.
      setCopiado(false)
    }
  }

  return (
    <button type="button" onClick={copiar} className="btn-neutro">
      {copiado ? 'Copiado' : 'Copiar el texto'}
    </button>
  )
}
