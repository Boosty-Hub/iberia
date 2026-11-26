import type Anthropic from '@anthropic-ai/sdk'
import type { Bloque } from '../tipos'
import { BETAS_ANTHROPIC, crearAnthropic } from './servicio'
import { HERRAMIENTA_ARTEFACTO, HERRAMIENTA_LEER_ARTEFACTO, contextoDelTurno, listaDeArtefactos } from './instrucciones'
import { costoDe, sumarUso, usoVacio, type ContextoMotor, type Precio, type ResultadoMotor, type Uso } from './contrato'
import { NOMBRES_DATOS, herramientaDatos, herramientasDeDatos } from './datos'
import { HERRAMIENTAS_MEMORIA, NOMBRES_MEMORIA, contextoMemoria, herramientaMemoria } from './memoria'
import { HERRAMIENTA_PROPONER_TAREA, herramientaProponerTarea } from './tareas'

type Msg = Anthropic.Beta.BetaMessageParam
type Contenido = Anthropic.Beta.BetaContentBlockParam

const HABILIDADES = ['xlsx', 'docx', 'pptx', 'pdf'].map((skill_id) => ({ type: 'anthropic' as const, skill_id, version: 'latest' }))
const MAX_VUELTAS = 16
const MAX_VUELTAS_INVESTIGACION = 60

type Paso = Extract<Bloque, { tipo: 'paso' }>

/** Lo que guarda un tramo para que el siguiente siga donde iba (investigación profunda). */
type EstadoAnthropic = {
  mensajes: Msg[]
  contenedor: string | null
  uso: Uso
  modeloServido: string
  primerTokenMs: number | null
  textos: string[]
  bloques: Bloque[]
  fuentes: [string, string][]
  generados: string[]
  pasos: Paso[]
  pensamiento: string
  vueltas: number
  cierre: boolean
}

const AVISO_CIERRE = '[Aviso del sistema: se acabó el presupuesto de esta investigación. No uses más búsquedas ni consultas: entrega ya el informe con lo que tienes y di qué quedó sin confirmar.]'

const TITULO_HERRAMIENTA: Record<string, { herramienta: Extract<Bloque, { tipo: 'paso' }>['herramienta']; titulo: string }> = {
  code_execution: { herramienta: 'codigo', titulo: 'Ejecutando código' },
  bash_code_execution: { herramienta: 'codigo', titulo: 'Ejecutando código' },
  text_editor_code_execution: { herramienta: 'codigo', titulo: 'Escribiendo un archivo de trabajo' },
  web_search: { herramienta: 'busqueda', titulo: 'Buscando en internet' },
  web_fetch: { herramienta: 'busqueda', titulo: 'Leyendo una página' },
  artefacto: { herramienta: 'html', titulo: 'Creando el artefacto' },
  leer_artefacto: { herramienta: 'html', titulo: 'Leyendo el artefacto' },
  consultar_tabla: { herramienta: 'datos', titulo: 'Consultando la plataforma' },
  microsoft_correo: { herramienta: 'datos', titulo: 'Leyendo tu correo' },
  microsoft_calendario: { herramienta: 'datos', titulo: 'Revisando tu calendario' },
  microsoft_archivos: { herramienta: 'datos', titulo: 'Buscando en OneDrive y SharePoint' },
  microsoft_teams: { herramienta: 'datos', titulo: 'Leyendo Teams' },
  consultar_metrica: { herramienta: 'datos', titulo: 'Consultando una métrica' },
  buscar_documentos: { herramienta: 'datos', titulo: 'Buscando en los documentos' },
  recordar: { herramienta: 'otra', titulo: 'Guardando en tu memoria' },
  olvidar: { herramienta: 'otra', titulo: 'Olvidando un recuerdo' },
  proponer_tarea: { herramienta: 'otra', titulo: 'Proponiendo una tarea programada' },
}

/** El historial como texto: sin bloques de pensamiento de turnos anteriores (se pueden quitar todos sin romper nada). */
export function historialAnthropic(ctx: ContextoMotor): Msg[] {
  const msgs: Msg[] = []
  for (const h of ctx.historial) {
    let texto = h.texto.trim()
    if (h.adjuntos.length) texto += `\n\n[Adjuntó: ${h.adjuntos.join(', ')}]`
    if (h.generados.length) texto += `\n\n[Archivos generados: ${h.generados.join(', ')}]`
    if (!texto.trim()) continue
    msgs.push({ role: h.rol === 'usuario' ? 'user' : 'assistant', content: texto })
  }
  // La API pide que el primero sea del usuario.
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  return msgs
}

