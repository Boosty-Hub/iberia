/**
 * El motor local (fase 6): un servidor de modelos de Iberia con la API de Chat
 * Completions compatible con OpenAI (Ollama, vLLM, llama.cpp, LM Studio). Es la
 * API que todos hablan; la Responses API no.
 *
 * No trae entorno de código ni buscador: lo que no puede lo dice la matriz de
 * capacidades (`asistente.capacidad_motor`), que el ejecutor ya aplicó al armar
 * el contexto (sin herramientas de la plataforma si están apagadas). En modo
 * híbrido los archivos los procesa Anthropic (decisión 19), igual que con OpenAI.
 *
 * Sin Next ni `server-only`: lo carga la función de fondo.
 */
import type { Bloque } from '../tipos'
import { HERRAMIENTA_ARCHIVOS, HERRAMIENTA_ARTEFACTO, HERRAMIENTA_LEER_ARTEFACTO, contextoDelTurno, listaDeArtefactos } from './instrucciones'
import { ejecutarAnthropic, herramientaArtefacto, mensajeDeError } from './anthropic'
import { costoDe, sumarUso, usoVacio, type ContextoMotor, type Precio, type ResultadoMotor, type Uso } from './contrato'
import { NOMBRES_DATOS, herramientaDatos, herramientasDeDatos } from './datos'
import { HERRAMIENTAS_MEMORIA, NOMBRES_MEMORIA, contextoMemoria, herramientaMemoria } from './memoria'
import { HERRAMIENTA_PROPONER_TAREA, herramientaProponerTarea } from './tareas'

type Paso = Extract<Bloque, { tipo: 'paso' }>
type Mensaje = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: Llamada[]; tool_call_id?: string }
type UsoLocal = { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
type Llamada = { id: string; type: 'function'; function: { name: string; arguments: string } }

export type ConfigLocal = {
  /** La base de la API, terminada en /v1 (por ejemplo http://ia.iberia.interna:11434/v1). */
  url: string
  clave: string | null
  /** El nombre con que el servidor conoce el modelo. */
  modelo: string
  /** ¿Puede procesar archivos? (modo híbrido: por Anthropic). */
  archivos: boolean
}

const MAX_VUELTAS = 12
const MODELO_ARCHIVOS = 'claude-opus-5-5'

const AVISO_LOCAL = `

Motor local: corres en la infraestructura de Industrias Iberia. No tienes internet: si te piden algo de afuera (noticias, precios del mercado, la tasa del día), dilo y sugiere cambiar de motor o consultar la fuente.`
const AVISO_ARCHIVOS = `
Archivos: no los abres tú. Para leer, analizar o generar cualquier archivo usa la herramienta procesar_archivo con la instrucción completa.`
const AVISO_SIN_ARCHIVOS = `
Archivos: en este modo no puedes abrir ni generar archivos. Si te los piden, dilo.`

function herramienta(h: { name: string; description: string; input_schema: unknown }) {
  return { type: 'function', function: { name: h.name, description: h.description, parameters: h.input_schema } }
}

const TITULO: Record<string, { herramienta: Paso['herramienta']; titulo: string }> = {
  artefacto: { herramienta: 'html', titulo: 'Creando el artefacto' },
  leer_artefacto: { herramienta: 'html', titulo: 'Leyendo el artefacto' },
  procesar_archivo: { herramienta: 'archivo', titulo: 'Procesando los archivos' },
  proponer_tarea: { herramienta: 'otra', titulo: 'Proponiendo una tarea programada' },
}

/** Una vuelta: manda la conversación y lee el SSE de Chat Completions. */
async function vuelta(cfg: ConfigLocal, cuerpo: Record<string, unknown>, ctx: ContextoMotor, alPrimero: () => void, pasos: Map<string, Paso>) {
  const r = await fetch(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cfg.clave ? { Authorization: `Bearer ${cfg.clave}` } : {}) },
    body: JSON.stringify(cuerpo),
    signal: ctx.senal,
  })
  if (!r.ok || !r.body) throw Object.assign(new Error((await r.text()).slice(0, 400)), { status: r.status })
  const lector = r.body.getReader()
  const dec = new TextDecoder()
  let resto = ''
  let texto = ''
  let final: string | null = null
  let uso = null as UsoLocal | null
  const llamadas = new Map<number, Llamada>()
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    let i
    while ((i = resto.indexOf('\n')) >= 0) {
      const linea = resto.slice(0, i).trim()
      resto = resto.slice(i + 1)
      if (!linea.startsWith('data:')) continue
      const dato = linea.slice(5).trim()
      if (!dato || dato === '[DONE]') continue
      const ev = JSON.parse(dato) as {
        choices?: { delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[]
        usage?: UsoLocal
      }
      if (ev.usage) uso = ev.usage
      const c = ev.choices?.[0]
      if (!c) continue
      const d = c.delta ?? {}
      if (d.content) {
        alPrimero()
        texto += d.content
        ctx.emitir({ t: 'texto', turno: ctx.turno, d: d.content })
      }
      const razon = d.reasoning_content ?? d.reasoning
      if (razon) {
        alPrimero()
        ctx.emitir({ t: 'pensamiento', turno: ctx.turno, d: razon })
      }
      for (const tc of d.tool_calls ?? []) {
        const k = tc.index ?? llamadas.size
        let ll = llamadas.get(k)
        if (!ll) {
          ll = { id: tc.id || `llamada-${k}-${Date.now()}`, type: 'function', function: { name: tc.function?.name ?? '', arguments: '' } }
          llamadas.set(k, ll)
        }
        if (tc.function?.name && !ll.function.name) ll.function.name = tc.function.name
        if (tc.function?.arguments) ll.function.arguments += tc.function.arguments
        if (ll.function.name && !pasos.has(ll.id)) {
          alPrimero()
          const n = ll.function.name
          const t = TITULO[n] ?? (NOMBRES_DATOS.has(n) ? { herramienta: 'datos' as const, titulo: 'Consultando la plataforma' } : NOMBRES_MEMORIA.has(n) ? { herramienta: 'otra' as const, titulo: n === 'recordar' ? 'Guardando en tu memoria' : 'Olvidando un recuerdo' } : { herramienta: 'otra' as const, titulo: 'Trabajando' })
          const paso: Paso = { tipo: 'paso', id: ll.id, herramienta: t.herramienta, titulo: t.titulo, estado: 'corriendo' }
          pasos.set(ll.id, paso)
          ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
        }
      }
      if (c.finish_reason) final = c.finish_reason
    }
  }
  return { texto, final, uso, llamadas: [...llamadas.values()] }
}

