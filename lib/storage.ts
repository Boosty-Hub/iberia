/**
 * Constantes de Supabase Storage.
 *
 * Vive aparte de las server actions a propósito: un módulo `'use server'` solo
 * puede exportar funciones async, así que una constante compartida lo rompería.
 */

/** Bucket privado del módulo de archivos. */
export const BUCKET_ARCHIVOS = 'archivos'

/**
 * Bucket privado de los audios del adiestramiento.
 *
 * A diferencia de `archivos`, aquí lee cualquiera con sesión de empleado: es el
 * curso, y si no lo puede oír la operadora de envasado no sirve de nada. Se
 * entrega firmado y con vigencia corta desde
 * `app/canal/(dentro)/adiestramiento/[numero]/audio/[pieza]/route.ts`.
 */
export const BUCKET_ADIESTRAMIENTO = 'adiestramiento'

/** `leccion-03/audio-1.mp3` — la ruta dentro del bucket. */
export function rutaAudio(leccion: number, pieza: string): string {
  return `leccion-${String(leccion).padStart(2, '0')}/audio-${pieza}.mp3`
}

/**
 * `fichas/leccion-03.png` — la ficha de bolsillo.
 *
 * Va en el mismo bucket que los audios y por la misma razón: es material del
 * curso, igual para todo el mundo, y lo ve cualquiera con matrícula. La lección
 * 8 tiene dos —`leccion-08-A` y `-B`, según el interruptor del asistente
 * libre—, así que la pieza entra completa y no solo el número.
 */
export function rutaFicha(pieza: string): string {
  return `fichas/leccion-${pieza}.png`
}

/**
 * Bucket de lo que manda la gente: notas de voz y fotos de los ejercicios.
 *
 * Reglas distintas de las del bucket de los audios. Los audios de Ajito los oye
 * cualquiera con matrícula; **una nota de voz la oye quien la grabó, y nadie
 * más**. La política lo comprueba con el dueño metido en la ruta, así que el
 * segundo tramo tiene que ser el id del empleado — lo arma `rutaRespuesta`.
 */
export const BUCKET_RESPUESTAS = 'adiestramiento-respuestas'

export function rutaRespuesta(
  empleadoId: string,
  leccion: number,
  clave: string,
  extension: string
): string {
  const carpeta = `leccion-${String(leccion).padStart(2, '0')}`
  return `respuestas/${empleadoId}/${carpeta}/${clave}-${Date.now()}.${extension}`
}

/**
 * El audio de la devolución de Ajito, en el mismo bucket y bajo la misma
 * carpeta que la respuesta que lo provocó.
 *
 * Va aquí y no en el bucket del curso a propósito: los audios de las lecciones
 * los oye cualquiera con matrícula porque son los mismos para todos, pero una
 * devolución habla de lo que esa persona contestó. Compartirla es compartir la
 * respuesta. Bajo `respuestas/<empleado_id>/` la política de dueño-en-la-ruta
 * ya la cubre, sin escribir ninguna política nueva.
 */
export function rutaDevolucion(empleadoId: string, leccion: number, clave: string): string {
  const carpeta = `leccion-${String(leccion).padStart(2, '0')}`
  return `respuestas/${empleadoId}/${carpeta}/devolucion-${clave}-${Date.now()}.mp3`
}
