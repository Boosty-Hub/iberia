/**
 * Deduce los datos de una entrevista a partir de su transcripción de Fireflies,
 * para que cargar el archivo baste y no haya que escribir nada.
 *
 * Todo lo que sale de aquí es una *propuesta*: la UI la muestra antes de
 * guardar y el consultor puede corregirla. Por eso cada deducción viene con su
 * nivel de confianza en lugar de fingir certeza.
 */

import type { TranscripcionParseada } from '@/lib/fireflies'

export type AreaMinima = { id: string; nombre: string; slug: string }

export type Sede = 'caracas' | 'cagua' | 'remoto'

export type Hablante = {
  nombre: string
  palabras: number
  turnos: number
}

export type EntrevistaDerivada = {
  entrevistadoNombre: string
  entrevistadoCargo: string | null
  entrevistador: string | null
  areaId: string | null
  areaNombre: string | null
  sede: Sede | null
  fecha: string | null
  duracionMinutos: number | null
  resumen: string | null
  firefliesUrl: string | null
  hablantes: Hablante[]
  /** Alta: se dedujo de quién habla. Media: del título. Baja: del nombre del archivo. */
  confianza: 'alta' | 'media' | 'baja'
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Un correo no es un nombre presentable. */
function pareceCorreo(nombre: string): boolean {
  return /@/.test(nombre)
}

/** "juan.perez@iberia.com" → "Juan Perez", como último recurso. */
function nombreDesdeCorreo(correo: string): string {
  const local = correo.split('@')[0]
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length
}

/** Hablantes ordenados por volumen de habla, de mayor a menor. */
export function perfilarHablantes(parseada: TranscripcionParseada): Hablante[] {
  const mapa = new Map<string, Hablante>()

  for (const s of parseada.segmentos) {
    const nombre = s.hablante?.trim()
    if (!nombre) continue
    const actual = mapa.get(nombre) ?? { nombre, palabras: 0, turnos: 0 }
    actual.palabras += contarPalabras(s.texto)
    actual.turnos += 1
    mapa.set(nombre, actual)
  }

  return [...mapa.values()].sort((a, b) => b.palabras - a.palabras)
}

// La captura se detiene en cualquier separador, guiones incluidos: en
// "Gerente de Producción — Planta Cagua" el cargo es solo la primera parte.
const ROLES =
  /\b(gerente|gerencia|director(?:a)?|direcci[oó]n|coordinador(?:a)?|coordinaci[oó]n|jefe|jefa|supervisor(?:a)?|analista|asistente|encargad[oa]|l[ií]der|presidente|vicepresidente|contralor(?:a)?|tesorer[oa])\b[^,.;|·\n\-–—]*/i

/** Busca un cargo en el título de la reunión ("Entrevista Gerente de Planta"). */
function cargoDesdeTitulo(titulo: string | null): string | null {
  if (!titulo) return null
  const m = titulo.match(ROLES)
  if (!m) return null
  const cargo = m[0].trim().replace(/\s{2,}/g, ' ')
  // Un fragmento de una sola palabra genérica no aporta.
  return cargo.split(/\s+/).length >= 2 ? cargo : null
}

/** Palabras con las que Fireflies encabeza el título, no parte del nombre. */
const ENCABEZADOS = /^\s*(entrevista|reuni[oó]n|meeting|llamada|sesi[oó]n|call)\b\s*(con|de|a|al)?\s*/i

/** Lugares y herramientas: se detectan como sede, nunca como nombre de persona. */
const LUGARES = /\b(planta|cagua|caracas|oficina|sede|zoom|meet|teams|remoto)\b/i

/**
 * Nombre propio dentro del título, cuando Fireflies lo nombra
 * ("Entrevista Luis Pérez - Producción" o "Entrevista Carmen Ruiz").
 */
function nombreDesdeTitulo(titulo: string | null): string | null {
  if (!titulo) return null

  const partes = titulo.split(/[-–—|·:]/).map((p) => p.trim())
  for (const parte of partes) {
    // Se descarta el encabezado antes de juzgar, no la parte entera: si no,
    // "Entrevista Carmen Ruiz" se perdería por completo.
    const limpio = parte.replace(ENCABEZADOS, '').trim()
    if (!limpio) continue

    const palabras = limpio.split(/\s+/).filter(Boolean)
    if (palabras.length < 2 || palabras.length > 4) continue
    if (ROLES.test(limpio)) continue
    if (LUGARES.test(limpio)) continue
    if (palabras.every((p) => /^[\p{Lu}]/u.test(p))) return limpio
  }
  return null
}

function detectarSede(textos: (string | null | undefined)[]): Sede | null {
  const todo = normalizar(textos.filter(Boolean).join(' '))
  if (/\bcagua\b|\bplanta\b/.test(todo)) return 'cagua'
  if (/\bcaracas\b/.test(todo)) return 'caracas'
  if (/\bremot|\bzoom\b|\bmeet\b|\bteams\b/.test(todo)) return 'remoto'
  return null
}

/**
 * Frases con las que se reconoce un área. Se parte solo por "/" y " y ", nunca
 * por palabra suelta: "Gerencia General" debe exigir las dos, porque "general"
 * por su cuenta aparece en cualquier título.
 */
function frasesDeArea(nombre: string): string[] {
  return nombre
    .split(/\s*\/\s*|\s+y\s+/i)
    .map((f) => normalizar(f))
    .filter((f) => f.length >= 4)
}

function contiene(texto: string, frase: string): boolean {
  const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escapada}\\b`).test(texto)
}

/** Área cuya frase coincidente sea la más larga, o null si ninguna coincide. */
function buscarArea(texto: string, areas: AreaMinima[]): AreaMinima | null {
  let mejor: { area: AreaMinima; largo: number } | null = null

  for (const area of areas) {
    for (const frase of frasesDeArea(area.nombre)) {
      if (contiene(texto, frase) && (!mejor || frase.length > mejor.largo)) {
        mejor = { area, largo: frase.length }
      }
    }
  }

  return mejor?.area ?? null
}

/**
 * El título nombra el área; el resumen solo la menciona de pasada. Por eso se
 * consulta el título primero: "Entrevista Gerente de Producción" es Producción
 * aunque el resumen hable de planificación.
 */
function detectarArea(
  titulo: string | null,
  resumen: string | null,
  areas: AreaMinima[]
): AreaMinima | null {
  if (titulo) {
    const porTitulo = buscarArea(normalizar(titulo), areas)
    if (porTitulo) return porTitulo
  }
  return resumen ? buscarArea(normalizar(resumen), areas) : null
}

export function derivarEntrevista(
  parseada: TranscripcionParseada,
  areas: AreaMinima[],
  nombreArchivo?: string
): EntrevistaDerivada {
  const hablantes = perfilarHablantes(parseada)

  // En una entrevista el entrevistado habla más que quien pregunta: el que más
  // palabras aporta es el entrevistado, y el segundo, el entrevistador.
  const conNombre = hablantes.filter((h) => !pareceCorreo(h.nombre))
  const principal = conNombre[0] ?? hablantes[0] ?? null
  const secundario = (conNombre[1] ?? hablantes[1]) ?? null

  const delTitulo = nombreDesdeTitulo(parseada.titulo)

  let entrevistadoNombre: string
  let confianza: EntrevistaDerivada['confianza']

  if (principal) {
    entrevistadoNombre = pareceCorreo(principal.nombre)
      ? nombreDesdeCorreo(principal.nombre)
      : principal.nombre
    confianza = 'alta'
  } else if (delTitulo) {
    entrevistadoNombre = delTitulo
    confianza = 'media'
  } else if (parseada.titulo) {
    entrevistadoNombre = parseada.titulo.slice(0, 120)
    confianza = 'media'
  } else {
    // Sin hablantes ni título: el nombre del archivo es lo único que queda.
    entrevistadoNombre =
      nombreArchivo?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
      'Entrevista sin identificar'
    confianza = 'baja'
  }

  const contexto = [parseada.titulo, parseada.resumen]
  const area = detectarArea(parseada.titulo, parseada.resumen, areas)

  return {
    entrevistadoNombre,
    entrevistadoCargo: cargoDesdeTitulo(parseada.titulo),
    entrevistador: secundario
      ? pareceCorreo(secundario.nombre)
        ? nombreDesdeCorreo(secundario.nombre)
        : secundario.nombre
      : null,
    areaId: area?.id ?? null,
    areaNombre: area?.nombre ?? null,
    sede: detectarSede(contexto),
    fecha: parseada.fecha,
    duracionMinutos: parseada.duracionMinutos,
    resumen: parseada.resumen,
    firefliesUrl: (parseada.meta.fireflies_url as string | undefined) ?? null,
    hablantes,
    confianza,
  }
}
