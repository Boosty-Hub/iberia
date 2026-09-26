'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import guion from '@/contenido/adiestramiento/guion.json'
import { CURSO } from '@/lib/adiestramiento'
import { obtenerSesion, puede } from '@/lib/auth'
import { requerirEmpleado } from '@/lib/canal'
import { turnoDelEjercicio, type LeccionGuion } from '@/lib/guion'
import { BUCKET_RESPUESTAS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'
import { esClaveVoz } from '@/lib/voz'

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
 * Con qué voz oye a Ajito. Vale para toda la clase y para lo que Ajito le
 * contesta, y la cambia cuando quiera. Ver `VOCES` en `lib/voz.ts`.
 */
export async function elegirVoz(datos: FormData) {
  const voz = datos.get('voz')
  if (!esClaveVoz(voz)) return

  const empleado = await requerirEmpleado()
  const supabase = await createClient()
  const { data: curso } = await supabase.from('cursos').select('id').eq('clave', CURSO).maybeSingle()
  if (!curso) return

  await supabase
    .from('matriculas')
    .update({ voz })
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)

  revalidatePath('/canal/adiestramiento', 'layout')
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
  const ctx = await contexto(numero)
  if (!ctx) return

  await adelantar(ctx, Number(datos.get('turno')))
  revalidatePath(`/canal/adiestramiento/${numero}`)
}

/**
 * Deja el avance en el turno que sigue a `desde`.
 *
 * El turno viene del navegador, pero solo puede empujar el avance de esta
 * persona y nunca hacia atrás: no hay nada que ganar mintiendo. ⚠️ Y se mide
 * desde el turno que se tocó, no desde el avance guardado: sumándole uno al
 * avance, dos toques seguidos al mismo botón se saltaban el turno de después.
 */
async function adelantar(ctx: NonNullable<Awaited<ReturnType<typeof contexto>>>, desde: number) {
  const { supabase, matricula, leccion } = ctx

  const { data: avance } = await supabase
    .from('avances')
    .select('paso')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .maybeSingle()

  const paso = avance?.paso ?? 0
  const siguiente = Number.isFinite(desde) ? Math.max(paso, desde + 1) : paso + 1

  await supabase
    .from('avances')
    .update({ paso: siguiente })
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)

  await supabase
    .from('matriculas')
    .update({ ultimo_toque: new Date().toISOString() })
    .eq('id', matricula.id)
}

/**
 * «No soy yo»: la persona corrige su ficha del padrón y la lección sigue.
 *
 * Lo que escribe queda en `correcciones_padron` como aviso para Capital
 * Humano —el padrón no se toca desde el teléfono: de ahí salen los
 * certificados— y el equipo lo ve en `/dashboard/empleados`. Lo único que
 * cambia en el acto es cómo la llama Ajito: el nombre del padrón era justo el
 * que estaba mal, y seguir diciéndolo en la consigna de al lado sería no haberla
 * oído.
 */
export async function corregirPadron(datos: FormData): Promise<{ ok: boolean }> {
  const numero = Number(datos.get('numero'))
  const nombre = String(datos.get('nombre') ?? '').replace(/\s+/g, ' ').trim()
  const area = String(datos.get('area') ?? '').replace(/\s+/g, ' ').trim()
  if (nombre.length < 2 || nombre.length > 120 || area.length > 120) return { ok: false }

  const ctx = await contexto(numero)
  if (!ctx) return { ok: false }
  const { empleado, supabase, matricula } = ctx

  const { error } = await supabase
    .from('correcciones_padron')
    .insert({ empleado_id: empleado.id, nombre, area: area || null })
  if (error) {
    console.error('[adiestramiento] no se guardó la corrección del padrón:', error.message)
    return { ok: false }
  }

  const primero = nombre.split(' ')[0]
  await supabase
    .from('matriculas')
    .update({ nombre_corto: primero.charAt(0).toLocaleUpperCase('es') + primero.slice(1) })
    .eq('id', matricula.id)

  await adelantar(ctx, Number(datos.get('turno')))
  revalidatePath(`/canal/adiestramiento/${numero}`)
  return { ok: true }
}

/**
 * Guarda lo que la persona contestó y adelanta la lección.
 *
 * Devuelve si quedó guardado: la caja de respuesta pone a Ajito «viendo lo que
 * le mandaste» en el acto, y si esto falla tiene que devolverle su texto con un
 * aviso, no dejarla mirando un cargando que no termina.
 */
