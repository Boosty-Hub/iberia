import type { Bloque, Motor } from '../tipos'
import { claveOpenAI } from './servicio'
import { HERRAMIENTA_ARCHIVOS, HERRAMIENTA_ARTEFACTO, HERRAMIENTA_LEER_ARTEFACTO, contextoDelTurno, listaDeArtefactos } from './instrucciones'
import { ejecutarAnthropic, herramientaArtefacto, mensajeDeError } from './anthropic'
import { costoDe, sumarUso, usoVacio, type ContextoMotor, type Precio, type ResultadoMotor, type Uso } from './contrato'
import { NOMBRES_DATOS, herramientaDatos, herramientasDeDatos } from './datos'
import { NOMBRES_MEMORIA, contextoMemoria, herramientaMemoria, herramientasDeMemoria } from './memoria'
import { HERRAMIENTA_PROPONER_TAREA, herramientaProponerTarea } from './tareas'

type Item = Record<string, unknown>
const MAX_VUELTAS = 12
/** El modelo de Anthropic que procesa los archivos cuando el motor es OpenAI (decisión 19). */
export const MODELO_ARCHIVOS = 'claude-opus-5-5'

const AVISO_ARCHIVOS =
  '\n\nArchivos: no los abres tú. Para leer, analizar o generar cualquier archivo (Excel, Word, PDF, PowerPoint, CSV, imágenes) usa la herramienta procesar_archivo con la instrucción completa; ella devuelve lo que encontró y los archivos que generó, que el usuario ya ve en el chat. No digas que no puedes abrir archivos: usa la herramienta.'

function historialOpenAI(ctx: ContextoMotor): Item[] {
  const items: Item[] = []
  for (const h of ctx.historial) {
    let texto = h.texto.trim()
    if (h.adjuntos.length) texto += `\n\n[Adjuntó: ${h.adjuntos.join(', ')}]`
    if (h.generados.length) texto += `\n\n[Archivos generados: ${h.generados.join(', ')}]`
    if (!texto.trim()) continue
    items.push(
      h.rol === 'usuario'
        ? { role: 'user', content: [{ type: 'input_text', text: texto }] }
        : { role: 'assistant', content: [{ type: 'output_text', text: texto }] }
    )
  }
  return items
}

/** Lee el SSE de la Responses API y devuelve la respuesta final. */
async function correr(cuerpo: Record<string, unknown>, ctx: ContextoMotor, base: string, clave: string, alPrimero: () => void, pasos: Map<string, Extract<Bloque, { tipo: 'paso' }>>) {
  const r = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: ctx.senal,
  })
  if (!r.ok || !r.body) {
    const detalle = (await r.text()).slice(0, 400)
    throw Object.assign(new Error(detalle), { status: r.status })
  }
  const lector = r.body.getReader()
  const dec = new TextDecoder()
  let resto = ''
  let final: Record<string, unknown> | null = null
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    let i
    while ((i = resto.indexOf('\n\n')) >= 0) {
      const trozo = resto.slice(0, i)
      resto = resto.slice(i + 2)
      const linea = trozo.split('\n').find((l) => l.startsWith('data: '))
      if (!linea || linea === 'data: [DONE]') continue
      const ev = JSON.parse(linea.slice(6)) as { type: string; delta?: string; item?: Item; response?: Record<string, unknown> }
      if (ev.type === 'response.output_text.delta' && ev.delta) {
        alPrimero()
        ctx.emitir({ t: 'texto', turno: ctx.turno, d: ev.delta })
      } else if (ev.type === 'response.reasoning_summary_text.delta' && ev.delta) {
        alPrimero()
        ctx.emitir({ t: 'pensamiento', turno: ctx.turno, d: ev.delta })
      } else if (ev.type === 'response.output_item.added' && ev.item) {
        const it = ev.item
        const id = String(it.id ?? '')
        if (it.type === 'web_search_call' || it.type === 'function_call') {
          alPrimero()
          const nombre = String(it.name ?? '')
          const paso: Extract<Bloque, { tipo: 'paso' }> =
            it.type === 'web_search_call'
              ? { tipo: 'paso', id, herramienta: 'busqueda', titulo: 'Buscando en internet', estado: 'corriendo' }
              : NOMBRES_MEMORIA.has(nombre)
                ? { tipo: 'paso', id, herramienta: 'otra', titulo: nombre === 'recordar' ? 'Guardando en tu memoria' : 'Olvidando un recuerdo', estado: 'corriendo' }
                : NOMBRES_DATOS.has(nombre)
                ? { tipo: 'paso', id, herramienta: 'datos', titulo: 'Consultando la plataforma', estado: 'corriendo' }
                : nombre === 'artefacto' || nombre === 'leer_artefacto'
                ? { tipo: 'paso', id, herramienta: 'html', titulo: nombre === 'artefacto' ? 'Creando el artefacto' : 'Leyendo el artefacto', estado: 'corriendo' }
                : { tipo: 'paso', id, herramienta: 'archivo', titulo: 'Procesando los archivos', estado: 'corriendo' }
          pasos.set(id, paso)
          ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
        }
      } else if (ev.type === 'response.output_item.done' && ev.item?.type === 'web_search_call') {
        const paso = pasos.get(String(ev.item.id))
        if (paso) {
          paso.estado = 'listo'
          ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
        }
      } else if (ev.type === 'response.completed' || ev.type === 'response.incomplete' || ev.type === 'response.failed') {
        final = ev.response ?? null
      }
    }
  }
  if (!final) throw new Error('La respuesta de OpenAI se cortó.')
  return final
}

