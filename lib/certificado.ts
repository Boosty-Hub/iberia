/**
 * Lo que dice el certificado del curso de Ajito.
 *
 * El certificado se ve de tres maneras: la hoja de la pantalla y del impreso
 * (`components/certificado-hoja.tsx`) y la imagen que se guarda, se manda por
 * WhatsApp o se publica en el canal (`lib/certificado-imagen.tsx`). Son dos
 * maquetas —una es HTML y la otra la dibuja `next/og`, que no entiende
 * Tailwind—, así que **el texto vive aquí, una sola vez**: si la pantalla y la
 * imagen dijeran cosas distintas del mismo curso, alguna de las dos estaría mal.
 */

/** Lo que se lee en el certificado, en el orden en que se lee. */
export const TEXTOS = {
  marca: 'Nuevo Sabor',
  certifica: 'Industrias Iberia certifica que',
  completo: 'completó el adiestramiento',
  curso: 'Inteligencia artificial en tu puesto',
  detalle: 'nueve lecciones del programa',
  programa: 'Nuevo Sabor',
  dictado: 'dictadas por Ajito.',
  cargo: 'Cargo',
  area: 'Área',
  fecha: 'Fecha',
  codigo: 'Código',
} as const

/** Los datos de la fila, congelados el día en que se emitió. */
export type DatosCertificado = {
  codigo: string
  nombre_completo: string
  /** El listado de Capital Humano no trae cédulas: puede faltar. */
  cedula: string | null
  /** El número de ficha de Capital Humano. */
  ficha?: string | null
  cargo: string | null
  area_nombre: string | null
  emitido_en: string
}

/**
 * Con qué se identifica a la persona en el certificado: «C.I. V-12345678», o
 * «Ficha 5034» si no hay cédula —el listado de Capital Humano llegó sin ellas, y
 * hasta el 27 de septiembre de 2026 eso impedía emitir el certificado a
 * cualquiera del padrón real—. Sin ninguna de las dos, nada.
 */
export function identificacion(c: Pick<DatosCertificado, 'cedula' | 'ficha'>): string | null {
  if (c.cedula) return `C.I. ${c.cedula}`
  if (c.ficha) return `Ficha ${c.ficha}`
  return null
}

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Caracas',
  })
}

/**
 * «OPERADOR DE ENVASADO» → «Operador de envasado».
 *
 * El cargo llega del listado de Capital Humano en mayúsculas, y en un
 * certificado que la persona va a enseñar se escribe como se lee. Lo que ya
 * viene bien escrito se queda como está.
 */
export function legible(texto: string): string {
  if (texto !== texto.toUpperCase()) return texto
  const bajo = texto.toLocaleLowerCase('es')
  return bajo.charAt(0).toLocaleUpperCase('es') + bajo.slice(1)
}

/** El nombre del archivo que se guarda en el teléfono. */
export function nombreArchivo(codigo: string): string {
  return `certificado-ajito-${codigo.toLowerCase()}.png`
}
