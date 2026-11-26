'use client'

import { abrirPreguntaIa } from '@/components/sistema/ia/abrir'

/** «✦ Preguntar a la IA» de la cabecera del módulo: abre el asistente al costado, con el contexto de la pantalla. */
export function BotonPreguntarIa({ contexto = '' }: { contexto?: string }) {
  return (
    <button
      type="button"
      data-boton-preguntar-ia
      onClick={() => abrirPreguntaIa('', contexto)}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-[#9d93bd] bg-white px-2.5 text-xs font-medium text-[#4f4577] hover:bg-[#fbfaff]"
    >
      <span aria-hidden>✦</span> Preguntar a la IA
    </button>
  )
}
