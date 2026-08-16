import { createHash, randomBytes } from 'node:crypto'

/**
 * El enlace personal, que es la credencial.
 *
 * Nadie de planta tiene correo corporativo y la vía que funciona es WhatsApp.
 * Pedirle a una operadora de envasado que se invente una contraseña, se la
 * acuerde y la teclee en un teléfono con guantes es pedirle que no entre. Así
 * que la credencial es el enlace: lo toca y está dentro.
 *
 * ── Lo que eso obliga ────────────────────────────────────────────────────────
 *
 * Un enlace que da sesión **es** una contraseña, aunque no lo parezca. De ahí
 * las tres reglas de este archivo, y ninguna es opcional:
 *
 *  · **El token no se guarda.** Se guarda su SHA-256, igual que una contraseña.
 *    Quien lea `accesos` —incluido quien tenga la clave de servicio— puede
 *    comprobar un token que le presenten, pero no puede suplantar a nadie.
 *  · **Caduca.** Un enlace en un chat de WhatsApp es reenviable. Ciento veinte
 *    días cubren la Fase 1 y no dejan la puerta abierta para siempre.
 *  · **Se puede volver a usar hasta entonces.** El curso son nueve lecciones a
 *    lo largo de semanas; un enlace de un solo uso obligaría a mandar uno nuevo
 *    cada vez, que es el trámite que esto viene a quitar.
 *
 * El SHA-256 basta aquí y un bcrypt sería peor: el token son 32 bytes de
 * aleatorio nuestro, no una palabra que alguien eligió. No hay diccionario que
 * probar, y el hash rápido es lo que permite comprobarlo en cada visita sin
 * castigar al teléfono de nadie.
 *
 * ── Por qué esto no lleva `server-only` ──────────────────────────────────────
 *
 * El resto de los módulos que tocan secretos sí lo llevan. Aquí se quitó a
 * conciencia: `node:crypto` no se puede empaquetar para el navegador, así que
 * importar esto en un componente de cliente **rompe la compilación** igual de
 * seco que el marcador. A cambio, las funciones se pueden probar desde
 * `npm run probar:padron` sin levantar Next — y de todo el repositorio, estas
 * son las que más falta hace poder probar: son las que deciden si un enlace en
 * un chat de WhatsApp es una credencial o un agujero.
 */

/** Cubre los cinco meses de la Fase 1 con margen. */
export const DIAS_VIGENCIA = 120

/** 32 bytes de aleatorio criptográfico: 43 caracteres en la URL. */
export function acunarToken(): string {
  return randomBytes(32).toString('base64url')
}

export function huella(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function cuandoCaduca(dias = DIAS_VIGENCIA): string {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * El enlace que se manda por WhatsApp.
 *
 * Va al canal y no al curso directamente: la ruta de entrada abre la sesión y
 * después manda a donde corresponda según el motivo. Un enlace que apunta a la
 * lección se rompe el día que cambie la ruta de la lección.
 */
export function enlaceDe(token: string, base = process.env.NEXT_PUBLIC_SITE_URL ?? ''): string {
  return `${base.replace(/\/$/, '')}/entrar/${token}`
}

/**
 * ¿Esto tiene pinta de token nuestro?
 *
 * Se comprueba antes de tocar la base. Un token con la forma mal no es un
 * intento legítimo, y no hay razón para gastarle una consulta.
 */
export function pareceToken(valor: string): boolean {
  return /^[A-Za-z0-9_-]{40,50}$/.test(valor)
}
