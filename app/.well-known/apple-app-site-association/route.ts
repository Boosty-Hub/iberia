/**
 * El archivo con el que iOS decide qué enlaces del sitio abren la app de Iberia
 * en vez de Safari (Universal Links).
 *
 * Apple lo baja desde su CDN al instalar la app y cada tanto, y es estricto:
 * **200, JSON y sin redirecciones**. Por eso es pública en `lib/supabase/sesion.ts`
 * —sin ella, el proxy mandaría a Apple al login— y no se sirve desde `public/`,
 * donde saldría sin `Content-Type` de JSON por no tener extensión.
 *
 * Abren la app:
 * - **`/entrar/*`**, el enlace personal de WhatsApp: así la sesión que acuña
 *   `/entrar/[token]` queda en la WebView de la app y no en Safari. Quien no
 *   tiene la app lo sigue abriendo en Safari, igual que antes.
 * - **`/canal` y `/canal/*`**: el enlace del curso de los recordatorios y
 *   cualquier enlace al canal.
 *
 * El otro lado está en `ios/App/App/App.entitlements`
 * (`applinks:iberiavenezuela.netlify.app`) y en `PuenteNativo`, que navega la
 * WebView a la ruta. Cambiar el dominio es cambiar los dos y publicar otra
 * versión de la app.
 */

const APP = '45TRWF6998.com.industriasiberia.canal'

const ASOCIACION = {
  applinks: {
    details: [
      {
        appIDs: [APP],
        components: [
          { '/': '/entrar/*', comment: 'El enlace personal: entra en la app con la sesión' },
          { '/': '/canal', comment: 'El canal' },
          { '/': '/canal/*', comment: 'El canal y el curso de Ajito' },
        ],
      },
    ],
  },
}

export function GET() {
  return Response.json(ASOCIACION, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
