'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import guion from '@/contenido/adiestramiento/guion.json'
import { CURSO } from '@/lib/adiestramiento'
import { obtenerSesion, puede } from '@/lib/auth'
import { requerirEmpleado } from '@/lib/canal'
import { cerrarLeccion } from '@/lib/cerrar-curso'
import { imagenCertificado } from '@/lib/certificado-imagen'
import { turnoDelEjercicio, type LeccionGuion } from '@/lib/guion'
import {
  BUCKET_CANAL,
  BUCKET_RESPUESTAS,
  rutaCertificadoPublicado,
  rutaEscudoPublicado,
} from '@/lib/storage'
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
 * «Recorrer el curso»: matricula a quien su rol le trae lecciones.
 *
 * La matrícula la pone el equipo desde el padrón, a planta y administrativo. Pero
 * un rol puede traer las lecciones a alguien de otro nivel —el de Marketing, para
 * Martha Álvarez, el 27 de septiembre de 2026—, y sin matrícula se encontraba
 * con «este curso no es para tu nivel»: la casilla no le abría nada. La función
 * comprueba en la base que su rol tenga alguna lección; aquí no se decide nada.
 */
export async function recorrerCurso() {
  await requerirEmpleado()
  const supabase = await createClient()
  const { error } = await supabase.rpc('matricularme', { p_curso: CURSO })
  if (error) console.error('[adiestramiento] no se pudo matricular:', error.message)
  revalidatePath('/canal')
  revalidatePath('/canal/adiestramiento')
  redirect('/canal/adiestramiento')
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
 * Anota que oyó un audio de la lección hasta el final, para que su ✓ siga ahí al
 * recargar o al volver otro día. Las piezas son las del guion y las devoluciones
 * van como `devolucion-<clave>`. No refresca la página: el ✓ ya está puesto.
 */
export async function marcarOido(numero: number, pieza: string): Promise<void> {
  if (!Number.isInteger(numero) || !/^[\w-]{1,60}$/.test(pieza)) return
  const ctx = await contexto(numero)
  if (!ctx) return

  const { error } = await ctx.supabase.rpc('marcar_oido', {
    p_matricula: ctx.matricula.id,
    p_leccion: ctx.leccion.id,
    p_pieza: pieza,
  })
  if (error) console.error('[adiestramiento] no se anotó el audio oído:', error.message)
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
 * «Publicarlo en el canal»: el escudo de la lección 4, en el feed de Iberia.
 *
 * Lo decide la persona —el guion lo pide así: no se publica nada sin que ella
 * lo mande— y sale en «Nuestra gente» como «Este es el escudo que construí con
 * Ajito», con su nombre. El escudo original vive en su carpeta privada, así que
 * se copia a su carpeta del bucket del canal, con su propia sesión, y
 * `publicar_mi_escudo()` hace el resto: comprueba que el escudo sea suyo y haya
 * pasado el filtro, y no lo publica dos veces.
 */
export async function publicarEscudo(datos: FormData): Promise<{ ok: boolean; id?: string }> {
  const numero = Number(datos.get('numero'))
  const ctx = await contexto(numero)
  if (!ctx) return { ok: false }
  const { empleado, supabase, matricula, leccion } = ctx

  const { data: respuesta } = await supabase
    .from('respuestas')
    .select('id, dibujo, dibujo_veredicto')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .eq('clave_paso', 'escudo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!respuesta?.dibujo || respuesta.dibujo_veredicto !== 'va') return { ok: false }

  const { data: archivo } = await supabase.storage.from(BUCKET_RESPUESTAS).download(respuesta.dibujo)
  if (!archivo) return { ok: false }

  const ruta = rutaEscudoPublicado(empleado.id, respuesta.id)
  const { error: errSubir } = await supabase.storage
    .from(BUCKET_CANAL)
    .upload(ruta, archivo, { contentType: 'image/webp', upsert: true })
  if (errSubir) {
    console.error('[canal] no se pudo copiar el escudo:', errSubir.message)
    return { ok: false }
  }

  const { data: id, error } = await supabase.rpc('publicar_mi_escudo', {
    p_respuesta: respuesta.id,
    p_imagen_ruta: ruta,
  })
  if (error || !id) {
    console.error('[canal] no se publicó el escudo:', error?.message)
    return { ok: false }
  }

  await adelantar(ctx, Number(datos.get('turno')))
  revalidatePath('/canal')
  revalidatePath(`/canal/adiestramiento/${numero}`)
  return { ok: true, id }
}

/**
 * «Publicarlo en el canal», debajo del certificado de la lección 8.
 *
 * Como el escudo: lo decide la persona, y sale en «Nuestra gente» como «Terminé
 * el curso de Ajito y este es mi certificado». La imagen se dibuja aquí mismo
 * **sin la cédula** —el feed lo leen todos— y se sube a su carpeta del bucket del
 * canal; `publicar_mi_certificado()` comprueba que el certificado sea suyo y no
 * lo publica dos veces.
 *
 * El turno es opcional: debajo del certificado, en el turno que toca, publicar
 * también sigue la lección; en la página del certificado solo publica.
 */
export async function publicarCertificado(datos: FormData): Promise<{ ok: boolean; id?: string }> {
  const numero = Number(datos.get('numero'))
  const ctx = await contexto(numero)
  if (!ctx) return { ok: false }
  const { empleado, supabase, matricula } = ctx

  const { data: certificado } = await supabase
    .from('certificados')
    .select('id, codigo, nombre_completo, cedula, cargo, area_nombre, emitido_en')
    .eq('matricula_id', matricula.id)
    .maybeSingle()
  if (!certificado) return { ok: false }

  const imagen = await imagenCertificado(certificado, { conCedula: false })
  const ruta = rutaCertificadoPublicado(empleado.id, certificado.id)
  const { error: errSubir } = await supabase.storage
    .from(BUCKET_CANAL)
    .upload(ruta, await imagen.arrayBuffer(), { contentType: 'image/png', upsert: true })
  if (errSubir) {
    console.error('[canal] no se pudo subir el certificado:', errSubir.message)
    return { ok: false }
  }

  const { data: id, error } = await supabase.rpc('publicar_mi_certificado', { p_imagen_ruta: ruta })
  if (error || !id) {
    console.error('[canal] no se publicó el certificado:', error?.message)
    return { ok: false }
  }

  const turno = datos.get('turno')
  if (turno !== null && turno !== '') await adelantar(ctx, Number(turno))
  revalidatePath('/canal')
  revalidatePath(`/canal/adiestramiento/${numero}`)
  revalidatePath('/canal/adiestramiento/certificado')
  return { ok: true, id }
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

  // La foto se manda sola, sin nota (desde el 27 de septiembre de 2026): antes
  // había que escribir qué se le tomó, y era un paso de más con guantes puestos.
  // Todo lo demás necesita texto.
  const esFoto = entrada === 'foto' && Boolean(mediaUrl)
  if (!clavePaso || (!texto && !esFoto)) return { ok: false }

  const ctx = await contexto(numero)
  if (!ctx) return { ok: false }

  const { empleado, supabase, matricula, leccion } = ctx

  // El archivo tiene que ser de la carpeta de quien contesta. La política del
  // bucket ya impide leer uno ajeno, pero no hay por qué guardar la ruta.
  if (mediaUrl && !mediaUrl.startsWith(`respuestas/${empleado.id}/`)) return { ok: false }

  // Si no se guardó, la lección no se adelanta: adelantarla dejaría el
  // ejercicio atrás sin contestar y el siguiente audio sonando.
  const { error: errGuardar } = await supabase.from('respuestas').insert({
    matricula_id: matricula.id,
    leccion_id: leccion.id,
    clave_paso: clavePaso,
    es_pregunta_campo: esCampo,
    entrada,
    texto: texto ? texto.slice(0, 4000) : null,
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

  // Terminó las nueve: se emite el certificado. Ver `cerrarLeccion`.
  const { termino } = await cerrarLeccion(supabase, {
    cursoId: curso.id,
    matricula,
    leccionId: leccion.id,
  })

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
      // El apodo de la lección 0 también se va: vuelve el primer nombre del
      // padrón, que es con el que se matriculó.
      nombre_corto: empleado.nombre_completo.split(' ')[0],
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