/** El mensaje de este turno: el contexto, los adjuntos montados en el contenedor (y a la vista si son imagen o PDF chico) y el texto. */
async function mensajeActual(ctx: ContextoMotor): Promise<Contenido[]> {
  const partes: Contenido[] = []
  const montar = new Map([...ctx.archivosFijos, ...ctx.adjuntos].map((a) => [a.id, a]))
  // Contenedor nuevo: se vuelven a montar los archivos que el chat ya tenía.
  if (!ctx.contenedorVigente) for (const a of ctx.archivosDelChat) montar.set(a.id, a)
  for (const a of montar.values()) {
    const fileId = await ctx.asegurarEnAnthropic(a)
    partes.push({ type: 'container_upload', file_id: fileId })
  }
  for (const a of ctx.adjuntos) {
    const fileId = await ctx.asegurarEnAnthropic(a)
    if (/^image\/(png|jpe?g|webp|gif)$/.test(a.mime)) partes.push({ type: 'image', source: { type: 'file', file_id: fileId } })
    else if (a.mime === 'application/pdf' && a.bytes <= 8 * 1024 * 1024) partes.push({ type: 'document', source: { type: 'file', file_id: fileId }, title: a.nombre })
  }
  const lista =
    (ctx.adjuntos.length ? `\n[Adjuntos de este mensaje, ya en tu entorno de código: ${ctx.adjuntos.map((a) => a.nombre).join(', ')}]` : '') +
    (ctx.archivosFijos.length ? `\n[Archivos de referencia del proyecto, en tu entorno de código: ${ctx.archivosFijos.map((a) => a.nombre).join(', ')}]` : '')
  partes.push({ type: 'text', text: `${contextoDelTurno()}${lista}${listaDeArtefactos(ctx.artefactos)}${contextoMemoria(ctx.memoria)}\n\n${ctx.texto}` })
  return partes
}

/** Los archivos que dejó la ejecución de código en un bloque de resultado. */
function archivosDe(bloque: unknown, ids: Set<string>) {
  const recorrer = (x: unknown) => {
    if (!x || typeof x !== 'object') return
    if (Array.isArray(x)) return x.forEach(recorrer)
    const o = x as Record<string, unknown>
    if (typeof o.file_id === 'string' && o.type !== 'container_upload') ids.add(o.file_id)
    Object.values(o).forEach(recorrer)
  }
  recorrer(bloque)
}

