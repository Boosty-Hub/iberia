import { toFile } from '@anthropic-ai/sdk'
import type { Bloque, ClaseArtefacto, Esfuerzo, Motor } from '../tipos'
import type { Database } from '../../database.types'
import { BETA_ARCHIVOS, crearAnthropic, crearServicio, enNetlify, secretoAsistente, urlBase, type BaseServicio } from './servicio'
import { Emisor } from './emisor'
import { instruccionesSistema } from './instrucciones'
import { ejecutarAnthropic, mensajeDeError } from './anthropic'
import { ejecutarOpenAI } from './openai'
import { ejecutarLocal } from './local'
import { titularYClasificar } from './titulo'
import { prepararDatos } from './datos'
import type { ApiMemoria } from './memoria'
import { INSTRUCCIONES_INVESTIGACION } from './tareas'
import type { ArchivoTurno, ArtefactoTurno, ContextoMotor, Precio, ResultadoMotor, TurnoHistorial } from './contrato'

/** Lo que se reserva antes de correr: el peor caso razonable de un turno, por modelo. Al cerrar se cobra lo real. */
// Calibrada el 26-nov-2026 con los turnos medidos en pruebas (p90 con margen): con ventanas de 5 h, una reserva
// muy alta dejaba sin usar el último tramo de cada ventana. Se recalibra con el primer mes real.
const RESERVA: Record<string, number> = {
  'claude-opus-5-5': 0.35,
  'claude-sonnet-5-5': 0.15,
  'claude-haiku-5-5': 0.02,
  'gpt-6.2-astra': 0.8,
  'gpt-6.2-sol': 0.45,
  'gpt-6.1-terra': 0.05,
}

const PRECIO_DEFECTO: Precio = { entrada: 4, salida: 20, cacheLee: 0.2, cacheEscribe: 5 }

/** El tramo de la función de fondo: pasado esto, el turno guarda su estado y sigue en otra invocación. */
const TRAMO_MS = Number(process.env.ASISTENTE_TRAMO_MS) || (enNetlify() ? 12 * 60_000 : 0)
const MAX_TRAMOS = 4

export type OpcionesTurno = {
  token?: string | null
  /** Lo que se antepone al mensaje en este turno (la nota de una corrida programada). */
  nota?: string | null
  /** La sesión se acuñó para esta corrida: se cierra al terminar. */
  efimero?: boolean
}

/** Un turno partido en tramos sigue en otra invocación (en local, en esta misma). */
async function relanzar(turnoId: string, opciones: OpcionesTurno) {
  if (enNetlify()) {
    const r = await fetch(`${urlBase()}/.netlify/functions/asistente-turno-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': secretoAsistente() },
      body: JSON.stringify({ turno: turnoId, token: opciones.token ?? null, efimero: !!opciones.efimero }),
    })
    if (r.status !== 202 && !r.ok) throw new Error(`No se pudo lanzar el tramo siguiente (${r.status}).`)
    return
  }
  await ejecutarTurno(turnoId, opciones)
}

/** Al terminar el turno de una corrida programada, el programador entrega (canales, avisos, reintentos). */
async function avisarProgramador(corrida: string, opciones: OpcionesTurno) {
  try {
    await fetch(`${urlBase()}/api/asistente/programador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': secretoAsistente() },
      body: JSON.stringify({ accion: 'entregar', corrida, token: opciones.efimero ? opciones.token ?? null : null }),
    })
  } catch (e) {
    console.error('[asistente] no se pudo avisar al programador', corrida, e)
  }
}

/**
 * Corre un turno de punta a punta. Lo llaman la función de fondo de Netlify
 * (producción) y la ruta de desarrollo. Nunca lanza: todo final deja el turno
 * cerrado (listo, detenido o fallido), la reserva liberada y el aviso enviado.
 */
