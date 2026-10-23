'use client'

import { useEffect } from 'react'
import { registrarDispositivo } from '@/app/canal/(dentro)/acciones'

/**
 * Cuánto se espera antes de pedir el permiso de avisos: que la persona vea el
 * canal primero y el diálogo de iOS no le salga encima de la pantalla en blanco.
 */
const PAUSA_MS = 2000

type Manija = { remove: () => Promise<void> }

/**
 * Pide permiso de avisos y registra el teléfono. Solo hace algo dentro de la app
 * de iOS; en un navegador no carga ni el plugin.
 *
 * Va en el layout del canal y no en el login: el permiso se pide cuando la
 * persona ya entró, que es cuando se entiende para qué es. Si ya lo dio, no se
 * vuelve a preguntar y el teléfono se registra en silencio —así la fila sigue al
 * día si Apple cambia el token—; si lo negó, no se insiste: iOS no deja volver a
 * preguntar, y eso se cambia en Ajustes.
 *
 * Lo que pasa al **tocar** un aviso no está aquí sino en `PuenteNativo`, en el
 * layout raíz: un aviso tocado con la app cerrada tiene que atenderse aunque la
 * sesión haya vencido y la app arranque en el login.
 */
export function NotificacionesNativas() {
  useEffect(() => {
    let cancelado = false
    const manijas: Manija[] = []
    // Un oyente que llega después de desmontar se quita en el acto.
    const guardar = (manija: Manija) => {
      if (cancelado) void manija.remove()
      else manijas.push(manija)
    }

    const reloj = setTimeout(async () => {
      try {
        // La app inyecta su puente antes que la página: sin él es un navegador.
        if (!('Capacitor' in window)) return
        const { Capacitor } = await import('@capacitor/core')
        // Solo iOS: en Android, `register()` cierra la app si no hay Firebase, y
        // la app de Android (PEN-14662) todavía no existe.
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return

        const { PushNotifications } = await import('@capacitor/push-notifications')
        if (cancelado) return

        // El oyente antes de `register()`: el token llega por aquí, y si se
        // registra primero, se pierde.
        guardar(
          await PushNotifications.addListener('registration', ({ value }) => {
            void registrarDispositivo(value, 'ios').catch(() => {})
          })
        )
        guardar(
          await PushNotifications.addListener('registrationError', (error) => {
            console.warn('No se pudo registrar el teléfono para avisos:', error)
          })
        )
        if (cancelado) return

        let permiso = await PushNotifications.checkPermissions()
        if (permiso.receive === 'prompt' || permiso.receive === 'prompt-with-rationale') {
          permiso = await PushNotifications.requestPermissions()
        }
        if (permiso.receive !== 'granted' || cancelado) return

        await PushNotifications.register()
      } catch (error) {
        // Sin avisos se sigue usando el canal: nada de esto puede romper la página.
        console.warn('Los avisos del teléfono no se pudieron preparar:', error)
      }
    }, PAUSA_MS)

    return () => {
      cancelado = true
      clearTimeout(reloj)
      for (const manija of manijas) void manija.remove()
    }
  }, [])

  return null
}