export async function ejecutarAnthropic(ctx: ContextoMotor, precioDe: (modelo: string) => Precio): Promise<ResultadoMotor> {
  const cliente = crearAnthropic()
  const previo = (ctx.reanudar ?? null) as EstadoAnthropic | null
  const mensajes: Msg[] = previo ? previo.mensajes : [...historialAnthropic(ctx), { role: 'user', content: await mensajeActual(ctx) }]
  let contenedor = previo ? previo.contenedor : ctx.contenedorVigente ? ctx.contenedorId : null
  let uso: Uso = previo?.uso ?? usoVacio()
  let modeloServido = previo?.modeloServido ?? ctx.modelo
  let primerTokenMs: number | null = previo?.primerTokenMs ?? null
  const inicio = Date.now()
  const textos: string[] = previo?.textos ?? []
  const bloques: Bloque[] = previo?.bloques ?? []
  const fuentes = new Map<string, string>(previo?.fuentes ?? [])
  const generados = new Set<string>(previo?.generados ?? [])
  const pasos = new Map<string, Paso>((previo?.pasos ?? []).map((x) => [x.id, x]))
  let pensamiento = previo?.pensamiento ?? ''
  const investigacion = ctx.modo === 'investigacion'
  const maxVueltas = investigacion ? MAX_VUELTAS_INVESTIGACION : MAX_VUELTAS
  let vuelta = previo?.vueltas ?? 0
  let cierre = previo?.cierre ?? false

  const marcarPrimero = () => {
    if (primerTokenMs === null) primerTokenMs = Date.now() - inicio
  }

  try {
    for (; vuelta < maxVueltas; vuelta++) {
      // Se acabó el tramo de la función de fondo: se guarda todo y sigue en otro.
      if (ctx.limiteMs && Date.now() - inicio > ctx.limiteMs) {
        const continuacion: EstadoAnthropic = {
          mensajes,
          contenedor,
          uso,
          modeloServido,
          primerTokenMs,
          textos,
          bloques,
          fuentes: [...fuentes],
          generados: [...generados],
          pasos: [...pasos.values()],
          pensamiento,
          vueltas: vuelta,
          cierre,
        }
        return { texto: '', bloques: [], uso: usoVacio(), contenedorId: contenedor, modeloServido, primerTokenMs, estado: 'continuar', continuacion }
      }
      // El tope de la investigación es duro: pasado, se cierra con lo que hay.
      if (ctx.topeUsd !== null && uso.costoUsd >= ctx.topeUsd) {
        textos.push('_(Se alcanzó el tope de gasto de esta investigación; el resultado llega hasta aquí.)_')
        break
      }
      const stream = cliente.beta.messages.stream(
        {
          model: ctx.modelo,
          max_tokens: 64000,
          betas: [...BETAS_ANTHROPIC],
          fallbacks: 'default',
          thinking: { type: 'adaptive', display: 'summarized' },
          output_config: { effort: ctx.esfuerzo },
          container: {
            ...(contenedor ? { id: contenedor } : {}),
            skills: [...HABILIDADES, ...ctx.habilidades.map((skill_id) => ({ type: 'custom' as const, skill_id, version: 'latest' }))],
          },
          system: [{ type: 'text', text: ctx.sistema, cache_control: { type: 'ephemeral' } }],
          tools: [
            { type: 'code_execution_20260521', name: 'code_execution' },
            { type: 'web_search_20250305', name: 'web_search', max_uses: investigacion ? 20 : 5 },
            { ...HERRAMIENTA_ARTEFACTO, eager_input_streaming: true } as Anthropic.Beta.BetaTool,
            HERRAMIENTA_LEER_ARTEFACTO as Anthropic.Beta.BetaTool,
            ...(ctx.datos ? herramientasDeDatos(ctx.datos) : []).map((h) => h as Anthropic.Beta.BetaTool),
            ...(ctx.memoria ? HERRAMIENTAS_MEMORIA : []).map((h) => h as Anthropic.Beta.BetaTool),
            ...(ctx.puedeProgramar ? [HERRAMIENTA_PROPONER_TAREA as Anthropic.Beta.BetaTool] : []),
          ],
          cache_control: { type: 'ephemeral' },
          messages: mensajes,
        },
        { signal: ctx.senal }
      )

      stream.on('streamEvent', (ev) => {
        if (ev.type === 'content_block_start') {
          const b = ev.content_block as { type: string; id?: string; name?: string }
          if ((b.type === 'server_tool_use' || b.type === 'tool_use') && b.id) {
            const t = TITULO_HERRAMIENTA[b.name ?? ''] ?? { herramienta: 'otra' as const, titulo: 'Trabajando' }
            const paso = { tipo: 'paso' as const, id: b.id, herramienta: t.herramienta, titulo: t.titulo, estado: 'corriendo' as const }
            pasos.set(b.id, paso)
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
            marcarPrimero()
          }
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta.type === 'text_delta') {
            marcarPrimero()
            ctx.emitir({ t: 'texto', turno: ctx.turno, d: ev.delta.text })
          } else if (ev.delta.type === 'thinking_delta') {
            marcarPrimero()
            ctx.emitir({ t: 'pensamiento', turno: ctx.turno, d: ev.delta.thinking })
          }
        }
      })

      const final = await stream.finalMessage()
      modeloServido = final.model ?? modeloServido
      contenedor = final.container?.id ?? contenedor
      const u = final.usage
      const parcial = {
        entrada: u.input_tokens,
        salida: u.output_tokens,
        cacheLee: u.cache_read_input_tokens ?? 0,
        cacheEscribe: u.cache_creation_input_tokens ?? 0,
        busquedas: u.server_tool_use?.web_search_requests ?? 0,
      }
      uso = sumarUso(uso, { ...parcial, costoUsd: costoDe(precioDe(modeloServido), parcial) })

      const resultadosHtml: Anthropic.Beta.BetaToolResultBlockParam[] = []
      // Lo que una herramienta trajo a mitad del turno (un Excel de OneDrive) se monta en el contenedor con los resultados.
      const montajes: Contenido[] = []
      for (const b of final.content) {
        if (b.type === 'text') {
          if (b.text.trim()) textos.push(b.text.trim())
        } else if (b.type === 'thinking') {
          if (b.thinking?.trim()) pensamiento += (pensamiento ? '\n\n' : '') + b.thinking.trim()
        } else if (b.type === 'web_search_tool_result') {
          const contenido = (b as { content: unknown }).content
          if (Array.isArray(contenido)) for (const r of contenido as { url?: string; title?: string }[]) if (r.url) fuentes.set(r.url, r.title ?? r.url)
          const paso = pasos.get((b as { tool_use_id: string }).tool_use_id)
          if (paso) {
            paso.estado = 'listo'
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
          }
        } else if (b.type.endsWith('_tool_result')) {
          archivosDe(b, generados)
          const id = (b as { tool_use_id?: string }).tool_use_id
          const paso = id ? pasos.get(id) : undefined
          if (paso) {
            const err = JSON.stringify(b).includes('_error"')
            paso.estado = err ? 'error' : 'listo'
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
          }
        } else if (b.type === 'tool_use' && NOMBRES_MEMORIA.has(b.name) && ctx.memoria) {
          const paso = pasos.get(b.id)
          const r = await herramientaMemoria(ctx.memoria, b.name, b.input)
          if (r.bloque) {
            bloques.push(r.bloque)
            ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: r.bloque })
          }
          if (paso) {
            paso.herramienta = 'otra'
            paso.titulo = r.titulo
            paso.estado = r.error ? 'error' : 'listo'
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
          }
          resultadosHtml.push({ type: 'tool_result', tool_use_id: b.id, content: r.texto, ...(r.error ? { is_error: true } : {}) })
        } else if (b.type === 'tool_use' && NOMBRES_DATOS.has(b.name) && ctx.datos) {
          const paso = pasos.get(b.id)
          const r = await herramientaDatos(ctx.datos, b.name, b.input)
          if (r.montar) {
            const a = await ctx.archivoPorId(r.montar)
            if (a) {
              montajes.push({ type: 'container_upload', file_id: await ctx.asegurarEnAnthropic(a) })
              ctx.archivosDelChat.push(a)
            }
          }
          if (paso) {
            paso.herramienta = 'datos'
            paso.titulo = r.titulo
            paso.estado = r.error ? 'error' : 'listo'
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
          }
          resultadosHtml.push({ type: 'tool_result', tool_use_id: b.id, content: r.texto, ...(r.error ? { is_error: true } : {}) })
        } else if (b.type === 'tool_use' && b.name === 'proponer_tarea' && ctx.puedeProgramar) {
          const paso = pasos.get(b.id)
          const r = await herramientaProponerTarea(b.input)
          if (r.bloque) {
            bloques.push(r.bloque)
            ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: r.bloque })
          }
          if (paso) {
            paso.estado = r.error ? 'error' : 'listo'
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
          }
          resultadosHtml.push({ type: 'tool_result', tool_use_id: b.id, content: r.texto, ...(r.error ? { is_error: true } : {}) })
        } else if (b.type === 'tool_use' && (b.name === 'artefacto' || b.name === 'leer_artefacto')) {
          const paso = pasos.get(b.id)
          const r = await herramientaArtefacto(ctx, b.name, b.input)
          if (r.bloque) {
            bloques.push(r.bloque)
            ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: r.bloque })
            if (paso) paso.titulo = `${r.bloque.version > 1 ? 'Actualizó' : 'Creó'} «${r.bloque.titulo}»`
          }
          if (paso) {
            paso.estado = r.error ? 'error' : 'listo'
            ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
          }
          resultadosHtml.push({ type: 'tool_result', tool_use_id: b.id, content: r.texto, ...(r.error ? { is_error: true } : {}) })
        }
      }

      if (final.stop_reason === 'tool_use' && resultadosHtml.length) {
        mensajes.push({ role: 'assistant', content: final.content as Contenido[] })
        // A los 80 % del tope de la investigación se le pide que cierre (una vez).
        const avisar = !cierre && ctx.topeUsd !== null && uso.costoUsd >= ctx.topeUsd * 0.8
        if (avisar) cierre = true
        mensajes.push({ role: 'user', content: [...resultadosHtml, ...montajes, ...(avisar ? [{ type: 'text' as const, text: AVISO_CIERRE }] : [])] })
        continue
      }
      if (final.stop_reason === 'pause_turn') {
        mensajes.push({ role: 'assistant', content: final.content as Contenido[] })
        continue
      }
      if (final.stop_reason === 'refusal') {
        textos.push('No puedo ayudar con esa petición. Si crees que es un error, reformúlala o escríbele a la administración de la plataforma.')
      } else if (final.stop_reason === 'max_tokens') {
        textos.push('_(La respuesta se cortó por largo. Pídeme que continúe.)_')
      }
      break
    }

    // Los archivos que dejó el código, a Storage.
    for (const id of generados) {
      const a = await ctx.guardarGenerado(id)
      if (a) {
        bloques.push(a)
        ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: a })
      }
    }
    for (const [url, titulo] of fuentes) bloques.push({ tipo: 'fuente', url, titulo })
    if (pensamiento) bloques.unshift({ tipo: 'pensamiento', texto: pensamiento.slice(0, 20000) })
    bloques.unshift(...pasos.values())
    return { texto: textos.join('\n\n'), bloques, uso, contenedorId: contenedor, modeloServido, primerTokenMs, estado: 'listo' }
  } catch (e) {
    const detenido = ctx.senal.aborted
    bloques.unshift(...pasos.values())
    return {
      texto: textos.join('\n\n'),
      bloques,
      uso,
      contenedorId: contenedor,
      modeloServido,
      primerTokenMs,
      estado: detenido ? 'detenido' : 'fallido',
      error: detenido ? undefined : mensajeDeError(e),
    }
  }
}

