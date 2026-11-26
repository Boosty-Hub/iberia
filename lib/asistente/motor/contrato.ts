import type { Bloque, ClaseArtefacto, Esfuerzo, EventoTurno } from '../tipos'

export type ArtefactoTurno = { grupo: string; titulo: string; clase: ClaseArtefacto; version: number }

/** Un archivo tal como lo necesita un motor. */
export type ArchivoTurno = {
  id: string
  nombre: string
  mime: string
  bytes: number
  ruta: string
  origen: 'subido' | 'generado'
  anthropic_file_id: string | null
}

export type TurnoHistorial = { rol: 'usuario' | 'asistente'; texto: string; adjuntos: string[]; generados: string[] }

/**
 * El contrato de un motor: la pantalla, la base y las herramientas no saben
 * cuál está detrás (plan, «Los adaptadores de motor»).
 */
export type ContextoMotor = {
  turno: string
  modelo: string
  esfuerzo: Esfuerzo
  sistema: string
  historial: TurnoHistorial[]
  texto: string
  /** Los adjuntos de este mensaje. */
  adjuntos: ArchivoTurno[]
  /** Todos los archivos del chat (para volver a montarlos si el contenedor es nuevo). */
  archivosDelChat: ArchivoTurno[]
  contenedorId: string | null
  /** ¿El contenedor sigue vivo? (vive 30 días desde su último uso; se renueva a los 25). */
  contenedorVigente: boolean
  senal: AbortSignal
  emitir: (e: EventoTurno) => void
  /** Sube (una vez) un archivo de Storage a la Files API de Anthropic y devuelve su `file_id`. */
  asegurarEnAnthropic: (a: ArchivoTurno) => Promise<string>
  /** Baja un archivo generado por la ejecución de código y lo guarda en Storage. */
  guardarGenerado: (fileId: string) => Promise<Extract<Bloque, { tipo: 'archivo' }> | null>
  /** Los artefactos del chat (la última versión de cada uno), para que el modelo los actualice. */
  artefactos: ArtefactoTurno[]
  /** Crea un artefacto o le agrega una versión (si `grupo` es de este chat). */
  publicarArtefacto: (a: { grupo: string | null; titulo: string; clase: ClaseArtefacto; contenido: string }) => Promise<Extract<Bloque, { tipo: 'artefacto' }>>
  /** El contenido de la última versión de un artefacto del chat. */
  leerArtefacto: (grupo: string) => Promise<string | null>
}

export type Uso = { entrada: number; salida: number; cacheLee: number; cacheEscribe: number; busquedas: number; costoUsd: number }

export type ResultadoMotor = {
  texto: string
  bloques: Bloque[]
  uso: Uso
  contenedorId: string | null
  modeloServido: string
  primerTokenMs: number | null
  estado: 'listo' | 'detenido' | 'fallido'
  error?: string
}

export function usoVacio(): Uso {
  return { entrada: 0, salida: 0, cacheLee: 0, cacheEscribe: 0, busquedas: 0, costoUsd: 0 }
}

export function sumarUso(a: Uso, b: Partial<Uso>): Uso {
  return {
    entrada: a.entrada + (b.entrada ?? 0),
    salida: a.salida + (b.salida ?? 0),
    cacheLee: a.cacheLee + (b.cacheLee ?? 0),
    cacheEscribe: a.cacheEscribe + (b.cacheEscribe ?? 0),
    busquedas: a.busquedas + (b.busquedas ?? 0),
    costoUsd: a.costoUsd + (b.costoUsd ?? 0),
  }
}

export type Precio = { entrada: number; salida: number; cacheLee: number; cacheEscribe: number }

/** USD de una llamada: tokens por el precio de lista + búsquedas a US$ 10 por 1.000. */
export function costoDe(p: Precio, u: Pick<Uso, 'entrada' | 'salida' | 'cacheLee' | 'cacheEscribe' | 'busquedas'>): number {
  return (u.entrada * p.entrada + u.salida * p.salida + u.cacheLee * p.cacheLee + u.cacheEscribe * p.cacheEscribe) / 1_000_000 + u.busquedas * 0.01
}
