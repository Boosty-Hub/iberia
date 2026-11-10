/**
 * Las normas de uso del canal (guía 1.2 de la App Store): quien escribe en el
 * canal las acepta una vez antes de entrar.
 *
 * La aceptación vive en los metadatos de la cuenta de Supabase Auth
 * (`user_metadata`), no en una tabla: `normas_aceptadas_version` y
 * `normas_aceptadas_en`. Al cambiar el texto de las normas de forma que haya que
 * volver a aceptarlas, se sube `VERSION_NORMAS` y todo el mundo las vuelve a ver.
 */
export const VERSION_NORMAS = 1

/** El correo de soporte de la app, el mismo en `/soporte`, `/normas` y `/privacidad`. */
export const CORREO_SOPORTE = 'industriasiberiait@gmail.com'

/** La versión aceptada que traen los metadatos de la cuenta, o 0 si no hay ninguna. */
export function versionAceptada(metadatos: Record<string, unknown> | null | undefined): number {
  const valor = metadatos?.normas_aceptadas_version
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
}
