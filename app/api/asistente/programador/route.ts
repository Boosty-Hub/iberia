import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { mismoSecreto, secretoAsistente } from '@/lib/asistente/motor/servicio'
import { entregarCorrida, lanzarCorrida } from '@/lib/asistente/programador'

/**
 * El reloj de las tareas programadas del asistente (fase 5). No es para el
 * navegador: exige `ASISTENTE_SECRETO` en la cabecera.
 *
 *   { accion: 'tick' }                    -> pg_cron, cada minuto: toma lo vencido y lo lanza
 *   { accion: 'entregar', corrida, token } -> el ejecutor, al terminar el turno de una corrida
 *
 * Fuera de producción, `tick` acepta `ahora` (ISO) para probar con el reloj adelantado.
 */
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function POST(peticion: NextRequest) {
  let secreto: string
  try {
    secreto = secretoAsistente()
  } catch {
    return NextResponse.json({ error: 'Sin configurar' }, { status: 503 })
  }
  if (!mismoSecreto(peticion.headers.get('x-asistente-secreto'), secreto)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const cuerpo = (await peticion.json().catch(() => null)) as { accion?: string; ahora?: string; corrida?: string; token?: string | null } | null

  if (cuerpo?.accion === 'tick') {
    const ahora = process.env.NODE_ENV !== 'production' && cuerpo.ahora && !Number.isNaN(Date.parse(cuerpo.ahora)) ? new Date(cuerpo.ahora).toISOString() : new Date().toISOString()
    const { data, error } = await createAdminClient().schema('asistente').rpc('tomar_vencidas', { p_ahora: ahora, p_limite: 20 })
    if (error) return NextResponse.json({ error: 'No se pudo leer la cola' }, { status: 500 })
    const corridas = (data ?? []) as { id: string }[]
    for (const c of corridas) await lanzarCorrida(c.id)
    // A quien llegó a un tope y ya se le renovó el cupo, un aviso en la campana (26-nov-2026).
    const { data: renovados } = await createAdminClient().schema('asistente').rpc('avisos_renovados', { p_ahora: ahora })
    const TEXTO = { ventana: 'Tu ventana de 5 horas del asistente se renovó: ya puedes seguir conversando.', dia: 'Tu cupo del día en el asistente se renovó: ya puedes seguir.', mes: 'Tu cupo del mes en el asistente se renovó: ya puedes seguir.' } as const
    const avisos = ((renovados ?? []) as { perfil_id: string; motivo: keyof typeof TEXTO }[]).map((r) => ({ destinatario: r.perfil_id, tipo: 'ia', texto: TEXTO[r.motivo] ?? TEXTO.ventana, enlace: '/sistema/asistente' }))
    if (avisos.length) await createAdminClient().schema('nucleo').from('notificacion').insert(avisos)
    return NextResponse.json({ corridas: corridas.map((c) => c.id), renovados: avisos.length })
  }
  if (cuerpo?.accion === 'entregar' && cuerpo.corrida && UUID.test(cuerpo.corrida)) {
    await entregarCorrida(cuerpo.corrida, typeof cuerpo.token === 'string' ? cuerpo.token : null)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
