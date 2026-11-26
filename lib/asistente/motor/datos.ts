/**
 * Las herramientas de datos de la fase 2, del lado del ejecutor: piden a la ruta
 * interna `/api/asistente/fuente` (que corre dentro de Next, con las mismas
 * definiciones de tablas de la plataforma) el catálogo de lo que esta persona
 * puede consultar y cada consulta, con el token de su sesión. Sin Next ni
 * `server-only`: lo carga la función de fondo.
 */
import { secretoAsistente } from './servicio'

export type CatalogoDatos = {
  fuentes: { clave: string; sensible: boolean }[]
  tablas: { fuente: string; titulo: string; columnas: { clave: string; etiqueta: string; filtrable: boolean }[]; buscable: boolean }[]
  metricas: { clave: string; nombre: string; unidad: string }[]
  documentos: boolean
}

export type Datos = {
  catalogo: CatalogoDatos
  consultar: (fuente: string, args: Record<string, unknown>) => Promise<{ resultado: Record<string, unknown>; sensible?: boolean }>
}

function base(): string {
  return (process.env.ASISTENTE_URL_BASE || process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

async function pedir(cuerpo: Record<string, unknown>) {
  const r = await fetch(`${base()}/api/asistente/fuente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': secretoAsistente() },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`fuente ${r.status}`)
  return r.json()
}

/** El catálogo de esta persona y la función para consultar. Sin token o sin fuentes, `null`: el asistente no ofrece datos. */
export async function prepararDatos(token: string | null | undefined, turno: string): Promise<Datos | null> {
  if (!token) return null
  try {
    const catalogo = (await pedir({ accion: 'catalogo', token })) as CatalogoDatos
    if (!catalogo.fuentes?.length) return null
    return {
      catalogo,
      consultar: async (fuente, args) => pedir({ accion: 'consultar', token, turno, fuente, args }),
    }
  } catch (e) {
    console.warn('[asistente] sin catálogo de datos:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Las herramientas para el modelo, armadas con el catálogo de esta persona. */
export function herramientasDeDatos(d: Datos) {
  const h: { name: string; description: string; input_schema: Record<string, unknown> }[] = []
  if (d.catalogo.tablas.length) {
    const lista = d.catalogo.tablas
      .map((t) => `- ${t.fuente} «${t.titulo}»${t.buscable ? ' (admite buscar texto)' : ''}: ${t.columnas.map((c) => `${c.clave}${c.filtrable ? '*' : ''} (${c.etiqueta})`).join(', ')}`)
      .join('\n')
    h.push({
      name: 'consultar_tabla',
      description: `Consulta una tabla de la Plataforma Iberia con los permisos de quien pregunta: devuelve las filas (con un enlace a la ficha de cada una cuando existe), el total y el enlace a la tabla. Las columnas con * se pueden filtrar por valor exacto. Pide solo lo necesario: máximo 200 filas.\n\nTablas disponibles:\n${lista}`,
      input_schema: {
        type: 'object',
        properties: {
          fuente: { type: 'string', enum: d.catalogo.tablas.map((t) => t.fuente) },
          buscar: { type: ['string', 'null'], description: 'Texto a buscar, si la tabla lo admite.' },
          filtros: {
            type: ['array', 'null'],
            items: { type: 'object', properties: { columna: { type: 'string' }, valores: { type: 'array', items: { type: 'string' } } }, required: ['columna', 'valores'], additionalProperties: false },
          },
          orden: { anyOf: [{ type: 'null' }, { type: 'object', properties: { columna: { type: 'string' }, dir: { type: 'string', enum: ['asc', 'desc'] } }, required: ['columna', 'dir'], additionalProperties: false }] },
          limite: { type: ['integer', 'null'], description: 'Filas a devolver (1 a 200).' },
        },
        required: ['fuente', 'buscar', 'filtros', 'orden', 'limite'],
        additionalProperties: false,
      },
    })
  }
  if (d.catalogo.metricas.length) {
    h.push({
      name: 'consultar_metrica',
      description: `Devuelve una cifra oficial del registro de métricas de la plataforma, con su definición, su valor, su total y su enlace. Úsala antes que contar a mano: es la misma cifra que muestra la pantalla.\n\nMétricas: ${d.catalogo.metricas.map((m) => `${m.clave} (${m.nombre}, ${m.unidad})`).join('; ')}`,
      input_schema: {
        type: 'object',
        properties: { clave: { type: 'string', enum: d.catalogo.metricas.map((m) => m.clave) } },
        required: ['clave'],
        additionalProperties: false,
      },
    })
  }
  if (d.catalogo.documentos) {
    h.push({
      name: 'buscar_documentos',
      description: 'Busca en el texto de los documentos del Sistema de Gestión de Calidad de Iberia (procedimientos, instructivos, formatos, políticas) y devuelve el documento, la página y un extracto. Cita siempre el documento y la página con su enlace.',
      input_schema: {
        type: 'object',
        properties: { consulta: { type: 'string', description: 'Palabras clave en español.' }, limite: { type: ['integer', 'null'] } },
        required: ['consulta', 'limite'],
        additionalProperties: false,
      },
    })
  }
  return h
}

export const NOMBRES_DATOS = new Set(['consultar_tabla', 'consultar_metrica', 'buscar_documentos'])

/** Ejecuta una herramienta de datos; devuelve el texto para el modelo y un título para el paso. */
export async function herramientaDatos(d: Datos, nombre: string, entrada: unknown): Promise<{ texto: string; titulo: string; error?: boolean }> {
  const e = (entrada ?? {}) as Record<string, unknown>
  try {
    if (nombre === 'consultar_tabla') {
      const t = d.catalogo.tablas.find((x) => x.fuente === e.fuente)
      const r = await d.consultar(String(e.fuente), { buscar: e.buscar ?? null, filtros: e.filtros ?? null, orden: e.orden ?? null, limite: e.limite ?? null })
      return { texto: JSON.stringify(r.resultado).slice(0, 120000), titulo: `Consultó «${t?.titulo ?? e.fuente}»`, error: !!r.resultado.error }
    }
    if (nombre === 'consultar_metrica') {
      const m = d.catalogo.metricas.find((x) => x.clave === e.clave)
      const r = await d.consultar('metricas', { clave: e.clave })
      return { texto: JSON.stringify(r.resultado), titulo: `Consultó la métrica «${m?.nombre ?? e.clave}»`, error: !!r.resultado.error }
    }
    const r = await d.consultar('documentos', { consulta: e.consulta, limite: e.limite ?? null })
    return { texto: JSON.stringify(r.resultado).slice(0, 60000), titulo: `Buscó en los documentos: «${String(e.consulta ?? '').slice(0, 40)}»`, error: !!r.resultado.error }
  } catch {
    return { texto: 'No se pudo consultar la fuente ahora. Dilo y sigue con lo que tengas.', titulo: 'No se pudo consultar', error: true }
  }
}
