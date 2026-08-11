/**
 * Importador de transcripciones de Fireflies.
 *
 * Fireflies exporta en dos formas y ambas llegan aquí:
 *  · JSON  — la forma de la API (`sentences[]` con speaker_name/start_time), o
 *            un objeto envuelto en `transcript` / `data.transcript`.
 *  · Markdown — el export legible, cuya marca de hablante varía según la
 *            configuración de la cuenta. Se soportan los formatos habituales.
 *
 * El parser nunca lanza por contenido malformado: acumula `advertencias` para
 * que el consultor vea qué no se pudo interpretar antes de guardar.
 */

/**
 * Valor serializable a JSON. Coincide estructuralmente con el tipo `Json` que
 * genera Supabase, así que `meta` entra en la columna jsonb sin castear.
 */
export type ValorJson =
  | string
  | number
  | boolean
  | null
  | { [clave: string]: ValorJson | undefined }
  | ValorJson[]

export type MetaTranscripcion = { [clave: string]: ValorJson | undefined }

export type SegmentoParseado = {
  indice: number
  hablante: string | null
  inicioSegundos: number | null
  finSegundos: number | null
  texto: string
}

export type TranscripcionParseada = {
  formato: 'json' | 'markdown'
  titulo: string | null
  fecha: string | null
  duracionMinutos: number | null
  participantes: string[]
  hablantes: string[]
  resumen: string | null
  segmentos: SegmentoParseado[]
  meta: MetaTranscripcion
  advertencias: string[]
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

/** "12:34" → 754 · "1:02:03" → 3723 · "78.5" → 78.5 */
export function parsearTiempo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null

  const texto = String(valor).trim()
  if (!texto) return null

  if (/^\d+(\.\d+)?$/.test(texto)) {
    const n = Number(texto)
    return Number.isFinite(n) ? n : null
  }

  const partes = texto.split(':')
  if (partes.length < 2 || partes.length > 3) return null
  if (!partes.every((p) => /^\d+(\.\d+)?$/.test(p.trim()))) return null

  const nums = partes.map((p) => Number(p.trim()))
  // Dos partes = mm:ss · tres partes = h:mm:ss
  return partes.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2]
}

/** Normaliza fechas variadas (ISO, epoch ms, dd/mm/yyyy) a YYYY-MM-DD. */
export function parsearFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'number') {
    // Fireflies entrega epoch en milisegundos.
    const d = new Date(valor > 1e12 ? valor : valor * 1000)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }

  const texto = String(valor).trim()
  if (!texto) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

  // dd/mm/yyyy y dd-mm-yyyy (convención local, no la de EE. UU.)
  const dmy = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function limpiar(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function unicos(valores: (string | null | undefined)[]): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const v of valores) {
    const s = (v ?? '').trim()
    if (!s || vistos.has(s.toLowerCase())) continue
    vistos.add(s.toLowerCase())
    salida.push(s)
  }
  return salida
}

// -----------------------------------------------------------------------------
// JSON
// -----------------------------------------------------------------------------

type Dict = Record<string, unknown>

function comoDict(valor: unknown): Dict | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Dict) : null
}

