import 'server-only'
import { graph, tokenDeAcceso } from '@/lib/asistente/microsoft'

/**
 * La agenda de Microsoft 365 de la persona en la plataforma (27-nov-2026, pedido de Gabriel): sus reuniones de Outlook
 * y sus tareas de Microsoft To Do, junto a las tareas de la plataforma (Mi día, Agenda, Tareas).
 *
 *  - **Se lee en vivo, no se copia**: cada pantalla le pregunta a Microsoft con el token DELEGADO de la persona. Lo que
 *    cambia en Outlook se ve cambiado; nada de su calendario queda guardado en la base.
 *  - **Solo lectura**: para cambiar una reunión o una tarea, se abre en Outlook o en To Do.
 *  - To Do necesita el permiso `Tasks.Read`, que la app de Iberia en Entra no pedía: no se pide en el inicio de sesión
 *    (pedir un permiso sin consentir rompería la conexión de todos), se mira en el token (`scp`). Si Tecnología lo
 *    agrega y le da el consentimiento, aparece solo, sin reconectar.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>

export type EventoMicrosoft = {
  id: string
  asunto: string
  /** Hora de Caracas, `AAAA-MM-DDTHH:mm`. */
  inicio: string
  fin: string
  todoElDia: boolean
  lugar: string | null
  enLinea: boolean
  enlace: string | null
  organizador: string | null
  cancelado: boolean
}

export type TareaMicrosoft = { id: string; titulo: string; lista: string; vence: string | null; importante: boolean; enlace: string }

const permisos = (token: string): string[] => {
  try {
    return String(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).scp ?? '').split(' ')
  } catch {
    return []
  }
}

const hora = (s: unknown) => String(s ?? '').slice(0, 16)

/** Las reuniones entre dos fechas (`AAAA-MM-DD`, la segunda sin incluir), en hora de Caracas. */
export async function eventosMicrosoft(perfilId: string, desde: string, hasta: string): Promise<{ ok: true; eventos: EventoMicrosoft[] } | { ok: false; error: string; sinConexion?: boolean }> {
  const token = await tokenDeAcceso(perfilId)
  if (!token) return { ok: false, error: 'Tu cuenta de Microsoft no está conectada.', sinConexion: true }
  try {
    const eventos: EventoMicrosoft[] = []
    let ruta: string | null =
      `/me/calendarView?startDateTime=${encodeURIComponent(`${desde}T00:00:00-04:00`)}&endDateTime=${encodeURIComponent(`${hasta}T00:00:00-04:00`)}` +
      '&$top=100&$orderby=start/dateTime&$select=id,subject,start,end,isAllDay,location,isOnlineMeeting,onlineMeeting,webLink,organizer,isCancelled,showAs'
    for (let vuelta = 0; ruta && vuelta < 3; vuelta++) {
      const datos = (await (await graph(token, ruta, { prefer: 'outlook.timezone="Venezuela Standard Time"' })).json()) as J
      for (const e of (datos.value ?? []) as J[]) {
        if (e.showAs === 'free' && e.isAllDay) continue // feriados y avisos de «libre» de día completo: ruido
        eventos.push({
          id: String(e.id),
          asunto: String(e.subject || '(Sin asunto)').slice(0, 200),
          inicio: hora(e.start?.dateTime),
          fin: hora(e.end?.dateTime),
          todoElDia: !!e.isAllDay,
          lugar: e.location?.displayName ? String(e.location.displayName).slice(0, 120) : null,
          enLinea: !!e.isOnlineMeeting,
          enlace: typeof e.webLink === 'string' ? e.webLink : null,
          organizador: e.organizer?.emailAddress?.name ?? null,
          cancelado: !!e.isCancelled,
        })
      }
      const sig: unknown = datos['@odata.nextLink']
      ruta = typeof sig === 'string' ? sig.replace(/^https:\/\/graph\.microsoft\.com\/v1\.0/, '') : null
    }
    return { ok: true, eventos }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer tu calendario de Microsoft.' }
  }
}

/** Las tareas abiertas de Microsoft To Do (todas sus listas, hasta 10 listas y 50 por lista). */
export async function tareasMicrosoft(perfilId: string): Promise<{ ok: true; tareas: TareaMicrosoft[] } | { ok: false; error: string; sinConexion?: boolean; sinPermiso?: boolean }> {
  const token = await tokenDeAcceso(perfilId)
  if (!token) return { ok: false, error: 'Tu cuenta de Microsoft no está conectada.', sinConexion: true }
  const scp = permisos(token)
  if (!scp.includes('Tasks.Read') && !scp.includes('Tasks.ReadWrite'))
    return { ok: false, error: 'Para ver tus tareas de Microsoft To Do, Tecnología tiene que habilitar el permiso «Tasks.Read» en la aplicación de Microsoft.', sinPermiso: true }
  try {
    const listas = (((await (await graph(token, '/me/todo/lists?$select=id,displayName')).json()) as J).value ?? []) as J[]
    const porLista = await Promise.all(
      listas.slice(0, 10).map(async (l) => {
        const datos = (await (await graph(token, `/me/todo/lists/${encodeURIComponent(l.id)}/tasks?$filter=${encodeURIComponent("status ne 'completed'")}&$top=50&$select=id,title,dueDateTime,importance,status`)).json()) as J
        return ((datos.value ?? []) as J[]).map((t) => ({
          id: String(t.id),
          titulo: String(t.title || '(Sin título)').slice(0, 200),
          lista: String(l.displayName ?? 'Tareas'),
          vence: t.dueDateTime?.dateTime ? String(t.dueDateTime.dateTime).slice(0, 10) : null,
          importante: t.importance === 'high',
          enlace: `https://to-do.office.com/tasks/id/${encodeURIComponent(String(t.id))}/details`,
        }))
      })
    )
    const tareas = porLista.flat().sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999'))
    return { ok: true, tareas }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudieron leer tus tareas de Microsoft To Do.' }
  }
}
