'use server'

import { revalidatePath } from 'next/cache'
import { CURSO } from '@/lib/adiestramiento'
import { requerirAdmin, requerirEditor } from '@/lib/auth'
import { escalonQueToca, redactar } from '@/lib/recordatorios'
import { createClient } from '@/lib/supabase/server'
import { estaLista, mandarPlantilla, probarConexion, type Conexion } from '@/lib/whatsapp'

const RUTA = '/dashboard/adiestramiento/recordatorios'

/**
 * Guarda la conexión con WhatsApp.
 *
 * Solo administradores: aquí se pega un token que puede escribirle a doscientas
 * personas en nombre de Iberia.
 *
 * **El token se deja como está si el campo viene vacío.** El panel nunca lo pinta
 * de vuelta —enseña que existe y ya—, así que un formulario enviado sin tocarlo
 * llega con el campo en blanco. Si eso se guardara tal cual, cambiar el nombre
 * de la plantilla borraría la conexión.
 */
export async function guardarWhatsapp(datos: FormData) {
  const { perfil } = await requerirAdmin()
  const supabase = await createClient()

  const token = String(datos.get('token') ?? '').trim()

  await supabase
    .from('ajustes_whatsapp')
    .update({
      activo: datos.get('activo') === 'si',
      id_numero: limpio(datos.get('id_numero')),
      plantilla: limpio(datos.get('plantilla')),
      numero_visible: limpio(datos.get('numero_visible')),
      actualizado_en: new Date().toISOString(),
      actualizado_por: perfil.id,
      // Vacío significa «no lo toques», no «bórralo».
      ...(token ? { token } : {}),
    })
    .eq('id', true)

  revalidatePath(RUTA)
}

/** Le pregunta a Meta por el número, sin escribirle a nadie. */
export async function probarWhatsapp() {
  await requerirAdmin()
  const supabase = await createClient()

  const { data } = await supabase.from('ajustes_whatsapp').select('*').eq('id', true).maybeSingle()

  const resultado = await probarConexion(data as Conexion | null)

  await supabase
    .from('ajustes_whatsapp')
    .update({
      probado_en: new Date().toISOString(),
      probado_ok: resultado.ok,
      probado_detalle: resultado.detalle,
    })
    .eq('id', true)

  revalidatePath(RUTA)
}

/**
 * Prepara los recordatorios que tocan hoy.
 *
 * Prepararlos y mandarlos son dos pasos a propósito. Preparar deja el texto
 * escrito, con el nombre y el enlace de cada quien, para poder **leerlo antes de
 * que salga**: doscientos mensajes con una errata de Ajito no se recogen. Y
 * mientras no haya cuenta de WhatsApp Business, prepararlos es todo lo que se
 * puede hacer desde aquí — se copian y se mandan a mano.
 *
 * Es idempotente: la pareja (matrícula, escalón) es única en la base, así que
 * darle diez veces al botón no prepara diez mensajes.
 */
export async function prepararRecordatorios() {
  await requerirEditor()
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso) return

  const [{ data: pendientes }, { data: lecciones }] = await Promise.all([
    supabase.from('recordatorios_pendientes').select('*').eq('curso_id', curso.id),
    supabase
      .from('lecciones')
      .select('numero, titulo')
      .eq('curso_id', curso.id)
      .eq('activa', true)
      .order('numero'),
  ])

  const total = lecciones?.length ?? 9
  const nuevos: { matricula_id: string; escalon: number; mensaje: string }[] = []

  // El enlace del curso. **No es todavía el enlace personal**: la tabla
  // `accesos` está en el esquema para eso —un token por persona, que es su
  // credencial— pero no hay ruta que lo consuma, así que no existe. Mientras
  // tanto va el del curso, que funciona: la persona entra con lo suyo y cae en
  // la lección donde se quedó. Un mensaje sin enlace no sirve de nada, y dejar
  // el hueco vacío en silencio es peor que poner el que hay.
  const enlace = `${(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/canal/adiestramiento`

  for (const fila of pendientes ?? []) {
    if (!fila.matricula_id || fila.dias === null) continue

    const escalon = escalonQueToca(fila.dias, fila.ultimo_escalon)
    if (!escalon) continue

    const hechas = fila.lecciones_hechas ?? 0
    const siguiente = lecciones?.[hechas]?.titulo ?? 'la que sigue'

    nuevos.push({
      matricula_id: fila.matricula_id,
      escalon: escalon.dias,
      mensaje: redactar(escalon.plantilla, {
        nombre: fila.nombre_corto ?? (fila.nombre_completo ?? '').split(' ')[0],
        hechas,
        faltan: Math.max(total - hechas, 0),
        siguiente,
        enlace,
      }).trim(),
    })
  }

  if (nuevos.length) {
    // `ignoreDuplicates` se apoya en la restricción única: si dos personas dan
    // al botón a la vez, no salen mensajes repetidos.
    await supabase.from('recordatorios').upsert(nuevos, {
      onConflict: 'matricula_id,escalon',
      ignoreDuplicates: true,
    })
  }

  revalidatePath(RUTA)
}

/**
 * Marca un recordatorio como mandado a mano.
 *
 * Es el camino de hoy, y no un apaño temporal que se tira cuando llegue la
 * integración: una supervisora con el teléfono en la mano va a seguir siendo la
 * mejor vía para quien no contesta mensajes de un número desconocido.
 */
export async function marcarAMano(datos: FormData) {
  await requerirEditor()
  const id = String(datos.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase
    .from('recordatorios')
    .update({ estado: 'enviado', via: 'a_mano', enviado_en: new Date().toISOString() })
    .eq('id', id)

  revalidatePath(RUTA)
}

/**
 * Manda por WhatsApp todo lo que esté preparado.
 *
 * Uno a uno y guardando el resultado de cada uno: si el número 40 falla, los 39
 * anteriores ya salieron y quedan marcados. Un lote que se deshace entero porque
 * uno tenía mal el teléfono obliga a mandarlos todos otra vez, y a la gente le
 * llega dos veces.
 */
export async function mandarPorWhatsapp() {
  await requerirEditor()
  const supabase = await createClient()

  const { data: conexion } = await supabase
    .from('ajustes_whatsapp')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  if (!estaLista(conexion as Conexion | null) || !conexion?.activo) return

  const { data: preparados } = await supabase
    .from('recordatorios')
    .select('id, mensaje, matricula_id, matriculas(empleado_id, empleados(telefono))')
    .eq('estado', 'preparado')
    .limit(200)

  for (const fila of preparados ?? []) {
    const empleado = (fila.matriculas as { empleados?: { telefono: string | null } } | null)
      ?.empleados
    const envio = await mandarPlantilla(conexion as Conexion, empleado?.telefono ?? null, [
      fila.mensaje,
    ])

    await supabase
      .from('recordatorios')
      .update(
        envio.ok
          ? { estado: 'enviado', via: 'whatsapp', enviado_en: new Date().toISOString() }
          : { estado: 'fallido', via: 'whatsapp', detalle: `${envio.motivo}${envio.detalle ? ` · ${envio.detalle}` : ''}` }
      )
      .eq('id', fila.id)
  }

  revalidatePath(RUTA)
}

function limpio(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? '').trim()
  return texto || null
}
