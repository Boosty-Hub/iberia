'use server'

import { revalidatePath } from 'next/cache'
import { CURSO } from '@/lib/adiestramiento'
import { acunarToken, cuandoCaduca, enlaceDe, huella } from '@/lib/accesos'
import { requerirEditor } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { aInternacional } from '@/lib/telefono'
import { estaLista, mandarPlantilla, type Conexion } from '@/lib/whatsapp'

const RUTA = '/dashboard/empleados'

/** Los que vinieron marcados en la tabla. */
function marcados(datos: FormData): string[] {
  return datos
    .getAll('empleado')
    .map((v) => String(v))
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v))
}

/**
 * Matricula en el curso a los seleccionados.
 *
 * Es idempotente por la restricción única de `matriculas`: darle dos veces no
 * duplica a nadie. La familia de oficio se copia del padrón en el momento de
 * matricular — si mañana Capital Humano corrige un cargo, la matrícula ya hecha
 * conserva el oficio con el que se armaron sus ejercicios.
 */
export async function matricularSeleccionados(datos: FormData) {
  await requerirEditor()
  const ids = marcados(datos)
  if (!ids.length) return

  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso) return

  const { data: gente } = await supabase
    .from('empleados')
    .select('id, nombre_completo, familia_oficio')
    .in('id', ids)

  const filas = (gente ?? []).map((e) => ({
    curso_id: curso.id,
    empleado_id: e.id,
    familia_oficio: e.familia_oficio,
    nombre_corto: e.nombre_completo.split(' ')[0],
  }))

  if (filas.length) {
    await supabase
      .from('matriculas')
      .upsert(filas, { onConflict: 'curso_id,empleado_id', ignoreDuplicates: true })
  }

  revalidatePath(RUTA)
  revalidatePath('/dashboard/adiestramiento')
}

/**
 * Acuña el enlace personal de los seleccionados.
 *
 * Dos cosas pasan aquí, y las dos necesitan la clave de servicio — que es
 * exactamente el caso que la regla permite: provisionar.
 *
 *  1. **Se le crea cuenta a quien no la tiene.** El padrón de planta llega sin
 *     correo: se les acuña uno interno con la cédula, `V12345678@iberia.local`,
 *     que nadie va a usar nunca para entrar. La puerta es el enlace; el correo
 *     solo existe porque Supabase necesita colgar la sesión de algo.
 *
 *  2. **Se guarda el hash del token, nunca el token.** El texto en claro sale de
 *     esta función hacia el mensaje y no se vuelve a poder leer. Si alguien
 *     pierde su enlace no se recupera: se acuña otro.
 *
 * Volver a acuñar para alguien que ya tiene uno vivo **no lo revoca**. Es a
 * propósito: quien mandó el enlace hace un mes y lo vuelve a mandar hoy no puede
 * dejar fuera a quien todavía estaba usando el primero.
 */
export async function acunarEnlaces(datos: FormData) {
  await requerirEditor()
  const ids = marcados(datos)
  if (!ids.length) return

  const admin = createAdminClient()

  const { data: gente } = await admin
    .from('empleados')
    .select('id, cedula, nombre_completo, cargo, perfil_id, activo')
    .in('id', ids)

  for (const persona of gente ?? []) {
    if (!persona.activo) continue

    let perfil = persona.perfil_id

    if (!perfil) {
      const correo = `${persona.cedula.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()}@iberia.local`

      const { data: creado, error } = await admin.auth.admin.createUser({
        email: correo,
        email_confirm: true,
        user_metadata: {
          nombre_completo: persona.nombre_completo,
          cargo: persona.cargo,
          organizacion: 'iberia',
          rol: 'lector',
        },
      })

      if (error || !creado?.user) {
        console.error(`[accesos] no se pudo crear la cuenta de ${persona.cedula}:`, error?.message)
        continue
      }

      perfil = creado.user.id
      await admin.from('empleados').update({ perfil_id: perfil }).eq('id', persona.id)
    }

    const token = acunarToken()
    await admin.from('accesos').insert({
      empleado_id: persona.id,
      token_hash: huella(token),
      motivo: 'curso',
      canal: 'whatsapp',
      expira_en: cuandoCaduca(),
      // El texto en claro va aquí y no vuelve a existir: es lo que se copia o
      // lo que sale por WhatsApp.
      mensaje: mensajeDeBienvenida(persona.nombre_completo, enlaceDe(token)),
    })
  }

  revalidatePath(RUTA)
}

/**
 * Manda por WhatsApp los enlaces que están acuñados y sin mandar.
 *
 * Uno a uno, guardando el resultado de cada uno: si el número 40 falla, los 39
 * anteriores ya salieron y quedan marcados. Un lote que se deshace entero
 * porque uno tenía mal el teléfono obliga a repetirlo, y a la gente le llega
 * dos veces.
 */
export async function mandarEnlaces(datos: FormData) {
  await requerirEditor()
  const ids = marcados(datos)
  if (!ids.length) return

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: conexion } = await supabase
    .from('ajustes_whatsapp')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  if (!estaLista(conexion as Conexion | null) || !conexion?.activo) return

  const { data: pendientes } = await admin
    .from('accesos')
    .select('id, mensaje, empleado_id, empleados(telefono)')
    .in('empleado_id', ids)
    .eq('motivo', 'curso')
    .is('enviado_en', null)

  for (const acceso of pendientes ?? []) {
    const telefono =
      (acceso.empleados as { telefono: string | null } | null)?.telefono ?? null
    if (!aInternacional(telefono)) continue

    const envio = await mandarPlantilla(conexion as Conexion, telefono, [acceso.mensaje ?? ''])

    if (envio.ok) {
      await admin
        .from('accesos')
        .update({ enviado_en: new Date().toISOString() })
        .eq('id', acceso.id)
    } else {
      console.error(`[accesos] no salió el de ${acceso.empleado_id}:`, envio.motivo, envio.detalle)
    }
  }

  revalidatePath(RUTA)
}

/**
 * Marca como mandados a mano los enlaces de los seleccionados.
 *
 * Es el camino de hoy —no hay cuenta de WhatsApp Business— y no un apaño que se
 * tira cuando llegue: una supervisora con el teléfono en la mano va a seguir
 * siendo la mejor vía para quien no abre mensajes de un número desconocido.
 */
export async function marcarEnlacesMandados(datos: FormData) {
  await requerirEditor()
  const ids = marcados(datos)
  if (!ids.length) return

  const admin = createAdminClient()
  await admin
    .from('accesos')
    .update({ enviado_en: new Date().toISOString(), canal: 'manual' })
    .in('empleado_id', ids)
    .eq('motivo', 'curso')
    .is('enviado_en', null)

  revalidatePath(RUTA)
}

/**
 * El mensaje con el que llega el enlace.
 *
 * Corto y sin adornos: es lo primero que esta persona lee de todo el programa, y
 * le llega de un número que no tiene agendado. Dice quién escribe, qué es y qué
 * hacer. Nada más.
 */
function mensajeDeBienvenida(nombreCompleto: string, enlace: string): string {
  const nombre = nombreCompleto.split(' ')[0]
  return (
    `Epa ${nombre}, soy Ajito, de Industrias Iberia. ` +
    `Te toca un curso corto por el teléfono: nueve clases de tres minutos, ` +
    `a tu ritmo y cuando puedas.\n\n` +
    `Este enlace es tuyo, no lo compartas. Con él entras directo, sin clave:\n${enlace}`
  )
}
