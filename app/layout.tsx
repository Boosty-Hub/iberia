import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
