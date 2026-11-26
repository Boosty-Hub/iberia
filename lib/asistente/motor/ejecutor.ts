import { toFile } from '@anthropic-ai/sdk'
import type { Bloque, ClaseArtefacto, Esfuerzo, Motor } from '../tipos'
import { BETA_ARCHIVOS, crearAnthropic, crearServicio, type BaseServicio } from './servicio'
import { Emisor } from './emisor'
import { instruccionesSistema } from './instrucciones'
import { ejecutarAnthropic, mensajeDeError } from './anthropic'
import { ejecutarOpenAI } from './openai'
import { titularYClasificar } from './titulo'
import { prepararDatos } from './datos'
import type { ApiMemoria } from './memoria'
import type { ArchivoTurno, ArtefactoTurno, ContextoMotor, Precio, ResultadoMotor, TurnoHistorial } from './contrato'

/** Lo que se reserva antes de correr: el peor caso razonable de un turno, por modelo. Al cerrar se cobra lo real. */
const RESERVA: Record<string, number> = {
  'claude-opus-5-5': 0.8,
  'claude-sonnet-5-5': 0.4,
  'claude-haiku-5-5': 0.05,
  'gpt-6.2-astra': 1.2,
  'gpt-6.2-sol': 0.4,
  'gpt-6.1-terra': 0.2,
}

const PRECIO_DEFECTO: Precio = { entrada: 4, salida: 20, cacheLee: 0.2, cacheEscribe: 5 }

/**
 * Corre un turno de punta a punta. Lo llaman la función de fondo de Netlify
 * (producción) y la ruta de desarrollo. Nunca lanza: todo final deja el turno
 * cerrado (listo, detenido o fallido), la reserva liberada y el aviso enviado.
 */
