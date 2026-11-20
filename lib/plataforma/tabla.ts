/**
 * `TablaDatos` (Anexo E §4): lo que comparten el servidor y el navegador. El
 * estado de la tabla vive en la URL —filtros, orden, agrupar, columnas,
 * página— para que una vista se comparta con un enlace y se guarde tal cual.
 *
 *   q=texto · f.<columna>=valor (repetible) · orden=<columna> · dir=asc|desc
 *   agrupar=<columna> · cols=a,b,c · pag=2 · tam=50 · vista=<id>
 *
 * Sin `'use client'` ni `'use server'`.
 */

export type TipoColumna = 'texto' | 'entero' | 'decimal' | 'tasa' | 'porcentaje' | 'fecha' | 'fechaHora' | 'codigo' | 'insignia' | 'acciones'

export type TonoCelda = 'neutro' | 'verde' | 'ambar' | 'rojo' | 'azul' | 'morado'

export type Columna = {
  clave: string
  etiqueta: string
  tipo?: TipoColumna
  /** Se puede ordenar por ella (por defecto, sí). */
  ordenable?: boolean
  /** Sale como chip de filtro con sus valores. */
  filtrable?: boolean
  /** La columna que trae el texto legible de cada valor (p. ej. `sede` → `sede_nombre`). */
  etiquetaDe?: string
  /** Se puede agrupar por ella. */
  agrupable?: boolean
  /** Suma en el pie (sobre todo lo filtrado, no solo la página). */
  total?: boolean
  /** Escondida hasta que se elija en «Columnas». */
  oculta?: boolean
  /** Edición en la celda: la página pasa la acción que guarda. */
  editable?: boolean
  /** Con edición: la celda se edita eligiendo de esta lista en vez de escribir. */
  opciones?: { valor: string; etiqueta: string }[]
  /** Con edición: lo que se lee al pasar el mouse por la celda (p. ej. «rige desde hoy»). */
  ayudaEdicion?: string
  /** Para `insignia`: el tono de cada valor. */
  tonos?: Record<string, TonoCelda>
  /** Texto legible de cada valor, cuando no viene en otra columna. */
  etiquetas?: Record<string, string>
  /** Ancho mínimo en px. */
  ancho?: number
  /** Explica la columna (sale al pasar el mouse por el encabezado). */
  ayuda?: string
  /** Marca de perímetro: la columna existe solo si la base la manda. */
  candado?: boolean
  /**
   * Para `acciones`: los botones de la fila. La columna trae, por fila, la lista
   * de claves que caben (`hijo,mover,ficha`), así que la base decide cuáles se
   * pintan. `ficha` abre la ficha; `href` es un enlace con `{columna}`; `pide`
   * pide un texto y llama a `alAccion` de la tabla; las demás abren la ficha.
   */
  acciones?: AccionFila[]
}

/**
 * `abre`: otra ficha que la de la fila, con `{columna}` (p. ej. `plaza:{plaza_ref}`):
 * se abre en el panel sin salir de la tabla ni perder sus filtros.
 */
export type AccionFila = { clave: string; etiqueta: string; titulo?: string; href?: string; pide?: string; abre?: string }

/**
 * Selección múltiple de `TablaDatos` (Anexo E §4) y lo que se hace en lote.
 * Las acciones son acciones de servidor que reciben las claves marcadas (y
 * vuelven a pedir su permiso: la barra no decide nada).
 *
 * - `nombre`: la columna con el nombre de la fila («Marcar a …»).
 * - `bloqueo`: columna con el motivo por el que una fila no se puede marcar
 *   (vacía = se puede).
 * - Cada acción cuenta las marcadas a las que aplica con `aplica` (una columna
 *   que vale verdadero en esas filas); sin ninguna, el botón se apaga.
 * - `avisos`: una línea bajo la barra cuando alguna marcada cumple `columna`;
 *   `{n}` es cuántas.
 */
