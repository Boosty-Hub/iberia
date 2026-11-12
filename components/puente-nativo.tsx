'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Manija = { remove: () => Promise<void> }

/**
 * Lo que llega a la app desde afuera y la mueve de página: un aviso tocado y un
 * enlace del sitio abierto en el teléfono (Universal Links en iOS, App Links en
 * Android), y en Android el botón de «atrás». Solo hace algo dentro de la app;
 * en un navegador no carga ni el plugin.
 *
 * Va en el layout raíz y no en el del canal porque las dos cosas pueden llegar
 * **sin sesión**: el enlace personal de WhatsApp (`/entrar/<token>`) es justo la
 * forma de entrar de quien no tiene clave, y con la app cerrada arranca en
 * `/canal`, que sin sesión manda al login. Si esto viviera en el canal, nadie lo
 * oiría. Capacitor guarda los dos eventos hasta que alguien los escucha, así que
 * el toque que abrió la app en frío se atiende al montar.
 *
 * **Solo se navega dentro del mismo sitio.** Lo que traiga otro origen se
 * ignora: la WebView no sale del dominio de Iberia por un enlace.
 */
export function PuenteNativo() {
  const router = useRouter()

  useEffect(() => {
    let cancelado = false
    const manijas: Manija[] = []
    const guardar = (manija: Manija) => {
      if (cancelado) void manija.remove()
      else manijas.push(manija)
    }

    const ir = (ruta: string | null) => {
      if (!ruta) return
      // `/entrar` pone la cookie de sesión y redirige: tiene que ser una petición
      // de verdad, no una navegación del router.
      if (ruta === '/entrar' || ruta.startsWith('/entrar/')) window.location.assign(ruta)
      else router.push(ruta)
    }

    // Quita el arranque nativo, que se queda hasta que la página pinta. Va aparte
    // de los oyentes: si ellos fallan, el arranque se quita igual.
    void (async () => {
      try {
        if (!('Capacitor' in window)) return
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        // Dos cuadros después del montaje: ya hay una pintura de la página.
        await new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo())))
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide({ fadeOutDuration: 250 })
      } catch (error) {
        console.warn('La app no pudo quitar el arranque:', error)
      }
    })()

    void (async () => {
      try {
        // La app inyecta su puente antes que la página: sin él es un navegador,
        // y no se baja ni el código de Capacitor.
        if (!('Capacitor' in window)) return
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        const [{ App }, { PushNotifications }] = await Promise.all([
          import('@capacitor/app'),
          import('@capacitor/push-notifications'),
        ])
        if (cancelado) return

        // Un enlace del sitio abierto desde WhatsApp, el correo o Safari.
        guardar(await App.addListener('appUrlOpen', ({ url }) => ir(rutaPropia(url))))

        // El botón o el gesto de «atrás» de Android. Sin oyente, Capacitor solo
        // retrocede la WebView y, en la primera página, no hace nada: el botón
        // quedaba muerto. Con oyente: primero cierra la hoja o el menú abierto
        // (`<dialog>`), si no retrocede en el historial, y en la primera página
        // manda la app al fondo —como cualquier app de Android— sin cerrarla, para
        // no perder lo que estaba en pantalla.
        if (Capacitor.getPlatform() === 'android') {
          guardar(
            await App.addListener('backButton', ({ canGoBack }) => {
              const abiertos = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
              const ultimo = abiertos[abiertos.length - 1]
              if (ultimo) ultimo.close()
              else if (canGoBack) window.history.back()
              else void App.minimizeApp()
            })
          )
        }

        // Un aviso tocado: `ruta` la pone `lib/notificaciones.ts`.
        guardar(
          await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) =>
            ir(rutaPropia((notification.data as { ruta?: unknown } | undefined)?.ruta))
          )
        )
      } catch (error) {
        console.warn('La app no pudo preparar los enlaces y los avisos:', error)
      }
    })()

    return () => {
      cancelado = true
      for (const manija of manijas) void manija.remove()
    }
  }, [router])

  return null
}

/** La ruta del mismo sitio —camino y consulta— a la que lleva una dirección, o null. */
function rutaPropia(direccion: unknown): string | null {
  if (typeof direccion !== 'string' || !direccion) return null
  try {
    const url = new URL(direccion, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}
