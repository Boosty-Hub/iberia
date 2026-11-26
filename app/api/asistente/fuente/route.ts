import { NextResponse, type NextRequest } from 'next/server'
import { FUENTES } from '@/lib/plataforma/tablas'
import { createAdminClient } from '@/lib/supabase/server'
import { consultarMicrosoft, type ParteM365 } from '@/lib/asistente/microsoft'
import { mismoSecreto, secretoAsistente } from '@/lib/asistente/motor/servicio'
import {
  anotarConsulta,
  buscarDocumentos,
  clienteDeToken,
  consultarMetrica,
  consultarTabla,
  descripcionCatalogo,
  fuentesPermitidas,
  identidad,
} from '@/lib/asistente/fuentes'

/**
 * Las fuentes de datos del asistente (fase 2), para el ejecutor del turno. No es
 * para el navegador: exige `ASISTENTE_SECRETO` en la cabecera y el token de la
 * sesión de quien preguntó, con el que corre cada consulta (la RLS de siempre).
 * Antes de consultar se vuelve a revisar el permiso de la pantalla y el alcance:
 * aunque el modelo pida una fuente que no se le ofreció, no pasa.
 *
 *   { accion: 'catalogo', token }                              → lo que esta persona puede consultar
 *   { accion: 'consultar', token, turno, fuente, args }        → una consulta, anotada en consulta_fuente
 */
export const maxDuration = 60

export async function POST(peticion: NextRequest) {
  let secreto: string
  try {
    secreto = secretoAsistente()
  } catch {
    return NextResponse.json({ error: 'Sin configurar' }, { status: 503 })
  }
  if (!mismoSecreto(peticion.headers.get('x-asistente-secreto'), secreto)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const cuerpo = (await peticion.json().catch(() => null)) as { accion?: string; token?: string; turno?: string | null; fuente?: string; args?: Record<string, unknown> } | null
  if (!cuerpo?.token) return NextResponse.json({ error: 'Falta el token' }, { status: 400 })

  const cliente = clienteDeToken(cuerpo.token)
  const yo = await identidad(cliente, cuerpo.token)
  if (!yo) return NextResponse.json({ error: 'La sesión ya no es válida' }, { status: 401 })
  const permitidas = await fuentesPermitidas(cliente, yo)

  if (cuerpo.accion === 'catalogo') {
    return NextResponse.json({ fuentes: permitidas.map((f) => ({ clave: f.clave, sensible: f.sensible })), ...(await descripcionCatalogo(cliente, permitidas)) })
  }

  if (cuerpo.accion !== 'consultar' || !cuerpo.fuente) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  const fuente = permitidas.find((f) => f.clave === cuerpo.fuente)
  if (!fuente) return NextResponse.json({ resultado: { error: 'Esa fuente no está en tu alcance o no tienes su permiso.' } })
  const args = cuerpo.args ?? {}
  const turno = cuerpo.turno && /^[0-9a-f-]{36}$/.test(cuerpo.turno) ? cuerpo.turno : null

  let resultado: Record<string, unknown>
  let filas = 0
  if (fuente.tipo === 'tabla') {
    const f = FUENTES[fuente.clave.slice(6)]
    resultado = f ? await consultarTabla(cliente, f, args) : { error: 'No existe esa tabla.' }
    filas = Number(resultado.mostradas ?? 0)
  } else if (fuente.tipo === 'microsoft') {
    // Fase 7: a nombre de la persona, con su cuenta de Microsoft. Lo que se trae va al chat como archivo (para el entorno de código).
    const r = await consultarMicrosoft(yo.uid, fuente.clave as ParteM365, args as Record<string, unknown>)
    resultado = r.resultado
    filas = r.filas
    if (r.archivo && turno) {
      const admin = createAdminClient()
      const { data: t } = await admin.schema('asistente').from('turno').select('chat_id').eq('id', turno).maybeSingle()
      if (t?.chat_id) {
        const id = crypto.randomUUID()
        const nombre = r.archivo.nombre.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 180) || 'archivo'
        const ruta = `${yo.uid}/${t.chat_id}/microsoft/${id}-${nombre}`
        const { error: eSubir } = await admin.storage.from('asistente').upload(ruta, r.archivo.bytes, { contentType: r.archivo.mime, upsert: false })
        if (!eSubir) {
          await admin.schema('asistente').from('archivo').insert({ id, dueno: yo.uid, chat_id: t.chat_id, origen: 'microsoft', estado: 'listo', nombre, mime: r.archivo.mime, bytes: r.archivo.bytes.length, ruta })
          resultado = { ...resultado, montar: id }
        } else resultado = { error: 'No se pudo traer el archivo a la plataforma.' }
      }
    }
  } else if (fuente.tipo === 'metricas') {
    resultado = await consultarMetrica(cliente, String(args.clave ?? ''))
    filas = resultado.error ? 0 : 1
  } else {
    resultado = await buscarDocumentos(cliente, String(args.consulta ?? ''), args.limite as number | null)
    filas = Array.isArray(resultado.resultados) ? resultado.resultados.length : 0
  }
  await anotarConsulta(yo.uid, turno, fuente.clave, args, filas)
  return NextResponse.json({ resultado, sensible: fuente.sensible })
}
