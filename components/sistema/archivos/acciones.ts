'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { MAX_BYTES_ARCHIVO } from '@/lib/asistente/tipos'
import { fuentesDePersona } from '@/lib/asistente/alcance'
import { esMicrosoft } from '@/lib/asistente/fuentes'
import { borrarCopiaAnthropic, ORIGEN_PROPIO } from '@/lib/archivos/servidor'

/**
 * Mis archivos (26-nov-2026): las acciones del módulo y las que usa el chat del asistente para citar con «/».
 * La autorización es doble, como en todo: la casilla `sistema:archivos` aquí y la RLS de `asistente.carpeta` y
 * `asistente.archivo` en la base. Lo que la sesión no puede escribir (renombrar o mover un archivo, crear un adjunto
 * de la biblioteca) lo hace el servidor con la clave de servicio, después de comprobar con la sesión que es suyo o
 * que lo puede leer.
 */

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const RUTA = '/sistema/archivos'

function nombreValido(n: string): string | null {
  const limpio = n.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!limpio || limpio.length > 200 || /[\\/]/.test(limpio)) return null
  return limpio
}

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

async function carpetaPropia(id: string | null, userId: string): Promise<boolean> {
  if (!id) return true
  if (!UUID.test(id)) return false
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('carpeta').select('id').eq('id', id).eq('dueno', userId).maybeSingle()
  return !!data
}

// ── Carpetas ────────────────────────────────────────────────────────────────

export async function crearCarpeta(nombre: string, padreId: string | null): Promise<R<{ id: string }>> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  const n = nombreValido(nombre)
  if (!n) return { ok: false, error: 'El nombre no puede ir vacío ni llevar «/».' }
  if (!(await carpetaPropia(padreId, sesion.userId))) return { ok: false, error: 'Esa carpeta no es tuya.' }
  const supabase = await createClient()
  const id = crypto.randomUUID()
  const { error } = await supabase.schema('asistente').from('carpeta').insert({ id, dueno: sesion.userId, padre_id: padreId, nombre: n })
  if (error) return { ok: false, error: error.code === '23505' ? 'Ya hay una carpeta con ese nombre aquí.' : 'No se pudo crear la carpeta.' }
  revalidatePath(RUTA, 'layout')
  return { ok: true, id }
}

export async function renombrar(tipo: 'carpeta' | 'archivo', id: string, nombre: string): Promise<R> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  const n = nombreValido(nombre)
  if (!UUID.test(id) || !n) return { ok: false, error: 'El nombre no puede ir vacío ni llevar «/».' }
  const supabase = await createClient()
  if (tipo === 'carpeta') {
    const { data, error } = await supabase.schema('asistente').from('carpeta').update({ nombre: n }).eq('id', id).eq('dueno', sesion.userId).select('id')
    if (error) return { ok: false, error: error.code === '23505' ? 'Ya hay una carpeta con ese nombre aquí.' : 'No se pudo renombrar.' }
    if (!data?.length) return { ok: false, error: 'No es tuya.' }
  } else {
    const { data: a } = await supabase.schema('asistente').from('archivo').select('id').eq('id', id).eq('dueno', sesion.userId).maybeSingle()
    if (!a) return { ok: false, error: 'No es tuyo.' }
    const { error } = await createAdminClient().schema('asistente').from('archivo').update({ nombre: n }).eq('id', id)
    if (error) return { ok: false, error: 'No se pudo renombrar.' }
  }
  revalidatePath(RUTA, 'layout')
  return { ok: true }
}