export async function ejecutarLocal(ctx: ContextoMotor, precioDe: (modelo: string) => Precio, cfg: ConfigLocal): Promise<ResultadoMotor> {
  const inicio = Date.now()
  let primerTokenMs: number | null = null
  const alPrimero = () => {
    if (primerTokenMs === null) primerTokenMs = Date.now() - inicio
  }
  let uso: Uso = usoVacio()
  let contenedor = ctx.contenedorId
  let vigente = ctx.contenedorVigente
  const textos: string[] = []
  const bloques: Bloque[] = []
  const pasos = new Map<string, Paso>()

  const historial: Mensaje[] = []
  for (const h of ctx.historial) {
    let t = h.texto.trim()
    if (h.adjuntos.length) t += `\n\n[Adjuntó: ${h.adjuntos.join(', ')}]`
    if (h.generados.length) t += `\n\n[Archivos generados: ${h.generados.join(', ')}]`
    if (t) historial.push({ role: h.rol === 'usuario' ? 'user' : 'assistant', content: t })
  }
  while (historial.length && historial[0].role !== 'user') historial.shift()
  const lista = ctx.adjuntos.length ? `\n[Adjuntos de este mensaje: ${ctx.adjuntos.map((a) => a.nombre).join(', ')}]` : ''
  const mensajes: Mensaje[] = [
    { role: 'system', content: ctx.sistema + AVISO_LOCAL + (cfg.archivos ? AVISO_ARCHIVOS : AVISO_SIN_ARCHIVOS) },
    ...historial,
    { role: 'user', content: `${contextoDelTurno()}${lista}${listaDeArtefactos(ctx.artefactos)}${contextoMemoria(ctx.memoria)}\n\n${ctx.texto}` },
  ]
  const herramientas = [
    herramienta(HERRAMIENTA_ARTEFACTO),
    herramienta(HERRAMIENTA_LEER_ARTEFACTO),
    ...(cfg.archivos ? [herramienta(HERRAMIENTA_ARCHIVOS)] : []),
    ...(ctx.datos ? herramientasDeDatos(ctx.datos) : []).map(herramienta),
    ...(ctx.memoria ? HERRAMIENTAS_MEMORIA : []).map(herramienta),
    ...(ctx.puedeProgramar ? [herramienta(HERRAMIENTA_PROPONER_TAREA)] : []),
  ]

  try {
    for (let n = 0; n < MAX_VUELTAS; n++) {
      const r = await vuelta(cfg, { model: cfg.modelo, messages: mensajes, tools: herramientas, stream: true, stream_options: { include_usage: true } }, ctx, alPrimero, pasos)
      if (r.uso) {
        const cacheLee = r.uso.prompt_tokens_details?.cached_tokens ?? 0
        const parcial = { entrada: Math.max(0, (r.uso.prompt_tokens ?? 0) - cacheLee), salida: r.uso.completion_tokens ?? 0, cacheLee, cacheEscribe: 0, busquedas: 0 }
        uso = sumarUso(uso, { ...parcial, costoUsd: costoDe(precioDe(ctx.modelo), parcial) })
      }
      if (r.texto.trim()) textos.push(r.texto.trim())
      if (!r.llamadas.length) break
      mensajes.push({ role: 'assistant', content: r.texto || null, tool_calls: r.llamadas })
      for (const ll of r.llamadas) {
        const paso = pasos.get(ll.id)
        let salida: string
        let error = false
        try {
          const args = JSON.parse(ll.function.arguments || '{}') as Record<string, unknown>
          const nombre = ll.function.name
          if (NOMBRES_MEMORIA.has(nombre) && ctx.memoria) {
            const x = await herramientaMemoria(ctx.memoria, nombre, args)
            if (x.bloque) {
              bloques.push(x.bloque)
              ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: x.bloque })
            }
            if (paso) paso.titulo = x.titulo
            salida = x.texto
            error = !!x.error
          } else if (NOMBRES_DATOS.has(nombre) && ctx.datos) {
            const x = await herramientaDatos(ctx.datos, nombre, args)
            if (x.montar) {
              const a = await ctx.archivoPorId(x.montar)
              if (a) ctx.archivosDelChat.push(a)
            }
            if (paso) paso.titulo = x.titulo
            salida = x.texto
            error = !!x.error
          } else if (nombre === 'proponer_tarea' && ctx.puedeProgramar) {
            const x = await herramientaProponerTarea(args)
            if (x.bloque) {
              bloques.push(x.bloque)
              ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: x.bloque })
            }
            salida = x.texto
            error = !!x.error
          } else if (nombre === 'artefacto' || nombre === 'leer_artefacto') {
            const x = await herramientaArtefacto(ctx, nombre, args)
            if (x.bloque) {
              bloques.push(x.bloque)
              ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: x.bloque })
              if (paso) paso.titulo = `${x.bloque.version > 1 ? 'Actualizó' : 'Creó'} «${x.bloque.titulo}»`
            }
            salida = x.texto
            error = !!x.error
          } else if (nombre === 'procesar_archivo' && cfg.archivos) {
            // Modo híbrido: los archivos los procesa Anthropic (decisión 19).
            const nombres = (args.archivos as string[] | undefined) ?? []
            const sub = await ejecutarAnthropic(
              {
                ...ctx,
                modelo: MODELO_ARCHIVOS,
                esfuerzo: 'medium',
                historial: [],
                texto: `${String(args.instruccion ?? '')}\n\nDevuelve un resumen claro de lo que hiciste y encontraste; los archivos de salida van a la carpeta de salida.`,
                adjuntos: ctx.archivosDelChat.filter((a) => nombres.length === 0 || nombres.includes(a.nombre)),
                contenedorId: contenedor,
                contenedorVigente: vigente,
                datos: null,
                memoria: null,
                modo: 'normal',
                puedeProgramar: false,
                topeUsd: null,
                limiteMs: null,
                reanudar: null,
                emitir: (e) => {
                  if (e.t !== 'texto') ctx.emitir(e)
                },
              },
              precioDe
            )
            contenedor = sub.contenedorId ?? contenedor
            vigente = true
            uso = sumarUso(uso, { costoUsd: sub.uso.costoUsd })
            for (const b of sub.bloques) if (b.tipo === 'archivo' || b.tipo === 'artefacto') bloques.push(b)
            salida = sub.estado === 'listo' ? sub.texto || 'Listo.' : `No se pudo procesar: ${sub.error ?? 'error'}`
            error = sub.estado !== 'listo'
          } else {
            salida = `La herramienta «${nombre}» no está disponible con el motor local.`
            error = true
          }
        } catch (e) {
          salida = `Error: ${e instanceof Error ? e.message : 'no se pudo'}`
          error = true
        }
        if (paso) {
          paso.estado = error ? 'error' : 'listo'
          ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
        }
        mensajes.push({ role: 'tool', tool_call_id: ll.id, content: salida.slice(0, 20000) })
      }
    }
    bloques.unshift(...pasos.values())
    return { texto: textos.join('\n\n'), bloques, uso, contenedorId: contenedor, modeloServido: ctx.modelo, primerTokenMs, estado: 'listo' }
  } catch (e) {
    const detenido = ctx.senal.aborted
    bloques.unshift(...pasos.values())
    const err = e as { status?: number; cause?: { code?: string } }
    const sinRed = !err.status && /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(String((e as Error)?.message) + String(err.cause?.code ?? ''))
    return {
      texto: textos.join('\n\n'),
      bloques,
      uso,
      contenedorId: contenedor,
      modeloServido: ctx.modelo,
      primerTokenMs,
      estado: detenido ? 'detenido' : 'fallido',
      error: detenido ? undefined : sinRed ? 'No se alcanza el servidor de modelos de Iberia. Revisa que esté encendido y que la red llegue hasta él.' : mensajeDeError(e),
    }
  }
}

/** Pregunta al servidor qué modelos tiene (la prueba de conexión del panel). */
export async function modelosDelServidor(url: string, clave: string | null): Promise<{ ok: true; modelos: string[] } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/models`, { headers: clave ? { Authorization: `Bearer ${clave}` } : {}, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return { ok: false, error: `El servidor respondió ${r.status}.` }
    const cuerpo = (await r.json()) as { data?: { id: string }[] }
    return { ok: true, modelos: (cuerpo.data ?? []).map((m) => m.id).slice(0, 200) }
  } catch (e) {
    return { ok: false, error: `No se alcanza el servidor (${e instanceof Error ? e.message : 'sin respuesta'}).` }
  }
}
