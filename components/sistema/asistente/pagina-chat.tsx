import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { catalogoModelos, miPolitica } from '@/lib/asistente/servidor'
import { leerChat, leerChats } from '@/lib/asistente/datos'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { ChatAsistente } from '@/components/sistema/asistente/chat'

/** La pantalla del asistente: la lista de chats y el chat abierto (o uno nuevo). Todo se lee en una tanda. */
export async function PaginaChat({ chatId }: { chatId: string | null }) {
  const sesion = await requerirPermiso('sistema:asistente')
  const [politica, modelos, chats, abierto] = await Promise.all([miPolitica(), catalogoModelos(), leerChats(), chatId ? leerChat(chatId) : Promise.resolve(null)])
  if (chatId && !abierto) notFound()
  const nombre = (sesion.perfil.nombre_completo || sesion.email || '').split(' ')[0]

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" />
      <ChatAsistente
        key={chatId ?? 'nuevo'}
        yo={{ id: sesion.userId, nombre }}
        politica={politica}
        modelos={modelos}
        chats={chats}
        chatId={chatId}
        tituloInicial={abierto?.chat.titulo ?? null}
        mensajesIniciales={abierto?.mensajes ?? []}
        archivosIniciales={abierto?.archivos ?? []}
        turnoInicial={abierto?.turno ?? null}
        modeloDelChat={abierto?.chat.modelo ?? null}
        esfuerzoDelChat={abierto?.chat.esfuerzo ?? null}
      />
    </>
  )
}
