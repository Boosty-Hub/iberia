import type { ReactNode } from 'react'

/**
 * El vocabulario del lienzo. El lienzo no sabe de unidades ni de procesos:
 * recibe nodos planos con su padre y unas capas de color, y los dibuja. Lo que
 * cada nodo significa lo deciden los envoltorios (`OrganigramaLienzo`,
 * `MapaLienzo`), que son los que conocen el dato.
 */

export type Diff = 'nuevo' | 'movido' | 'cambiado' | 'quitado'

export const ETIQUETA_DIFF: Record<Diff, string> = {
  nuevo: 'nuevo',
  movido: 'movido',
  cambiado: 'cambiado',
  quitado: 'quitado',
}

/** Un tono de la casa. El color nunca va solo: siempre con su icono y su etiqueta. */
export type Tono = 'verde' | 'ambar' | 'rojo' | 'gris' | 'carbon' | 'morado' | 'azul'

export const COLOR_TONO: Record<Tono, string> = {
  verde: '#1f8a5b',
  ambar: '#b7791f',
  rojo: '#d4332c',
  gris: '#a8a29e',
  carbon: '#2f2c2b',
  morado: '#6b4fb3',
  azul: '#2f6fb0',
}

export type Marca = {
  tono: Tono
  /** Un carácter que se lee sin color: ✓ ○ ▲ ≈ … */
  icono: string
  /** Lo que dice la leyenda. */
  etiqueta: string
  /** Lo que dice la caja, si es más corto o lleva la cifra («+12», «3 vac.»). */
  corta?: string
}

export type ClaseNodo = 'raiz' | 'grupo' | 'unidad' | 'plaza' | 'proceso'

export type FichaDe = { tipo: string; id: string; href: string }

export type NodoLienzo = {
  id: string
  padre: string | null
  clase: ClaseNodo
  titulo: string
  subtitulo?: string | null
  /** Texto adicional para buscar: códigos, personas, sinónimos. */
  busqueda?: string
  orden?: number
  diff?: Diff | null
  /** Qué cambió, dicho corto: «antes en Tesorería», «dotación 4 → 6». */
  diffTexto?: string | null
  ficha?: FichaDe | null
  /** En modo escenario, si se puede arrastrar sobre otro. */
  arrastrable?: boolean
  /** Lo que el envoltorio necesite para pintar el cuerpo y las capas. */
  datos?: Record<string, unknown>
}

export type Capa = {
  clave: string
  etiqueta: string
  leyenda: Marca[]
  marca: (n: NodoLienzo) => Marca | null
}

export type CampoMenu = {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'opciones'
  opciones?: { valor: string; etiqueta: string }[]
  inicial?: string
  requerido?: boolean
}

export type AccionMenu = {
  clave: string
  etiqueta: string
  peligro?: boolean
  /** Si pide datos, se abren estos campos antes de ejecutar. */
  campos?: CampoMenu[]
  /** Si no pide datos, se pide esta confirmación. */
  confirmar?: string
  /** Devuelve el texto del error, o `null` si salió bien. */
  ejecutar: (valores: Record<string, string>) => Promise<string | null>
  /** Lo que se dice al salir bien. */
  hecho?: string
}

/** Lo que el lienzo sabe del árbol y le presta a quien valida un arrastre. */
export type ContextoArbol = {
  padreDe: (id: string) => string | null
  /** ¿`id` está debajo de `ancestro`? */
  esDescendiente: (id: string, ancestro: string) => boolean
  nodo: (id: string) => NodoLienzo | undefined
}

export type PropsLienzo = {
  nodos: NodoLienzo[]
  capas: Capa[]
  /** La línea de cifras de la caja según la capa elegida (ocupación, salud…). */
  cuerpo?: (n: NodoLienzo, capa: string) => ReactNode
  /** Qué arranca desplegado. */
  abiertosIniciales: string[]
  /** Nombre del dibujo: rótulo accesible y nombre del PNG. */
  nombre: string
  /** Para recordar en la pestaña lo desplegado entre recargas. */
  claveMemoria: string
  editable?: boolean
  validarSoltar?: (origen: NodoLienzo, destino: NodoLienzo, arbol: ContextoArbol) => string | null
  alSoltar?: (origen: NodoLienzo, destino: NodoLienzo) => Promise<string | null>
  menu?: (n: NodoLienzo) => AccionMenu[]
  /** Lo que va arriba de la lista de cambios del escenario (el resumen del envoltorio). */
  resumenCambios?: ReactNode
  /** Texto del lado vacío de las migas. */
  ayuda?: string
}
