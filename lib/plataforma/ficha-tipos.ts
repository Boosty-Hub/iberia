/**
 * La ficha de un objeto (Anexo E §2.1): la misma forma para una unidad, una
 * plaza, un proceso, un documento o una requisición. La arma el servidor
 * (`lib/plataforma/fichas.ts`) y la pinta `FichaObjeto`, en el panel lateral o a
 * página completa. Todo es serializable: viaja desde una acción de servidor.
 */

export type TipoFicha =
  | 'unidad'
  | 'plaza'
  | 'cargo'
  | 'persona'
  | 'proceso'
  | 'documento'
  | 'requisicion'
  | 'escenario'
  | 'conciliacion'
  // Programa (PRG): `lib/plataforma/fichas/programa.ts`.
  | 'entrevista'
  | 'archivo'
  | 'actividad'

export const TIPOS_FICHA: Record<TipoFicha, string> = {
  unidad: 'Unidad',
  plaza: 'Plaza',
  cargo: 'Cargo',
  persona: 'Persona',
  proceso: 'Proceso',
  documento: 'Documento',
  requisicion: 'Requisición',
  escenario: 'Escenario',
  conciliacion: 'Punto de conciliación',
  entrevista: 'Sesión del levantamiento',
  archivo: 'Archivo del expediente',
  actividad: 'Actividad del calendario',
}

export type TonoFicha = 'neutro' | 'verde' | 'ambar' | 'rojo' | 'azul' | 'morado'

/** Las pastillas de estado: fondo suave y texto oscuro del mismo tono (contraste AA). */
export const TONO_CHIP: Record<TonoFicha, string> = {
  neutro: 'bg-[#eef0f3] text-marca-600',
  verde: 'bg-[#e7f5ee] text-[#1f6f4b]',
  ambar: 'bg-[#fdf4e3] text-[#8a5a12]',
  rojo: 'bg-[#fbeceb] text-[#a3241f]',
  azul: 'bg-[#eaf2fb] text-[#2f5f9a]',
  morado: 'bg-[#f1edfa] text-[#5a3f9e]',
}

/**
 * Edición en la ficha (Anexo E §2: «edición en la celda o en la ficha, que nace
 * con fecha»). La ficha solo describe el campo; lo guarda la acción `accion` del
 * tipo, en el servidor (`ejecutarAccionFicha`), que vuelve a pedir el permiso y
 * llama a la función de la base: lo publicado nunca se corrige en el sitio.
 */
export type CampoEditable = {
  accion: string
  control: 'texto' | 'textoLargo' | 'entero' | 'numero' | 'opciones' | 'fecha'
  /** El valor de partida, como texto. */
  valor: string
  opciones?: { valor: string; etiqueta: string }[]
  /** Pide «rige desde» (hoy por defecto): el cambio cierra la versión que rige y abre otra. */
  conFecha?: boolean
  ayuda?: string
}

/** Un botón de la ficha: una acción del servidor o un enlace. */
export type AccionFicha = {
  accion?: string
  href?: string
  etiqueta: string
  tono?: 'principal' | 'neutro' | 'peligro'
  /** Pide un texto antes de ejecutar. */
  motivo?: 'opcional' | 'obligatorio'
  /** Rótulo del texto que se pide (por defecto, «Motivo»). */
  rotuloMotivo?: string
  conFecha?: boolean
  /** Rótulo de la fecha (por defecto, «Rige desde»). */
  rotuloFecha?: string
  /** Pregunta de confirmación (las destructivas la llevan). */
  confirmar?: string
  /** Un valor fijo que viaja con la acción (el paso que se decide, la versión del plan). */
  param?: string
}

export type DatoFicha = { etiqueta: string; valor: string; mono?: boolean; editar?: CampoEditable }

/** Los bloques de una pestaña propia del tipo (Impacto, Ruta, Costo…). */
export type BloqueFicha =
  | { tipo: 'datos'; titulo?: string; filas: DatoFicha[] }
  | { tipo: 'lista'; titulo?: string; items: Ficha['relaciones']; vacio?: string }
  | {
      tipo: 'pasos'
      titulo?: string
      pasos: {
        orden: number
        nombre: string
        quien?: string | null
        estado: string
        tono: TonoFicha
        en?: string | null
        comentario?: string | null
        nota?: string | null
        acciones?: AccionFicha[]
      }[]
    }
  | { tipo: 'texto'; titulo?: string; texto: string; tono?: TonoFicha }
  | { tipo: 'cifras'; titulo?: string; cifras: { etiqueta: string; valor: string; detalle?: string | null; tono?: TonoFicha }[]; sello?: string | null }
  | { tipo: 'acciones'; titulo?: string; acciones: AccionFicha[] }

/** Una pestaña propia del tipo; con `candado`, es perímetro (solo llega a quien tiene el permiso). */
export type SeccionFicha = { clave: string; etiqueta: string; candado?: boolean; n?: number; bloques: BloqueFicha[] }

/** Lo que devuelve una acción de la ficha. */
export type ResultadoAccionFicha = { ok?: string; error?: string; aviso?: string; ficha?: string | null; href?: string }

export type Ficha = {
  tipo: TipoFicha
  id: string
  tipoEtiqueta: string
  titulo: string
  subtitulo?: string | null
  codigo?: string | null
  estado?: { etiqueta: string; tono: TonoFicha } | null
  /** La pantalla del módulo donde se trabaja este objeto. */
  hrefModulo?: string | null
  datos: DatoFicha[]
  /** Pestañas propias del tipo, entre Datos y Relaciones. */
  secciones?: SeccionFicha[]
  /** Botones de la cabecera de la ficha. */
  acciones?: AccionFicha[]
  relaciones: { tipo: string; titulo: string; detalle?: string | null; href?: string | null; ficha?: string | null }[]
  linea: { en: string; texto: string; quien?: string | null }[]
  /** null = sin permiso para ver el historial (no «vacío»). */
  lineaVisible: boolean
  documentos: { codigo: string; titulo: string; estado: string; href: string }[]
  aprobaciones: {
    titulo: string
    estado: string
    creado_en: string
    href?: string | null
    pasos: { orden: number; nombre: string; decision: string; decidido_en: string | null }[]
  }[]
  /** En los perímetros la IA no existe, ni siquiera apagada (§7): no se pinta su pestaña. */
  perimetro: boolean
}

/** `tipo:id` → partes, o null si no es una ficha válida. */
export function leerFicha(v: string | null | undefined): { tipo: TipoFicha; id: string } | null {
  if (!v) return null
  const [tipo, id] = v.split(':')
  if (!tipo || !id || !(tipo in TIPOS_FICHA)) return null
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return { tipo: tipo as TipoFicha, id }
}