export async function mover(tipo: 'carpeta' | 'archivo', id: string, destinoId: string | null): Promise<R> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  if (!(await carpetaPropia(destinoId, sesion.userId))) return { ok: false, error: 'La carpeta de destino no es tuya.' }
  const supabase = await createClient()
  if (tipo === 'carpeta') {
    if (destinoId === id) return { ok: false, error: 'No se puede mover una carpeta dentro de sí misma.' }
    const { data, error } = await supabase.schema('asistente').from('carpeta').update({ padre_id: destinoId }).eq('id', id).eq('dueno', sesion.userId).select('id')
    if (error) return { ok: false, error: error.code === '23505' ? 'En el destino ya hay una carpeta con ese nombre.' : (error.message.match(/No se puede[^.]*/)?.[0] ?? 'No se pudo mover.') }
    if (!data?.length) return { ok: false, error: 'No es tuya.' }
  } else {
    const { data: a } = await supabase.schema('asistente').from('archivo').select('id').eq('id', id).eq('dueno', sesion.userId).maybeSingle()
    if (!a) return { ok: false, error: 'No es tuyo.' }
    const { error } = await createAdminClient().schema('asistente').from('archivo').update({ carpeta_id: destinoId }).eq('id', id)
    if (error) return { ok: false, error: 'No se pudo mover.' }
  }
  revalidatePath(RUTA, 'layout')
  return { ok: true }
}

/**
 * Borra un archivo o una carpeta con todo lo de adentro. Lo que es dueño de su objeto (subido, generado, de
 * Microsoft) se lleva también los bytes de Storage y la copia en Anthropic; una referencia o un adjunto de la
 * biblioteca solo se quita de la carpeta: el original sigue donde estaba.
 */
export async function borrar(tipo: 'carpeta' | 'archivo', id: string): Promise<R> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const admin = createAdminClient()
  const db = admin.schema('asistente')
  let carpetas: string[] = []
  if (tipo === 'carpeta') {
    const { data: c } = await supabase.schema('asistente').from('carpeta').select('id').eq('id', id).eq('dueno', sesion.userId).maybeSingle()
    if (!c) return { ok: false, error: 'No es tuya.' }
    // El subárbol, por niveles.
    carpetas = [id]
    let nivel = [id]
    for (let i = 0; i < 40 && nivel.length; i++) {
      const { data: hijas } = await db.from('carpeta').select('id').in('padre_id', nivel)
      nivel = (hijas ?? []).map((h) => h.id)
      carpetas.push(...nivel)
    }
  }
  const consulta = db.from('archivo').select('id, ruta, bucket, origen, anthropic_file_id').eq('dueno', sesion.userId)
  const { data: archivos } = tipo === 'carpeta' ? await consulta.in('carpeta_id', carpetas) : await consulta.eq('id', id)
  if (tipo === 'archivo' && !archivos?.length) return { ok: false, error: 'No es tuyo.' }
  const propios = (archivos ?? []).filter((a) => ORIGEN_PROPIO.includes(a.origen))
  for (const a of propios) await borrarCopiaAnthropic(a.anthropic_file_id)
  for (let i = 0; i < propios.length; i += 100) await admin.storage.from('asistente').remove(propios.slice(i, i + 100).map((a) => a.ruta))
  const ids = (archivos ?? []).map((a) => a.id)
  for (let i = 0; i < ids.length; i += 200) await db.from('archivo').delete().in('id', ids.slice(i, i + 200))
  if (tipo === 'carpeta') {
    const { error } = await supabase.schema('asistente').from('carpeta').delete().eq('id', id).eq('dueno', sesion.userId)
    if (error) return { ok: false, error: 'No se pudo borrar la carpeta.' }
  }
  // Lo compartido de lo que ya no existe.
  await db.from('compartido').delete().in('objeto_id', [...ids, ...carpetas].slice(0, 1000))
  revalidatePath(RUTA, 'layout')
  return { ok: true }
}

// ── Subir ───────────────────────────────────────────────────────────────────

