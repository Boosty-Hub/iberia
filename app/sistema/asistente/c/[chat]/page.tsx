import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PaginaChat } from '@/components/sistema/asistente/pagina-chat'

export const metadata: Metadata = { title: 'Asistente de IA · Plataforma Iberia' }

export default async function ChatPage({ params }: PageProps<'/sistema/asistente/c/[chat]'>) {
  const { chat } = await params
  if (!/^[0-9a-f-]{36}$/.test(chat)) notFound()
  return <PaginaChat chatId={chat} />
}
