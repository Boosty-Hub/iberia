/**
 * El emisor de APNs: cómo se le habla a Apple para que un aviso llegue al iPhone.
 *
 * Solo el protocolo. **Quién** recibe qué, con qué texto y a dónde lleva el toque
 * vive en `lib/notificaciones.ts`, que es lo que importa la app. Este módulo no
 * importa `server-only` a propósito: `scripts/probar-apns.mjs` lo carga desde
 * Node para comprobar la clave contra Apple con el mismo código que usa el
 * servidor. Igual no puede llegar al navegador: depende de `node:http2`.
 *
 * ── Tres cosas que Apple exige ───────────────────────────────────────────────
 *
 * - **HTTP/2.** APNs no contesta HTTP/1.1, y el `fetch` de Node habla 1.1. Por
 *   eso `node:http2` y una sola conexión por tanda de avisos.
 * - **Un JWT ES256 firmado con la clave del equipo** (`.p8`), que se reusa entre
 *   20 y 60 minutos: Apple rechaza uno más viejo de una hora
 *   (`ExpiredProviderToken`) y castiga renovarlo más seguido
 *   (`TooManyProviderTokenUpdates`). Se guarda 50 minutos.
 * - **El `apns-topic` es el bundle id** de la app. Se manda siempre a
 *   producción: TestFlight y la App Store usan producción, y un token de una
 *   compilación de Xcode (sandbox) contesta `BadDeviceToken`.
 */
import { connect, constants } from 'node:http2'
import { createPrivateKey, sign } from 'node:crypto'
import type { ClientHttp2Session } from 'node:http2'

export const HOST_PRODUCCION = 'api.push.apple.com'

export type ConfigApns = {
  /** La clave `.p8` del equipo, en PEM. */
  clave: string
  /** El id de esa clave (`kid`), el que va en su nombre: `AuthKey_<id>.p8`. */
  idClave: string
  /** El equipo de Apple Developer (`iss`). */
  equipo: string
  /** El bundle id de la app: es el `apns-topic`. */
  bundle: string
}

export type AvisoApns = {
  titulo: string
  cuerpo: string
  subtitulo?: string
  /** Agrupa los avisos en el centro de notificaciones (`thread-id`). */
  hilo?: string
  /** A dónde lleva el toque: una ruta del sitio, que la app abre en su WebView. */
  ruta: string
}

export type EnvioApns = { token: string; aviso: AvisoApns }

export type ResultadoApns = {
  token: string
  /** El estado HTTP que contestó Apple; 0 si no hubo respuesta. */
  estado: number
  /** El `reason` del cuerpo, cuando Apple dice que no. */
  motivo?: string
  ok: boolean
  /** Apple dice que este token ya no sirve: la app se desinstaló o caducó. */
  descartar: boolean
}

