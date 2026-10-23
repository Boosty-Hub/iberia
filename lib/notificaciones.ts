import 'server-only'
import { cookies } from 'next/headers'
import { configDesdeEntorno, mandarApns } from '@/lib/apns'
import type { AvisoApns, ConfigApns, EnvioApns } from '@/lib/apns'
import type { createClient } from '@/lib/supabase/server'

/**
 * Los avisos al teléfono: quién recibe qué, con qué texto, y a dónde lleva el
 * toque. El protocolo con Apple está en `lib/apns.ts`.
 *
 * Avisan dos cosas, y nada más por ahora:
 *
 * - **Un mensaje nuevo** en una conversación del canal, a los demás participantes
 *   —nunca a quien lo escribió—. Dice quién lo manda y el comienzo del mensaje, y
 *   el toque abre la conversación.
 * - **Un recordatorio del curso de Ajito**, cuando el equipo lo da por mandado
 *   desde el empujón (a mano o por WhatsApp). El texto es el del recordatorio
 *   —el de `contenido/adiestramiento/recordatorios.md`— sin el enlace, y el
 *   toque abre la lección donde la persona se quedó.
 *
 * ── Lo que no puede pasar ─────────────────────────────────────────────────────
 *
 * **Un aviso que falla no puede tumbar ni demorar lo que lo disparó.** Las
 * acciones llaman a esto dentro de `after()`, cuando la respuesta ya salió, y
 * todo aquí se traga sus errores: un mensaje se manda igual con APNs caído, sin
 * las variables o con la base lenta. Lo peor que pasa es que no llega el aviso.
 *
 * Los tokens se piden con la sesión de quien manda, a funciones `security
 * definer` que comprueban por dentro que puede pedirlos (ver la migración
 * `20261103120000_dispositivos.sql`). No se usa la clave de servicio.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>
type Dispositivo = { token: string; plataforma: string }

/**
 * La cookie con el token de este teléfono, solo en la app. La pone el alta y la
 * lee el cierre de sesión, para que el teléfono deje de recibir los avisos de la
 * cuenta que salió: en un teléfono compartido, los mensajes de una persona le
 * saldrían en la pantalla bloqueada a la siguiente.
 */
export const COOKIE_DISPOSITIVO = 'iberia_dispositivo'

/** Un token de APNs (hexadecimal) o de FCM (letras, números, `:`, `-` y `_`). */
export function tokenValido(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_:-]{20,512}$/.test(token)
}

// --- Configuración ---------------------------------------------------------------

let yaSeDijoQueFalta = false

/** La configuración de APNs, o null —y un aviso en el registro, una sola vez— si falta algo. */
function configuracion(): ConfigApns | null {
  const leida = configDesdeEntorno()
  if ('config' in leida) return leida.config
  if (!yaSeDijoQueFalta) {
    yaSeDijoQueFalta = true
    console.warn(
      `[notificaciones] Faltan ${leida.faltan.join(', ')}: no se mandan avisos al teléfono.`
    )
  }
  return null
}

/**
 * Manda y limpia: lo que Apple dice que ya no existe se olvida. Solo iOS: la app
 * de Android (PEN-14662) todavía no existe, y sus tokens irían por FCM.
 */
async function entregar(supabase: Cliente, envios: EnvioApns[]): Promise<void> {
  const config = configuracion()
  if (!config || !envios.length) return

  const resultados = await mandarApns(config, envios)
  for (const r of resultados) {
    if (r.descartar) {
      await supabase.rpc('descartar_dispositivo', { p_token: r.token })
    } else if (!r.ok) {
      // Sin el token en el registro: identifica un teléfono.
      console.warn(
        `[notificaciones] APNs contestó ${r.estado || 'sin respuesta'}${r.motivo ? ` · ${r.motivo}` : ''}`
      )
    }
  }
}

function soloIos(dispositivos: Dispositivo[]): string[] {
  return [...new Set(dispositivos.filter((d) => d.plataforma === 'ios').map((d) => d.token))]
}

