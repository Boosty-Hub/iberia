import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // El indicador flotante de desarrollo se sitúa abajo a la izquierda, justo
  // encima del pie de la barra lateral, y lo tapa.
  devIndicators: false,
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