export async function responder(datos: FormData): Promise<{ ok: boolean }> {
  const numero = Number(datos.get('numero'))
  const clavePaso = String(datos.get('clave_paso') ?? '').trim()
  const texto = String(datos.get('texto') ?? '').trim()
  const esCampo = datos.get('es_campo') === 'si'
  const mediaUrl = String(datos.get('media_url') ?? '').trim()

  // De dónde vino la respuesta. Se guarda porque dice mucho: si en planta
  // resulta que casi nadie escribe, el dato está aquí y no en una suposición.
  const cruda = String(datos.get('entrada') ?? 'texto')
  const entrada = ['texto', 'voz', 'foto', 'boton'].includes(cruda) ? cruda : 'texto'

  if (!clavePaso || !texto) return { ok: false }

  const ctx = await contexto(numero)
  if (!ctx) return { ok: false }

  const { empleado, supabase, matricula, leccion } = ctx

  // Si no se guardó, la lección no se adelanta: adelantarla dejaría el
  // ejercicio atrás sin contestar y el siguiente audio sonando.
  const { error: errGuardar } = await supabase.from('respuestas').insert({
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
  if (errGuardar) {
    console.error('[adiestramiento] no se guardó la respuesta:', errGuardar.message)
    return { ok: false }
  }

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
  return { ok: true }
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

/**
 * Reinicia el curso completo de quien lo pide.
 *
 * ⚠️ **Solo para editores de Boosty, y a propósito.** Es una herramienta de
 * trabajo: para volver a recorrer una lección hay que borrar el avance, y sin
 * esto había que ir a la base a mano. Delante de las doscientas personas de
 * planta un botón que borra el avance es un accidente esperando — quien lleva
 * tres lecciones hechas no tiene ninguna razón para tocarlo, y si lo toca no hay
 * cómo devolvérselo.
 *
 * Borra de verdad, no marca: avances, respuestas con sus fotos y notas de voz,
 * los audios de las devoluciones y el certificado si lo hubo. Y devuelve la
 * matrícula a «matriculada», como si nunca hubiera entrado.
 *
 * Los archivos del bucket se van con las filas. Dejarlos sería peor que un
 * descuido: son fotos de una persona y notas de voz suyas, sin nada que las
 * apunte y por lo tanto sin nada que las vuelva a borrar.
 */
export async function reiniciarMiCurso() {
  const empleado = await requerirEmpleado()
  const sesion = await obtenerSesion()
  if (!puede(sesion, 'modulo:adiestramiento', 'editar')) {
    return { error: 'Esto solo lo puede hacer el equipo de Boosty.' }
  }

  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso) return { error: 'El curso no existe.' }

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)
    .maybeSingle()
  if (!matricula) return { error: 'No tienes matrícula en el curso.' }

  // --- los archivos -----------------------------------------------------------
  //
  // Se barre **la carpeta del empleado**, no solo lo que apuntan las filas. Los
  // intentos que fallaron a mitad de camino dejan objetos sin fila que los
  // nombre, y esos ya nadie los volvería a borrar: son fotos de una persona y
  // notas de voz suyas. La primera versión de esto borró 2 archivos y dejó 7.
  const raiz = `respuestas/${empleado.id}`
  const carpetas = await supabase.storage.from(BUCKET_RESPUESTAS).list(raiz)
  const rutas: string[] = []
  for (const carpeta of carpetas.data ?? []) {
    const dentro = await supabase.storage.from(BUCKET_RESPUESTAS).list(`${raiz}/${carpeta.name}`)
    for (const objeto of dentro.data ?? []) rutas.push(`${raiz}/${carpeta.name}/${objeto.name}`)
  }

  if (rutas.length) {
    const { error } = await supabase.storage.from(BUCKET_RESPUESTAS).remove(rutas)
    if (error) return { error: `No se pudieron borrar los archivos: ${error.message}` }
  }

  // --- las filas --------------------------------------------------------------
  //
  // ⚠️ Con los errores mirados uno por uno. Sin política de DELETE, Postgres no
  // se queja: filtra las filas y `delete()` devuelve cero afectadas. Así, la
  // primera versión de esto decía «curso reiniciado» con los avances intactos.
  // Las políticas están en `20260831180000_reiniciar_curso.sql`.
  for (const tabla of ['respuestas', 'avances', 'certificados'] as const) {
    const { error } = await supabase.from(tabla).delete().eq('matricula_id', matricula.id)
    if (error) return { error: `No se pudo limpiar ${tabla}: ${error.message}` }
  }

  const { error: errMatricula } = await supabase
    .from('matriculas')
    .update({
      // 'pendiente' es el valor de arranque del `check` de la tabla. Poner uno
      // inventado —'matriculada'— lo rechazaba con un 23514 que nadie leía.
      estado: 'pendiente',
      iniciado_en: null,
      completado_en: null,
      ultimo_toque: null,
    })
    .eq('id', matricula.id)
  if (errMatricula) return { error: `No se pudo reiniciar la matrícula: ${errMatricula.message}` }

  // Y se comprueba: la acción no dice «hecho» sin haberlo mirado.
  const [{ count: avances }, { count: respuestas }] = await Promise.all([
    supabase.from('avances').select('*', { count: 'exact', head: true }).eq('matricula_id', matricula.id),
    supabase.from('respuestas').select('*', { count: 'exact', head: true }).eq('matricula_id', matricula.id),
  ])
  if (avances || respuestas) {
    return { error: `Quedaron ${avances} avances y ${respuestas} respuestas sin borrar.` }
  }

  revalidatePath('/canal/adiestramiento')
  return {
    ok: `Curso reiniciado. Se borraron ${rutas.length} archivo${rutas.length === 1 ? '' : 's'} tuyo${rutas.length === 1 ? '' : 's'} del expediente.`,
  }
}
