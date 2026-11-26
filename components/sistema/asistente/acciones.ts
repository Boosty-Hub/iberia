'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { catalogoModelos, lanzarTurno, miPolitica, tokenDeSesion } from '@/lib/asistente/servidor'
import { MAX_BYTES_ARCHIVO, dentroDelMaximo, type Esfuerzo } from '@/lib/asistente/tipos'
import { Emisor } from '@/lib/asistente/motor/emisor'

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function nombreSeguro(n: string): string {
  return (
    n
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f#%{}^~[\]`]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'archivo'
  )
}

/**
 * Manda un mensaje: crea el chat si hace falta, deja el turno en cola, guarda
 * lo que escribió la persona (primero y siempre: lo dicho no se pierde aunque
 * el modelo falle) y dispara el turno sin esperarlo.
 */
export async function enviarMensaje(entrada: {
  chatId: string | null
  texto: string
  adjuntos: string[]
  modelo: string
  esfuerzo: Esfuerzo
  /** En un chat compartido: false = un mensaje para el grupo, sin preguntarle al asistente (no gasta). */
  alAsistente?: boolean
}): Promise<Resultado<{ chatId: string; turnoId: string | null; mensajeId: string }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  const texto = entrada.texto.trim()
  if (!texto && !entrada.adjuntos.length) return { ok: false, error: 'Escribe algo o adjunta un archivo.' }
  if (texto.length > 100_000) return { ok: false, error: 'El mensaje es demasiado largo. Adjúntalo como archivo.' }
  if (entrada.chatId && !UUID.test(entrada.chatId)) return { ok: false, error: 'Chat no válido.' }
  if (entrada.adjuntos.length > 20 || entrada.adjuntos.some((a) => !UUID.test(a))) return { ok: false, error: 'Adjuntos no válidos.' }

  const [pol, modelos] = await Promise.all([miPolitica(), catalogoModelos()])
  if (!pol?.habilitado) return { ok: false, error: 'No tienes el asistente de IA habilitado.' }
  if (!pol.encendido) return { ok: false, error: 'El asistente está apagado por la administración.' }
  const motor = pol.motor
  // El modelo tiene que ser del motor activo y estar en tu política.
  let modelo = modelos.find((m) => m.id === entrada.modelo && m.proveedor === motor && m.encendido && pol.modelos.includes(m.id))
  if (!modelo) modelo = modelos.find((m) => m.id === pol.modelo_defecto && pol.modelos.includes(m.id)) ?? modelos.find((m) => m.proveedor === motor && m.encendido && pol.modelos.includes(m.id))
  if (!modelo) return { ok: false, error: 'No tienes ningún modelo habilitado para el motor activo.' }
  let esfuerzo: Esfuerzo = modelo.esfuerzos.includes(entrada.esfuerzo) ? entrada.esfuerzo : pol.esfuerzo_defecto
  if (!dentroDelMaximo(esfuerzo, pol.esfuerzo_max)) esfuerzo = pol.esfuerzo_max
  if (!modelo.esfuerzos.includes(esfuerzo)) esfuerzo = modelo.esfuerzos.includes('medium') ? 'medium' : modelo.esfuerzos[0]

  const supabase = await createClient()
  const db = supabase.schema('asistente')
  let chatId = entrada.chatId
  if (!chatId) {
    chatId = crypto.randomUUID()
    const titulo = (texto || 'Archivo adjunto').replace(/\s+/g, ' ').slice(0, 60)
    const { error } = await db.from('chat').insert({ id: chatId, dueno: sesion.userId, titulo })
    if (error) return { ok: false, error: 'No se pudo crear el chat.' }
  }

  // Los adjuntos tienen que ser tuyos, estar listos y no estar en otro chat.
  if (entrada.adjuntos.length) {
    const { data: propios } = await db.from('archivo').select('id, chat_id, estado').in('id', entrada.adjuntos).eq('dueno', sesion.userId)
    const validos = (propios ?? []).filter((a) => a.estado === 'listo' && (!a.chat_id || a.chat_id === chatId))
    if (validos.length !== entrada.adjuntos.length) return { ok: false, error: 'Algún adjunto no terminó de subir. Espera o vuelve a adjuntarlo.' }
  }

  // Un mensaje para el grupo: sin turno y sin gasto; los demás lo ven en vivo.
  if (entrada.alAsistente === false && entrada.chatId) {
    const mensajeId = crypto.randomUUID()
    const { error } = await db.from('mensaje').insert({ id: mensajeId, chat_id: chatId, turno_id: null, rol: 'usuario', autor: sesion.userId, texto, adjuntos: [] })
    if (error) return { ok: false, error: 'No se pudo enviar.' }
    const e = new Emisor(chatId)
    e.emitir({ t: 'mensaje', turno: '', id: mensajeId })
    await e.terminar()
    return { ok: true, chatId, turnoId: null, mensajeId }
  }

  const turnoId = crypto.randomUUID()
  const { error: eTurno } = await db.from('turno').insert({ id: turnoId, chat_id: chatId, solicitante: sesion.userId, motor, modelo: modelo.id, esfuerzo })
  if (eTurno) return { ok: false, error: 'No se pudo dejar el turno en cola.' }
  const mensajeId = crypto.randomUUID()
  const { error: eMensaje } = await db
    .from('mensaje')
    .insert({ id: mensajeId, chat_id: chatId, turno_id: turnoId, rol: 'usuario', autor: sesion.userId, texto, adjuntos: entrada.adjuntos })
  if (eMensaje) return { ok: false, error: 'No se pudo guardar el mensaje.' }
  {
    // Los demás participantes ven el mensaje en el acto (en un chat propio no hay nadie más, y no estorba).
    const e = new Emisor(chatId)
    e.emitir({ t: 'mensaje', turno: turnoId, id: mensajeId })
    void e.terminar()
  }

  if (entrada.adjuntos.length) {
    // El enlace archivo → chat y mensaje lo escribe el servidor (la sesión no actualiza archivos).
    await createAdminClient().schema('asistente').from('archivo').update({ chat_id: chatId, mensaje_id: mensajeId }).in('id', entrada.adjuntos).eq('dueno', sesion.userId)
  }

  try {
    const h = await headers()
    const origen = h.get('origin') ?? `https://${h.get('host')}`
    await lanzarTurno(turnoId, origen, await tokenDeSesion())
  } catch (e) {
    await createAdminClient()
      .schema('asistente')
      .from('turno')
      .update({ estado: 'fallido', error: 'No se pudo arrancar el turno. Intenta de nuevo.', terminado_en: new Date().toISOString() })
      .eq('id', turnoId)
    console.error('[asistente] lanzar turno', e)
    return { ok: false, error: 'No se pudo arrancar el turno. Intenta de nuevo.' }
  }
  return { ok: true, chatId, turnoId, mensajeId }
}

