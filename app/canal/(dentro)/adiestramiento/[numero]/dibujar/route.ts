import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { ponerVoz } from '@/lib/devolucion-hablada'
import { NO_VA, dibujaEn, dibujar, revisarPedido } from '@/lib/dibujar'
import {
  BUCKET_ADIESTRAMIENTO,
  BUCKET_RESPUESTAS,
  RUTA_REFERENCIA_AJITO,
  rutaRespuesta,
} from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'
import { vozDe } from '@/lib/voz'

/**
 * Ajito dibuja lo que la persona pidió en la lección 4.
 *
 * Es el primer paso de la devolución de `libre` y `escudo`, y va en su propia
 * petición: dibujar tarda unos 12 segundos, y sumado a comentar el dibujo rozaba
 * lo que aguanta una función. `DevolucionAjito` llama aquí y después a
 * `devolver`, que ya encuentra el dibujo hecho y lo comenta.
 *
 *  · **Primero se revisa el pedido**, con el modelo chico. Si pide a una persona
 *    de verdad o algo que no va, no se dibuja: la devolución es el texto fijo del
 *    guion, dicho con la voz de la clase, y la persona puede pedir otro dibujo.
 *  · **Si va, se dibuja** y se guarda en su carpeta del bucket privado, junto a
 *    su respuesta. El filtro del generador queda detrás; si frena, sale el «no
 *    va» general.
 *
 * **En la pregunta de campo de la lección 4 el dibujo es un extra.** No se pidió
 * un dibujo: se contestó qué cosa del trabajo sería más fácil de explicar con
 * uno. Si no describe nada dibujable, o no va, no hay negativa: se marca el
 * veredicto y `devolver` contesta la pregunta sin dibujo, como en las demás.
 *
 * Es idempotente: si ya hay dibujo o ya hay devolución, no vuelve a dibujar ni
 * a cobrar.
 */
export const maxDuration = 60

export async function POST(
  peticion: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const empleado = await empleadoActual()
  if (!empleado) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { numero: crudo } = await params
  const numero = Number(crudo)
  const cuerpo = (await peticion.json().catch(() => null)) as { clave_paso?: string } | null
  const clavePaso = String(cuerpo?.clave_paso ?? '').trim()

  if (!Number.isInteger(numero) || numero < 0 || !/^[\w-]{1,40}$/.test(clavePaso)) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, abierto')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso?.abierto) {
    return NextResponse.json({ error: 'El curso no está abierto' }, { status: 404 })
  }

  const [{ data: matricula }, { data: leccion }] = await Promise.all([
    supabase
      .from('matriculas')
      .select('id, voz')
      .eq('curso_id', curso.id)
      .eq('empleado_id', empleado.id)
      .maybeSingle(),
    supabase
      .from('lecciones')
      .select('id, forma')
      .eq('curso_id', curso.id)
      .eq('numero', numero)
      .eq('activa', true)
      .maybeSingle(),
  ])
  if (!matricula || !leccion) {
    return NextResponse.json({ error: 'No hay lección' }, { status: 404 })
  }
  if (!dibujaEn(clavePaso, leccion.forma)) {
    return NextResponse.json({ error: 'Ese ejercicio no se dibuja' }, { status: 400 })
  }
  const esCampo = clavePaso === 'campo'

  const { data: respuesta } = await supabase
    .from('respuestas')
    .select('id, texto, dibujo, dibujo_veredicto, devolucion')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .eq('clave_paso', clavePaso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!respuesta?.texto) {
    return NextResponse.json({ error: 'Todavía no has pedido el dibujo' }, { status: 404 })
  }
  if (respuesta.dibujo || respuesta.devolucion) {
    return NextResponse.json({ dibujo: Boolean(respuesta.dibujo), listo: true })
  }
  // En la de campo, ya se revisó y no había que dibujar: se sigue sin dibujo.
  if (esCampo && respuesta.dibujo_veredicto && respuesta.dibujo_veredicto !== 'va') {
    return NextResponse.json({ sinDibujo: true })
  }

  // --- ¿va? ---------------------------------------------------------------------

  const veredicto = await revisarPedido(respuesta.texto, esCampo)
  if (!veredicto) {
    // Sin poder revisar no se dibuja: con doscientas personas y nadie mirando,
    // mejor un reintento que un dibujo sin filtro.
    return NextResponse.json({ error: 'No se pudo revisar el pedido', motivo: 'ocupado' }, { status: 502 })
  }

  const noVa = async (cual: 'persona' | 'no_va') => {
    const texto = NO_VA[cual]
    await supabase
      .from('respuestas')
      .update({ devolucion: texto, devolucion_en: new Date().toISOString(), dibujo_veredicto: cual })
      .eq('id', respuesta.id)
    await ponerVoz(supabase, respuesta.id, empleado.id, numero, clavePaso, texto, vozDe(matricula.voz))
    return NextResponse.json({ rechazado: true })
  }

  // La pregunta de campo no es un pedido de dibujo: sin dibujo, sin negativa.
  const sinDibujo = async (cual: 'persona' | 'no_va' | 'nada') => {
    await supabase.from('respuestas').update({ dibujo_veredicto: cual }).eq('id', respuesta.id)
    return NextResponse.json({ sinDibujo: true })
  }

  if (veredicto !== 'va') {
    if (esCampo) return sinDibujo(veredicto)
    return noVa(veredicto === 'nada' ? 'no_va' : veredicto)
  }

  // --- el dibujo ----------------------------------------------------------------

  let referencia: Blob | null = null
  if (/ajito/i.test(respuesta.texto)) {
    const { data } = await supabase.storage.from(BUCKET_ADIESTRAMIENTO).download(RUTA_REFERENCIA_AJITO)
    referencia = data ?? null
  }

  const hecho = await dibujar(respuesta.texto, clavePaso, referencia)
  if (!hecho.ok) {
    if (hecho.motivo === 'rechazado') return esCampo ? sinDibujo('no_va') : noVa('no_va')
    console.error(`[dibujo] ${hecho.motivo} · ${clavePaso}:`, hecho.detalle ?? '')
    return NextResponse.json(
      { error: 'Ajito no pudo dibujar', motivo: hecho.motivo, detalle: hecho.detalle },
      { status: 502 }
    )
  }

  const ruta = rutaRespuesta(empleado.id, numero, `dibujo-${clavePaso}`, 'webp')
  const { error: errSubir } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .upload(ruta, hecho.bytes, { contentType: 'image/webp', upsert: false })
  if (errSubir) {
    console.error('[dibujo] no se pudo guardar:', errSubir.message)
    return NextResponse.json({ error: 'No se pudo guardar el dibujo', motivo: 'fallo' }, { status: 502 })
  }

  await supabase
    .from('respuestas')
    .update({ dibujo: ruta, dibujo_veredicto: 'va' })
    .eq('id', respuesta.id)

  return NextResponse.json({ dibujo: true })
}
