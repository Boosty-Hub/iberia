'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Un menú que se abre bajo su botón: cierra con Esc, con un clic afuera y al
 * volver el foco al botón. Lo usan la barra (campana, persona, escenario) y la
 * tabla (filtros, columnas, vistas). `children` puede ser una función que
 * recibe `cerrar`.
 */
export function Desplegable({
  boton,
  etiqueta,
  children,
  alinear = 'izq',
  className,
  claseBoton,
  ancho = 'w-64',
  oscuro = false,
  inicialAbierto = false,
}: {
  boton: ReactNode
  /** Lo que lee un lector de pantalla del botón. */
  etiqueta: string
  children: ReactNode | ((cerrar: () => void) => ReactNode)
  alinear?: 'izq' | 'der'
  className?: string
  claseBoton?: string
  ancho?: string
  oscuro?: boolean
  /** Abrirlo al montar (por ejemplo, cuando se llega desde Ctrl K con `?nuevo=1`). */
  inicialAbierto?: boolean
}) {
  const [abierto, setAbierto] = useState(inicialAbierto)
  const caja = useRef<HTMLDivElement>(null)
  const boton_ = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        boton_.current?.focus()
      }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const cerrar = () => setAbierto(false)

  return (
    <div ref={caja} className={cn('relative', className)}>
      <button
        ref={boton_}
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        className={claseBoton}
      >
        {boton}
      </button>
      {abierto && (
        <div
          id={id}
          className={cn(
            'absolute top-full z-50 mt-1.5 max-h-[70vh] overflow-auto rounded-xl border shadow-xl',
            oscuro ? 'border-[#4a4845] bg-[#2b2a28] text-white' : 'border-[var(--borde)] bg-white text-marca-900',
            alinear === 'der' ? 'right-0' : 'left-0',
            ancho
          )}
        >
          {typeof children === 'function' ? children(cerrar) : children}
        </div>
      )}
    </div>
  )
}
