/**
 * De qué clave de Anthropic sale Ajito.
 *
 * En `.env.local` hay **dos**, y no por descuido: `ANTHROPIC_API_KEY` es la
 * original y se quedó sin crédito —la primera vez que Ajito no contestó, el
 * motivo fue ese y se perdió una hora buscándolo en el código—, y
 * `ANTHROPIC_API_KEY_SALDO` es la que tiene saldo. Se resuelve aquí, en un solo
 * sitio, y **la función dice cuál eligió**: dos claves con una regla de
 * precedencia invisible es exactamente el tipo de cosa que muerde a los tres
 * meses, cuando nadie recuerda que había dos.
 *
 * Manda la que tiene saldo. Cuando la original se recargue, basta borrar la otra
 * de `.env.local` y esto sigue funcionando sin tocar código.
 */

/** Por orden de preferencia. La primera con valor gana. */
const NOMBRES = ['ANTHROPIC_API_KEY_SALDO', 'ANTHROPIC_API_KEY'] as const

export type ClaveAnthropic = {
  /** La clave, o `null` si no hay ninguna configurada. */
  clave: string | null
  /** El nombre de la variable de la que salió, para poder decirlo en un error. */
  nombre: (typeof NOMBRES)[number] | null
}

export function claveAnthropic(): ClaveAnthropic {
  for (const nombre of NOMBRES) {
    const clave = process.env[nombre]?.trim()
    if (clave) return { clave, nombre }
  }
  return { clave: null, nombre: null }
}
