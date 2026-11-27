import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { borrarCopiaAnthropic } from '@/lib/archivos/servidor'
import { anotarConsulta } from '@/lib/asistente/fuentes'
import { graph, tokenDeAcceso } from '@/lib/asistente/microsoft'
import { MAX_BYTES_ARCHIVO } from '@/lib/asistente/tipos'

/**
 * Los archivos de Microsoft 365 en la plataforma (27-nov-2026, pedido de Gabriel: «cada vez que llame a un archivo,
 * que ya se quede en la plataforma»). Lo usan la pestaña Microsoft 365 del «/» del chat y la herramienta
 * `microsoft_archivos` (traer) del asistente.
 *
 *  - Todo va con el token DELEGADO de la persona: solo ve y trae lo que ella ve en Microsoft.
 *  - Lo traído queda en Mis archivos, carpeta «Microsoft 365» (raíz), como archivo suyo (`origen = 'microsoft'`, cuenta
 *    en su espacio). Volver a traerlo no duplica: con la misma fecha de modificación se usa la copia; si cambió, se
 *    reemplazan los bytes y se actualizan también los adjuntos de chats que apuntaban a ella.
 *  - Compartirlo desde Mis archivos pide confirmación (origen `microsoft`), como todo lo de Microsoft 365.
 */

export const CARPETA_MICROSOFT = 'Microsoft 365'
const ID_ITEM = /^[A-Za-z0-9!_.\-]{1,200}:[A-Za-z0-9!_.\-]{1,200}$/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>

export type ItemMicrosoft = {
  id: string
  nombre: string
  lugar: string
  modificado: string | null
  bytes: number | null
  /** Ya hay copia en Mis archivos (`'igual'`), o la hay pero cambió en Microsoft (`'cambio'`). */
  enPlataforma: 'igual' | 'cambio' | null
}

