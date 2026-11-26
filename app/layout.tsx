import type { Metadata, Viewport } from 'next'
import { DM_Sans, Geist_Mono } from 'next/font/google'
import { PuenteNativo } from '@/components/puente-nativo'
import { AvisoVersionNueva } from '@/components/aviso-version-nueva'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/**
 * Tipografía de todo el aplicativo. Entró por el canal y se quedó: el panel y
 * el informe se leen como el mismo producto.
 *
 * next/font la descarga en compilación y la sirve desde el propio dominio: no
 * depende de Google en tiempo de ejecución, que es lo que permite que cargue
 * con la conectividad de planta.
 */
const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'Programa de Adopción de IA · Industrias Iberia',
    template: '%s · Programa de IA Iberia',
  },
  description:
    'Levantamiento, diagnóstico y arquitectura de IA para Industrias Iberia. Boosty Digital.',
  // Material bajo NDA: no debe aparecer en buscadores.
  robots: { index: false, follow: false, nocache: true },
}

/**
 * `viewport-fit=cover` hace que la página llegue hasta los bordes físicos del
 * teléfono, bajo el notch y la barra de gestos. Sin él, `env(safe-area-inset-*)`
 * vale cero y la app de iOS (una WebView sin `contentInset`) pinta la cabecera
 * debajo de la hora y la navegación sobre la barra de gestos. Las zonas seguras
 * se respetan con las variables `--seguro-*` de globals.css.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/* Los avisos tocados y los enlaces que abren la app de iOS. Fuera de la
            app no hace nada. */}
        <PuenteNativo />
        <AvisoVersionNueva />
      </body>
    </html>
  )
}
