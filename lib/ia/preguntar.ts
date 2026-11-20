import { createClient } from '@/lib/supabase/server'
import { fechaLarga, plano } from '@/lib/plataforma/formato'
import { REGLAS_COMUNES, limpiarDato, pedirJson } from '@/lib/ia/modelo'

/**
 * NUC-PRO-IA-01 · «Preguntar a la IA» (N1). Responde sobre procesos, estructura
 * y documentos **solo con lo que quien pregunta puede leer**: la búsqueda usa su
 * sesión (`ui.buscar` y las tablas con RLS), los documentos de perímetro y los
 * que traen datos sensibles se quitan aunque su rol los alcance, y nada de
 * costos ni de personas sale de aquí. Cada afirmación lleva su cita [n] al
 * registro, con su versión y su fecha. Si los registros no alcanzan, lo dice.
 */

export type Cita = {
  n: number
  tipo: 'proceso' | 'documento' | 'unidad' | 'cargo' | 'plaza'
  id: string
  titulo: string
  codigo: string | null
  version: string | null
  fecha: string | null
  detalle: string | null
}

export type Respuesta = {
  respuesta: string
  suficiente: boolean
  citas: Cita[]
  /** Los registros que se leyeron (citados o no), para el «¿Por qué?». */
  leidos: number
  medida: { tokensEntrada: number; tokensSalida: number; costoUsd: number; latenciaMs: number; modelo: string | null }
}

const VACIAS = new Set(
  'el la los las un una unos unas de del al a en y o u que se su sus es son por para con sin como cual cuales quien quienes cuando donde cómo qué cuál quién dónde cuándo hay me mi mis te tu tus le les lo nos este esta estos estas ese esa eso esto ser esta están está tiene tienen hace hacen debe deben puede pueden cada sobre entre hasta desde muy mas más ya no si sí cosa algo todo toda todos todas favor dime explica explícame decir proceso procesos documento documentos'
    .split(' ')
    .map((p) => plano(p))
)

/** Las palabras que vale la pena buscar, con los códigos II-… primero. */
export function palabrasClave(pregunta: string): string[] {
  const codigos = [...pregunta.matchAll(/II-\d{2}(?:-\d{2}-\d{3})?/gi)].map((m) => m[0].toUpperCase())
  const palabras = plano(pregunta)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !VACIAS.has(p) && !/^ii-\d/.test(p))
  // Las más largas primero: suelen ser las que distinguen.
  const unicas = [...new Set(palabras)].sort((a, b) => b.length - a.length)
  return [...new Set([...codigos, ...unicas])].slice(0, 6)
}

type Hallado = { tipo: Cita['tipo']; id: string; codigo: string | null; titulo: string; detalle: string | null; puntos: number }

const TOPE: Record<Cita['tipo'], number> = { proceso: 6, documento: 8, unidad: 4, cargo: 4, plaza: 4 }

