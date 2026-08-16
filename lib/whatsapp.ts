import 'server-only'
import { aInternacional } from '@/lib/telefono'

/**
 * Mandar por WhatsApp.
 *
 * Es la vía que ya funciona en esta planta: nadie de piso tiene correo
 * corporativo, y el enlace de WhatsApp es la credencial con la que entran.
 *
 * ── Lo importante de este archivo ────────────────────────────────────────────
 *
 * **La cuenta de WhatsApp Business de Iberia todavía no existe.** Está pedida a
 * Martha Fuentes y va a tardar: hay que dar de alta un número, verificar el
 * negocio con Meta y esperar a que aprueben cada plantilla. Meses, con suerte
 * semanas.
 *
 * Por eso lo que hay aquí no es «lo que falta para que funcione», sino la mitad
 * de un sistema que **ya sirve sin esto**. Cuando no hay conexión, el panel
 * prepara los mensajes y los deja listos para copiar; alguien los manda desde su
 * teléfono y marca que salieron. El día que llegue la cuenta se pega en el panel,
 * se enciende el interruptor, y los mismos mensajes salen solos.
 *
 * Un empujón que solo empuja cuando la integración esté terminada no empuja nada
 * durante los meses que tarde la integración — que es justo cuando las doscientas
 * personas están haciendo el curso.
 *
 * ── La plantilla ─────────────────────────────────────────────────────────────
 *
 * Meta no deja escribirle a alguien que no te ha escrito en las últimas 24 horas,
 * salvo con una **plantilla aprobada por ellos**. Los recordatorios caen siempre
 * de ese lado: por definición se le escribe a quien lleva días callado. Así que
 * el texto no viaja libre, viaja como parámetros de una plantilla registrada, y
 * el nombre de esa plantilla se configura en el panel.
 */

/** Lo que hace falta para poder mandar. Sale de `ajustes_whatsapp`. */
export type Conexion = {
  activo: boolean
  id_numero: string | null
  token: string | null
  plantilla: string | null
}

export type Envio =
  | { ok: true; id: string }
  | {
      ok: false
      motivo: 'sin-configurar' | 'apagado' | 'sin-telefono' | 'rechazado' | 'fallo'
      detalle?: string
    }

/** Versión de la API de Meta. Se sube a mano y a conciencia. */
const VERSION = 'v21.0'

export function estaLista(conexion: Conexion | null): boolean {
  return Boolean(conexion?.id_numero && conexion.token && conexion.plantilla)
}

/**
 * Manda un recordatorio.
 *
 * `parametros` van en el orden en que la plantilla aprobada los espera. Meta no
 * los nombra: son `{{1}}`, `{{2}}`… y el orden es el contrato.
 */
export async function mandarPlantilla(
  conexion: Conexion | null,
  telefono: string | null,
  parametros: string[]
): Promise<Envio> {
  if (!estaLista(conexion)) return { ok: false, motivo: 'sin-configurar' }
  if (!conexion!.activo) return { ok: false, motivo: 'apagado' }

  const numero = aInternacional(telefono)
  if (!numero) return { ok: false, motivo: 'sin-telefono' }

  const { id_numero, token, plantilla } = conexion!

  let respuesta: Response
  try {
    respuesta = await fetch(`https://graph.facebook.com/${VERSION}/${id_numero}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: {
          name: plantilla,
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: parametros.map((texto) => ({ type: 'text', text: texto })),
            },
          ],
        },
      }),
    })
  } catch (error) {
    return { ok: false, motivo: 'fallo', detalle: String(error).slice(0, 300) }
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as {
    messages?: { id: string }[]
    error?: { message?: string; code?: number }
  } | null

  if (!respuesta.ok) {
    return {
      ok: false,
      motivo: 'rechazado',
      detalle: `${respuesta.status} · ${cuerpo?.error?.message ?? ''}`.slice(0, 300),
    }
  }

  const id = cuerpo?.messages?.[0]?.id
  if (!id) return { ok: false, motivo: 'fallo', detalle: 'Meta no devolvió id de mensaje' }

  return { ok: true, id }
}

/**
 * Comprueba la conexión sin escribirle a nadie.
 *
 * Pide los datos del número. Si el token no vale o el id está mal, se sabe aquí
 * y no cuando doscientos mensajes fallen en silencio.
 */
export async function probarConexion(
  conexion: Conexion | null
): Promise<{ ok: boolean; detalle: string }> {
  if (!conexion?.id_numero || !conexion.token) {
    return { ok: false, detalle: 'Faltan el identificador del número o el token.' }
  }

  try {
    const respuesta = await fetch(
      `https://graph.facebook.com/${VERSION}/${conexion.id_numero}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${conexion.token}` } }
    )

    const cuerpo = (await respuesta.json().catch(() => null)) as {
      display_phone_number?: string
      verified_name?: string
      quality_rating?: string
      error?: { message?: string }
    } | null

    if (!respuesta.ok) {
      return {
        ok: false,
        detalle: `${respuesta.status} · ${cuerpo?.error?.message ?? 'sin detalle'}`.slice(0, 300),
      }
    }

    const nombre = cuerpo?.verified_name ?? 'sin nombre verificado'
    const numero = cuerpo?.display_phone_number ?? 'sin número'
    const calidad = cuerpo?.quality_rating ? ` · calidad ${cuerpo.quality_rating}` : ''

    return { ok: true, detalle: `${nombre} · ${numero}${calidad}` }
  } catch (error) {
    return { ok: false, detalle: String(error).slice(0, 300) }
  }
}