/** De dónde es, leído de la dirección: OneDrive personal, o el sitio de SharePoint (los archivos de Teams viven ahí). */
function lugarDe(webUrl: unknown, compartido: boolean): string {
  const u = String(webUrl ?? '')
  const sitio = /\/(?:sites|teams)\/([^/]+)/.exec(u)?.[1]
  if (sitio) {
    try {
      return `SharePoint · ${decodeURIComponent(sitio)}`
    } catch {
      return `SharePoint · ${sitio}`
    }
  }
  if (/-my\.sharepoint\.com\/personal\//.test(u)) return compartido ? 'Compartido conmigo' : 'OneDrive'
  return compartido ? 'Compartido conmigo' : 'Microsoft 365'
}

function aItem(r: J, compartido = false): Omit<ItemMicrosoft, 'enPlataforma'> | null {
  // En «recientes» y «compartidos», un archivo de otra unidad llega como `remoteItem`.
  const x = r.remoteItem ?? r
  if (x.folder || r.folder || r.package) return null
  const drive = x.parentReference?.driveId
  if (!drive || !x.id) return null
  return {
    id: `${drive}:${x.id}`,
    nombre: String(x.name ?? r.name ?? 'archivo').slice(0, 255),
    lugar: lugarDe(x.webUrl ?? r.webUrl, compartido || !!r.remoteItem),
    modificado: x.lastModifiedDateTime ?? r.lastModifiedDateTime ?? null,
    bytes: typeof (x.size ?? r.size) === 'number' ? Number(x.size ?? r.size) : null,
  }
}

const SIN_CONEXION = 'Tu cuenta de Microsoft no está conectada o se venció. Conéctala en Conexiones.'

/** Sin texto: recientes y compartidos conmigo. Con texto: busca en OneDrive, SharePoint y Teams. Solo archivos. */
export async function listarArchivosMicrosoft(perfilId: string, consulta: string): Promise<{ ok: true; items: ItemMicrosoft[] } | { ok: false; error: string; sinConexion?: boolean }> {
  const token = await tokenDeAcceso(perfilId)
  if (!token) return { ok: false, error: SIN_CONEXION, sinConexion: true }
  const q = consulta.replace(/\s+/g, ' ').trim().slice(0, 120)
  let items: Omit<ItemMicrosoft, 'enPlataforma'>[] = []
  try {
    if (q) {
      const datos = await (
        await graph(token, '/search/query', {
          method: 'POST',
          body: JSON.stringify({ requests: [{ entityTypes: ['driveItem'], query: { queryString: q }, from: 0, size: 25 }] }),
        })
      ).json()
      const hits = (datos.value?.[0]?.hitsContainers?.[0]?.hits ?? []) as { resource: J }[]
      items = hits.map((h) => aItem(h.resource)).filter((x): x is NonNullable<typeof x> => !!x)
    } else {
      const recientes = ((await (await graph(token, '/me/drive/recent?$top=25')).json()).value ?? []) as J[]
      items = recientes.map((r) => aItem(r)).filter((x): x is NonNullable<typeof x> => !!x)
      // «Compartidos conmigo» puede no estar disponible en todas las cuentas: si falla, quedan los recientes.
      try {
        const compartidos = ((await (await graph(token, '/me/drive/sharedWithMe?$top=15')).json()).value ?? []) as J[]
        items.push(...compartidos.map((r) => aItem(r, true)).filter((x): x is NonNullable<typeof x> => !!x))
      } catch {}
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo consultar Microsoft 365.' }
  }
  const vistos = new Set<string>()
  items = items.filter((i) => (vistos.has(i.id) ? false : (vistos.add(i.id), true))).slice(0, 30)

  const { data: copias } = items.length
    ? await createAdminClient()
        .schema('asistente')
        .from('archivo')
        .select('ms_item, ms_modificado')
        .eq('dueno', perfilId)
        .eq('origen', 'microsoft')
        .is('chat_id', null)
        .in(
          'ms_item',
          items.map((i) => i.id)
        )
    : { data: [] }
  const copia = new Map((copias ?? []).map((c) => [c.ms_item, c.ms_modificado]))
  return {
    ok: true,
    items: items.map((i) => ({
      ...i,
      enPlataforma: copia.has(i.id) ? (mismaFecha(copia.get(i.id) ?? null, i.modificado) ? 'igual' : 'cambio') : null,
    })),
  }
}

const mismaFecha = (a: string | null, b: string | null) => !!a && !!b && Date.parse(a) === Date.parse(b)

function nombreObjeto(n: string): string {
  return (
    n
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f#%{}^~[\]`]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'archivo'
  )
}

/** La carpeta «Microsoft 365» de la persona, en la raíz de Mis archivos. La crea si no está. */
async function carpetaMicrosoft(perfilId: string): Promise<string> {
  const db = createAdminClient().schema('asistente')
  const buscar = async () => (await db.from('carpeta').select('id').eq('dueno', perfilId).is('padre_id', null).ilike('nombre', CARPETA_MICROSOFT).maybeSingle()).data?.id ?? null
  const hay = await buscar()
  if (hay) return hay
  const id = crypto.randomUUID()
  const { error } = await db.from('carpeta').insert({ id, dueno: perfilId, padre_id: null, nombre: CARPETA_MICROSOFT })
  if (!error) return id
  const otra = await buscar() // la creó otra petición al mismo tiempo
  if (otra) return otra
  throw new Error('No se pudo crear la carpeta «Microsoft 365».')
}

export type ArchivoGuardado = { id: string; nombre: string; mime: string; bytes: number; bucket: string; ruta: string }

/**
 * Trae un archivo de Microsoft 365 a Mis archivos (carpeta «Microsoft 365») a nombre de la persona y devuelve la fila.
 * Si ya estaba y no cambió, devuelve la misma sin bajar nada; si cambió, reemplaza los bytes.
 */
export async function guardarDeMicrosoft(
  perfilId: string,
  itemId: string,
  turno: string | null = null
): Promise<{ ok: true; archivo: ArchivoGuardado; como: 'nuevo' | 'igual' | 'actualizado' } | { ok: false; error: string; sinConexion?: boolean }> {
  if (!ID_ITEM.test(itemId)) return { ok: false, error: 'El id del archivo viene de buscar (unidad:elemento).' }
  const token = await tokenDeAcceso(perfilId)
  if (!token) return { ok: false, error: SIN_CONEXION, sinConexion: true }
  const [drive, item] = itemId.split(':')
  const base = `/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(item)}`
  const admin = createAdminClient()
  const db = admin.schema('asistente')
  try {
    const meta = (await (await graph(token, `${base}?$select=id,name,size,file,folder,package,webUrl,lastModifiedDateTime`)).json()) as J
    if (meta.folder || meta.package || !meta.file) return { ok: false, error: 'Eso es una carpeta: elige un archivo.' }
    const bytesMeta = Number(meta.size) || 0
    if (bytesMeta > MAX_BYTES_ARCHIVO) return { ok: false, error: 'El archivo pasa de 100 MB.' }

    const { data: previa } = await db
      .from('archivo')
      .select('id, nombre, mime, bytes, bucket, ruta, ms_modificado, anthropic_file_id, estado')
      .eq('dueno', perfilId)
      .eq('origen', 'microsoft')
      .is('chat_id', null)
      .eq('ms_item', itemId)
      .maybeSingle()
    if (previa && previa.estado === 'listo' && mismaFecha(previa.ms_modificado, meta.lastModifiedDateTime)) {
      await anotarConsulta(perfilId, turno, 'm365:archivos', { accion: 'traer', id: itemId, copia: 'igual' }, 1)
      return { ok: true, archivo: { id: previa.id, nombre: previa.nombre, mime: previa.mime, bytes: Number(previa.bytes), bucket: previa.bucket, ruta: previa.ruta }, como: 'igual' }
    }

    // El espacio: cuenta lo que crece (una copia que se actualiza ya ocupaba lo suyo).
    const { data: pol } = await db.rpc('politica_de', { p_perfil: perfilId })
    const p = (pol ?? {}) as { usado_bytes?: number; cuota_mb?: number }
    const crece = bytesMeta - (previa ? Number(previa.bytes) : 0)
    if (p.cuota_mb && crece > 0 && Number(p.usado_bytes ?? 0) + crece > p.cuota_mb * 1024 * 1024) {
      return { ok: false, error: `No te alcanza el espacio: usas ${Math.round(Number(p.usado_bytes ?? 0) / 1048576)} MB de ${p.cuota_mb} MB. Borra archivos que ya no uses en Mis archivos.` }
    }

    const contenido = Buffer.from(await (await graph(token, `${base}/content`)).arrayBuffer())
    if (contenido.length > MAX_BYTES_ARCHIVO) return { ok: false, error: 'El archivo pasa de 100 MB.' }
    const nombre = nombreObjeto(String(meta.name ?? 'archivo'))
    const mime = String(meta.file?.mimeType ?? 'application/octet-stream')
    const ruta = `${perfilId}/microsoft/${crypto.randomUUID()}-${nombre}`
    const { error: eSubir } = await admin.storage.from('asistente').upload(ruta, contenido, { contentType: mime, upsert: false })
    if (eSubir) return { ok: false, error: 'No se pudo guardar el archivo en la plataforma.' }

    const datos = {
      nombre,
      mime,
      bytes: contenido.length,
      ruta,
      estado: 'listo',
      ms_modificado: meta.lastModifiedDateTime ?? null,
      ms_enlace: typeof meta.webUrl === 'string' ? meta.webUrl.slice(0, 2000) : null,
      anthropic_file_id: null,
      anthropic_usado_en: null,
    }
    let id: string
    let como: 'nuevo' | 'actualizado'
    if (previa) {
      id = previa.id
      como = 'actualizado'
      const { error } = await db.from('archivo').update(datos).eq('id', previa.id)
      if (error) {
        await admin.storage.from('asistente').remove([ruta])
        return { ok: false, error: 'No se pudo actualizar la copia.' }
      }
      // Los adjuntos de chats que apuntaban a la copia vieja pasan a la nueva (los bytes viejos se borran).
      await db.from('archivo').update({ ruta, bytes: contenido.length, mime, nombre, anthropic_file_id: null, anthropic_usado_en: null }).eq('origen', 'biblioteca').eq('fuente_id', previa.id)
      await admin.storage.from('asistente').remove([previa.ruta])
      await borrarCopiaAnthropic(previa.anthropic_file_id)
    } else {
      id = crypto.randomUUID()
      como = 'nuevo'
      const carpeta = await carpetaMicrosoft(perfilId)
      const { error } = await db.from('archivo').insert({ id, dueno: perfilId, origen: 'microsoft', bucket: 'asistente', carpeta_id: carpeta, ms_item: itemId, ...datos })
      if (error) {
        await admin.storage.from('asistente').remove([ruta])
        // Otra petición la guardó al mismo tiempo: se usa esa.
        const { data: ganadora } = await db.from('archivo').select('id, nombre, mime, bytes, bucket, ruta').eq('dueno', perfilId).eq('origen', 'microsoft').is('chat_id', null).eq('ms_item', itemId).maybeSingle()
        if (ganadora) return { ok: true, archivo: { ...ganadora, bytes: Number(ganadora.bytes) }, como: 'igual' }
        return { ok: false, error: 'No se pudo guardar el archivo en la plataforma.' }
      }
    }
    await anotarConsulta(perfilId, turno, 'm365:archivos', { accion: 'traer', id: itemId, copia: como }, 1)
    return { ok: true, archivo: { id, nombre, mime, bytes: contenido.length, bucket: 'asistente', ruta }, como }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo traer el archivo de Microsoft 365.' }
  }
}
