import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { catalogoModelos, miPolitica } from '@/lib/asistente/servidor'
import { leerChat, leerChats } from '@/lib/asistente/datos'
import { createClient } from '@/lib/supabase/server'
import { catalogoFuentes } from '@/lib/asistente/fuentes'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { ChatAsistente } from '@/components/sistema/asistente/chat'

/** La pantalla del asistente: la lista de chats y el chat abierto (o uno nuevo). Todo se lee en una tanda. */
export async function PaginaChat({ chatId, proyectoId = null }: { chatId: string | null; proyectoId?: string | null }) {
  const sesion = await requerirPermiso('sistema:asistente')
  const [politica, modelos, chats, abierto] = await Promise.all([miPolitica(), catalogoModelos(), leerChats(), chatId ? leerChat(chatId) : Promise.resolve(null)])
  if (chatId && !abierto) notFound()
  const supabase = await createClient()
  const idProyecto = abierto?.chat.proyecto_id ?? proyectoId
  const [{ data: atajos }, { data: proyecto }, { data: participantes }, { data: fuentesChat }] = await Promise.all([
    supabase.schema('asistente').from('atajo').select('id, comando, titulo, instruccion, modelo, esfuerzo, dueno').order('comando'),
    idProyecto ? supabase.schema('asistente').from('proyecto').select('id, nombre').eq('id', idProyecto).maybeSingle() : Promise.resolve({ data: null }),
    chatId ? supabase.schema('asistente').rpc('participantes', { p_chat: chatId }) : Promise.resolve({ data: [] }),
    chatId ? supabase.schema('asistente').rpc('fuentes_del_chat', { p_chat: chatId }) : Promise.resolve({ data: [] }),
  ])
  const titulos = new Map(catalogoFuentes().map((f) => [f.clave, f.titulo]))
  const nombre = (sesion.perfil.nombre_completo || sesion.email || '').split(' ')[0]

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" />
      <ChatAsistente
        key={chatId ?? `nuevo-${proyectoId ?? ''}`}
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
        proyecto={proyecto ? { id: proyecto.id, nombre: proyecto.nombre } : null}
        compartido={abierto?.chat.compartido ?? false}
        esDueno={!abierto || abierto.chat.dueno === sesion.userId}
        participantes={(participantes ?? []) as { perfil_id: string; nombre: string; rol: string }[]}
        fuentesDelChat={((fuentesChat ?? []) as { fuente: string }[]).map((f) => titulos.get(f.fuente) ?? f.fuente)}
        atajos={(atajos ?? []).map((a) => ({ id: a.id, comando: a.comando, titulo: a.titulo, instruccion: a.instruccion, modelo: a.modelo, esfuerzo: a.esfuerzo, empresa: a.dueno === null }))}
      />
    </>
  )
}