export type AccionLote = {
  clave: string
  etiqueta: string
  principal?: boolean
  aplica?: string
  confirmar?: string
  ejecutar: (claves: string[]) => Promise<{ ok?: string; error?: string } | void>
}
export type LoteTabla = {
  nombre: string
  bloqueo?: string
  acciones: AccionLote[]
  avisos?: { columna: string; texto: string; tono?: 'ambar' | 'rojo' }[]
}

export type EstadoTabla = {
  q: string
  filtros: Record<string, string[]>
  orden: string | null
  dir: 'asc' | 'desc'
  agrupar: string | null
  /** Las columnas visibles, en orden. */
  columnas: string[]
  pagina: number
  tamano: number
  vista: string | null
}

export const TAMANOS = [25, 50, 100, 200]
export const PREFIJO_FILTRO = 'f.'
/** Los parámetros que son de la tabla (los demás —al, esc, ficha— se respetan). */
export const PARAMS_TABLA = ['q', 'orden', 'dir', 'agrupar', 'cols', 'pag', 'tam', 'vista']

type Entrada = URLSearchParams | Record<string, string | string[] | undefined>

function todos(sp: Entrada, k: string): string[] {
  if (sp instanceof URLSearchParams) return sp.getAll(k)
  const v = sp[k]
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}
function uno(sp: Entrada, k: string): string | null {
  return todos(sp, k)[0] ?? null
}
function claves(sp: Entrada): string[] {
  return sp instanceof URLSearchParams ? [...new Set(sp.keys())] : Object.keys(sp)
}

/** Lee el estado de la URL, validado contra las columnas (lo que no existe se ignora). */
export function leerEstado(sp: Entrada, columnas: Columna[], defecto: { orden?: string; dir?: 'asc' | 'desc'; tamano?: number } = {}): EstadoTabla {
  const existe = new Set(columnas.map((c) => c.clave))
  const filtros: Record<string, string[]> = {}
  for (const k of claves(sp)) {
    if (!k.startsWith(PREFIJO_FILTRO)) continue
    const col = k.slice(PREFIJO_FILTRO.length)
    const c = columnas.find((x) => x.clave === col)
    if (!c?.filtrable) continue
    const vals = todos(sp, k).filter(Boolean).slice(0, 50)
    if (vals.length) filtros[col] = vals
  }
  const orden = uno(sp, 'orden')
  const agrupar = uno(sp, 'agrupar')
  const cols = (uno(sp, 'cols') ?? '').split(',').filter((c) => existe.has(c))
  const tam = Number(uno(sp, 'tam'))
  const pag = Number(uno(sp, 'pag'))
  return {
    q: (uno(sp, 'q') ?? '').slice(0, 80),
    filtros,
    orden: orden && existe.has(orden) && columnas.find((c) => c.clave === orden)?.ordenable !== false ? orden : (defecto.orden ?? null),
    dir: uno(sp, 'dir') === 'desc' ? 'desc' : uno(sp, 'dir') === 'asc' ? 'asc' : (defecto.dir ?? 'asc'),
    agrupar: agrupar && columnas.find((c) => c.clave === agrupar)?.agrupable ? agrupar : null,
    columnas: cols.length ? cols : columnas.filter((c) => !c.oculta).map((c) => c.clave),
    pagina: Number.isInteger(pag) && pag > 0 ? pag : 1,
    tamano: TAMANOS.includes(tam) ? tam : (defecto.tamano ?? 50),
    vista: uno(sp, 'vista'),
  }
}

/**
 * El estado de la tabla como consulta de URL (sin `vista` ni la página): es lo
 * que se guarda en una vista y lo que se exporta.
 */
export function consultaDeEstado(sp: URLSearchParams): string {
  const fuera = new URLSearchParams()
  for (const [k, v] of sp.entries()) {
    if (k.startsWith(PREFIJO_FILTRO) || ['q', 'orden', 'dir', 'agrupar', 'cols', 'tam'].includes(k)) fuera.append(k, v)
  }
  return fuera.toString()
}
