'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { UUID } from '@/lib/reportes'
import { createClient } from '@/lib/supabase/server'

/**
 * Las acciones de la administración del canal (NUC-CAN). Cada una pide la
 * casilla de editar de `modulo:reportes` aquí, y la función de la base la pide
 * otra vez: la acción no confía en que el botón estuviera escondido.
 */

const BASE = '/sistema/nucleo/canal'

/** Vuelve a la pantalla de donde vino (solo rutas del canal en la plataforma). */
function volver(datos: FormData, aviso?: string): never {
  const destino = String(datos.get('volver') ?? '')
  const ruta = destino.startsWith(BASE) ? destino : BASE
  if (!aviso) redirect(ruta)
  const url = new URL(ruta, 'http://x')
  url.searchParams.set('aviso', aviso)
  redirect(`${url.pathname}${url.search}`)
}

/** Marca un reporte como revisado, o lo reabre. */
export async function revisarReporte(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const id = String(datos.get('id') ?? '')
  if (!UUID.test(id)) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('revisar_reporte', { p_reporte: id, p_revisado: datos.get('revisado') === 'si' })
  revalidatePath(BASE, 'layout')
  if (error) volver(datos, 'error')
}

/**
 * Oculta lo reportado —o lo devuelve— y da por revisados todos los reportes de
 * esa misma cosa. No borra nada: mensaje y comentario pasan a `oculto`, una
 * publicación a `archivado`, y se restaura igual.
 */
export async function ocultarReportado(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const id = String(datos.get('id') ?? '')
  if (!UUID.test(id)) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('ocultar_contenido_reportado', { p_reporte: id, p_ocultar: datos.get('ocultar') === 'si' })
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}

const ACCIONES_PUBLICACION = ['archivar', 'restaurar', 'fijar', 'soltar', 'oficial', 'no_oficial'] as const

/** Archivar, restaurar, fijar o marcar oficial una publicación del feed. */
export async function moderarPublicacion(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const id = String(datos.get('id') ?? '')
  const accion = String(datos.get('accion') ?? '')
  if (!UUID.test(id) || !(ACCIONES_PUBLICACION as readonly string[]).includes(accion)) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('canal_moderar_publicacion', { p_publicacion: id, p_accion: accion })
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}

/** Quién publica en nombre de la organización y quién modera. */
export async function autorizarPersona(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const id = String(datos.get('empleado') ?? '')
  if (!UUID.test(id)) return
  const valor = (k: string) => (datos.has(k) ? datos.get(k) === 'si' : null)
  const supabase = await createClient()
  const { error } = await supabase.rpc('canal_autorizar', {
    p_empleado: id,
    p_puede_publicar: valor('publica') as boolean,
    p_es_moderador: valor('modera') as boolean,
  })
  revalidatePath(BASE, 'layout')
  if (error) volver(datos, 'error')
}

// ── Portal planta (24-nov-2026): grupos, comentarios y secciones ──────────────────────────────────────────

/** Agregar, quitar o cambiar el rol de alguien en un grupo. */
export async function miembroDeGrupo(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const grupo = String(datos.get('grupo') ?? '')
  const empleado = String(datos.get('empleado') ?? '')
  const accion = String(datos.get('accion') ?? '')
  if (!UUID.test(grupo) || !UUID.test(empleado) || !['agregar', 'quitar', 'coordinador', 'miembro'].includes(accion)) return
  const supabase = await createClient()
  const { error } = await supabase
    .schema('ui')
    .rpc('canal_grupo_miembro' as never, { p_grupo: grupo, p_empleado: empleado, p_accion: accion } as never)
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}

/** Renombrar, cambiar propósito o tipo, archivar o restaurar un grupo. */
export async function editarGrupo(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const grupo = String(datos.get('grupo') ?? '')
  if (!UUID.test(grupo)) return
  const texto = (k: string) => (datos.has(k) ? String(datos.get(k) ?? '') : null)
  const tipo = datos.get('tipo')
  const activo = datos.get('activo')
  const supabase = await createClient()
  const { error } = await supabase.schema('ui').rpc('canal_grupo_editar' as never, {
    p_grupo: grupo,
    p_nombre: texto('nombre'),
    p_proposito: texto('proposito'),
    p_tipo: tipo === 'abierto' || tipo === 'cerrado' ? tipo : null,
    p_activo: activo === 'si' ? true : activo === 'no' ? false : null,
  } as never)
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}

/** Ocultar o volver a mostrar un comentario. */
export async function estadoComentario(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const id = String(datos.get('id') ?? '')
  const estado = datos.get('estado') === 'oculto' ? 'oculto' : 'visible'
  if (!UUID.test(id)) return
  const supabase = await createClient()
  const { error } = await supabase.schema('ui').rpc('canal_comentario_estado' as never, { p_comentario: id, p_estado: estado } as never)
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}

/** Abrir o cerrar los comentarios de una publicación. */
export async function comentariosDePublicacion(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const id = String(datos.get('id') ?? '')
  if (!UUID.test(id)) return
  const supabase = await createClient()
  const { error } = await supabase
    .schema('ui')
    .rpc('canal_publicacion_comentarios' as never, { p_publicacion: id, p_permite: datos.get('permite') === 'si' } as never)
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}

/** Prender o apagar una sección del portal. */
export async function seccionDelPortal(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')
  const clave = String(datos.get('clave') ?? '')
  if (!/^[a-z]{3,20}$/.test(clave)) return
  const supabase = await createClient()
  const { error } = await supabase
    .schema('ui')
    .rpc('canal_modulo_activar' as never, { p_clave: clave, p_activo: datos.get('activo') === 'si' } as never)
  revalidatePath(BASE, 'layout')
  revalidatePath('/canal', 'layout')
  if (error) volver(datos, 'error')
}
