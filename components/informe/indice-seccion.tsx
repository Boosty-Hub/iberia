'use client'

import { useEffect, useRef, useState } from 'react'
import { IconoLista } from '@/components/iconos'
import { revelarAncla } from '@/components/markdown-plegable'
import type { Encabezado } from '@/lib/encabezados'
import { cn } from '@/lib/utils'

/**
 * «En esta sección»: los `##` de la sección, para saltar dentro de ella.
 *
 * Dos formas del mismo índice. En pantalla ancha va en su columna, pegado al
 * hacer scroll, y marca dónde va el lector. En teléfono y tableta va plegado
 * arriba del texto: abierto de entrada ocuparía la pantalla entera antes de la
 * primera línea.
 */
export function IndiceSeccion({
  entradas,
  variante,
}: {
  entradas: Encabezado[]
  variante: 'lateral' | 'plegado'
}) {
  const [activa, setActiva] = useState<string | null>(null)
  const plegado = useRef<HTMLDetailsElement>(null)

  // El encabezado que está leyendo: el más alto de los que cruzan la franja de
  // arriba de la pantalla. La franja empieza debajo de la cabecera fija.
  useEffect(() => {
    if (variante !== 'lateral') return
    const destinos = entradas
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (destinos.length === 0) return

    const observador = new IntersectionObserver(
      (registros) => {
        const visibles = registros
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visibles[0]) setActiva(visibles[0].target.id)
      },
      { rootMargin: '-88px 0px -70% 0px' }
    )
    destinos.forEach((d) => observador.observe(d))
    return () => observador.disconnect()
  }, [entradas, variante])

  if (entradas.length < 2) return null

  const ir = (ev: React.MouseEvent, id: string) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
    ev.preventDefault()
    window.history.replaceState(null, '', `#${id}`)
    // `revelarAncla` abre los bloques plegados que lo contengan y salta.
    revelarAncla(id)
    setActiva(id)
    if (plegado.current) plegado.current.open = false
  }

  const lista = (
    <ol className="indice-seccion-lista">
      {entradas.map((e) => (
        <li key={e.id}>
          <a
            href={`#${e.id}`}
            onClick={(ev) => ir(ev, e.id)}
            aria-current={activa === e.id ? 'location' : undefined}
            className={cn('indice-seccion-enlace', activa === e.id && 'activo')}
          >
            {e.texto}
          </a>
        </li>
      ))}
    </ol>
  )

  if (variante === 'lateral') {
    return (
      <nav aria-label="En esta sección" className="indice-seccion">
        <p className="indice-seccion-titulo">En esta sección</p>
        {lista}
      </nav>
    )
  }

  return (
    <details ref={plegado} className="indice-seccion-plegado">
      <summary>
        <IconoLista className="h-4 w-4 text-acento-600" />
        <span className="flex-1">En esta sección</span>
        <span className="indice-seccion-cuenta">{entradas.length}</span>
      </summary>
      <nav aria-label="En esta sección">{lista}</nav>
    </details>
  )
}
