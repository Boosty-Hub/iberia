'use client'

import { abrirVentanaAsistente } from '@/components/sistema/ia/abrir'
// El estilo de `BOTON_CABECERA` (vive en un componente de servidor).
const BOTON_CABECERA = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50'

/** «Abrir en ventana»: el chat en una ventana flotante que sigue abierta mientras se navega por la plataforma. */
export function BotonVentanaAsistente() {
  return (
    <button type="button" className={BOTON_CABECERA} onClick={abrirVentanaAsistente} title="Seguir navegando con el chat abierto: el asistente sabe en qué pantalla estás" data-abrir-ventana>
      <span aria-hidden>⧉</span> Abrir en ventana
    </button>
  )
}
