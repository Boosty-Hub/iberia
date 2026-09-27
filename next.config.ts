import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
