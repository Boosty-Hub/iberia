import type { SVGProps } from 'react'
import type { ClaveDominio } from '@/lib/plataforma/dominios'

/**
 * Los iconos del armazón: uno por dominio del riel y los de la barra. Trazo
 * fino, `currentColor`, el mismo dibujo que `components/iconos.tsx`.
 */

type P = SVGProps<SVGSVGElement>

function Base({ children, ...p }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  )
}

const DOMINIO: Record<ClaveDominio, (p: P) => React.ReactElement> = {
  inicio: (p) => (
    <Base {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Base>
  ),
  direccion: (p) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </Base>
  ),
  comercial: (p) => (
    <Base {...p}>
      <path d="M4 7h16l-1.5 9.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5L4 7Z" />
      <path d="M8.5 7V5.5a3.5 3.5 0 0 1 7 0V7" />
    </Base>
  ),
  finanzas: (p) => (
    <Base {...p}>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c-.6-1.4-2.3-2.3-4.5-2.3-2.6 0-4.3 1.3-4.3 3.1 0 4.2 9 2.3 9 6.6 0 1.9-1.9 3.3-4.7 3.3-2.4 0-4.2-1-4.8-2.6" />
    </Base>
  ),
  abastecimiento: (p) => (
    <Base {...p}>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </Base>
  ),
  logistica: (p) => (
    <Base {...p}>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 9.5h4l3 3v3h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </Base>
  ),
  planta: (p) => (
    <Base {...p}>
      <path d="M3 21V10l5 3V10l5 3V5h4l1 16" />
      <path d="M3 21h18" />
      <path d="M7 17h2M12 17h2" />
    </Base>
  ),
  personas: (p) => (
    <Base {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.7.6 2.7 2.4 3 5.2" />
    </Base>
  ),
  organizacion: (p) => (
    <Base {...p}>
      <rect x="9" y="3" width="6" height="4.5" rx="1" />
      <rect x="2.5" y="16.5" width="6" height="4.5" rx="1" />
      <rect x="15.5" y="16.5" width="6" height="4.5" rx="1" />
      <path d="M12 7.5v4.5M5.5 16.5V12h13v4.5" />
    </Base>
  ),
  programa: (p) => (
    <Base {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Base>
  ),
  datos: (p) => (
    <Base {...p}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
      <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </Base>
  ),
  administracion: (p) => (
    <Base {...p}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M21 12v2.5" />
    </Base>
  ),
}

export function IconoDominio({ clave, ...p }: P & { clave: ClaveDominio }) {
  const I = DOMINIO[clave]
  return <I {...p} />
}

export const IconoLupa = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Base>
)

export const IconoCampanita = (p: P) => (
  <Base {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Base>
)

export const IconoOjo = (p: P) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Base>
)

export const IconoCalendarito = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
)

export const IconoPlegar = (p: P) => (
  <Base {...p}>
    <path d="m14 7-5 5 5 5" />
    <path d="M19 5v14" />
  </Base>
)

export const IconoDesplegar = (p: P) => (
  <Base {...p}>
    <path d="m10 7 5 5-5 5" />
    <path d="M5 5v14" />
  </Base>
)

export const IconoRombo = (p: P) => (
  <Base {...p}>
    <path d="M12 3 21 12 12 21 3 12Z" />
  </Base>
)

export const IconoFlechaAfuera = (p: P) => (
  <Base {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Base>
)

export const IconoEstrella = (p: P) => (
  <Base {...p}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
  </Base>
)

export const IconoGente = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
    <circle cx="17" cy="9.5" r="2.3" />
    <path d="M16 14.9c2.3.1 4 1.6 4.5 4.6" />
  </Base>
)

export const IconoCandadito = (p: P) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Base>
)

export const IconoChispa = (p: P) => (
  <Base {...p}>
    <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" />
  </Base>
)

export const IconoBajar = (p: P) => (
  <Base {...p}>
    <path d="M12 4v11M7 10.5 12 15.5l5-5" />
    <path d="M5 20h14" />
  </Base>
)

export const IconoFlechita = (p: P) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
)