/** Anota la fila (subiendo) y devuelve la ruta: el navegador sube directo a Storage. */
export async function prepararSubida(entrada: { nombre: string; mime: string; bytes: number; carpetaId: string | null }): Promise<R<{ archivoId: string; ruta: string }>> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  if (!(entrada.bytes > 0)) return { ok: false, error: 'El archivo está vacío.' }
  if (entrada.bytes > MAX_BYTES_ARCHIVO) return { ok: false, error: 'El archivo pasa de 100 MB.' }
  if (!(await carpetaPropia(entrada.carpetaId, sesion.userId))) return { ok: false, error: 'Esa carpeta no es tuya.' }
  const { data: pol } = await createAdminClient().schema('asistente').rpc('politica_de', { p_perfil: sesion.userId })
  const p = pol as { usado_bytes?: number; cuota_mb?: number } | null
  const cuota = Number(p?.cuota_mb ?? 0) * 1024 * 1024
  if (Number(p?.usado_bytes ?? 0) + entrada.bytes > cuota) {
    return { ok: false, error: `No te alcanza el espacio: usas ${Math.round(Number(p?.usado_bytes ?? 0) / 1048576)} MB de ${p?.cuota_mb ?? 0} MB.` }
  }
  const archivoId = crypto.randomUUID()
  const nombre = nombreObjeto(entrada.nombre)
  const ruta = `${sesion.userId}/biblioteca/${archivoId}-${nombre}`
  const supabase = await createClient()
  const { error } = await supabase
    .schema('asistente')
    .from('archivo')
    .insert({ id: archivoId, dueno: sesion.userId, carpeta_id: entrada.carpetaId, origen: 'subido', estado: 'subiendo', nombre, mime: entrada.mime || 'application/octet-stream', bytes: entrada.bytes, ruta })
  if (error) return { ok: false, error: 'No se pudo preparar la subida.' }
  return { ok: true, archivoId, ruta }
}

/** Confirma que los bytes llegaron y deja el archivo listo con su tamaño real. */
export async function confirmarSubida(archivoId: string): Promise<R<{ bytes: number }>> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  if (!UUID.test(archivoId)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data: a } = await supabase.schema('asistente').from('archivo').select('id, ruta').eq('id', archivoId).eq('dueno', sesion.userId).maybeSingle()
  if (!a) return { ok: false, error: 'Ese archivo no es tuyo.' }
  const admin = createAdminClient()
  const carpeta = a.ruta.slice(0, a.ruta.lastIndexOf('/'))
  const nombre = a.ruta.slice(a.ruta.lastIndexOf('/') + 1)
  const { data: lista } = await admin.storage.from('asistente').list(carpeta, { search: nombre, limit: 5 })
  const objeto = (lista ?? []).find((o) => o.name === nombre)
  if (!objeto) {
    await admin.schema('asistente').from('archivo').update({ estado: 'error' }).eq('id', archivoId)
    return { ok: false, error: 'El archivo no terminó de subir.' }
  }
  const meta = objeto.metadata as { size?: number; mimetype?: string } | null
  const bytes = Number(meta?.size ?? 0)
  await admin.schema('asistente').from('archivo').update({ estado: 'listo', bytes, ...(meta?.mimetype ? { mime: meta.mimetype } : {}) }).eq('id', archivoId)
  revalidatePath(RUTA, 'layout')
  return { ok: true, bytes }
}

// ── Compartir ───────────────────────────────────────────────────────────────

/**
 * Comparte un archivo o una carpeta (con todo lo de adentro) con otra persona que tenga Mis archivos.
 * - Lo que trae datos de la plataforma (un archivo que generó el asistente) se revisa contra los permisos de quien
 *   recibe, como en el chat: si le falta alguna fuente, no se comparte.
 * - Lo que viene de un lugar privado (`aviso`: respuestas de los trabajadores, documentos de perímetro sensible) o de
 *   Microsoft 365 pide confirmación expresa: quien lo recibe lo va a ver aunque no tenga ese permiso.
 */