/** Deja lista la subida de un archivo: revisa la cuota y anota la fila; el navegador sube los bytes directo a Storage. */
export async function prepararSubida(entrada: { nombre: string; mime: string; bytes: number; chatId: string | null; proyectoId?: string | null }): Promise<Resultado<{ archivoId: string; ruta: string }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (entrada.chatId && !UUID.test(entrada.chatId)) return { ok: false, error: 'Chat no válido.' }
  if (entrada.proyectoId && !UUID.test(entrada.proyectoId)) return { ok: false, error: 'Proyecto no válido.' }
  if (!(entrada.bytes > 0)) return { ok: false, error: 'El archivo está vacío.' }
  if (entrada.bytes > MAX_BYTES_ARCHIVO) return { ok: false, error: 'El archivo pasa de 100 MB.' }
  const pol = await miPolitica()
  if (!pol?.habilitado) return { ok: false, error: 'No tienes el asistente de IA habilitado.' }
  if (pol.usado_bytes + entrada.bytes > pol.cuota_mb * 1024 * 1024) {
    return { ok: false, error: `No te alcanza el espacio: usas ${Math.round(pol.usado_bytes / 1048576)} MB de ${pol.cuota_mb} MB. Borra archivos viejos en «Mis archivos».` }
  }
  const archivoId = crypto.randomUUID()
  const nombre = nombreSeguro(entrada.nombre)
  const carpeta = entrada.proyectoId ? `proyectos/${entrada.proyectoId}` : (entrada.chatId ?? 'sueltos')
  const ruta = `${sesion.userId}/${carpeta}/${archivoId}-${nombre}`
  const supabase = await createClient()
  const { error } = await supabase
    .schema('asistente')
    .from('archivo')
    .insert({
      id: archivoId,
      dueno: sesion.userId,
      chat_id: entrada.proyectoId ? null : entrada.chatId,
      proyecto_id: entrada.proyectoId ?? null,
      origen: 'subido',
      estado: 'subiendo',
      nombre,
      mime: entrada.mime || 'application/octet-stream',
      bytes: entrada.bytes,
      ruta,
    })
  if (error) return { ok: false, error: 'No se pudo preparar la subida.' }
  return { ok: true, archivoId, ruta }
}

