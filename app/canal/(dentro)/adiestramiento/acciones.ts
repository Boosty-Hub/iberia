'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import guion from '@/contenido/adiestramiento/guion.json'
import { CURSO } from '@/lib/adiestramiento'
import { requerirEmpleado } from '@/lib/canal'
import { turnoDelEjercicio, type LeccionGuion } from '@/lib/guion'
import { createClient } from '@/lib/supabase/server'

const LECCIONES = guion.lecciones as LeccionGuion[]

/** Mi matrícula y la lección pedida, o null si algo no cuadra. */
async function contexto(numero: number) {
  const empleado = await requerirEmpleado()
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, abierto')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso?.abierto) return null

  const [{ data: matricula }, { data: leccion }] = await Promise.all([
    supabase
      .from('matriculas')
      .select('*')
      .eq('curso_id', curso.id)
      .eq('empleado_id', empleado.id)
      .maybeSingle(),
    supabase
      .from('lecciones')
      .select('*')
      .eq('curso_id', curso.id)
      .eq('numero', numero)
      .maybeSingle(),
  ])

  if (!matricula || !leccion) return null
  return { empleado, supabase, curso, matricula, leccion }
}

/**
 * Abre la lección. Deja constancia de que empezó y, si es la primera vez que
 * toca el curso, mueve la matrícula a «en curso».
 */
export async function empezarLeccion(datos: FormData) {
  const numero = Number(datos.get('numero'))
  const ctx = await contexto(numero)
  if (!ctx) return

  const { supabase, matricula, leccion } = ctx
  const ahora = new Date().toISOString()

  await supabase.from('avances').upsert(
    { matricula_id: matricula.id, leccion_id: leccion.id, estado: 'en_curso' },
    { onConflict: 'matricula_id,leccion_id', ignoreDuplicates: true }
  )

  await supabase
    .from('matriculas')
    .update({
      estado: matricula.estado === 'completado' ? 'completado' : 'en_curso',
      iniciado_en: matricula.iniciado_en ?? ahora,
      ultimo_toque: ahora,
    })
    .eq('id', matricula.id)

  revalidatePath(`/canal/adiestramiento/${numero}`)
}

/**
 * Adelanta un turno.
 *
 * La lección no se entrega de una: Ajito habla, se toca un botón y sigue. El
 * turno en el que se quedó vive en `avances.paso`, así que quien deje la
 * lección por la mitad la retoma donde estaba — que es lo que Ajito promete en
 * la lección 0.
 */
export async function avanzarPaso(datos: FormData) {
  const numero = Number(datos.get('numero'))
  const desde = Number(datos.get('turno'))
  const ctx = await contexto(numero)
  if (!ctx) return

  const { supabase, matricula, leccion } = ctx
  const ahora = new Date().toISOString()

  // El turno viene del navegador, pero solo puede empujar el avance de esta
  // persona y nunca hacia atrás: no hay nada que ganar mintiendo.
  const { data: avance } = await supabase
    .from('avances')
    .select('paso')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .maybeSingle()

  const siguiente = Math.max((avance?.paso ?? 0) + 1, Number.isFinite(desde) ? desde + 1 : 0)

  await supabase
    .from('avances')
    .update({ paso: siguiente })
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)

  await supabase.from('matriculas').update({ ultimo_toque: ahora }).eq('id', matricula.id)

  revalidatePath(`/canal/adiestramiento/${numero}`)
}

/**
 * Guarda lo que la persona respondió, y con eso adelanta el turno.
 *
 * La devolución de Ajito todavía no se genera: falta cerrar el modelo (ver
 * `contenido/adiestramiento/herramientas.md`). Lo que sí se guarda es la
 * respuesta, que es lo que no se puede perder.
 */