export async function recuperar(pregunta: string) {
  const supabase = await createClient()
  const claves = palabrasClave(pregunta)
  const hallados = new Map<string, Hallado>()
  const resultados = await Promise.all(claves.map((k) => supabase.schema('ui').rpc('buscar', { p_q: k, p_limite: 8 })))
  resultados.forEach(({ data }, i) => {
    for (const r of data ?? []) {
      if (!['proceso', 'documento', 'unidad', 'cargo', 'plaza'].includes(r.tipo)) continue
      const k = `${r.tipo}:${r.id}`
      const peso = (claves.length - i) + (r.rango === 0 ? 2 : 0)
      const h = hallados.get(k)
      if (h) h.puntos += peso
      else hallados.set(k, { tipo: r.tipo as Cita['tipo'], id: r.id, codigo: r.codigo, titulo: r.titulo, detalle: r.detalle, puntos: peso })
    }
  })
  const elegidos: Hallado[] = []
  for (const tipo of Object.keys(TOPE) as Cita['tipo'][]) {
    elegidos.push(...[...hallados.values()].filter((h) => h.tipo === tipo).sort((a, b) => b.puntos - a.puntos).slice(0, TOPE[tipo]))
  }

  // Los detalles, otra vez con la sesión de quien pregunta.
  const refs = elegidos.filter((h) => h.tipo === 'proceso').map((h) => h.id)
  const docs = elegidos.filter((h) => h.tipo === 'documento').map((h) => h.id)
  const [{ data: procesos }, { data: documentos }] = await Promise.all([
    refs.length
      ? supabase
          .schema('sgc')
          .from('proceso')
          .select('ref, nombre, codigo_sgc, codigo_informe, nivel, version, vigencia, dueno_texto, area_texto, ficha')
          .in('ref', refs)
          .is('escenario_id', null)
          .eq('estado', 'vigente')
      : { data: [] },
    docs.length
      ? supabase.schema('sgc').from('documento').select('id, codigo, titulo, version, fecha, estado, perimetro, datos_sensibles, familia').in('id', docs)
      : { data: [] },
  ])
  const procPorRef = new Map((procesos ?? []).map((p) => [p.ref, p]))
  const docPorId = new Map((documentos ?? []).filter((d) => d.perimetro === 'general' && !d.datos_sensibles).map((d) => [d.id, d]))

  const registros: { cita: Omit<Cita, 'n'>; texto: string }[] = []
  for (const h of elegidos) {
    if (h.tipo === 'proceso') {
      const p = procPorRef.get(h.id)
      if (!p) continue
      const f = (p.ficha ?? {}) as Record<string, unknown>
      const lista = (k: string) => (Array.isArray(f[k]) ? (f[k] as unknown[]).map((x) => limpiarDato(typeof x === 'string' ? x : JSON.stringify(x), 160)).join('; ') : '')
      const desde = (p.vigencia as string | null)?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
      const partes = [
        `Proceso «${limpiarDato(p.nombre, 200)}»`,
        p.dueno_texto && `Dueño: ${limpiarDato(p.dueno_texto, 120)}`,
        p.area_texto && `Área: ${limpiarDato(p.area_texto, 120)}`,
        f.objetivo && `Objetivo: ${limpiarDato(f.objetivo, 400)}`,
        f.alcance && `Alcance: ${limpiarDato(f.alcance, 300)}`,
        lista('entradas') && `Entradas: ${lista('entradas')}`,
        lista('salidas') && `Salidas: ${lista('salidas')}`,
        lista('clientes') && `Clientes: ${lista('clientes')}`,
        lista('proveedores') && `Proveedores: ${lista('proveedores')}`,
        lista('registros') && `Registros: ${lista('registros')}`,
        lista('documentos') && `Documentos: ${lista('documentos')}`,
        lista('indicadores') && `Indicadores: ${lista('indicadores')}`,
        lista('riesgos') && `Riesgos: ${lista('riesgos')}`,
        f.nota_ficha && `Nota de la ficha: ${limpiarDato(f.nota_ficha, 500)}`,
      ].filter(Boolean)
      registros.push({
        cita: { tipo: 'proceso', id: p.ref, titulo: p.nombre, codigo: p.codigo_sgc ?? p.codigo_informe, version: p.version ? `v${p.version}` : null, fecha: desde, detalle: h.detalle },
        texto: partes.join('. ').slice(0, 2400),
      })
    } else if (h.tipo === 'documento') {
      const d = docPorId.get(h.id)
      if (!d) continue
      registros.push({
        cita: { tipo: 'documento', id: d.id, titulo: d.titulo, codigo: d.codigo, version: d.version ? `v${d.version}` : null, fecha: d.fecha, detalle: d.estado },
        texto: `Documento ${limpiarDato(d.codigo, 40)} «${limpiarDato(d.titulo, 200)}». Estado: ${d.estado.replace('_', ' ')}.${d.familia ? ` Familia de formulario: ${d.familia}.` : ''} (Solo metadatos: el contenido del archivo no se leyó.)`,
      })
    } else {
      registros.push({
        cita: { tipo: h.tipo, id: h.id, titulo: h.titulo, codigo: h.codigo, version: null, fecha: null, detalle: h.detalle },
        texto: `${h.tipo === 'unidad' ? 'Unidad' : h.tipo === 'cargo' ? 'Cargo' : 'Plaza'} «${limpiarDato(h.titulo, 160)}»${h.detalle ? ` · ${limpiarDato(h.detalle, 200)}` : ''}${h.codigo ? ` · código ${limpiarDato(h.codigo, 40)}` : ''}. Estructura vigente hoy.`,
      })
    }
  }
  return registros.slice(0, 22)
}