/** Confirma que los bytes llegaron a Storage y deja el archivo listo, con su tamaño real. */
export async function confirmarSubida(archivoId: string): Promise<Resultado<{ bytes: number }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(archivoId)) return { ok: false, error: 'Archivo no válido.' }
  const supabase = await createClient()
  const { data: a } = await supabase.schema('asistente').from('archivo').select('id, ruta, nombre').eq('id', archivoId).eq('dueno', sesion.userId).maybeSingle()
  if (!a) return { ok: false, error: 'Ese archivo no es tuyo.' }
  const admin = createAdminClient()
  const carpeta = a.ruta.slice(0, a.ruta.lastIndexOf('/'))
  const nombreObjeto = a.ruta.slice(a.ruta.lastIndexOf('/') + 1)
  const { data: lista } = await admin.storage.from('asistente').list(carpeta, { search: nombreObjeto, limit: 5 })
  const objeto = (lista ?? []).find((o) => o.name === nombreObjeto)
  if (!objeto) {
    await admin.schema('asistente').from('archivo').update({ estado: 'error' }).eq('id', archivoId)
    return { ok: false, error: 'El archivo no terminó de subir.' }
  }
  const bytes = Number((objeto.metadata as { size?: number } | null)?.size ?? 0)
  const mime = (objeto.metadata as { mimetype?: string } | null)?.mimetype
  await admin.schema('asistente').from('archivo').update({ estado: 'listo', bytes, ...(mime ? { mime } : {}) }).eq('id', archivoId)
  return { ok: true, bytes }
}

export async function detenerTurno(turnoId: string): Promise<Resultado<object>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(turnoId)) return { ok: false, error: 'Turno no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').from('turno').update({ detener: true }).eq('id', turnoId).eq('solicitante', sesion.userId)
  return error ? { ok: false, error: 'No se pudo detener.' } : { ok: true }
}

export async function calificar(mensajeId: string, valor: -1 | 1 | null, nota?: string): Promise<Resultado<object>> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(mensajeId)) return { ok: false, error: 'Mensaje no válido.' }
  const supabase = await createClient()
  const { error } = await supabase
    .schema('asistente')
    .from('mensaje')
    .update({ calificacion: valor, calificacion_nota: nota?.trim() ? nota.trim().slice(0, 1000) : null })
    .eq('id', mensajeId)
  return error ? { ok: false, error: 'No se pudo guardar la calificación.' } : { ok: true }
}

export async function renombrarChat(chatId: string, titulo: string): Promise<Resultado<object>> {
  await requerirPermiso('sistema:asistente')
  const t = titulo.replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!UUID.test(chatId) || !t) return { ok: false, error: 'Título no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').from('chat').update({ titulo: t, titulo_auto: false }).eq('id', chatId)
  revalidatePath('/sistema/asistente', 'layout')
  return error ? { ok: false, error: 'No se pudo renombrar.' } : { ok: true }
}

export async function borrarChat(chatId: string): Promise<Resultado<object>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(chatId)) return { ok: false, error: 'Chat no válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').from('chat').delete().eq('id', chatId).eq('dueno', sesion.userId).select('id')
  revalidatePath('/sistema/asistente', 'layout')
  // Sin política de DELETE, Postgres no se queja: devuelve cero filas. Se cuenta.
  if (error || !data?.length) return { ok: false, error: 'No se pudo borrar el chat (solo lo borra su dueño).' }
  return { ok: true }
}

