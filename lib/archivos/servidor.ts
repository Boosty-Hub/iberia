import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Mis archivos (26-nov-2026): lo que leen las páginas del módulo. Todo con la sesión de quien mira: la RLS de
 * `asistente.carpeta` y `asistente.archivo` deja lo propio y lo que le compartieron (también por una carpeta de
 * más arriba).
 */

/** Los orígenes que son dueños de su objeto en Storage: borrarlos se lleva los bytes. */
export const ORIGEN_PROPIO = ['subido', 'generado', 'microsoft']

/** Borra la copia de un archivo en la Files API de Anthropic, si la tiene. Nunca lanza. */
export async function borrarCopiaAnthropic(fileId: string | null): Promise<void> {
  if (!fileId) return
  try {
    const { crearAnthropic, BETA_ARCHIVOS } = await import('@/lib/asistente/motor/servicio')
    await crearAnthropic().beta.files.delete(fileId, { betas: [...BETA_ARCHIVOS] })
  } catch {
    // La copia caduca sola; no tumba el borrado.
  }
}

export type Carpeta = { id: string; nombre: string; padre_id: string | null; dueno: string; creado_en: string }
export type ArchivoBiblioteca = {
  id: string
  nombre: string
  mime: string
  bytes: number
  origen: string
  bucket: string
  aviso: string | null
  dueno: string
  carpeta_id: string | null
  creado_en: string
}
const COLUMNAS_ARCHIVO = 'id, nombre, mime, bytes, origen, bucket, aviso, dueno, carpeta_id, creado_en'

/** Una carpeta (o la raíz con `null`): sus subcarpetas, sus archivos y la ruta de migas hasta ella. */
export async function contenidoDe(carpetaId: string | null, userId: string) {
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  let carpeta: Carpeta | null = null
  if (carpetaId) {
    const { data } = await db.from('carpeta').select('id, nombre, padre_id, dueno, creado_en').eq('id', carpetaId).maybeSingle()
    if (!data) return null
    carpeta = data
  }
  // En la raíz: las carpetas propias de arriba y los archivos sueltos (no los de un chat ni de un proyecto).
  const subcarpetas = carpetaId
    ? db.from('carpeta').select('id, nombre, padre_id, dueno, creado_en').eq('padre_id', carpetaId)
    : db.from('carpeta').select('id, nombre, padre_id, dueno, creado_en').is('padre_id', null).eq('dueno', userId)
  const archivos = (desde: number) =>
    (carpetaId
      ? db.from('archivo').select(COLUMNAS_ARCHIVO).eq('carpeta_id', carpetaId)
      : db.from('archivo').select(COLUMNAS_ARCHIVO).is('carpeta_id', null).is('chat_id', null).is('proyecto_id', null).eq('dueno', userId)
    )
      .eq('estado', 'listo')
      .order('nombre')
      .range(desde, desde + 999)
  const [{ data: cs }, archivosTodos] = await Promise.all([subcarpetas.order('nombre').limit(1000), paginar(archivos)])
  // Las migas: subir por el árbol mientras se pueda leer (en lo compartido, hasta la carpeta compartida).
  const migas: { id: string; nombre: string }[] = []
  let cursor = carpeta
  for (let i = 0; cursor && i < 30; i++) {
    migas.unshift({ id: cursor.id, nombre: cursor.nombre })
    if (!cursor.padre_id) break
    const { data } = await db.from('carpeta').select('id, nombre, padre_id, dueno, creado_en').eq('id', cursor.padre_id).maybeSingle()
    cursor = data
  }
  return {
    carpeta,
    migas,
    // Desde la raíz de quien la compartió se entra por «Compartido conmigo»: la primera miga dice de dónde viene.
    esPropia: !carpeta || carpeta.dueno === userId,
    carpetas: (cs ?? []) as Carpeta[],
    archivos: archivosTodos.filter((a) => a.origen !== 'biblioteca'),
  }
}

/** Supabase corta en 1.000 filas: una carpeta grande se pide por páginas. */
async function paginar(pagina: (desde: number) => PromiseLike<{ data: unknown[] | null }>): Promise<ArchivoBiblioteca[]> {
  const todas: ArchivoBiblioteca[] = []
  for (let desde = 0; desde < 20_000; desde += 1000) {
    const { data } = await pagina(desde)
    const filas = (data ?? []) as ArchivoBiblioteca[]
    todas.push(...filas)
    if (filas.length < 1000) break
  }
  return todas
}

/** Lo que otros me compartieron: carpetas y archivos sueltos, con quién y cuándo. */
export async function compartidoConmigo(userId: string) {
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const { data: filas } = await db.from('compartido').select('id, tipo, objeto_id, por, creado_en').eq('con', userId).in('tipo', ['carpeta', 'archivo']).order('creado_en', { ascending: false })
  const idsC = (filas ?? []).filter((f) => f.tipo === 'carpeta').map((f) => f.objeto_id)
  const idsA = (filas ?? []).filter((f) => f.tipo === 'archivo').map((f) => f.objeto_id)
  const [{ data: carpetas }, { data: archivos }, { data: nombres }] = await Promise.all([
    idsC.length ? db.from('carpeta').select('id, nombre, padre_id, dueno, creado_en').in('id', idsC) : Promise.resolve({ data: [] as Carpeta[] }),
    idsA.length ? db.from('archivo').select(COLUMNAS_ARCHIVO).in('id', idsA) : Promise.resolve({ data: [] as ArchivoBiblioteca[] }),
    supabase.schema('asistente').rpc('personas_con_archivos'),
  ])
  const nombre = new Map(((nombres ?? []) as { perfil_id: string; nombre: string }[]).map((p) => [p.perfil_id, p.nombre]))
  const por = new Map((filas ?? []).map((f) => [f.objeto_id, { por: f.por, desde: f.creado_en }]))
  return {
    carpetas: ((carpetas ?? []) as Carpeta[]).map((c) => ({ ...c, de: nombre.get(por.get(c.id)?.por ?? '') ?? 'Otra persona', desde: por.get(c.id)?.desde ?? c.creado_en })),
    archivos: ((archivos ?? []) as ArchivoBiblioteca[]).map((a) => ({ ...a, de: nombre.get(por.get(a.id)?.por ?? '') ?? 'Otra persona', desde: por.get(a.id)?.desde ?? a.creado_en })),
  }
}

/** Con quién compartí algo mío (para la hoja de compartir). */
export async function compartidosDe(objetoId: string) {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('compartido').select('id, con, creado_en').eq('objeto_id', objetoId)
  return data ?? []
}

/** Todas mis carpetas (para «Mover a…»). */
export async function misCarpetas(userId: string): Promise<Carpeta[]> {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('carpeta').select('id, nombre, padre_id, dueno, creado_en').eq('dueno', userId).order('nombre').limit(5000)
  return (data ?? []) as Carpeta[]
}