export async function responder(datos: FormData) {
  const numero = Number(datos.get('numero'))
  const clavePaso = String(datos.get('clave_paso') ?? '').trim()
  const texto = String(datos.get('texto') ?? '').trim()
  const esCampo = datos.get('es_campo') === 'si'
  const mediaUrl = String(datos.get('media_url') ?? '').trim()

  // De dónde vino la respuesta. Se guarda porque dice mucho: si en planta
  // resulta que casi nadie escribe, el dato está aquí y no en una suposición.
  const cruda = String(datos.get('entrada') ?? 'texto')
  const entrada = ['texto', 'voz', 'foto', 'boton'].includes(cruda) ? cruda : 'texto'

  if (!clavePaso || !texto) return

  const ctx = await contexto(numero)
  if (!ctx) return

  const { empleado, supabase, matricula, leccion } = ctx

  await supabase.from('respuestas').insert({
    matricula_id: matricula.id,
    leccion_id: leccion.id,
    clave_paso: clavePaso,
    es_pregunta_campo: esCampo,
    entrada,
    texto: texto.slice(0, 4000),
    // Lo que se guarda es el texto ya confirmado por la persona; la
    // transcripción cruda se queda en el audio, que también se guarda.
    media_url: mediaUrl || null,
    // Se copian para que el corte por oficio y área del informe sobreviva a un
    // cambio de cargo de la persona.
    familia_oficio: matricula.familia_oficio,
    area_id: empleado.area_id,
  })

  // Hasta dónde adelantar sale del guion, no del formulario: el turno de cada
  // ejercicio está fijado por su clave.
  const enGuion = LECCIONES.find((l) => l.numero === numero)
  const turno = enGuion ? turnoDelEjercicio(enGuion, clavePaso) : null

  if (turno !== null) {
    const { data: avance } = await supabase
      .from('avances')
      .select('paso')
      .eq('matricula_id', matricula.id)
      .eq('leccion_id', leccion.id)
      .maybeSingle()

    await supabase
      .from('avances')
      .update({ paso: Math.max(avance?.paso ?? 0, turno + 1) })
      .eq('matricula_id', matricula.id)
      .eq('leccion_id', leccion.id)
  }

  await supabase
    .from('matriculas')
    .update({ ultimo_toque: new Date().toISOString() })
    .eq('id', matricula.id)

  revalidatePath(`/canal/adiestramiento/${numero}`)
}

/** Da la lección por vista y manda a la siguiente, o al índice si era la última. */
export async function terminarLeccion(datos: FormData) {
  const numero = Number(datos.get('numero'))
  const ctx = await contexto(numero)
  if (!ctx) return

  const { supabase, curso, matricula, leccion } = ctx
  const ahora = new Date().toISOString()

  await supabase.from('avances').upsert(
    {
      matricula_id: matricula.id,
      leccion_id: leccion.id,
      estado: 'completada',
      completada_en: ahora,
    },
    { onConflict: 'matricula_id,leccion_id' }
  )

  // ¿Quedó alguna sin terminar? Si no, el curso está completo.
  const [{ count: totalLecciones }, { count: completadas }] = await Promise.all([
    supabase
      .from('lecciones')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', curso.id)
      .eq('activa', true),
    supabase
      .from('avances')
      .select('id', { count: 'exact', head: true })
      .eq('matricula_id', matricula.id)
      .eq('estado', 'completada'),
  ])

  const termino = (completadas ?? 0) >= (totalLecciones ?? 0)

  await supabase
    .from('matriculas')
    .update({
      estado: termino ? 'completado' : 'en_curso',
      completado_en: termino ? (matricula.completado_en ?? ahora) : null,
      ultimo_toque: ahora,
    })
    .eq('id', matricula.id)

  // Terminó las nueve: se emite el certificado. La función comprueba por su
  // cuenta que el curso esté completo —no se fía de esta cuenta de aquí— y
  // devuelve el mismo si ya existía, así que volver a pasar por aquí no da dos
  // códigos. Si algo falla, la lección igual queda terminada: perder el avance
  // por no poder emitir un papel sería el peor de los dos males.
  if (termino) {
    const { error } = await supabase.rpc('emitir_mi_certificado', {
      p_matricula: matricula.id,
    })
    if (error) console.error('[certificado] no se pudo emitir:', error.message)
  }

  revalidatePath('/canal/adiestramiento')

  const { data: siguiente } = await supabase
    .from('lecciones')
    .select('numero')
    .eq('curso_id', curso.id)
    .eq('activa', true)
    .gt('numero', numero)
    .order('numero')
    .limit(1)
    .maybeSingle()

  // Al terminar la última no se vuelve al índice: se va al certificado. Es lo
  // que Ajito acaba de prometer en el audio, y llegar a una lista de lecciones
  // tachadas después de eso sería quedarle mal.
  redirect(
    siguiente
      ? `/canal/adiestramiento/${siguiente.numero}`
      : termino
        ? '/canal/adiestramiento/certificado'
        : '/canal/adiestramiento'
  )
}
