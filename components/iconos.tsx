import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement>

/**
 * Set mínimo de iconos con trazo, dibujados inline para no arrastrar una
 * librería. Heredan color vía `currentColor` y tamaño vía la clase del padre.
 */
function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconoPanel = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Base>
)

export const IconoEntrevistas = (p: Props) => (
  <Base {...p}>
    <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
    <path d="M8.5 21h7" />
  </Base>
)

export const IconoArchivos = (p: Props) => (
  <Base {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.6.8l1 1.3a2 2 0 0 0 1.6.8h5.6A2.5 2.5 0 0 1 21 10.4v6.1A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
  </Base>
)

export const IconoHallazgos = (p: Props) => (
  <Base {...p}>
    <path d="M9.5 21h5" />
    <path d="M10 17.5h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.6.8.6 1.3v.8h5.8v-.8c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3Z" />
  </Base>
)

export const IconoInforme = (p: Props) => (
  <Base {...p}>
    <path d="M6 3h7.5L19 8.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M13.5 3v4a1.5 1.5 0 0 0 1.5 1.5h4" />
    <path d="M8.5 13h7" />
    <path d="M8.5 16.5h4.5" />
  </Base>
)

export const IconoUsuarios = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M17.5 14.6A5.5 5.5 0 0 1 20.5 20" />
  </Base>
)

export const IconoSalir = (p: Props) => (
  <Base {...p}>
    <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8 6 12l4 4" />
    <path d="M6 12h8" />
  </Base>
)

export const IconoBuscar = (p: Props) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
)

export const IconoMas = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Base>
)

export const IconoSubir = (p: Props) => (
  <Base {...p}>
    <path d="M12 16V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Base>
)

export const IconoDescargar = (p: Props) => (
  <Base {...p}>
    <path d="M12 4v12" />
    <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
    <path d="M4 18v.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V18" />
  </Base>
)

export const IconoImportar = (p: Props) => (
  <Base {...p}>
    <path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M14 3h6v6" />
    <path d="M20 3l-8.5 8.5" />
  </Base>
)

export const IconoAtras = (p: Props) => (
  <Base {...p}>
    <path d="m14 6-6 6 6 6" />
  </Base>
)

export const IconoReloj = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Base>
)

export const IconoSede = (p: Props) => (
  <Base {...p}>
    <path d="M12 21s6.5-5.4 6.5-10a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </Base>
)

export const IconoEditar = (p: Props) => (
  <Base {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" />
    <path d="m14.5 7.5 2.8 2.8" />
  </Base>
)

export const IconoBasura = (p: Props) => (
  <Base {...p}>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7l.8 12A1.6 1.6 0 0 0 8.9 20.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7" />
  </Base>
)

export const IconoCheck = (p: Props) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
)

export const IconoAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M12 4.5 21 19.5H3Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </Base>
)

// --- Canal de comunicación interna -------------------------------------------

export const IconoCasa = (p: Props) => (
  <Base {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5" />
    <path d="M9.5 20.5v-5.5h5v5.5" />
  </Base>
)

export const IconoChat = (p: Props) => (
  <Base {...p}>
    <path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-4.8A7.5 7.5 0 1 1 20 12.5Z" />
  </Base>
)

export const IconoGrupo = (p: Props) => (
  <Base {...p}>
    <circle cx="8.5" cy="9" r="2.8" />
    <path d="M3.5 19a5 5 0 0 1 10 0" />
    <circle cx="16.5" cy="7.5" r="2.2" />
    <path d="M15.5 13.6A4.6 4.6 0 0 1 20.5 18" />
  </Base>
)

export const IconoPersona = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
)

export const IconoCampana = (p: Props) => (
  <Base {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 4.5-1.5 5.8-1.5 5.8h15S18 13.5 18 9Z" />
    <path d="M10.3 18.5a2 2 0 0 0 3.4 0" />
  </Base>
)

export const IconoEnviar = (p: Props) => (
  <Base {...p}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.8 18-3.7-7.5L3 9.8Z" />
  </Base>
)

export const IconoOficial = (p: Props) => (
  <Base {...p}>
    <path d="m12 3 2.6 1.9 3.2-.2.6 3.2 2.4 2.2-1.7 2.7.6 3.2-3.1.9L14.7 20 12 18.6 9.3 20l-1.9-2.9-3.1-.9.6-3.2L3.2 10l2.4-2.2.6-3.2 3.2.2Z" />
    <path d="m9.3 12 2 2 3.4-3.6" />
  </Base>
)

export const IconoVerInforme = (p: Props) => (
  <Base {...p}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Base>
)