export async function compartir(tipo: 'carpeta' | 'archivo', id: string, conId: string, confirmado = false): Promise<R | { ok: false; error: string; confirmar: true }> {
  const sesion = await requerirPermiso('sistema:archivos', 'crear')
  if (!UUID.test(id) || !UUID.test(conId) || conId === sesion.userId) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const admin = createAdminClient()
  const db = admin.schema('asistente')
  const { data: propio } = await supabase.schema('asistente').from(tipo).select('id').eq('id', id).eq('dueno', sesion.userId).maybeSingle()
  if (!propio) return { ok: false, error: 'Solo compartes lo tuyo.' }
  const { data: tiene } = await db.rpc('tiene_archivos', { p_perfil: conId })
  if (!tiene) return { ok: false, error: 'Esa persona no tiene Mis archivos.' }

  // Lo que se comparte: el archivo, o todo lo que cuelga de la carpeta.
  let archivos: { id: string; mensaje_id: string | null; aviso: string | null; origen: string }[] = []
  if (tipo === 'archivo') {
    const { data } = await db.from('archivo').select('id, mensaje_id, aviso, origen').eq('id', id)
    archivos = data ?? []
  } else {
    const carpetas = [id]
    let nivel = [id]
    for (let i = 0; i < 40 && nivel.length; i++) {
      const { data: hijas } = await db.from('carpeta').select('id').in('padre_id', nivel)
      nivel = (hijas ?? []).map((h) => h.id)
      carpetas.push(...nivel)
    }
    for (let i = 0; i < carpetas.length; i += 200) {
      const { data } = await db.from('archivo').select('id, mensaje_id, aviso, origen').in('carpeta_id', carpetas.slice(i, i + 200))
      archivos.push(...(data ?? []))
    }
  }

  // El linaje de lo que produjo el asistente.
  const mensajes = [...new Set(archivos.map((a) => a.mensaje_id).filter((m): m is string => !!m))]
  let linaje: string[] = []
  if (mensajes.length) {
    const { data: ms } = await db.from('mensaje').select('turno_id').in('id', mensajes.slice(0, 500))
    const turnos = [...new Set((ms ?? []).map((m) => m.turno_id).filter((t): t is string => !!t))]
    if (turnos.length) {
      const { data: q } = await db.from('consulta_fuente').select('fuente').in('turno_id', turnos)
      linaje = [...new Set((q ?? []).map((x) => x.fuente))]
    }
  }
  const dePlataforma = linaje.filter((f) => !esMicrosoft(f))
  if (dePlataforma.length) {
    const suyas = await fuentesDePersona(conId)
    const faltan = suyas.filter((f) => dePlataforma.includes(f.clave) && f.estado !== 'si')
    if (faltan.length) return { ok: false, error: `No se comparte: trae datos de ${faltan.map((f) => `«${f.titulo}»`).join(', ')}, que esa persona no puede ver.` }
  }
  const avisos = [...new Set(archivos.map((a) => a.aviso).filter((a): a is string => !!a))]
  const deMicrosoft = linaje.some(esMicrosoft) || archivos.some((a) => a.origen === 'microsoft')
  if ((avisos.length || deMicrosoft) && !confirmado) {
    const que = [...avisos.slice(0, 3), ...(deMicrosoft ? ['información de tu Microsoft 365'] : [])].join('; ')
    const cuantos = archivos.filter((a) => a.aviso).length
    return { ok: false, confirmar: true, error: `Contiene material privado${cuantos > 1 ? ` (${cuantos} archivos)` : ''}: ${que}. Si lo compartes, esa persona lo va a ver aunque no tenga ese permiso.` }
  }
  const { error } = await db.from('compartido').upsert({ tipo, objeto_id: id, con: conId, por: sesion.userId, linaje }, { onConflict: 'tipo,objeto_id,con' })
  revalidatePath(RUTA, 'layout')
  return error ? { ok: false, error: 'No se pudo compartir.' } : { ok: true }
}