export async function ejecutarTurno(turnoId: string, opciones: { token?: string | null } = {}): Promise<void> {
  const db = crearServicio()
  const { data: turno } = await db.schema('asistente').from('turno').select('*').eq('id', turnoId).maybeSingle()
  if (!turno || turno.estado !== 'en_cola') return
  const emisor = new Emisor(turno.chat_id)
  const cerrarFallido = async (error: string) => {
    await db.schema('asistente').from('turno').update({ estado: 'fallido', error, reserva_usd: 0, terminado_en: new Date().toISOString() }).eq('id', turnoId)
    emisor.emitir({ t: 'fin', turno: turnoId, estado: 'fallido', mensaje: null, error })
    await emisor.terminar()
  }

  try {
    const [{ data: chat }, { data: config }, { data: modelos }] = await Promise.all([
      db.schema('asistente').from('chat').select('*').eq('id', turno.chat_id).single(),
      db.schema('asistente').from('config').select('*').eq('id', true).single(),
      db.schema('asistente').from('modelo').select('*'),
    ])
    if (!chat || !config) return await cerrarFallido('No se encontró el chat.')

    // El catálogo de datos (fase 2) se pide mientras se reserva y se lee el chat.
    const promesaDatos = prepararDatos(opciones.token, turnoId)
    const reserva = RESERVA[turno.modelo] ?? 0.8
    const { data: motivo, error: errReserva } = await db.schema('asistente').rpc('reservar_turno', { p_turno: turnoId, p_reserva_usd: reserva })
    if (errReserva) return await cerrarFallido('No se pudo reservar el turno.')
    if (motivo) {
      emisor.emitir({ t: 'fin', turno: turnoId, estado: 'fallido', mensaje: null, error: motivo as string })
      await emisor.terminar()
      return
    }
    emisor.emitir({ t: 'estado', turno: turnoId, estado: 'corriendo' })

    // El historial y los archivos del chat.
    const [{ data: mensajes }, { data: archivos }, { data: versiones }, { data: proyecto }, { data: archivosProyecto }, { data: pref }, { data: recuerdos }] = await Promise.all([
      db.schema('asistente').from('mensaje').select('id, rol, texto, adjuntos, bloques, turno_id, creado_en').eq('chat_id', chat.id).order('creado_en'),
      db.schema('asistente').from('archivo').select('id, nombre, mime, bytes, ruta, origen, anthropic_file_id, mensaje_id, estado').eq('chat_id', chat.id).eq('estado', 'listo'),
      db.schema('asistente').from('html').select('grupo, titulo, tipo, version').eq('chat_id', chat.id).order('version', { ascending: false }),
      chat.proyecto_id ? db.schema('asistente').from('proyecto').select('nombre, instrucciones').eq('id', chat.proyecto_id).maybeSingle() : Promise.resolve({ data: null }),
      chat.proyecto_id
        ? db.schema('asistente').from('archivo').select('id, nombre, mime, bytes, ruta, origen, anthropic_file_id, mensaje_id, estado').eq('proyecto_id', chat.proyecto_id).eq('estado', 'listo')
        : Promise.resolve({ data: [] }),
      db.schema('asistente').from('preferencia').select('memoria').eq('perfil_id', turno.solicitante).maybeSingle(),
      chat.compartido ? Promise.resolve({ data: [] }) : db.schema('asistente').from('memoria').select('id, texto').eq('dueno', turno.solicitante).order('usado_en', { ascending: false }).limit(40),
    ])
    // La memoria: de quien pregunta, apagable, y nunca en un chat compartido.
    const memoria: ApiMemoria | null =
      chat.compartido || pref?.memoria === false
        ? null
        : {
            lista: (recuerdos ?? []) as { id: string; texto: string }[],
            recordar: async (texto) => {
              const { data, error } = await db.schema('asistente').from('memoria').insert({ dueno: turno.solicitante, texto, origen_chat: chat.id }).select('id, texto').single()
              if (error || !data) throw new Error('No se pudo guardar en la memoria.')
              return data
            },
            olvidar: async (id) => {
              const { data } = await db.schema('asistente').from('memoria').delete().eq('id', id).eq('dueno', turno.solicitante).select('id')
              return !!data?.length
            },
          }
    // La última versión de cada artefacto del chat.
    const artefactos: ArtefactoTurno[] = []
    for (const v of versiones ?? []) if (!artefactos.some((x) => x.grupo === v.grupo)) artefactos.push({ grupo: v.grupo, titulo: v.titulo, clase: v.tipo as ClaseArtefacto, version: v.version })
    const porId = new Map([...(archivos ?? []), ...(archivosProyecto ?? [])].map((a) => [a.id, a as ArchivoTurno & { mensaje_id: string | null }]))
    const propio = (mensajes ?? []).filter((m) => m.rol === 'usuario' && m.turno_id === turnoId).at(-1)
    if (!propio) return await cerrarFallido('No se encontró el mensaje del turno.')
    const historial: TurnoHistorial[] = (mensajes ?? [])
      .filter((m) => m.creado_en < propio.creado_en)
      .map((m) => ({
        rol: m.rol as 'usuario' | 'asistente',
        texto: m.texto,
        adjuntos: (m.adjuntos ?? []).map((id: string) => porId.get(id)?.nombre).filter(Boolean) as string[],
        generados: ((m.bloques as Bloque[] | null) ?? []).flatMap((b) =>
          b.tipo === 'archivo' ? [b.nombre] : b.tipo === 'artefacto' ? [`artefacto «${b.titulo}» v${b.version}`] : b.tipo === 'html' ? [`${b.titulo} (HTML)`] : []
        ),
      }))
    const adjuntos = (propio.adjuntos ?? []).map((id: string) => porId.get(id)).filter(Boolean) as ArchivoTurno[]

    const precioDe = (id: string): Precio => {
      const m = (modelos ?? []).find((x) => x.id === id || id.startsWith(x.id))
      return m ? { entrada: Number(m.precio_entrada), salida: Number(m.precio_salida), cacheLee: Number(m.precio_cache_lee), cacheEscribe: Number(m.precio_cache_escribe) } : PRECIO_DEFECTO
    }

    // Detener: la persona marca `detener`; se revisa cada 2 s. Latido cada 30 s.
    const control = new AbortController()
    let vueltas = 0
    const vigia = setInterval(async () => {
      vueltas++
      const { data } = await db.schema('asistente').from('turno').select('detener').eq('id', turnoId).maybeSingle()
      if (data?.detener) control.abort()
      if (vueltas % 15 === 0) await db.schema('asistente').from('turno').update({ latido: new Date().toISOString() }).eq('id', turnoId)
    }, 2000)

    const vigente = !!chat.contenedor_id && !!chat.contenedor_usado_en && Date.now() - Date.parse(chat.contenedor_usado_en) < 25 * 86_400_000
    const ctx: ContextoMotor = {
      turno: turnoId,
      modelo: turno.modelo,
      esfuerzo: turno.esfuerzo as Esfuerzo,
      sistema: instruccionesSistema(config.instrucciones_empresa ?? '', proyecto ? { nombre: proyecto.nombre, instrucciones: proyecto.instrucciones } : null),
      historial,
      texto: propio.texto,
      adjuntos,
      archivosDelChat: [...porId.values()],
      archivosFijos: (archivosProyecto ?? []) as ArchivoTurno[],
      contenedorId: chat.contenedor_id,
      contenedorVigente: vigente,
      habilidades: config.habilidades ?? [],
      datos: await promesaDatos,
      memoria,
      senal: control.signal,
      emitir: (e) => emisor.emitir(e),
      asegurarEnAnthropic: (a) => asegurarEnAnthropic(db, a),
      guardarGenerado: (fileId) => guardarGenerado(db, chat.dueno, chat.id, turno.solicitante, fileId),
      artefactos,
      publicarArtefacto: (x) => publicarArtefacto(db, turno.solicitante, chat.id, x),
      leerArtefacto: (grupo) => leerArtefacto(db, chat.id, grupo),
    }

    const inicio = Date.now()
    let r: ResultadoMotor
    try {
      r = (turno.motor as Motor) === 'anthropic' ? await ejecutarAnthropic(ctx, precioDe) : await ejecutarOpenAI(ctx, precioDe, turno.motor as Motor)
    } finally {
      clearInterval(vigia)
    }

    // El título del chat y la categoría del turno (Haiku, barato), solo la primera vez o cuando haga falta.
    let extra = 0
    let categoria: string | null = null
    if (r.estado !== 'fallido') {
      const t = await titularYClasificar(propio.texto, r.texto, chat.titulo_auto && historial.length === 0)
      extra = t.costoUsd
      categoria = t.categoria
      if (t.titulo) await db.schema('asistente').from('chat').update({ titulo: t.titulo, titulo_auto: false }).eq('id', chat.id)
    }

    const textoFinal = r.texto || (r.estado === 'detenido' ? '_(Detenido.)_' : r.estado === 'fallido' ? '' : '_(Sin respuesta.)_')
    let mensajeId: string | null = null
    if (textoFinal || r.bloques.length) {
      const { data: m } = await db
        .schema('asistente')
        .from('mensaje')
        .insert({ chat_id: chat.id, turno_id: turnoId, rol: 'asistente', autor: null, texto: textoFinal, bloques: r.bloques as never })
        .select('id')
        .single()
      mensajeId = m?.id ?? null
      // Los archivos y HTML del turno quedan enlazados a su mensaje.
      const archivosIds = r.bloques.flatMap((b) => (b.tipo === 'archivo' ? [b.archivoId] : []))
      const htmlIds = r.bloques.flatMap((b) => (b.tipo === 'artefacto' ? [b.artefactoId] : []))
      if (mensajeId && archivosIds.length) await db.schema('asistente').from('archivo').update({ mensaje_id: mensajeId }).in('id', archivosIds)
      if (mensajeId && htmlIds.length) await db.schema('asistente').from('html').update({ mensaje_id: mensajeId }).in('id', htmlIds)
    }

    await Promise.all([
      db
        .schema('asistente')
        .from('turno')
        .update({
          estado: r.estado,
          error: r.error ?? null,
          modelo: r.modeloServido || turno.modelo,
          tokens_entrada: r.uso.entrada,
          tokens_salida: r.uso.salida,
          tokens_cache_lee: r.uso.cacheLee,
          tokens_cache_escribe: r.uso.cacheEscribe,
          busquedas: r.uso.busquedas,
          costo_usd: Math.round((r.uso.costoUsd + extra) * 100000) / 100000,
          reserva_usd: 0,
          categoria,
          primer_token_ms: r.primerTokenMs,
          duracion_ms: Date.now() - inicio,
          terminado_en: new Date().toISOString(),
        })
        .eq('id', turnoId),
      db
        .schema('asistente')
        .from('chat')
        .update({
          motor: turno.motor,
          modelo: turno.modelo,
          esfuerzo: turno.esfuerzo,
          ...(r.contenedorId ? { contenedor_id: r.contenedorId, contenedor_usado_en: new Date().toISOString() } : {}),
        })
        .eq('id', chat.id),
    ])
    emisor.emitir({ t: 'fin', turno: turnoId, estado: r.estado, mensaje: mensajeId, error: r.error ?? null })
    await emisor.terminar()
  } catch (e) {
    console.error('[asistente] turno', turnoId, e)
    await cerrarFallido(mensajeDeError(e))
  }
}

