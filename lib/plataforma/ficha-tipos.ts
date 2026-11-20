/**
 * La ficha de un objeto (Anexo E §2.1): la misma forma para una unidad, una
 * plaza, un proceso, un documento o una requisición. La arma el servidor
 * (`lib/plataforma/fichas.ts`) y la pinta `FichaObjeto`, en el panel lateral o a
 * página completa. Todo es serializable: viaja desde una acción de servidor.
 */

export type TipoFicha = 'unidad' | 'plaza' | 'cargo' | 'proceso' | 'documento' | 'requisicion'

export const TIPOS_FICHA: Record<TipoFicha, string> = {
  unidad: 'Unidad',
  plaza: 'Plaza',
  cargo: 'Cargo',
  proceso: 'Proceso',
  documento: 'Documento',
  requisicion: 'Requisición',
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
  datos: { etiqueta: string; valor: string; mono?: boolean }[]
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