function primerString(fuente: Dict, claves: string[]): string | null {
  for (const c of claves) {
    const v = fuente[c]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** Aplana el resumen de Fireflies (overview, keywords, action_items…) a texto. */
function resumenDesdeJson(raiz: Dict): {
  resumen: string | null
  meta: MetaTranscripcion
} {
  const meta: MetaTranscripcion = {}
  const summary = comoDict(raiz.summary)

  if (!summary) {
    const suelto = primerString(raiz, ['summary', 'overview', 'resumen'])
    return { resumen: suelto, meta }
  }

  const resumen =
    primerString(summary, ['overview', 'short_summary', 'shortSummary', 'gist', 'summary']) ??
    null

  for (const clave of [
    'action_items',
    'actionItems',
    'keywords',
    'topics_discussed',
    'topicsDiscussed',
    'bullet_gist',
    'outline',
    'shorthand_bullet',
  ]) {
    // Viene de JSON.parse, así que ya es un valor JSON válido por construcción.
    if (summary[clave] !== undefined && summary[clave] !== null) {
      meta[clave] = summary[clave] as ValorJson
    }
  }

  return { resumen, meta }
}

function parsearJson(crudo: string): TranscripcionParseada {
  const advertencias: string[] = []
  let datos: unknown

  try {
    datos = JSON.parse(crudo)
  } catch (e) {
    return {
      formato: 'json',
      titulo: null,
      fecha: null,
      duracionMinutos: null,
      participantes: [],
      hablantes: [],
      resumen: null,
      segmentos: [],
      meta: {},
      advertencias: [`El archivo no es JSON válido: ${(e as Error).message}`],
    }
  }

  // Fireflies envuelve la transcripción de formas distintas según el export:
  // { sentences }, { transcript: {…} }, { data: { transcript: {…} } }…
  // Se desciende por las envolturas conocidas hasta encontrar las frases.
  const ENVOLTURAS = ['transcript', 'data', 'result', 'transcripts']
  const tieneFrases = (d: Dict) =>
    Array.isArray(d.sentences) || Array.isArray(d.segments) || Array.isArray(d.transcript)

  let raiz = comoDict(datos) ?? {}
  for (let profundidad = 0; profundidad < 4 && !tieneFrases(raiz); profundidad++) {
    let descendio = false
    for (const clave of ENVOLTURAS) {
      const interno = comoDict(raiz[clave])
      if (interno) {
        raiz = interno
        descendio = true
        break
      }
      // transcripts: [ {…} ] — se toma la primera transcripción del arreglo.
      if (Array.isArray(raiz[clave])) {
        const primero = comoDict((raiz[clave] as unknown[])[0])
        if (primero) {
          raiz = primero
          descendio = true
          break
        }
      }
    }
    if (!descendio) break
  }

  // Un array desnudo también es válido: se asume que son las frases.
  const frasesCrudas = Array.isArray(datos)
    ? datos
    : Array.isArray(raiz.sentences)
      ? raiz.sentences
      : Array.isArray(raiz.transcript)
        ? raiz.transcript
        : Array.isArray(raiz.segments)
          ? raiz.segments
          : []

  if (frasesCrudas.length === 0) {
    advertencias.push(
      'No se encontró un arreglo de frases (sentences / transcript / segments) en el JSON.'
    )
  }

  const segmentos: SegmentoParseado[] = []

  for (const cruda of frasesCrudas) {
    const f = comoDict(cruda)
    if (!f) continue

    const texto = limpiar(
      String(
        (typeof f.text === 'string' && f.text) ||
          (typeof f.raw_text === 'string' && f.raw_text) ||
          (typeof f.sentence === 'string' && f.sentence) ||
          ''
      )
    )
    if (!texto) continue

    const hablante =
      primerString(f, ['speaker_name', 'speakerName', 'speaker', 'speaker_label', 'name']) ??
      (typeof f.speaker_id === 'number' ? `Hablante ${f.speaker_id + 1}` : null)

    segmentos.push({
      indice: segmentos.length,
      hablante,
      inicioSegundos: parsearTiempo(f.start_time ?? f.startTime ?? f.start ?? f.time),
      finSegundos: parsearTiempo(f.end_time ?? f.endTime ?? f.end),
      texto,
    })
  }

  const { resumen, meta } = resumenDesdeJson(raiz)

  const participantesCrudos = Array.isArray(raiz.participants)
    ? raiz.participants
    : Array.isArray(raiz.attendees)
      ? raiz.attendees
      : []

  const participantes = unicos(
    participantesCrudos.map((p) => {
      if (typeof p === 'string') return p
      const d = comoDict(p)
      return d ? primerString(d, ['name', 'displayName', 'email']) : null
    })
  )

  const duracionCruda = raiz.duration ?? raiz.duration_minutes ?? raiz.durationMinutes
  let duracionMinutos: number | null = null
  if (typeof duracionCruda === 'number' && Number.isFinite(duracionCruda)) {
    // Fireflies reporta la duración en minutos; valores muy grandes son segundos.
    duracionMinutos = Math.round(duracionCruda > 600 ? duracionCruda / 60 : duracionCruda)
  }

  const urlCruda = raiz.transcript_url ?? raiz.transcriptUrl
  if (typeof urlCruda === 'string' && urlCruda) meta.fireflies_url = urlCruda
  if (participantes.length) meta.participantes = participantes

  return {
    formato: 'json',
    titulo: primerString(raiz, ['title', 'meeting_title', 'name', 'titulo']),
    fecha: parsearFecha(raiz.date ?? raiz.dateString ?? raiz.meeting_date ?? raiz.created_at),
    duracionMinutos,
    participantes,
    hablantes: unicos(segmentos.map((s) => s.hablante)),
    resumen,
    segmentos,
    meta,
    advertencias,
  }
}

// -----------------------------------------------------------------------------
// Markdown
// -----------------------------------------------------------------------------

const TIEMPO = String.raw`\d{1,2}:\d{2}(?::\d{2})?`

/**
 * Patrones de línea de hablante, del más específico al más general.
 * Cada uno debe capturar los grupos `hablante`, `tiempo` (opcional) y `resto`.
 */
const PATRONES_HABLANTE: {
  re: RegExp
  orden: ('hablante' | 'tiempo' | 'resto')[]
  /** Exige que el nombre sea Capitalizado palabra por palabra. */
  estricto?: boolean
}[] = [
  // **Nombre** 00:12  ·  **Nombre** (00:12):  ·  **Nombre:**
  {
    re: new RegExp(String.raw`^\*\*\s*([^*]{1,60}?)\s*:?\s*\*\*\s*[:\-–]?\s*\(?(${TIEMPO})?\)?\s*[:\-–]?\s*(.*)$`),
    orden: ['hablante', 'tiempo', 'resto'],
  },
  // [00:12] Nombre: texto  ·  00:12 - Nombre: texto
  {
    re: new RegExp(String.raw`^\[?\s*(${TIEMPO})\s*\]?\s*[-–]?\s*([^:\n]{1,60}?)\s*:\s*(.*)$`),
    orden: ['tiempo', 'hablante', 'resto'],
  },
  // Nombre (00:12): texto  ·  Nombre (00:12) texto
  {
    re: new RegExp(String.raw`^([^()\n]{1,60}?)\s*\(\s*(${TIEMPO})\s*\)\s*[:\-–]?\s*(.*)$`),
    orden: ['hablante', 'tiempo', 'resto'],
  },
  // Nombre 00:12  ·  Nombre  00:12:34   (timestamp sin delimitador)
  // Es el patrón más ambiguo: "Llegamos a las 10:30 todos los días" lo
  // dispararía. De ahí el nombre estricto.
  {
    re: new RegExp(String.raw`^([^:\n]{1,60}?)\s{1,}(${TIEMPO})\s*[:\-–]?\s*(.*)$`),
    orden: ['hablante', 'tiempo', 'resto'],
    estricto: true,
  },
]

// Último recurso: "Nombre: texto". Se exige que el nombre parezca un nombre
// (pocas palabras, sin puntuación de oración) para no partir párrafos normales.
const PATRON_SIMPLE = /^([^:\n]{2,50}?):\s+(.{2,})$/

/** Etiquetas de sección que aparecen como línea suelta, sin ser encabezado. */
const LINEA_ETIQUETA =
  /^(transcript|transcripci[óo]n|resumen|summary|overview|action items?|notes|notas|palabras clave|keywords|participantes|participants)\s*:?\s*$/i

/** Partículas que en español van en minúscula dentro de un nombre propio. */
const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'da', 'das', 'do', 'dos',
  'van', 'von', 'di', 'san', 'santa',
])