export async function retirarCompartido(compartidoId: string): Promise<R> {
  await requerirPermiso('sistema:archivos')
  if (!UUID.test(compartidoId)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('compartido').delete().eq('id', compartidoId).select('id')
  revalidatePath(RUTA, 'layout')
  return data?.length ? { ok: true } : { ok: false, error: 'No se pudo retirar.' }
}

// ── Para el chat: «/» busca y adjunta ───────────────────────────────────────

export type ItemBiblioteca = { tipo: 'carpeta' | 'archivo'; id: string; nombre: string; detalle: string }

/** Lo que coincide con lo escrito tras «/»: carpetas y archivos propios o compartidos (la RLS decide). */
export async function buscarEnBiblioteca(q: string): Promise<ItemBiblioteca[]> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!puede(sesion, 'sistema:archivos')) return []
  const texto = q.normalize('NFC').trim().replace(/[%_,()\\]/g, ' ').slice(0, 60)
  if (texto.length < 2) return []
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: carpetas }, { data: archivos }] = await Promise.all([
    db.from('carpeta').select('id, nombre, dueno').ilike('nombre', `%${texto}%`).order('nombre').limit(4),
    db.from('archivo').select('id, nombre, bytes, dueno').ilike('nombre', `%${texto}%`).eq('estado', 'listo').neq('origen', 'biblioteca').is('chat_id', null).order('creado_en', { ascending: false }).limit(6),
  ])
  return [
    ...(carpetas ?? []).map((c) => ({ tipo: 'carpeta' as const, id: c.id, nombre: c.nombre, detalle: c.dueno === sesion.userId ? 'Carpeta' : 'Carpeta compartida' })),
    ...(archivos ?? []).map((a) => ({ tipo: 'archivo' as const, id: a.id, nombre: a.nombre, detalle: a.dueno === sesion.userId ? 'Mis archivos' : 'Compartido conmigo' })),
  ]
}

export type Adjuntado = { archivoId: string; nombre: string; mime: string; bytes: number }

/**
 * Adjunta al chat un archivo de la biblioteca, o los de una carpeta (hasta 20, de arriba hacia abajo). No copia
 * bytes: crea filas `biblioteca` a nombre de quien adjunta, con la dirección del original. Antes comprueba con la sesión que el original se puede leer.
 */
export async function adjuntarDeBiblioteca(tipo: 'carpeta' | 'archivo', id: string): Promise<R<{ adjuntos: Adjuntado[] }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!puede(sesion, 'sistema:archivos') || !UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  type Fila = { id: string; nombre: string; mime: string; bytes: number; bucket: string; ruta: string; huella: string | null }
  const columnas = 'id, nombre, mime, bytes, bucket, ruta, huella'
  let originales: Fila[] = []
  if (tipo === 'archivo') {
    const { data } = await db.from('archivo').select(columnas).eq('id', id).eq('estado', 'listo').maybeSingle()
    if (data) originales = [data as Fila]
  } else {
    const { data: c } = await db.from('carpeta').select('id').eq('id', id).maybeSingle()
    if (!c) return { ok: false, error: 'Esa carpeta no existe o no la puedes ver.' }
    let nivel = [id]
    for (let i = 0; i < 10 && nivel.length && originales.length < 20; i++) {
      const { data } = await db.from('archivo').select(columnas).in('carpeta_id', nivel).eq('estado', 'listo').order('nombre').limit(20 - originales.length)
      originales.push(...((data ?? []) as Fila[]))
      const { data: hijas } = await db.from('carpeta').select('id').in('padre_id', nivel)
      nivel = (hijas ?? []).map((h) => h.id)
    }
  }
  if (!originales.length) return { ok: false, error: tipo === 'carpeta' ? 'La carpeta está vacía.' : 'Ese archivo no existe o no lo puedes ver.' }
  const filas = originales.map((o) => ({
    id: crypto.randomUUID(),
    dueno: sesion.userId,
    origen: 'biblioteca',
    estado: 'listo',
    nombre: o.nombre,
    mime: o.mime,
    bytes: o.bytes,
    bucket: o.bucket,
    ruta: o.ruta,
    huella: o.huella,
    // Sin la copia en Anthropic del original: caduca y se borra con el original; cada adjunto sube la suya si hace falta.
    anthropic_file_id: null,
    fuente_id: o.id,
  }))
  const { error } = await createAdminClient().schema('asistente').from('archivo').insert(filas)
  if (error) return { ok: false, error: 'No se pudo adjuntar.' }
  return { ok: true, adjuntos: filas.map((f) => ({ archivoId: f.id, nombre: f.nombre, mime: f.mime, bytes: Number(f.bytes) })) }
}
