import type { Metadata } from 'next'
import { PaginaChat } from '@/components/sistema/asistente/pagina-chat'

export const metadata: Metadata = { title: 'Asistente de IA · Plataforma Iberia' }

/** El asistente de IA de cada quien (plan del 26-nov-2026): un chat nuevo, con la lista de los anteriores. */
export default async function AsistentePage({ searchParams }: PageProps<'/sistema/asistente'>) {
  const sp = await searchParams
  const proyecto = typeof sp.proyecto === 'string' && /^[0-9a-f-]{36}$/.test(sp.proyecto) ? sp.proyecto : null
  return <PaginaChat chatId={null} proyectoId={proyecto} />
}