function pareceNombre(candidato: string): boolean {
  const s = candidato.trim()
  if (!s || s.length > 50) return false
  if (/[.!?;]/.test(s)) return false
  const palabras = s.split(/\s+/)
  if (palabras.length > 5) return false
  // Debe arrancar con mayúscula (o dígito, para "Hablante 2").
  return /^[\p{Lu}\p{N}]/u.test(s)
}

/**
 * Igual que `pareceNombre` pero exigiendo que cada palabra sea inicial
 * mayúscula, dígito o partícula. Descarta arranques de frase como
 * "Nos reunimos" o "Llegamos a las", que de otro modo pasarían por nombre.
 */
function pareceNombreEstricto(candidato: string): boolean {
  if (!pareceNombre(candidato)) return false
  return candidato
    .trim()
    .split(/\s+/)
    .every(
      (palabra) =>
        PARTICULAS.has(palabra.toLowerCase().replace(/[^\p{L}]/gu, '')) ||
        /^[\p{Lu}\p{N}]/u.test(palabra)
    )
}

/** Quita negritas, cursivas y viñetas para comparar y almacenar texto limpio. */
function desmarcar(texto: string): string {
  return texto
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|\s)\*(?!\s)(.+?)(?<!\s)\*/g, '$1$2')
    .trim()
}

