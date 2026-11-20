import { createClient } from '@/lib/supabase/server'
import { REGLAS_COMUNES, limpiarDato, pedirJson } from '@/lib/ia/modelo'
import { RESERVA_USD, explicarPropuestas, registrarLlamada, reservarLlamada } from '@/lib/ia/registro'

/**
 * NUC-ORG-IA-05 · Vigilancia de coherencia de plazas (N2).
 *
 * Las reglas viven en SQL (`ia.revisar_plazas`, con la sesión de quien pide):
 * por encima de la dotación desde una fecha, sin titular más de N días,
 * inferida sin validar. El modelo solo añade una explicación breve a las
 * nuevas —qué significa para Capital Humano y qué puede decidir una persona—,
 * en una sola llamada. Al modelo viajan cargo, unidad, cifras y fechas; ningún
 * nombre de persona.
 */

const SISTEMA = `${REGLAS_COMUNES}
Tu tarea: para cada señal sobre una plaza de la estructura, escribe una explicación breve (máximo 2 frases, 45 palabras) para Capital Humano: por qué conviene mirarla y qué puede decidir una persona (ajustar la dotación con fecha, abrir un escenario, pedir una requisición, cerrar la plaza o confirmarla). No culpes a nadie, no repitas las cifras que ya trae la señal y no des la decisión por tomada. No menciones otras plazas, áreas ni personas que no estén en la señal.`

/** Cuántas se explican por corrida: las de más peso primero (cuida el costo). */
const TOPE_EXPLICAR = 25
const PESO: Record<string, number> = { exceso: 0, sin_titular: 1, inferida: 2 }

export type ResultadoRevision = {
  nuevas: number
  explicadas: number
  medida: { tokensEntrada: number; tokensSalida: number; costoUsd: number; latenciaMs: number; modelo: string | null } | null
  avisoModelo?: string
}

export async function revisarPlazas(perfil: string): Promise<ResultadoRevision | { error: string }> {
  const supabase = await createClient()
  const ia = supabase.schema('ia')
  const { data: nuevas, error } = await ia.rpc('revisar_plazas')
  if (error) return { error: error.message }
  const lista = (nuevas ?? []).filter((n) => n.regla !== 'inferida').sort((a, b) => (PESO[a.regla] ?? 9) - (PESO[b.regla] ?? 9)).slice(0, TOPE_EXPLICAR)
  if (!lista.length) return { nuevas: nuevas?.length ?? 0, explicadas: 0, medida: null }

  // El gasto del día se reserva antes de salir al modelo (R6 · M2).
  const reserva = await reservarLlamada(perfil, 'NUC-ORG-IA-05', { reservaUsd: RESERVA_USD.lote })
  if ('error' in reserva) return { nuevas: nuevas?.length ?? 0, explicadas: 0, medida: null, avisoModelo: `Las señales quedaron sin explicación del modelo: ${reserva.error}` }

  const bloques = lista.map((n) => `<registro id="${n.id}" regla="${n.regla}">\n${limpiarDato(n.titulo, 200)}. ${limpiarDato(n.cuerpo, 600)}\n</registro>`).join('\n')
  const r = await pedirJson<{ explicaciones: { id: string; texto: string }[] }>({
    sistema: SISTEMA,
    contenido: `<registros>\n${bloques}\n</registros>`,
    esfuerzo: 'low',
    maxTokens: 6000,
    esquema: {
      type: 'object',
      properties: {
        explicaciones: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' }, texto: { type: 'string' } }, required: ['id', 'texto'], additionalProperties: false },
        },
      },
      required: ['explicaciones'],
      additionalProperties: false,
    },
  })
  const medida = { tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida, costoUsd: r.costoUsd, latenciaMs: r.latenciaMs, modelo: r.modelo }
  const ids = new Set(lista.map((n) => n.id))
  await registrarLlamada(perfil, reserva.reserva, {
    capacidad: 'NUC-ORG-IA-05',
    accion: r.ok ? 'explico' : 'error',
    resumen: r.ok ? `Explicó ${lista.length} señal(es) de plazas (reglas en SQL; la explicación es del modelo)` : `No pudo explicar las señales de plazas: ${r.detalle}`,
    evidencia: lista.map((n) => ({ tipo: 'plaza', id: n.objeto_id, campo: n.regla, fuente: 'ia.revisar_plazas' })),
    medida,
  })
  if (!r.ok) return { nuevas: nuevas?.length ?? 0, explicadas: 0, medida, avisoModelo: `Las señales quedaron sin explicación del modelo: ${r.detalle}` }

  const items = r.datos.explicaciones.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, texto: limpiarDato(e.texto, 600) }))
  const n = await explicarPropuestas(perfil, items)
  return { nuevas: nuevas?.length ?? 0, explicadas: n, medida }
}
