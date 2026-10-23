import type { CapacitorConfig } from '@capacitor/cli'

/**
 * La app nativa de iOS es una cáscara: carga el sitio en línea, así que un
 * cambio de la web llega a los teléfonos sin publicar otra versión en la App
 * Store. Se compila y se sube solo desde GitHub Actions (`.github/workflows/ios.yml`).
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
  server: {
    url: 'https://iberiavenezuela.netlify.app/canal',
    cleartext: false,
  },

  // Marca fija para el código web que necesite saber que corre dentro de la app:
  // el iPad se presenta como un Mac, así que el agente de usuario solo no basta.
  appendUserAgent: 'IberiaApp',

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