export async function ejecutarTurno(turnoId: string, opciones: OpcionesTurno = {}): Promise<void> {
  const db = crearServicio()
  const { data: turno } = await db.schema('asistente').from('turno').select('*').eq('id', turnoId).maybeSingle()
  if (!turno || turno.estado !== 'en_cola') return
  let siguio = false
  try {
    siguio = await correrTurno(db, turno, opciones)
  } finally {
    if (!siguio && turno.corrida_id) await avisarProgramador(turno.corrida_id, opciones)
  }
}

type FilaTurno = Database['asistente']['Tables']['turno']['Row']

/** Devuelve true si el turno siguió en otro tramo (todavía no terminó). */
async function correrTurno(db: BaseServicio, turno: FilaTurno, opciones: OpcionesTurno): Promise<boolean> {
  const turnoId = turno.id
  const emisor = new Emisor(turno.chat_id)
  const cerrarFallido = async (error: string) => {
    await db.schema('asistente').from('turno').update({ estado: 'fallido', error, reserva_usd: 0, continuacion: null, terminado_en: new Date().toISOString() }).eq('id', turnoId)
    emisor.emitir({ t: 'fin', turno: turnoId, estado: 'fallido', mensaje: null, error })
    await emisor.terminar()
    return false
  }
  const reanuda = turno.continuacion !== null && turno.continuacion !== undefined
  const investigacion = turno.modo === 'investigacion'

  try {
    const [{ data: chat }, { data: config }, { data: modelos }] = await Promise.all([
      db.schema('asistente').from('chat').select('*').eq('id', turno.chat_id).single(),
      db.schema('asistente').from('config').select('*').eq('id', true).single(),
      db.schema('asistente').from('modelo').select('*'),
    ])
    if (!chat || !config) return await cerrarFallido('No se encontró el chat.')
    // Una corrida programada: su tarea (nombre y, si es un tablero, el artefacto que mantiene).
    const { data: corrida } = turno.corrida_id
      ? await db.schema('asistente').from('corrida').select('id, tarea:tarea_id (nombre, html_grupo)').eq('id', turno.corrida_id).maybeSingle()
      : { data: null }
    const tarea = (corrida?.tarea ?? null) as { nombre: string; html_grupo: string | null } | null

    // El catálogo de datos (fase 2) se pide mientras se reserva y se lee el chat.
    const promesaDatos = prepararDatos(opciones.token, turnoId)
    // Un turno a la vez por chat (chats compartidos): este espera a que termine el que va adelante.
    for (let i = 0; i < (reanuda ? 0 : 300); i++) {
      const { data: delante } = await db
        .schema('asistente')
        .from('turno')
        .select('id')
        .eq('chat_id', chat.id)
        .eq('estado', 'corriendo')
        .neq('id', turnoId)
        .lt('creado_en', turno.creado_en)
        .limit(1)
      if (!delante?.length) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    if (reanuda) {
      // El tramo siguiente: la reserva ya está hecha.
      await db.schema('asistente').from('turno').update({ estado: 'corriendo', latido: new Date().toISOString() }).eq('id', turnoId)
    } else {
      // La investigación reserva su propio tope; el resto, el peor caso razonable del modelo.
      const reserva = investigacion ? Math.max(Number(config.tope_investigacion_usd), RESERVA[turno.modelo] ?? 0.35) : (RESERVA[turno.modelo] ?? 0.35)
      const { data: motivo, error: errReserva } = await db.schema('asistente').rpc('reservar_turno', { p_turno: turnoId, p_reserva_usd: reserva })
      if (errReserva) return await cerrarFallido('No se pudo reservar el turno.')
      if (motivo) {
        emisor.emitir({ t: 'fin', turno: turnoId, estado: 'fallido', mensaje: null, error: motivo as string })
        await emisor.terminar()
        return false
      }
    }
    emisor.emitir({ t: 'estado', turno: turnoId, estado: 'corriendo' })
    const [{ data: pol }, { data: caps }] = await Promise.all([
      db.schema('asistente').rpc('politica_de', { p_perfil: turno.solicitante }),
      db.schema('asistente').rpc('capacidades', { p_motor: turno.motor }),
    ])
    // Lo que el motor no puede (fase 6, la matriz de capacidades) ni se le ofrece.
    const puedeMotor = (k: string) => ((caps ?? []) as { capacidad: string; disponible: boolean }[]).find((c) => c.capacidad === k)?.disponible !== false

    // El historial y los archivos del chat.
    const [{ data: mensajes }, { data: archivos }, { data: versiones }, { data: proyecto }, { data: archivosProyecto }, { data: pref }, { data: recuerdos }] = await Promise.all([
      db.schema('asistente').from('mensaje').select('id, rol, texto, adjuntos, bloques, turno_id, creado_en, autor').eq('chat_id', chat.id).order('creado_en'),
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
    // Un tablero vivo: el artefacto que mantiene viene de otro chat (del mismo dueño).
    if (tarea?.html_grupo && !artefactos.some((x) => x.grupo === tarea.html_grupo)) {
      const { data: t } = await db.schema('asistente').from('html').select('grupo, titulo, tipo, version').eq('grupo', tarea.html_grupo).eq('dueno', turno.solicitante).order('version', { ascending: false }).limit(1).maybeSingle()
      if (t) artefactos.push({ grupo: t.grupo, titulo: t.titulo, clase: t.tipo as ClaseArtefacto, version: t.version })
    }
    // En un chat compartido, cada mensaje lleva el nombre de quien lo escribió.
    const nombres = new Map<string, string>()
    if (chat.compartido) {
      const autores = [...new Set((mensajes ?? []).map((m) => m.autor).filter(Boolean))] as string[]
      const { data: gente } = autores.length ? await db.from('profiles').select('id, nombre_completo').in('id', autores) : { data: [] }
      for (const g of gente ?? []) nombres.set(g.id, g.nombre_completo || 'Alguien')
    }
    const firmar = (autor: string | null, texto: string) => (chat.compartido && autor ? `[${nombres.get(autor) ?? 'Alguien'}]: ${texto}` : texto)
    const porId = new Map([...(archivos ?? []), ...(archivosProyecto ?? [])].map((a) => [a.id, a as ArchivoTurno & { mensaje_id: string | null }]))
    const propio = (mensajes ?? []).filter((m) => m.rol === 'usuario' && m.turno_id === turnoId).at(-1)
    if (!propio) return await cerrarFallido('No se encontró el mensaje del turno.')
    const historial: TurnoHistorial[] = (mensajes ?? [])
      .filter((m) => m.creado_en < propio.creado_en)
      .map((m) => ({
        rol: m.rol as 'usuario' | 'asistente',
        texto: m.rol === 'usuario' ? firmar(m.autor, m.texto) : m.texto,
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
      sistema:
        instruccionesSistema(config.instrucciones_empresa ?? '', proyecto ? { nombre: proyecto.nombre, instrucciones: proyecto.instrucciones } : null) +
        (investigacion ? INSTRUCCIONES_INVESTIGACION : ''),
      historial,
      texto: (opciones.nota ?? '') + firmar(propio.autor, propio.texto),
      adjuntos,
      archivosDelChat: [...porId.values()],
      archivosFijos: (archivosProyecto ?? []) as ArchivoTurno[],
      contenedorId: chat.contenedor_id,
      contenedorVigente: vigente,
      habilidades: config.habilidades ?? [],
      datos: puedeMotor('herramientas') ? await promesaDatos : null,
      memoria: puedeMotor('herramientas') ? memoria : null,
      senal: control.signal,
      emitir: (e) => emisor.emitir(e),
      asegurarEnAnthropic: (a) => asegurarEnAnthropic(db, a),
      guardarGenerado: (fileId) => guardarGenerado(db, chat.dueno, chat.id, turno.solicitante, fileId),
      artefactos,
      publicarArtefacto: (x) => publicarArtefacto(db, turno.solicitante, chat.id, x),
      leerArtefacto: (grupo) => leerArtefacto(db, turno.solicitante, chat.id, grupo),
      archivoPorId: async (id) => {
        const { data } = await db.schema('asistente').from('archivo').select('id, nombre, mime, bytes, ruta, origen, anthropic_file_id').eq('id', id).eq('chat_id', chat.id).eq('estado', 'listo').maybeSingle()
        return (data as ArchivoTurno | null) ?? null
      },
      modo: investigacion ? 'investigacion' : 'normal',
      puedeProgramar: !turno.corrida_id && puedeMotor('herramientas') && !!(pol as { puede_programar?: boolean } | null)?.puede_programar,
      topeUsd: investigacion ? Number(config.tope_investigacion_usd) : null,
      // Solo el motor de Anthropic se parte en tramos; el último tramo corre sin límite.
      limiteMs: turno.motor === 'anthropic' && TRAMO_MS > 0 && turno.tramos < MAX_TRAMOS - 1 ? TRAMO_MS : null,
      reanudar: reanuda ? turno.continuacion : null,
    }

    const inicio = Date.now()
    let r: ResultadoMotor
    try {
      if ((turno.motor as Motor) === 'anthropic') r = await ejecutarAnthropic(ctx, precioDe)
      else if ((turno.motor as Motor) === 'local') {
        if (!config.local_url) throw new Error('El motor local no está configurado (falta la dirección del servidor de modelos).')
        const nombreApi = (modelos ?? []).find((m) => m.id === turno.modelo)?.nombre_api || turno.modelo
        r = await ejecutarLocal(ctx, precioDe, { url: config.local_url, clave: process.env.ASISTENTE_LOCAL_CLAVE?.trim() || null, modelo: nombreApi, archivos: puedeMotor('archivos') })
      } else r = await ejecutarOpenAI(ctx, precioDe, turno.motor as Motor)
    } finally {
      clearInterval(vigia)
    }

    if (r.estado === 'continuar') {
      // Se acabó el tramo: el estado del motor queda en el turno y sigue en otra invocación.
      await db
        .schema('asistente')
        .from('turno')
        .update({ estado: 'en_cola', continuacion: r.continuacion as never, tramos: turno.tramos + 1, latido: new Date().toISOString(), duracion_ms: (turno.duracion_ms ?? 0) + Date.now() - inicio })
        .eq('id', turnoId)
      await emisor.terminar()
      await relanzar(turnoId, opciones)
      return true
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

    if (chat.compartido && r.bloques.some((b) => b.tipo === 'paso' && b.herramienta === 'datos')) {
      const { data: quien } = await db.from('profiles').select('nombre_completo').eq('id', turno.solicitante).maybeSingle()
      r.bloques.push({ tipo: 'nota', texto: `Consultado con los permisos de ${quien?.nombre_completo || 'quien escribió el mensaje'}.` })
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
          continuacion: null,
          categoria,
          primer_token_ms: r.primerTokenMs,
          duracion_ms: (turno.duracion_ms ?? 0) + Date.now() - inicio,
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
    return false
  } catch (e) {
    console.error('[asistente] turno', turnoId, e)
    return await cerrarFallido(mensajeDeError(e))
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
    const { data: previos } = await db
      .schema('asistente')
      .from('html')
      .select('version')
      .eq('grupo', grupo)
      .or(`chat_id.eq.${chat},dueno.eq.${solicitante}`)
      .order('version', { ascending: false })
      .limit(1)
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

async function leerArtefacto(db: BaseServicio, solicitante: string, chat: string, grupo: string): Promise<string | null> {
  const { data: v } = await db
    .schema('asistente')
    .from('html')
    .select('ruta')
    .eq('grupo', grupo)
    .or(`chat_id.eq.${chat},dueno.eq.${solicitante}`)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!v) return null
  const { data } = await db.storage.from('asistente').download(v.ruta)
  return data ? await data.text() : null
}
