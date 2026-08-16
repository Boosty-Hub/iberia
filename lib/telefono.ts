/**
 * Teléfonos venezolanos.
 *
 * En el padrón están anotados de todas las maneras que se le ocurren a alguien
 * copiándolos de una planilla: `0412-1234567`, `(0412) 123 45 67`,
 * `+58 412 1234567`, `04121234567`. Meta los quiere en internacional y sin
 * signos, y el resto del aplicativo los quiere legibles.
 *
 * Vive aparte de `lib/whatsapp.ts` —que es `server-only` porque maneja el
 * token— porque normalizar un número no tiene nada de servidor, y esto hace
 * falta también en el padrón y en el directorio del canal.
 */

/** Las operadoras móviles de Venezuela. Un fijo no recibe WhatsApp. */
const MOVILES = ['412', '414', '416', '424', '426']

/**
 * A formato internacional sin signos: `584121234567`.
 *
 * Devuelve `null` cuando no cuadra, y eso es a propósito: **más vale no mandar
 * un mensaje que mandárselo a otra persona**. Un número corto o con la operadora
 * mal casi siempre es un dato mal copiado, no un teléfono raro.
 */
export function aInternacional(telefono: string | null | undefined): string | null {
  if (!telefono) return null

  let digitos = telefono.replace(/\D/g, '')
  if (!digitos) return null

  // El 58 del país y el 0 de la marcación nacional sobran, y vienen mezclados:
  // `+58 0412…` existe en el padrón, escrito por quien juntó las dos formas.
  if (digitos.startsWith('58')) digitos = digitos.slice(2)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)

  if (digitos.length !== 10) return null
  if (!MOVILES.includes(digitos.slice(0, 3))) return null

  return `58${digitos}`
}

/** `0412-1234567`, que es como lo lee alguien en Venezuela. */
export function comoSeLee(telefono: string | null | undefined): string | null {
  const internacional = aInternacional(telefono)
  if (!internacional) return null

  const nacional = internacional.slice(2)
  return `0${nacional.slice(0, 3)}-${nacional.slice(3)}`
}
