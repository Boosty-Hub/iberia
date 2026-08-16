import { NextResponse, type NextRequest } from 'next/server'
import {
  CURSO,
  ejerciciosDeLeccion,
  preguntaDeCampo,
  type FamiliaOficio,
  type FormaIA,
} from '@/lib/adiestramiento'
import { devolver, type Contexto } from '@/lib/ajito'
import { empleadoActual } from '@/lib/canal'
import { hablar } from '@/lib/hablar'
import { BUCKET_RESPUESTAS, rutaDevolucion } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/**
 * Ajito contesta un ejercicio.
 *
 * Se llama desde el navegador cuando la respuesta ya está guardada y todavía no
 * tiene devolución. Va por separado de `responder` a propósito: guardar lo que
 * la persona dijo es lo que no se puede perder, y eso pasa primero y siempre.
 * Si el modelo se cae o Azure no contesta, la respuesta ya está a salvo y la
 * devolución se reintenta sola la próxima vez que abra la lección.
 *
 * Es idempotente: si ya hay devolución, la entrega y no vuelve a generarla. Dos
 * pestañas abiertas —o un toque doble— no producen dos audios ni dos cobros.
 */
export const maxDuration = 60

/** Claude no abre HEIC. Un iPhone por la cámara del navegador manda JPEG. */
const IMAGENES: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

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
      .select('id, familia_oficio, nombre_corto')
      .eq('curso_id', curso.id)
      .eq('empleado_id', empleado.id)
      .maybeSingle(),
    supabase
      .from('lecciones')
      .select('id, numero, titulo, forma')
      .eq('curso_id', curso.id)
      .eq('numero', numero)
      .eq('activa', true)
      .maybeSingle(),
  ])

  if (!matricula || !leccion) {
    return NextResponse.json({ error: 'No hay lección que contestar' }, { status: 404 })
  }

  // La RLS ya acota esto a las respuestas propias; el filtro por matrícula está
  // para que la consulta sea precisa, no para autorizar.
  const { data: respuesta } = await supabase
    .from('respuestas')
    .select('id, texto, entrada, media_url, devolucion, devolucion_audio, es_pregunta_campo')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .eq('clave_paso', clavePaso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!respuesta?.texto) {
    return NextResponse.json({ error: 'Todavía no has contestado eso' }, { status: 404 })
  }

  // Ya está contestada. Se entrega tal cual: ni se regenera ni se cobra otra vez.
  if (respuesta.devolucion) {
    return NextResponse.json({
      texto: respuesta.devolucion,
      audio: Boolean(respuesta.devolucion_audio),
    })
  }

  const forma = leccion.forma as FormaIA
  const familia = matricula.familia_oficio as FamiliaOficio
  const esCampo = respuesta.es_pregunta_campo

  const consigna = esCampo
    ? preguntaDeCampo(forma, familia)
    : ejerciciosDeLeccion(forma, familia).find((e) => e.clave === clavePaso)?.consigna

  if (!consigna) {
    return NextResponse.json({ error: 'Ese ejercicio no existe' }, { status: 404 })
  }

  // --- la foto, si la hubo ---------------------------------------------------

  let imagen: Contexto['imagen']
  const extension = respuesta.media_url?.split('.').pop()?.toLowerCase() ?? ''
  const tipo = IMAGENES[extension]

  if (respuesta.media_url && tipo) {
    const { data: archivo } = await supabase.storage
      .from(BUCKET_RESPUESTAS)
      .download(respuesta.media_url)

    if (archivo) {
      const bytes = Buffer.from(await archivo.arrayBuffer())
      imagen = { base64: bytes.toString('base64'), tipo }
    }
  }

  // Una foto que llegó en un formato que el modelo no abre —HEIC de un iPhone
  // que no pasó por la cámara del navegador— no es un fallo del sistema, y no se
  // le puede decir «algo salió mal». Se le dice qué pasó y qué hacer.
  if (respuesta.media_url && !tipo) {
    return NextResponse.json({
      texto:
        'Esa foto me llegó en un formato que no puedo abrir. Búscala en la galería y ' +
        'mándamela otra vez desde ahí, que así sí la veo.',
      audio: false,
    })
  }

  // --- Ajito -----------------------------------------------------------------

  const dicho = await devolver({
    nombre: matricula.nombre_corto ?? empleado.nombre_completo.split(' ')[0],
    familia,
    leccion: leccion.numero,
    tituloLeccion: leccion.titulo,
    clave: clavePaso,
    esCampo,
    consigna,
    texto: respuesta.texto,
    entrada: respuesta.entrada as Contexto['entrada'],
    imagen,
  })

  if (!dicho.ok) {
    console.error(`[ajito] ${dicho.motivo} · ${clavePaso}:`, dicho.detalle ?? '')

    // Se marca el intento **solo cuando el problema es de esta respuesta**. La
    // marca la saca de la cola para que no congele detrás de sí el resto de la
    // lección, y a cambio pierde el reintento automático: queda con su botón.
    //
    // Si lo que pasa es que no hay saldo, o la clave no vale, o el servicio está
    // saturado, no es cosa de esta respuesta — le va a pasar igual a las
    // doscientas. Ahí no se marca nada: la cola se para sola, que es lo que
    // corresponde, y el día que se arregle se recuperan todas sin que nadie
    // tenga que tocar un botón.
    if (dicho.motivo === 'fallo') {
      await supabase
        .from('respuestas')
        .update({ devolucion_en: new Date().toISOString() })
        .eq('id', respuesta.id)
    }

    return NextResponse.json(
      { error: 'Ajito no pudo contestar', motivo: dicho.motivo, detalle: dicho.detalle },
      { status: 502 }
    )
  }

  // --- ponerlo a hablar ------------------------------------------------------
  //
  // El texto se guarda aunque el audio falle. Sin audio la devolución se lee, y
  // leerla es peor que oírla — pero perderla es mucho peor que leerla.

  let rutaAudio: string | null = null
  const hablado = await hablar(dicho.texto)

  if (hablado.ok) {
    const ruta = rutaDevolucion(empleado.id, numero, clavePaso)
    const { error } = await supabase.storage
      .from(BUCKET_RESPUESTAS)
      .upload(ruta, hablado.mp3, { contentType: 'audio/mpeg', upsert: false })
    if (!error) rutaAudio = ruta
    else console.error('[ajito] no se pudo guardar el audio:', error.message)
  } else {
    console.error('[ajito] síntesis fallida:', hablado.detalle ?? hablado.motivo)
  }

  await supabase
    .from('respuestas')
    .update({
      devolucion: dicho.texto,
      devolucion_audio: rutaAudio,
      devolucion_en: new Date().toISOString(),
    })
    .eq('id', respuesta.id)

  return NextResponse.json({ texto: dicho.texto, audio: Boolean(rutaAudio) })
}