/** Sube a la Files API de Anthropic el archivo que está en Storage, una sola vez. */
async function asegurarEnAnthropic(db: BaseServicio, a: ArchivoTurno): Promise<string> {
  if (a.anthropic_file_id) return a.anthropic_file_id
  const { data, error } = await db.storage.from('asistente').download(a.ruta)
  if (error || !data) throw new Error(`No se pudo leer «${a.nombre}» del almacenamiento.`)
  const subido = await crearAnthropic().beta.files.upload({
    file: await toFile(Buffer.from(await data.arrayBuffer()), a.nombre, { type: a.mime || 'application/octet-stream' }),
    betas: [...BETA_ARCHIVOS],
  })
  await db.schema('asistente').from('archivo').update({ anthropic_file_id: subido.id, anthropic_usado_en: new Date().toISOString() }).eq('id', a.id)
  a.anthropic_file_id = subido.id
  return subido.id
}

function nombreSeguro(n: string): string {
  return n.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 180) || 'archivo'
}

/** Baja de Anthropic un archivo generado y lo guarda en Storage, a nombre de quien pidió el turno. */
async function guardarGenerado(db: BaseServicio, _dueno: string, chat: string, solicitante: string, fileId: string): Promise<Extract<Bloque, { tipo: 'archivo' }> | null> {
  try {
    const cliente = crearAnthropic()
    const meta = await cliente.beta.files.retrieveMetadata(fileId, { betas: [...BETA_ARCHIVOS] })
    const r = await cliente.beta.files.download(fileId, { betas: [...BETA_ARCHIVOS] })
    const buf = Buffer.from(await r.arrayBuffer())
    const id = crypto.randomUUID()
    const nombre = nombreSeguro(meta.filename)
    const ruta = `${solicitante}/${chat}/generados/${id}-${nombre}`
    const { error } = await db.storage.from('asistente').upload(ruta, buf, { contentType: meta.mime_type || 'application/octet-stream', upsert: false })
    if (error) throw error
    await db.schema('asistente').from('archivo').insert({
      id,
      dueno: solicitante,
      chat_id: chat,
      origen: 'generado',
      estado: 'listo',
      nombre,
      mime: meta.mime_type || 'application/octet-stream',
      bytes: buf.length,
      ruta,
      anthropic_file_id: fileId,
      anthropic_usado_en: new Date().toISOString(),
    })
    return { tipo: 'archivo', archivoId: id, nombre, mime: meta.mime_type, bytes: buf.length }
  } catch (e) {
    console.error('[asistente] no se pudo guardar el archivo generado', fileId, e)
    return null
  }
}

