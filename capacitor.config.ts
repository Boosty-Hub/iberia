import type { CapacitorConfig } from '@capacitor/cli'

/**
 * La app nativa —iOS y Android— es una cáscara: carga el sitio en línea, así que
 * un cambio de la web llega a los teléfonos sin publicar otra versión en la
 * tienda. Se compila solo desde GitHub Actions (`.github/workflows/ios.yml` y
 * `.github/workflows/android.yml`).
 */
const config: CapacitorConfig = {
  appId: 'com.industriasiberia.canal',
  appName: 'Iberia',

  // Next no exporta estático y la app no lo necesita: la carpeta solo existe
  // porque Capacitor exige una para copiar al proyecto nativo.
  webDir: 'movil/www',

  // Abre en el canal, que sin sesión manda al login: nunca una página de
  // presentación, que es la causa de rechazo 4.2 de la App Store. Si el dominio
  // cambia, cambia aquí y hay que publicar otra versión de la app.
  //
  // `allowNavigation` no es opcional: Capacitor solo da por propias las direcciones
  // que empiezan por `url`, con su `/canal`, y todo lo demás —el login, `/entrar`—
  // lo abre en Safari.
  server: {
    url: 'https://iberiavenezuela.netlify.app/canal',
    allowNavigation: ['iberiavenezuela.netlify.app'],
    cleartext: false,
  },

  // Marca fija para el código web que necesite saber que corre dentro de la app:
  // el iPad se presenta como un Mac, así que el agente de usuario solo no basta.
  appendUserAgent: 'IberiaApp',

  // Fondo del canal. Sin esto la WebView se pinta con el color del sistema, que en
  // modo oscuro es negro, mientras baja la página remota.
  backgroundColor: '#f6f7f9',

  plugins: {
    // El arranque se queda hasta que la página pinta: lo quita `PuenteNativo`
    // con `SplashScreen.hide()`. `launchShowDuration` es solo el tope de
    // seguridad: si la página nunca llega —sin red, servidor caído—, el plugin lo
    // quita a los 10 s. Un `hide()` antes lo quita en el acto y el tope ya no hace
    // nada. OJO: `launchShowDuration: 0` NO lo apaga, hace que ni se muestre.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 10000,
      backgroundColor: '#f6f7f9',
      showSpinner: false,
    },
    // Solo lo lee Android. La página declara `viewport-fit=cover` (app/layout.tsx):
    // decírselo de entrada evita que la WebView salte al detectarlo. Con WebView
    // 140 o más, la página llega hasta los bordes y `env(safe-area-inset-*)` trae
    // la medida real, que es lo que ya respetan las `--seguro-*` de globals.css;
    // con una más vieja, Capacitor aparta la WebView de las barras y `env()` da 0.
    // El color de los iconos (oscuros sobre el fondo claro) no va aquí: `style`
    // también lo lee iOS. Lo fija `MainActivity` en Android.
    SystemBars: {
      initialViewportFitValueHint: 'cover',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