/** Ejecuta las herramientas de artefactos (iguales para los dos motores). */
export async function herramientaArtefacto(
  ctx: ContextoMotor,
  nombre: string,
  entrada: unknown
): Promise<{ texto: string; error?: boolean; bloque?: Extract<Bloque, { tipo: 'artefacto' }> }> {
  const e = (entrada ?? {}) as { artefacto_id?: unknown; titulo?: unknown; tipo?: unknown; contenido?: unknown }
  const conocido = (id: unknown) => (typeof id === 'string' && ctx.artefactos.some((a) => a.grupo === id) ? id : null)
  if (nombre === 'leer_artefacto') {
    const grupo = conocido(e.artefacto_id)
    if (!grupo) return { texto: 'Ese artefacto no existe en este chat.', error: true }
    const contenido = await ctx.leerArtefacto(grupo)
    return contenido === null ? { texto: 'No se pudo leer el artefacto.', error: true } : { texto: contenido.slice(0, 180000) }
  }
  const clase = e.tipo === 'documento' || e.tipo === 'svg' ? e.tipo : 'html'
  if (typeof e.titulo !== 'string' || typeof e.contenido !== 'string' || e.contenido.trim().length < 10) {
    return { texto: 'Faltan el título o el contenido completo (o vino cortado). Vuelve a intentarlo con el contenido entero.', error: true }
  }
  try {
    const grupo = conocido(e.artefacto_id)
    const bloque = await ctx.publicarArtefacto({ grupo, titulo: e.titulo.slice(0, 200), clase, contenido: e.contenido })
    const previo = ctx.artefactos.find((a) => a.grupo === bloque.grupo)
    if (previo) previo.version = bloque.version
    else ctx.artefactos.push({ grupo: bloque.grupo, titulo: bloque.titulo, clase, version: bloque.version })
    return { texto: `Listo: «${bloque.titulo}», versión ${bloque.version} (id ${bloque.grupo}). El usuario ya lo ve en el panel.`, bloque }
  } catch (err) {
    return { texto: `No se pudo guardar: ${err instanceof Error ? err.message : 'error'}`, error: true }
  }
}

export function mensajeDeError(e: unknown): string {
  const err = e as { status?: number; message?: string; name?: string }
  if (err?.status === 401) return 'La clave del proveedor de IA no autentica.'
  if (err?.status === 429) return 'El proveedor de IA está saturado. Intenta de nuevo en un momento.'
  if (err?.status === 529 || (err?.status ?? 0) >= 500) return 'El proveedor de IA no respondió. Intenta de nuevo.'
  if (err?.status === 400) return `El proveedor rechazó la petición: ${(err.message ?? '').slice(0, 300)}`
  return `No se pudo completar la respuesta${err?.message ? `: ${err.message.slice(0, 300)}` : '.'}`
}