const MIME_ARTEFACTO: Record<ClaseArtefacto, string> = {
  html: 'text/html; charset=utf-8',
  documento: 'text/markdown; charset=utf-8',
  svg: 'image/svg+xml',
}
const EXTENSION: Record<ClaseArtefacto, string> = { html: 'html', documento: 'md', svg: 'svg' }

/** Crea un artefacto o le agrega una versión. El grupo tiene que ser de este chat: si no, nace uno nuevo. */
async function publicarArtefacto(
  db: BaseServicio,
  solicitante: string,
  chat: string,
  a: { grupo: string | null; titulo: string; clase: ClaseArtefacto; contenido: string }
): Promise<Extract<Bloque, { tipo: 'artefacto' }>> {
  let grupo = a.grupo
  let version = 1
  if (grupo) {
    const { data: previos } = await db.schema('asistente').from('html').select('version').eq('chat_id', chat).eq('grupo', grupo).order('version', { ascending: false }).limit(1)
    if (previos?.length) version = previos[0].version + 1
    else grupo = null
  }
  grupo ??= crypto.randomUUID()
  const id = crypto.randomUUID()
  const ruta = `${solicitante}/${chat}/artefactos/${grupo}/v${version}-${id}.${EXTENSION[a.clase]}`
  const buf = Buffer.from(a.contenido, 'utf8')
  const { error } = await db.storage.from('asistente').upload(ruta, buf, { contentType: MIME_ARTEFACTO[a.clase], upsert: false })
  if (error) throw new Error('No se pudo guardar el artefacto.')
  const { error: e2 } = await db.schema('asistente').from('html').insert({ id, grupo, dueno: solicitante, chat_id: chat, titulo: a.titulo, tipo: a.clase, ruta, version, bytes: buf.length })
  if (e2) throw new Error('No se pudo registrar el artefacto.')
  return { tipo: 'artefacto', artefactoId: id, grupo, titulo: a.titulo, version, clase: a.clase }
}

async function leerArtefacto(db: BaseServicio, chat: string, grupo: string): Promise<string | null> {
  const { data: v } = await db.schema('asistente').from('html').select('ruta').eq('chat_id', chat).eq('grupo', grupo).order('version', { ascending: false }).limit(1).maybeSingle()
  if (!v) return null
  const { data } = await db.storage.from('asistente').download(v.ruta)
  return data ? await data.text() : null
}
