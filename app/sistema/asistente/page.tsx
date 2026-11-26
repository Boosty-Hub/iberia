import type { Metadata } from 'next'
import { PaginaChat } from '@/components/sistema/asistente/pagina-chat'

export const metadata: Metadata = { title: 'Asistente de IA · Plataforma Iberia' }

/** El asistente de IA de cada quien (plan del 26-nov-2026): un chat nuevo, con la lista de los anteriores. */
export default function AsistentePage() {
  return <PaginaChat chatId={null} />
}