type Seccion = { titulo: string | null; lineas: string[] }

function trocearSecciones(lineas: string[]): { titulo: string | null; secciones: Seccion[] } {
  let titulo: string | null = null
  const secciones: Seccion[] = [{ titulo: null, lineas: [] }]

  for (const linea of lineas) {
    const h1 = linea.match(/^#\s+(.*)$/)
    if (h1) {
      if (!titulo) titulo = desmarcar(h1[1])
      else secciones.push({ titulo: desmarcar(h1[1]), lineas: [] })
      continue
    }
    const h = linea.match(/^#{2,6}\s+(.*)$/)
    if (h) {
      secciones.push({ titulo: desmarcar(h[1]), lineas: [] })
      continue
    }
    secciones[secciones.length - 1].lineas.push(linea)
  }

  return { titulo, secciones }
}

function extraerSegmentos(
  lineas: string[],
  permitirSimple: boolean
): SegmentoParseado[] {
  const segmentos: SegmentoParseado[] = []
  let actual: SegmentoParseado | null = null

  const cerrar = () => {
    if (actual && actual.texto.trim()) {
      actual.texto = limpiar(actual.texto)
      actual.indice = segmentos.length
      segmentos.push(actual)
    }
    actual = null
  }

  for (const lineaCruda of lineas) {
    const linea = lineaCruda.trim()

    if (!linea) {
      // Una línea en blanco no cierra el turno: Fireflies parte párrafos largos.
      if (actual) actual.texto += '\n'
      continue
    }

    // Separadores y metadatos sueltos no aportan al turno.
    if (/^([-*_=]\s*){3,}$/.test(linea)) continue

    // "Transcript" o "Resumen" como línea suelta rotula la sección siguiente;
    // no es contenido. Solo se descarta si no hay un turno abierto, para no
    // comerse una palabra que legítimamente forme parte de lo dicho.
    if (!actual && LINEA_ETIQUETA.test(desmarcar(linea))) continue

    let encontrado: { hablante: string; tiempo: string | null; resto: string } | null = null

    for (const { re, orden, estricto } of PATRONES_HABLANTE) {
      const m = linea.match(re)
      if (!m) continue

      const campos: Record<string, string | undefined> = {}
      orden.forEach((nombre, i) => {
        campos[nombre] = m[i + 1]
      })

      const hablante = desmarcar(campos.hablante ?? '')
      const valido = estricto ? pareceNombreEstricto(hablante) : pareceNombre(hablante)
      if (!valido) continue

      encontrado = {
        hablante,
        tiempo: campos.tiempo ?? null,
        resto: desmarcar(campos.resto ?? ''),
      }
      break
    }

    if (!encontrado && permitirSimple) {
      const m = linea.match(PATRON_SIMPLE)
      if (m) {
        const hablante = desmarcar(m[1])
        if (pareceNombreEstricto(hablante)) {
          encontrado = { hablante, tiempo: null, resto: desmarcar(m[2]) }
        }
      }
    }

    if (encontrado) {
      cerrar()
      actual = {
        indice: 0,
        hablante: encontrado.hablante,
        inicioSegundos: parsearTiempo(encontrado.tiempo),
        finSegundos: null,
        texto: encontrado.resto,
      }
      continue
    }

    if (actual) {
      actual.texto += (actual.texto.endsWith('\n') || !actual.texto ? '' : ' ') + desmarcar(linea)
    } else {
      // Texto antes del primer hablante: se guarda como turno sin atribuir.
      actual = {
        indice: 0,
        hablante: null,
        inicioSegundos: null,
        finSegundos: null,
        texto: desmarcar(linea),
      }
    }
  }

  cerrar()

  // El fin de cada turno es el inicio del siguiente: da duración aproximada.
  for (let i = 0; i < segmentos.length - 1; i++) {
    if (segmentos[i].finSegundos === null) {
      segmentos[i].finSegundos = segmentos[i + 1].inicioSegundos
    }
  }

  return segmentos
}

function parsearMarkdown(crudo: string): TranscripcionParseada {
  const advertencias: string[] = []
  const lineas = crudo.replace(/\r\n?/g, '\n').split('\n')

  const { titulo, secciones } = trocearSecciones(lineas)

  // Metadatos del encabezado: **Fecha:** …, **Duration:** …, etc.
  const meta: MetaTranscripcion = {}
  const camposCabecera = new Map<string, string>()
  for (const linea of lineas.slice(0, 40)) {
    const m = linea.match(/^\s*(?:[-*]\s*)?\*{0,2}([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30})\*{0,2}\s*:\s*\*{0,2}(.+?)\*{0,2}\s*$/)
    if (m) camposCabecera.set(m[1].trim().toLowerCase(), desmarcar(m[2]))
  }

  const buscarCampo = (...claves: string[]) => {
    for (const c of claves) {
      for (const [k, v] of camposCabecera) {
        if (k === c || k.startsWith(c)) return v
      }
    }
    return null
  }

  const esTranscripcion = (t: string | null) =>
    !!t && /transcri|conversaci|di[áa]logo|dialogue/i.test(t)
  const esResumen = (t: string | null) =>
    !!t && /resumen|summary|overview|gist|s[íi]ntesis/i.test(t)
  const esAccion = (t: string | null) =>
    !!t && /action items?|tareas|pr[óo]ximos pasos|next steps|acuerdos/i.test(t)
  const esPalabras = (t: string | null) => !!t && /keywords?|palabras clave|temas|topics/i.test(t)

  const seccionesTranscripcion = secciones.filter((s) => esTranscripcion(s.titulo))

  let segmentos: SegmentoParseado[]

  if (seccionesTranscripcion.length > 0) {
    const lineasT = seccionesTranscripcion.flatMap((s) => s.lineas)
    segmentos = extraerSegmentos(lineasT, false)
    if (segmentos.length < 2) segmentos = extraerSegmentos(lineasT, true)
  } else {
    // Sin encabezado de transcripción: se recorre todo menos resumen y acciones.
    const lineasT = secciones
      .filter((s) => !esResumen(s.titulo) && !esAccion(s.titulo) && !esPalabras(s.titulo))
      .flatMap((s) => s.lineas)
    segmentos = extraerSegmentos(lineasT, false)
    if (segmentos.length < 2) segmentos = extraerSegmentos(lineasT, true)
    advertencias.push(
      'No se encontró una sección de transcripción; se interpretó todo el documento.'
    )
  }

  // Un solo segmento sin hablante significa que no se reconoció el formato.
  if (segmentos.length === 1 && !segmentos[0].hablante) {
    advertencias.push(
      'No se reconocieron marcas de hablante. El texto se importará como un bloque único; ' +
        'puedes corregir los turnos después de guardar.'
    )
  }
  if (segmentos.length === 0) {
    advertencias.push('No se encontró contenido de transcripción en el archivo.')
  }

  const resumenSecciones = secciones.filter((s) => esResumen(s.titulo))
  const resumen = resumenSecciones.length
    ? limpiar(resumenSecciones.flatMap((s) => s.lineas).map(desmarcar).join('\n')) || null
    : null

  for (const s of secciones) {
    if (esAccion(s.titulo)) {
      const contenido = limpiar(s.lineas.map(desmarcar).join('\n'))
      if (contenido) meta.action_items = contenido
    }
    if (esPalabras(s.titulo)) {
      const contenido = limpiar(s.lineas.map(desmarcar).join('\n'))
      if (contenido) meta.keywords = contenido
    }
  }

  const participantes = unicos(
    (buscarCampo('participantes', 'participants', 'asistentes', 'attendees') ?? '')
      .split(/[,;]/)
      .map((p) => p.trim())
  )
  if (participantes.length) meta.participantes = participantes

  const duracionTexto = buscarCampo('duraci', 'duration')
  let duracionMinutos: number | null = null
  if (duracionTexto) {
    const enMinutos = duracionTexto.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m\b)/i)
    if (enMinutos) {
      duracionMinutos = Math.round(Number(enMinutos[1].replace(',', '.')))
    } else {
      const reloj = parsearTiempo(duracionTexto.match(new RegExp(TIEMPO))?.[0])
      if (reloj !== null) duracionMinutos = Math.round(reloj / 60)
    }
  }
  // Sin dato explícito, el último timestamp da una duración razonable.
  if (duracionMinutos === null && segmentos.length) {
    const ultimo = [...segmentos].reverse().find((s) => s.inicioSegundos !== null)
    if (ultimo?.inicioSegundos) duracionMinutos = Math.max(1, Math.round(ultimo.inicioSegundos / 60))
  }

  const urlFireflies = crudo.match(/https?:\/\/[^\s)"']*fireflies\.ai[^\s)"']*/i)?.[0]
  if (urlFireflies) meta.fireflies_url = urlFireflies

  return {
    formato: 'markdown',
    titulo: titulo ?? buscarCampo('t[íi]tulo', 'title', 'reuni[óo]n', 'meeting'),
    fecha: parsearFecha(buscarCampo('fecha', 'date')),
    duracionMinutos,
    participantes,
    hablantes: unicos(segmentos.map((s) => s.hablante)),
    resumen,
    segmentos,
    meta,
    advertencias,
  }
}

// -----------------------------------------------------------------------------
// Entrada única
// -----------------------------------------------------------------------------

/**
 * Detecta el formato y parsea. `nombreArchivo` solo desempata cuando el
 * contenido es ambiguo; el criterio principal es la forma del texto.
 */
export function parsearTranscripcion(
  contenido: string,
  nombreArchivo?: string
): TranscripcionParseada {
  const texto = contenido.replace(/^﻿/, '').trim()

  if (!texto) {
    return {
      formato: 'markdown',
      titulo: null,
      fecha: null,
      duracionMinutos: null,
      participantes: [],
      hablantes: [],
      resumen: null,
      segmentos: [],
      meta: {},
      advertencias: ['El archivo está vacío.'],
    }
  }

  const pareceJson = texto.startsWith('{') || texto.startsWith('[')
  const extensionJson = !!nombreArchivo && /\.json$/i.test(nombreArchivo)

  if (pareceJson || extensionJson) {
    const resultado = parsearJson(texto)
    // Un .json ilegible no debe caer silenciosamente al parser de markdown.
    if (resultado.segmentos.length > 0 || pareceJson) return resultado
  }

  return parsearMarkdown(texto)
}