/** Borra un archivo o un HTML propio: la fila, los bytes en Storage y la copia en Anthropic. */
export async function borrarArchivo(tipo: 'archivo' | 'html', id: string): Promise<Resultado<object>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const tabla = supabase.schema('asistente').from(tipo)
  const { data: fila } = await tabla.select('id, ruta').eq('id', id).eq('dueno', sesion.userId).maybeSingle()
  if (!fila) return { ok: false, error: 'No es tuyo o ya no existe.' }
  const admin = createAdminClient()
  if (tipo === 'archivo') {
    const { data: a } = await admin.schema('asistente').from('archivo').select('anthropic_file_id').eq('id', id).maybeSingle()
    if (a?.anthropic_file_id) {
      const { crearAnthropic, BETA_ARCHIVOS } = await import('@/lib/asistente/motor/servicio')
      await crearAnthropic()
        .beta.files.delete(a.anthropic_file_id, { betas: [...BETA_ARCHIVOS] })
        .catch(() => undefined)
    }
  }
  await supabase.storage.from('asistente').remove([fila.ruta])
  const { data: borrado } = await supabase.schema('asistente').from(tipo).delete().eq('id', id).select('id')
  revalidatePath('/sistema/asistente/archivos')
  return borrado?.length ? { ok: true } : { ok: false, error: 'No se pudo borrar.' }
}

/**
 * Crea el chat vacío antes del primer mensaje: así la pantalla se suscribe a su
 * canal antes de que el turno arranque y no se pierde ni la primera palabra.
 */
export async function crearChat(titulo: string, proyectoId?: string | null): Promise<Resultado<{ chatId: string }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  const pol = await miPolitica()
  if (!pol?.habilitado) return { ok: false, error: 'No tienes el asistente de IA habilitado.' }
  if (proyectoId && !UUID.test(proyectoId)) return { ok: false, error: 'Proyecto no válido.' }
  const chatId = crypto.randomUUID()
  const supabase = await createClient()
  const t = titulo.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Chat nuevo'
  // El trigger `b_chat_proyecto` niega un proyecto ajeno.
  const { error } = await supabase.schema('asistente').from('chat').insert({ id: chatId, dueno: sesion.userId, titulo: t, proyecto_id: proyectoId ?? null })
  return error ? { ok: false, error: 'No se pudo crear el chat.' } : { ok: true, chatId }
}

/** Vuelve a correr un turno que falló o se detuvo, con el mismo mensaje. */
export async function reintentarTurno(turnoId: string): Promise<Resultado<{ turnoId: string }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(turnoId)) return { ok: false, error: 'Turno no válido.' }
  const supabase = await createClient()
  const { data: viejo } = await supabase.schema('asistente').from('turno').select('id, chat_id, motor, modelo, esfuerzo, estado, solicitante').eq('id', turnoId).maybeSingle()
  if (!viejo || viejo.solicitante !== sesion.userId) return { ok: false, error: 'Ese turno no es tuyo.' }
  if (viejo.estado !== 'fallido' && viejo.estado !== 'detenido') return { ok: false, error: 'Ese turno no falló.' }
  const pol = await miPolitica()
  if (!pol?.habilitado || !pol.encendido) return { ok: false, error: 'El asistente no está disponible.' }
  const nuevo = crypto.randomUUID()
  const motor = pol.motor
  const modelo = pol.modelos.includes(viejo.modelo) ? viejo.modelo : pol.modelo_defecto
  const { error } = await supabase.schema('asistente').from('turno').insert({ id: nuevo, chat_id: viejo.chat_id, solicitante: sesion.userId, motor, modelo, esfuerzo: viejo.esfuerzo })
  if (error) return { ok: false, error: 'No se pudo reintentar.' }
  // El mensaje de la persona pasa al turno nuevo (lo escribe el servidor).
  await createAdminClient().schema('asistente').from('mensaje').update({ turno_id: nuevo }).eq('turno_id', turnoId).eq('rol', 'usuario')
  try {
    const h = await headers()
    await lanzarTurno(nuevo, h.get('origin') ?? `https://${h.get('host')}`, await tokenDeSesion())
  } catch {
    return { ok: false, error: 'No se pudo arrancar el turno.' }
  }
  return { ok: true, turnoId: nuevo }
}
