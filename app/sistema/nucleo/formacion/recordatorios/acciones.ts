'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { requerirAdmin, requerirPermiso } from '@/lib/auth'
import { avisarRecordatorios } from '@/lib/notificaciones'
import { escalonQueToca, redactar } from '@/lib/recordatorios'
import { createClient } from '@/lib/supabase/server'
import { estaLista, mandarPlantilla, probarConexion, type Conexion } from '@/lib/whatsapp'

/**
 * El empujón (Formación › Recordatorios). Solo funciones async. Cada una vuelve
 * a pedir su permiso: `modulo:recordatorios` · editar para preparar y mandar, y
 * administración para la conexión con WhatsApp (se pega un token que puede
 * escribirle a doscientas personas en nombre de Iberia).
 */

const RUTA = '/sistema/nucleo/formacion/recordatorios'

/**
 * Guarda la conexión con WhatsApp. **El token se deja como está si el campo
 * viene vacío**: el panel nunca lo pinta de vuelta, así que un formulario
 * enviado sin tocarlo llega en blanco; guardarlo tal cual borraría la conexión
 * al cambiar el nombre de la plantilla.
 */
export async function guardarWhatsapp(datos: FormData): Promise<void> {
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
export async function probarWhatsapp(): Promise<void> {
  await requerirAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from('ajustes_whatsapp').select('*').eq('id', true).maybeSingle()
  const resultado = await probarConexion(data as Conexion | null)
  await supabase
    .from('ajustes_whatsapp')
    .update({ probado_en: new Date().toISOString(), probado_ok: resultado.ok, probado_detalle: resultado.detalle })
    .eq('id', true)
  revalidatePath(RUTA)
}

/**
 * Prepara los recordatorios que tocan hoy: el escalón más alto vencido de cada
 * quien, con su nombre. Preparar y mandar son dos pasos para poder leer el texto
 * antes de que salga. Idempotente: la pareja (matrícula, escalón) es única.
 */
export async function prepararRecordatorios(): Promise<void> {
  await requerirPermiso('modulo:recordatorios', 'editar')
  const supabase = await createClient()
  const { data: curso } = await supabase.from('cursos').select('id').eq('clave', CURSO).maybeSingle()
  if (!curso) return

  const [{ data: pendientes }, { data: lecciones }] = await Promise.all([
    supabase.from('recordatorios_pendientes').select('*').eq('curso_id', curso.id),
    supabase.from('lecciones').select('numero, titulo').eq('curso_id', curso.id).eq('activa', true).order('numero'),
  ])

  const total = lecciones?.length ?? 9
  const nuevos: { matricula_id: string; escalon: number; mensaje: string }[] = []
  // El enlace del curso, no el personal: el personal sale del padrón al acuñarlo.
  // La persona entra con lo suyo y cae en la lección donde se quedó.
  const enlace = `${(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/canal/adiestramiento`

  for (const fila of pendientes ?? []) {
    if (!fila.matricula_id || fila.dias === null) continue
    const escalon = escalonQueToca(fila.dias, fila.ultimo_escalon)
    if (!escalon) continue
    const hechas = fila.lecciones_hechas ?? 0
    nuevos.push({
      matricula_id: fila.matricula_id,
      escalon: escalon.dias,
      mensaje: redactar(escalon.plantilla, {
        nombre: fila.nombre_corto ?? (fila.nombre_completo ?? '').split(' ')[0],
        hechas,
        faltan: Math.max(total - hechas, 0),
        siguiente: lecciones?.[hechas]?.titulo ?? 'la que sigue',
        enlace,
      }).trim(),
    })
  }

  if (nuevos.length) {
    // `ignoreDuplicates` se apoya en la restricción única: dos personas dándole a la vez no duplican.
    await supabase.from('recordatorios').upsert(nuevos, { onConflict: 'matricula_id,escalon', ignoreDuplicates: true })
  }
  revalidatePath(RUTA)
}

/**
 * Marca un recordatorio como mandado a mano. Si la persona tiene la app, le
 * llega además el aviso de Ajito, con `after()`: marcarlo no espera a Apple. Uno
 * ya mandado no se vuelve a marcar, así que un doble toque no avisa dos veces.
 */
export async function marcarAMano(datos: FormData): Promise<void> {
  await requerirPermiso('modulo:recordatorios', 'editar')
  const id = String(datos.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return
  const supabase = await createClient()
  const { data: marcados } = await supabase
    .from('recordatorios')
    .update({ estado: 'enviado', via: 'a_mano', enviado_en: new Date().toISOString() })
    .eq('id', id)
    .neq('estado', 'enviado')
    .select('id')
  revalidatePath(RUTA)
  const ids = (marcados ?? []).map((m) => m.id)
  if (ids.length) after(() => avisarRecordatorios(supabase, ids))
}

/**
 * Manda por WhatsApp todo lo preparado, uno a uno y guardando el resultado de
 * cada uno: si el 40 falla, los 39 de antes ya salieron y quedan marcados.
 */
export async function mandarPorWhatsapp(): Promise<void> {
  await requerirPermiso('modulo:recordatorios', 'editar')
  const supabase = await createClient()
  const { data: conexion } = await supabase.from('ajustes_whatsapp').select('*').eq('id', true).maybeSingle()
  if (!estaLista(conexion as Conexion | null) || !conexion?.activo) return

  const { data: preparados } = await supabase
    .from('recordatorios')
    .select('id, mensaje, matricula_id, matriculas(empleado_id, empleados(telefono))')
    .eq('estado', 'preparado')
    .limit(200)

  const enviados: string[] = []
  for (const fila of preparados ?? []) {
    const empleado = (fila.matriculas as { empleados?: { telefono: string | null } } | null)?.empleados
    const envio = await mandarPlantilla(conexion as Conexion, empleado?.telefono ?? null, [fila.mensaje])
    await supabase
      .from('recordatorios')
      .update(
        envio.ok
          ? { estado: 'enviado', via: 'whatsapp', enviado_en: new Date().toISOString() }
          : { estado: 'fallido', via: 'whatsapp', detalle: `${envio.motivo}${envio.detalle ? ` · ${envio.detalle}` : ''}` }
      )
      .eq('id', fila.id)
    if (envio.ok) enviados.push(fila.id)
  }
  revalidatePath(RUTA)
  if (enviados.length) after(() => avisarRecordatorios(supabase, enviados))
}

function limpio(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? '').trim()
  return texto || null
}
