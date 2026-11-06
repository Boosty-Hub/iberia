/**
 * El vocabulario de reportar y bloquear en el canal (guía 1.2 de la App Store).
 *
 * Va aparte de `lib/canal.ts` porque lo usan componentes del navegador, y
 * `canal.ts` importa el cliente de Supabase del servidor. Este archivo no importa
 * nada. Las claves espejan los `CHECK` de la tabla `reportes`: si se añade un
 * motivo, se cambia en la migración y aquí.
 */

/** Lo que se puede reportar. */
export type TipoReportable = 'publicacion' | 'comentario' | 'mensaje'

export const TIPOS_REPORTABLES: Record<TipoReportable, string> = {
  publicacion: 'Publicación',
  comentario: 'Comentario',
  mensaje: 'Mensaje',
}

/** Lo que dice el menú de cada cosa: «Reportar este mensaje». */
export const ESTE_CONTENIDO: Record<TipoReportable, string> = {
  publicacion: 'esta publicación',
  comentario: 'este comentario',
  mensaje: 'este mensaje',
}

export type MotivoReporte =
  | 'ofensivo'
  | 'acoso'
  | 'inapropiado'
  | 'falso'
  | 'privacidad'
  | 'spam'
  | 'otro'

/** Una lista corta y fija: lo que se escoge en la hoja de «Reportar». */
export const MOTIVOS_REPORTE: Record<MotivoReporte, string> = {
  ofensivo: 'Es ofensivo o tiene insultos',
  acoso: 'Es acoso o una amenaza',
  inapropiado: 'Es sexual o violento',
  falso: 'Es falso o engañoso',
  privacidad: 'Comparte información privada',
  spam: 'Es spam o no viene al caso',
  otro: 'Otro motivo',
}

export const LARGO_DETALLE_REPORTE = 500

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El resultado de una acción que el navegador espera para cambiar la hoja. */
export type Resultado = { ok: boolean; error?: string }