/** Las cuatro variables que hacen falta, en el orden en que se piden. */
export const VARIABLES_APNS = ['APNS_KEY_P8', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID'] as const

/**
 * La configuración, del entorno. `APNS_KEY_P8` es el `.p8` en base64 —una sola
 * línea, que es lo que aguanta bien una variable de Netlify—; si alguien pegó el
 * PEM tal cual, también se acepta.
 */
export function configDesdeEntorno(
  entorno: Record<string, string | undefined> = process.env
): { config: ConfigApns } | { faltan: string[] } {
  const faltan = VARIABLES_APNS.filter((nombre) => !entorno[nombre]?.trim())
  if (faltan.length) return { faltan }

  const crudo = entorno.APNS_KEY_P8!.trim()
  const clave = crudo.includes('BEGIN PRIVATE KEY')
    ? crudo
    : Buffer.from(crudo, 'base64').toString('utf8')

  return {
    config: {
      clave,
      idClave: entorno.APNS_KEY_ID!.trim(),
      equipo: entorno.APNS_TEAM_ID!.trim(),
      bundle: entorno.APNS_BUNDLE_ID!.trim(),
    },
  }
}

// --- El JWT del proveedor ------------------------------------------------------

const VIDA_JWT_SEGUNDOS = 50 * 60

let jwtGuardado: { llave: string; token: string; vence: number } | null = null

/** El JWT con el que se firma cada petición. Se reusa mientras tenga menos de 50 minutos. */
export function jwtDelProveedor(config: ConfigApns, ahora = Date.now()): string {
  const segundos = Math.floor(ahora / 1000)
  const llave = `${config.equipo}:${config.idClave}`
  if (jwtGuardado && jwtGuardado.llave === llave && segundos < jwtGuardado.vence) {
    return jwtGuardado.token
  }

  const cabecera = base64url(JSON.stringify({ alg: 'ES256', kid: config.idClave }))
  const cuerpo = base64url(JSON.stringify({ iss: config.equipo, iat: segundos }))
  const entrada = `${cabecera}.${cuerpo}`
  // `ieee-p1363` da la firma cruda (r‖s) que pide JWS; la de por defecto es DER.
  const firma = sign('sha256', Buffer.from(entrada), {
    key: createPrivateKey(config.clave),
    dsaEncoding: 'ieee-p1363',
  })

  const token = `${entrada}.${firma.toString('base64url')}`
  jwtGuardado = { llave, token, vence: segundos + VIDA_JWT_SEGUNDOS }
  return token
}

function base64url(texto: string): string {
  return Buffer.from(texto, 'utf8').toString('base64url')
}

// --- El envío ------------------------------------------------------------------

/**
 * Las únicas respuestas que dicen que el token ya no existe. `DeviceTokenNotForTopic`
 * y `TopicDisallowed` **no** están: las da también un `APNS_BUNDLE_ID` mal puesto,
 * y con él se borrarían los tokens de todo el mundo por un error de configuración.
 */
const MOTIVOS_PARA_DESCARTAR = new Set(['BadDeviceToken', 'Unregistered'])

/** El JWT se tira y se firma otro en la siguiente tanda. */
const MOTIVOS_DE_JWT = new Set(['ExpiredProviderToken', 'InvalidProviderToken'])

/**
 * APNs abre la conexión con un solo flujo a la vez y lo sube cuando valida el
 * primer JWT. El primer aviso va solo y el resto en tandas.
 */
const TANDA = 20

/**
 * Manda los avisos por una sola conexión y devuelve qué contestó Apple a cada
 * uno. **Nunca lanza**: un aviso es un extra de lo que lo disparó, y lo que lo
 * disparó ya ocurrió. Pasado `tiempoMaximoMs` corta la conexión y lo que no
 * alcanzó a salir vuelve con estado 0.
 */
export async function mandarApns(
  config: ConfigApns,
  envios: EnvioApns[],
  opciones: { host?: string; tiempoMaximoMs?: number } = {}
): Promise<ResultadoApns[]> {
  if (!envios.length) return []

  let jwt: string
  try {
    jwt = jwtDelProveedor(config)
  } catch (error) {
    // La clave no se pudo leer: no es un problema de ningún token.
    const motivo = `Clave ilegible: ${error instanceof Error ? error.message : String(error)}`
    return envios.map(({ token }) => ({ token, estado: 0, motivo, ok: false, descartar: false }))
  }

  const sesion = connect(`https://${opciones.host ?? HOST_PRODUCCION}`)
  // Sin un oyente de `error`, un fallo de red tumba el proceso entero.
  sesion.on('error', () => {})
  const reloj = setTimeout(() => sesion.destroy(), opciones.tiempoMaximoMs ?? 8000)

  const resultados: ResultadoApns[] = []
  try {
    const [primero, ...resto] = envios
    resultados.push(await pedir(sesion, jwt, config.bundle, primero))
    for (let i = 0; i < resto.length; i += TANDA) {
      const tanda = resto.slice(i, i + TANDA)
      resultados.push(...(await Promise.all(tanda.map((e) => pedir(sesion, jwt, config.bundle, e)))))
    }
  } finally {
    clearTimeout(reloj)
    if (!sesion.destroyed) sesion.close()
  }

  if (resultados.some((r) => r.motivo && MOTIVOS_DE_JWT.has(r.motivo))) jwtGuardado = null
  return resultados
}

function pedir(
  sesion: ClientHttp2Session,
  jwt: string,
  topic: string,
  { token, aviso }: EnvioApns
): Promise<ResultadoApns> {
  return new Promise((resolver) => {
    let estado = 0
    let texto = ''
    let listo = false

    const terminar = () => {
      if (listo) return
      listo = true
      const motivo = leerMotivo(texto)
      resolver({
        token,
        estado,
        motivo,
        ok: estado === 200,
        descartar: estado === 410 || (motivo !== undefined && MOTIVOS_PARA_DESCARTAR.has(motivo)),
      })
    }

    try {
      const peticion = sesion.request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${encodeURIComponent(token)}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      })
      peticion.setEncoding('utf8')
      peticion.on('response', (cabeceras) => {
        estado = Number(cabeceras[constants.HTTP2_HEADER_STATUS]) || 0
      })
      peticion.on('data', (trozo: string) => {
        texto += trozo
      })
      peticion.on('end', terminar)
      peticion.on('close', terminar)
      peticion.on('error', terminar)
      peticion.end(JSON.stringify(cargaDe(aviso)))
    } catch {
      // La sesión ya estaba cerrada (venció el tiempo): sin respuesta.
      terminar()
    }
  })
}

/** El cuerpo que entiende iOS, más `ruta` para la app. */
export function cargaDe(aviso: AvisoApns) {
  const alert: Record<string, string> = { title: aviso.titulo, body: aviso.cuerpo }
  if (aviso.subtitulo) alert.subtitle = aviso.subtitulo
  const aps: Record<string, unknown> = { alert, sound: 'default' }
  if (aviso.hilo) aps['thread-id'] = aviso.hilo
  return { aps, ruta: aviso.ruta }
}

function leerMotivo(texto: string): string | undefined {
  if (!texto) return undefined
  try {
    const motivo = (JSON.parse(texto) as { reason?: unknown }).reason
    return typeof motivo === 'string' ? motivo : undefined
  } catch {
    return undefined
  }
}
