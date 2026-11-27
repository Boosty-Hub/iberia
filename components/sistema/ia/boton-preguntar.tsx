'use client'

import { abrirPreguntaIa } from '@/components/sistema/ia/abrir'

/**
 * «✦ Preguntar a la IA» de la cabecera del módulo: abre el asistente al costado, con el contexto de la pantalla.
 * Botón sólido en carbón con el ✦ dorado, el mismo del botón flotante (27-nov-2026, Gabriel: con el borde punteado
 * parecía «en construcción»).
 */
export function BotonPreguntarIa({ contexto = '' }: { contexto?: string }) {
  return (
    <button
      type="button"
      data-boton-preguntar-ia
      onClick={() => abrirPreguntaIa('', contexto)}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white shadow-sm hover:bg-marca-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-500"
    >
      <span aria-hidden className="text-[13px] leading-none text-[#ffd036]">
        ✦
      </span>
      Preguntar a la IA
    </button>
  )
}
