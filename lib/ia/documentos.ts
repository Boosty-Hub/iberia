import { createClient } from '@/lib/supabase/server'
import { REGLAS_COMUNES, limpiarDato, pedirJson } from '@/lib/ia/modelo'

/**
 * NUC-DOC-IA-02 · Clasificar documentos de la conciliación.
 *
 * Lee **solo metadatos** (código, título, tipo, versión, fecha, proceso y la
 * evidencia de la carga) de documentos generales sin datos sensibles con estado
 * sin determinar; nunca el archivo, nunca un perímetro. Propone estado, familia
 * de formulario y proceso. La base (`ia.proponer_clasificacion`) valida cada
 * valor y decide qué hacer según el nivel de la capacidad:
 *  · N2/N3: todo queda como propuesta para una persona.
 *  · N4: aplica sola la familia y el proceso (metadatos internos), con 12 horas
 *    para deshacer; el estado de vigencia sigue siendo propuesta.
 */

const FAMILIAS = [
  ['FAM-01', 'Análisis contra especificación'],
  ['FAM-02', 'Control de línea o de proceso'],
  ['FAM-03', 'Inspección con lista conforme / no conforme'],
  ['FAM-04', 'Registro de evento, acceso o movimiento'],
  ['FAM-05', 'Solicitud con aprobación'],
  ['FAM-06', 'Parte o reporte periódico'],
  ['FAM-07', 'Evaluación con puntaje'],
  ['FAM-08', 'Acta, reclamo o caso'],
  ['FAM-09', 'Identificación impresa (etiqueta)'],
  ['FAM-10', 'Ficha maestra o contrato con vencimiento'],
] as const

const SISTEMA = `${REGLAS_COMUNES}
Tu tarea: clasificar documentos del Sistema de Gestión de la Calidad que la carga inicial no pudo decidir, solo con sus metadatos.
Para cada registro devuelve:
- estado: "vigente", "obsoleto" o "borrador" si la evidencia de la carga lo sostiene; "ninguno" si no alcanza. Un documento que no figura en el listado maestro más reciente no es vigente por sí solo: decide por el conteo de fichas que trae la evidencia y dilo.
- familia: solo para formatos (tipo 40), la familia de formulario que mejor describe el título; "ninguna" si no es un formato o no está clara. Familias:
${FAMILIAS.map(([c, n]) => `  ${c} · ${n}`).join('\n')}
- proceso_ref: el id de uno de los procesos de <procesos> SOLO si el documento no tiene proceso; si no, "".
- razon: una frase, citando la evidencia.
- confianza: "alta", "media" o "baja".`

export type ResultadoClasificacion = {
  leidos: number
  aplicadas: number
  propuestas: number
  medida: { tokensEntrada: number; tokensSalida: number; costoUsd: number; latenciaMs: number; modelo: string | null } | null
  aviso?: string
}

export async function clasificarDocumentos(limite = 8): Promise<ResultadoClasificacion | { error: string }> {
  const supabase = await createClient()
  const ia = supabase.schema('ia')
  const { data: candidatos, error } = await ia.rpc('candidatos_clasificacion', { p_limite: limite })
  if (error) return { error: error.message }
  if (!candidatos?.length) return { leidos: 0, aplicadas: 0, propuestas: 0, medida: null, aviso: 'No quedan documentos sin determinar por clasificar.' }

  // Los procesos de nivel 1 de las áreas de esos documentos (para los que no tienen proceso).
  const areas = [...new Set(candidatos.map((c) => c.proceso_xx).filter(Boolean))] as string[]
  const { data: procesos } = areas.length
    ? await supabase.schema('sgc').from('proceso').select('ref, nombre, codigo_sgc').is('escenario_id', null).eq('estado', 'vigente').in('codigo_sgc', areas.map((a) => `II-${a}`))
    : { data: [] }

  const bloques = candidatos
    .map(
      (c) =>
        `<registro documento_id="${c.id}">\nCódigo ${limpiarDato(c.codigo, 40)} · «${limpiarDato(c.titulo, 200)}» · tipo ${limpiarDato(c.tipo_yy ?? '?', 4)} · versión ${limpiarDato(c.version ?? '—', 10)} · fecha ${c.fecha ?? '—'} · proceso actual: ${c.proceso ? limpiarDato(c.proceso, 120) : 'sin proceso'} · familia actual: ${c.familia ?? 'ninguna'}\nEvidencia de la carga: ${limpiarDato(c.evidencia_estado ?? 'sin evidencia', 400)}\n</registro>`
    )
    .join('\n')
  const lista = (procesos ?? []).map((p) => `<proceso id="${p.ref}">${limpiarDato(p.codigo_sgc, 10)} · ${limpiarDato(p.nombre, 120)}</proceso>`).join('\n')

  const r = await pedirJson<{ items: { documento_id: string; estado: string; familia: string; proceso_ref: string; razon: string; confianza: string }[] }>({
    sistema: SISTEMA,
    contenido: `<procesos>\n${lista}\n</procesos>\n<registros>\n${bloques}\n</registros>`,
    esfuerzo: 'low',
    maxTokens: 6000,
    esquema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              documento_id: { type: 'string' },
              estado: { type: 'string', enum: ['vigente', 'obsoleto', 'borrador', 'ninguno'] },
              familia: { type: 'string', enum: [...FAMILIAS.map(([c]) => c), 'ninguna'] },
              proceso_ref: { type: 'string' },
              razon: { type: 'string' },
              confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
            },
            required: ['documento_id', 'estado', 'familia', 'proceso_ref', 'razon', 'confianza'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  })
  const medida = { tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida, costoUsd: r.costoUsd, latenciaMs: r.latenciaMs, modelo: r.modelo }
  await ia.rpc('registrar_llamada', {
    p_capacidad: 'NUC-DOC-IA-02',
    p_accion: r.ok ? 'explico' : 'error',
    p_resumen: r.ok ? `Leyó los metadatos de ${candidatos.length} documento(s) de la conciliación para clasificarlos` : `No pudo clasificar: ${r.detalle}`,
    p_evidencia: candidatos.map((c) => ({ tipo: 'documento', id: c.id, campo: 'codigo', valor: c.codigo, fuente: 'sgc.documento (metadatos)' })),
    p_tokens_entrada: r.tokensEntrada,
    p_tokens_salida: r.tokensSalida,
    p_costo_usd: r.costoUsd,
    p_latencia_ms: r.latenciaMs,
    p_modelo: r.modelo ?? 'ninguno',
  })
  if (!r.ok) return { error: r.detalle }

  const validos = new Set(candidatos.map((c) => c.id))
  // La confianza baja no propone nada: el estado es la decisión que más pesa.
  const items = r.datos.items
    .filter((i) => validos.has(i.documento_id))
    .map((i) => ({
      documento_id: i.documento_id,
      estado: i.estado === 'ninguno' || i.confianza === 'baja' ? '' : i.estado,
      // Con confianza baja tampoco se toca la familia: en N4 se aplicaría sola.
      familia: i.familia === 'ninguna' || i.confianza === 'baja' ? '' : i.familia,
      proceso_ref: i.proceso_ref,
      razon: `${limpiarDato(i.razon, 500)} (confianza ${i.confianza})`,
    }))
  const { data: hechas, error: e2 } = await ia.rpc('proponer_clasificacion', { p_items: items })
  if (e2) return { error: e2.message }
  const filas = hechas ?? []
  return {
    leidos: candidatos.length,
    aplicadas: filas.filter((f) => f.estado === 'aceptada').length,
    propuestas: filas.filter((f) => f.estado === 'pendiente').length,
    medida,
  }
}
