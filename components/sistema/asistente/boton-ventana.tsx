'use client'

import { usePathname } from 'next/navigation'
import { abrirVentanaAsistente } from '@/components/sistema/ia/abrir'
// El estilo de `BOTON_CABECERA` (vive en un componente de servidor).
const BOTON_CABECERA = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50'

/** «Abrir en ventana»: el chat en una ventana flotante que sigue abierta mientras se navega por la plataforma. */
export function BotonVentanaAsistente() {
  // Desde un chat abierto, la ventana sigue ese mismo chat (26-nov-2026, Gabriel); si no, uno nuevo.
  const ruta = usePathname()
  const chatId = ruta.match(/^\/sistema\/asistente\/c\/([0-9a-f-]{36})/)?.[1] ?? null
  return (
    <button type="button" className={BOTON_CABECERA} onClick={() => abrirVentanaAsistente(chatId)} title="Seguir navegando con el chat abierto: el asistente sabe en qué pantalla estás" data-abrir-ventana>
      <span aria-hidden>⧉</span> Abrir en ventana
    </button>
  )
}
