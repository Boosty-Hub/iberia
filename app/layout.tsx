import type { Metadata } from 'next'
import { DM_Sans, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/**
 * Tipografía del canal de comunicación interna. next/font la descarga en
 * compilación y la sirve desde el propio dominio: no depende de Google en
 * tiempo de ejecución, que es lo que permite que cargue con la conectividad
 * de planta.
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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
