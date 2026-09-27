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

/**
 * `leccion-03/audio-1.mp3` — la ruta dentro del bucket. Con la carpeta de una
 * voz delante, la de esa voz: `hombre/leccion-03/audio-1.mp3`. La voz de mujer
 * no lleva carpeta: son las rutas de siempre.
 */
export function rutaAudio(leccion: number, pieza: string, carpetaVoz = ''): string {
  const ruta = `leccion-${String(leccion).padStart(2, '0')}/audio-${pieza}.mp3`
  return carpetaVoz ? `${carpetaVoz}/${ruta}` : ruta
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
 * Bucket de las imágenes del feed del canal. Lo lee cualquiera con sesión —es el
 * feed— y cada quien escribe solo en `escudos/<su empleado>/`: ahí va la copia
 * del escudo que decidió publicar, porque el original vive en su carpeta privada
 * del bucket de respuestas y nadie más lo lee.
 */
export const BUCKET_CANAL = 'canal'

export function rutaEscudoPublicado(empleadoId: string, respuestaId: string): string {
  return `escudos/${empleadoId}/${respuestaId}.webp`
}

/** El certificado que alguien publicó, sin la cédula (ver `lib/certificado-imagen.tsx`). */
export function rutaCertificadoPublicado(empleadoId: string, certificadoId: string): string {
  return `certificados/${empleadoId}/${certificadoId}.png`
}

/**
 * El dibujo de Ajito tal como es, para que el generador de la lección 4 lo
 * dibuje igualito cuando alguien lo pide. Va en el bucket del curso, no en
 * `public/`: en Netlify la función no ve los archivos públicos del sitio.
 */
export const RUTA_REFERENCIA_AJITO = 'referencias/ajito.png'

/**
 * El logo de Industrias Iberia, para que un dibujo que lo pide lleve el de verdad
 * y no el de la aerolínea, que es lo que el generador entendía (ver
 * `IBERIA_DE_VERDAD` en `lib/dibujo.ts`).
 */
export const RUTA_REFERENCIA_IBERIA = 'referencias/iberia.png'

/** Los ejemplos ya hechos de la lección 4 —«Ajito en la playa»…—, del guion. */
export function rutaEjemplo(leccion: number, numero: number): string {
  return `ejemplos/leccion-${String(leccion).padStart(2, '0')}/ejemplo-${numero}.webp`
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
 * Lo de la conversación libre con Ajito: la foto o la nota de voz de la persona,
 * el dibujo y el audio de lo que Ajito contestó. Bajo `respuestas/<empleado_id>/`,
 * como todo lo suyo: la política de dueño-en-la-ruta ya lo cubre, y
 * `barrerCarpeta` lo encuentra al limpiar.
 */
export function rutaCharla(empleadoId: string, que: string, extension: string): string {
  return `respuestas/${empleadoId}/charla/${que}-${Date.now()}.${extension}`
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