export async function ejecutarOpenAI(ctx: ContextoMotor, precioDe: (modelo: string) => Precio, motor: Motor): Promise<ResultadoMotor> {
  if (motor === 'local') {
    return { texto: '', bloques: [], uso: usoVacio(), contenedorId: ctx.contenedorId, modeloServido: ctx.modelo, primerTokenMs: null, estado: 'fallido', error: 'El motor local todavía no está configurado (fase 6).' }
  }
  const clave = claveOpenAI()
  const base = 'https://api.openai.com/v1'
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
  const pasos = new Map<string, Extract<Bloque, { tipo: 'paso' }>>()
  const fuentes = new Map<string, string>()
  const lista = ctx.adjuntos.length ? `\n[Adjuntos de este mensaje: ${ctx.adjuntos.map((a) => a.nombre).join(', ')}]` : ''
  const entrada: Item[] = [...historialOpenAI(ctx), { role: 'user', content: [{ type: 'input_text', text: `${contextoDelTurno()}${lista}${listaDeArtefactos(ctx.artefactos)}${contextoMemoria(ctx.memoria)}${ctx.recuerdo ?? ''}\n\n${ctx.texto}` }] }]

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const final = await correr(
        {
          model: ctx.modelo,
          instructions: ctx.sistema + AVISO_ARCHIVOS,
          input: entrada,
          stream: true,
          store: false,
          include: ['reasoning.encrypted_content'],
          reasoning: { effort: ctx.esfuerzo === 'xhigh' || ctx.esfuerzo === 'max' ? 'high' : ctx.esfuerzo, summary: 'auto' },
          tools: [
            { type: 'web_search' },
            { type: 'function', name: HERRAMIENTA_ARTEFACTO.name, description: HERRAMIENTA_ARTEFACTO.description, parameters: HERRAMIENTA_ARTEFACTO.input_schema, strict: true },
            { type: 'function', name: HERRAMIENTA_LEER_ARTEFACTO.name, description: HERRAMIENTA_LEER_ARTEFACTO.description, parameters: HERRAMIENTA_LEER_ARTEFACTO.input_schema, strict: true },
            { type: 'function', name: HERRAMIENTA_ARCHIVOS.name, description: HERRAMIENTA_ARCHIVOS.description, parameters: HERRAMIENTA_ARCHIVOS.input_schema, strict: true },
            ...(ctx.datos ? herramientasDeDatos(ctx.datos) : []).map((h) => ({ type: 'function', name: h.name, description: h.description, parameters: h.input_schema, strict: true })),
            ...herramientasDeMemoria(ctx.memoria).map((h) => ({ type: 'function', name: h.name, description: h.description, parameters: h.input_schema, strict: true })),
            ...(ctx.puedeProgramar ? [HERRAMIENTA_PROPONER_TAREA] : []).map((h) => ({ type: 'function', name: h.name, description: h.description, parameters: h.input_schema, strict: true })),
          ],
        },
        ctx,
        base,
        clave,
        alPrimero,
        pasos
      )
      const u = (final.usage ?? {}) as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } }
      const salida = (final.output ?? []) as Item[]
      const cacheLee = u.input_tokens_details?.cached_tokens ?? 0
      const cacheEscribe = u.input_tokens_details?.cache_write_tokens ?? 0
      const parcial = {
        entrada: Math.max(0, (u.input_tokens ?? 0) - cacheLee - cacheEscribe),
        salida: u.output_tokens ?? 0,
        cacheLee,
        cacheEscribe,
        busquedas: salida.filter((o) => o.type === 'web_search_call').length,
      }
      uso = sumarUso(uso, { ...parcial, costoUsd: costoDe(precioDe(ctx.modelo), parcial) })

      const llamadas: Item[] = []
      for (const o of salida) {
        if (o.type === 'message') {
          for (const c of (o.content ?? []) as { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[]) {
            if (c.type === 'output_text' && c.text?.trim()) textos.push(c.text.trim())
            for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) fuentes.set(a.url, a.title ?? a.url)
          }
        } else if (o.type === 'function_call') {
          llamadas.push(o)
        }
      }
      if (!llamadas.length) break

      entrada.push(...salida)
      for (const ll of llamadas) {
        const id = String(ll.id ?? '')
        const paso = pasos.get(id)
        let salidaHerramienta: string
        try {
          const args = JSON.parse(String(ll.arguments ?? '{}')) as Record<string, unknown>
          if (NOMBRES_MEMORIA.has(String(ll.name)) && ctx.memoria) {
            const r = await herramientaMemoria(ctx.memoria, String(ll.name), args)
            if (r.bloque) {
              bloques.push(r.bloque)
              ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: r.bloque })
            }
            if (paso) {
              paso.titulo = r.titulo
              if (r.error) paso.estado = 'error'
            }
            salidaHerramienta = r.texto
          } else if (NOMBRES_DATOS.has(String(ll.name)) && ctx.datos) {
            const r = await herramientaDatos(ctx.datos, String(ll.name), args)
            if (r.montar) {
              const a = await ctx.archivoPorId(r.montar)
              if (a) ctx.archivosDelChat.push(a)
            }
            if (paso) {
              paso.herramienta = 'datos'
              paso.titulo = r.titulo
              if (r.error) paso.estado = 'error'
            }
            salidaHerramienta = r.texto
          } else if (ll.name === 'proponer_tarea' && ctx.puedeProgramar) {
            const r = await herramientaProponerTarea(args)
            if (r.bloque) {
              bloques.push(r.bloque)
              ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: r.bloque })
            }
            if (r.error && paso) paso.estado = 'error'
            salidaHerramienta = r.texto
          } else if (ll.name === 'artefacto' || ll.name === 'leer_artefacto') {
            const r = await herramientaArtefacto(ctx, String(ll.name), args)
            if (r.bloque) {
              bloques.push(r.bloque)
              ctx.emitir({ t: 'bloque', turno: ctx.turno, bloque: r.bloque })
              if (paso) paso.titulo = `${r.bloque.version > 1 ? 'Actualizó' : 'Creó'} «${r.bloque.titulo}»`
            }
            if (r.error && paso) paso.estado = 'error'
            salidaHerramienta = r.texto
          } else {
            // Decisión 19: los archivos los procesa Anthropic, sea cual sea el motor.
            const nombres = (args.archivos as string[] | undefined) ?? []
            const elegidos = ctx.archivosDelChat.filter((a) => nombres.length === 0 || nombres.includes(a.nombre))
            const sub = await ejecutarAnthropic(
              {
                ...ctx,
                modelo: MODELO_ARCHIVOS,
                esfuerzo: 'medium',
                historial: [],
                texto: `${String(args.instruccion ?? '')}\n\nDevuelve un resumen claro de lo que hiciste y encontraste; los archivos de salida van a la carpeta de salida.`,
                adjuntos: elegidos,
                contenedorId: contenedor,
                contenedorVigente: vigente,
                modo: 'normal',
                puedeProgramar: false,
                topeUsd: null,
                limiteMs: null,
                reanudar: null,
                // Lo que escribe el procesador no es la respuesta: no se transmite como texto.
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
            salidaHerramienta = sub.estado === 'listo' ? sub.texto || 'Listo.' : `No se pudo procesar: ${sub.error ?? 'error'}`
          }
          if (paso && paso.estado !== 'error') paso.estado = 'listo'
        } catch (e) {
          if (paso) paso.estado = 'error'
          salidaHerramienta = `Error: ${e instanceof Error ? e.message : 'desconocido'}`
        }
        if (paso) ctx.emitir({ t: 'paso', turno: ctx.turno, paso })
        entrada.push({ type: 'function_call_output', call_id: ll.call_id, output: salidaHerramienta.slice(0, 20000) })
      }
    }
    for (const [url, titulo] of fuentes) bloques.push({ tipo: 'fuente', url, titulo })
    bloques.unshift(...pasos.values())
    return { texto: textos.join('\n\n'), bloques, uso, contenedorId: contenedor, modeloServido: ctx.modelo, primerTokenMs, estado: 'listo' }
  } catch (e) {
    const detenido = ctx.senal.aborted
    bloques.unshift(...pasos.values())
    return { texto: textos.join('\n\n'), bloques, uso, contenedorId: contenedor, modeloServido: ctx.modelo, primerTokenMs, estado: detenido ? 'detenido' : 'fallido', error: detenido ? undefined : mensajeDeError(e) }
  }
}
