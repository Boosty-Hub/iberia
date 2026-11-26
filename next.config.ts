import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Un id por despliegue (26-nov-2026): una pestaña abierta antes de publicar tenía el código viejo y al tocar algo daba
  // «Server Action … was not found on the server» (409). Con el id, Next detecta que el servidor es de otro despliegue y
  // recarga la página entera en vez de fallar. Netlify pone `DEPLOY_ID` al construir; en local no hay y no cambia nada.
  deploymentId: process.env.DEPLOY_ID || undefined,
  // El indicador flotante de desarrollo se sitúa abajo a la izquierda, justo
  // encima del pie de la barra lateral, y lo tapa.
  devIndicators: false,
  // El certificado en imagen (`lib/certificado-imagen.tsx`) lee del disco la
  // letra y los logos. En Netlify la función no ve `public/` ni `assets/` si no
  // se le mete: sin esto, en producción no habría certificado que guardar.
  outputFileTracingIncludes: {
    '/canal/**': [
      './assets/fuentes/*.woff',
      './public/marca/iberia.png',
      './public/marca/ajito.png',
    ],
  },
  experimental: {
    serverActions: {
      // La importación de Fireflies manda la transcripción ya interpretada como
      // argumento de una server action. Una entrevista larga (hasta 5000 turnos)
      // roza el límite de 1 MB por defecto.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