/** El comienzo de un texto, en una línea y cortado por palabra. */
function adelanto(texto: string, largo: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (limpio.length <= largo) return limpio
  const corte = limpio.slice(0, largo)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > largo * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`
}

// --- Un mensaje nuevo ---------------------------------------------------------------

/**
 * Avisa a los demás participantes de una conversación. Se llama dentro de
 * `after()` con el cliente de la acción, que es la sesión de quien escribió.
 */
export async function avisarMensaje(
  supabase: Cliente,
  datos: { conversacionId: string; autor: string; texto: string }
): Promise<void> {
  try {
    const { data: dispositivos } = await supabase.rpc('dispositivos_de_conversacion', {
      p_conversacion: datos.conversacionId,
    })
    const tokens = soloIos(dispositivos ?? [])
    if (!tokens.length) return

    // En un grupo, el nombre del grupo va debajo de quien escribe.
    const { data: conversacion } = await supabase
      .from('conversaciones')
      .select('tipo, grupos(nombre)')
      .eq('id', datos.conversacionId)
      .maybeSingle()
    const grupo =
      conversacion?.tipo === 'grupo' ? (conversacion.grupos?.nombre ?? 'Grupo') : undefined

    const aviso: AvisoApns = {
      titulo: datos.autor,
      subtitulo: grupo,
      cuerpo: adelanto(datos.texto, 140),
      hilo: `conversacion-${datos.conversacionId}`,
      ruta: `/canal/mensajes/${datos.conversacionId}`,
    }
    await entregar(
      supabase,
      tokens.map((token) => ({ token, aviso }))
    )
  } catch (error) {
    console.warn('[notificaciones] El aviso del mensaje no salió:', error)
  }
}

// --- Un recordatorio del curso ----------------------------------------------------------

/**
 * Avisa a quien se le acaba de mandar un recordatorio. Solo el equipo con la
 * casilla de los recordatorios recibe tokens, y solo de recordatorios ya
 * marcados como enviados: la función lo comprueba en la base.
 */
export async function avisarRecordatorios(supabase: Cliente, ids: string[]): Promise<void> {
  if (!ids.length) return
  try {
    const { data: dispositivos } = await supabase.rpc('dispositivos_de_recordatorios', {
      p_recordatorios: ids,
    })
    const deIos = (dispositivos ?? []).filter((d) => d.plataforma === 'ios')
    if (!deIos.length) return

    const conTelefono = [...new Set(deIos.map((d) => d.recordatorio_id))]
    const { data: filas } = await supabase
      .from('recordatorios')
      .select('id, mensaje')
      .in('id', conTelefono)
    const mensajes = new Map((filas ?? []).map((f) => [f.id, f.mensaje]))

    const envios: EnvioApns[] = []
    for (const d of deIos) {
      const mensaje = mensajes.get(d.recordatorio_id)
      if (!mensaje) continue
      // El enlace es para WhatsApp; en el aviso, el toque ya lleva al curso.
      const cuerpo = adelanto(mensaje.replace(/https?:\/\/\S+/g, ''), 240)
      if (!cuerpo) continue
      envios.push({
        token: d.token,
        aviso: {
          titulo: 'Ajito',
          cuerpo,
          hilo: 'curso-ajito',
          ruta:
            typeof d.leccion === 'number'
              ? `/canal/adiestramiento/${d.leccion}`
              : '/canal/adiestramiento',
        },
      })
    }

    await entregar(supabase, envios)
  } catch (error) {
    console.warn('[notificaciones] El aviso del recordatorio no salió:', error)
  }
}

// --- Cerrar sesión ----------------------------------------------------------------

/**
 * Desliga este teléfono de la cuenta que sale. Va **antes** de `signOut()`: el
 * borrado pasa por la RLS de lo propio, y después ya no hay sesión con la que
 * pasarla. Fuera de la app no hay cookie y no hace nada.
 */
export async function olvidarEsteTelefono(supabase: Cliente): Promise<void> {
  try {
    const almacen = await cookies()
    const token = almacen.get(COOKIE_DISPOSITIVO)?.value
    if (!token) return
    const { error } = await supabase.from('dispositivos').delete().eq('token', token)
    if (error) console.warn('[notificaciones] No se pudo desligar el teléfono:', error.message)
    almacen.delete(COOKIE_DISPOSITIVO)
  } catch (error) {
    console.warn('[notificaciones] No se pudo desligar el teléfono:', error)
  }
}
