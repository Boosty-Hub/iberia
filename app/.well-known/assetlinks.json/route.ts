/**
 * El archivo con el que Android decide qué enlaces del sitio abren la app de
 * Iberia en vez del navegador (App Links). Es el par del de Apple
 * (`apple-app-site-association`).
 *
 * Android lo baja al instalar la app y lo verifica por su cuenta: **200, JSON y
 * sin redirecciones**. Por eso es pública en `lib/supabase/sesion.ts`, igual que
 * la de Apple: mandado al login, la verificación falla y los enlaces abren Chrome.
 *
 * Qué enlaces abren la app no se dice aquí sino en el `intent-filter` con
 * `autoVerify` de `android/app/src/main/AndroidManifest.xml`: `/entrar/*`,
 * `/canal` y `/canal/*`, los mismos del archivo de Apple. Aquí solo se dice qué
 * app es dueña del dominio: el paquete y las huellas de los certificados que la
 * firman.
 *
 * Las huellas son públicas —van dentro de cada APK—, no secretos.
 */

const PAQUETE = 'com.industriasiberia.canal'

/**
 * Las huellas SHA-256 de los certificados que firman la app.
 *
 * ⚠️ **Falta la de Google Play.** Con Play App Signing, lo que baja la gente lo
 * firma Google con su propia clave, no con la de subida. Después de la primera
 * subida, se copia de Play Console (Integridad de la app > Firma de apps >
 * «Certificado de la clave de firma de apps», SHA-256) y se agrega aquí. Sin ella,
 * los enlaces no abren la app instalada desde la tienda.
 */
const HUELLAS = [
  // La clave de subida (alias `iberia-subida`): firma lo que sale del flujo «App
  // de Android», así que vale para probar el AAB instalado a mano.
  '78:D8:FE:C7:4C:12:09:FD:88:FA:48:E6:48:90:3B:C8:DB:75:59:20:55:FB:D3:71:93:BA:F7:FF:E6:00:73:0E',
]

const ASOCIACION = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: PAQUETE,
      sha256_cert_fingerprints: HUELLAS,
    },
  },
]

export function GET() {
  return Response.json(ASOCIACION, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