const SISTEMA = `${REGLAS_COMUNES}
Tu tarea: responder la pregunta de una persona de Iberia sobre sus procesos, su estructura o sus documentos del SGC.
- Responde SOLO con lo que dicen los registros. Cada afirmación lleva al final la cita del registro entre corchetes, por ejemplo [2] o [1][3].
- Si los registros no alcanzan para responder, dilo en una frase («No lo encuentro en lo que puedes leer…»), di qué faltaría y pon suficiente = false. No completes con lo que «suele ser».
- Si un registro es solo metadatos de un documento, no inventes su contenido.
- Máximo 120 palabras. Sin listas largas: dos a cuatro frases.
- En "citas" pon los números de los registros que usaste.`

export async function responder(pregunta: string): Promise<Respuesta | { error: string; medida?: Respuesta['medida'] }> {
  const registros = await recuperar(pregunta)
  const vacio = { tokensEntrada: 0, tokensSalida: 0, costoUsd: 0, latenciaMs: 0, modelo: null }
  if (!registros.length) {
    // Sin registros no se llama al modelo: no tendría con qué responder.
    return {
      respuesta: 'No encontré registros a tu alcance que respondan esto. Prueba con el nombre del proceso, su código (II-…) o el del documento.',
      suficiente: false,
      citas: [],
      leidos: 0,
      medida: vacio,
    }
  }
  const bloques = registros
    .map((r, i) => `<registro n="${i + 1}" tipo="${r.cita.tipo}"${r.cita.codigo ? ` codigo="${limpiarDato(r.cita.codigo, 40)}"` : ''}${r.cita.version ? ` version="${r.cita.version}"` : ''}${r.cita.fecha ? ` fecha="${r.cita.fecha}"` : ''}>\n${r.texto}\n</registro>`)
    .join('\n')
  const hoy = fechaLarga(new Date().toISOString().slice(0, 10))
  const contenido = `<registros>\n${bloques}\n</registros>\n\nHoy es ${hoy} (Caracas).\n<pregunta>${limpiarDato(pregunta, 500)}</pregunta>`

  const r = await pedirJson<{ respuesta: string; suficiente: boolean; citas: number[] }>({
    sistema: SISTEMA,
    contenido,
    esfuerzo: 'low',
    maxTokens: 3000,
    esquema: {
      type: 'object',
      properties: {
        respuesta: { type: 'string' },
        suficiente: { type: 'boolean' },
        citas: { type: 'array', items: { type: 'integer' } },
      },
      required: ['respuesta', 'suficiente', 'citas'],
      additionalProperties: false,
    },
  })
  const medida = { tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida, costoUsd: r.costoUsd, latenciaMs: r.latenciaMs, modelo: r.modelo }
  if (!r.ok) return { error: r.detalle, medida }

  // Las citas: las que puso en el texto y las que declaró, solo si existen.
  const enTexto = [...r.datos.respuesta.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1]))
  const numeros = [...new Set([...enTexto, ...r.datos.citas])].filter((n) => n >= 1 && n <= registros.length).sort((a, b) => a - b)
  return {
    // Un [n] que no corresponde a ningún registro se quita del texto.
    respuesta: r.datos.respuesta.replace(/\[(\d{1,2})\]/g, (m, n) => (Number(n) >= 1 && Number(n) <= registros.length ? m : '')).trim(),
    suficiente: r.datos.suficiente && numeros.length > 0,
    citas: numeros.map((n) => ({ n, ...registros[n - 1].cita })),
    leidos: registros.length,
    medida,
  }
}
