'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, type ParteInforme } from '@/lib/types'

export type EstadoSeccion = { error?: string; ok?: boolean; guardadoEn?: string }

const PARTES = Object.keys(PARTES_INFORME) as ParteInforme[]

function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/** Slug seguro para la URL de la sección. */
function slugificar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/**
 * El slug de una sección por su id, para pedir el permiso de esa sección. Si la
 * RLS no la deja ver, no existe: nadie edita lo que no puede leer.
 */
async function slugDe(id: string): Promise<string | null> {
  if (!id) return null
  const supabase = await createClient()
  const { data } = await supabase.from('informe_secciones').select('slug').eq('id', id).maybeSingle()
  return data?.slug ?? null
}

function revalidarInforme(slug?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/informe')
  revalidatePath('/informe')
  if (slug) revalidatePath(`/dashboard/informe/${slug}`)
}

export async function actualizarSeccion(
  _anterior: EstadoSeccion,
  fd: FormData
): Promise<EstadoSeccion> {
  const id = texto(fd, 'id')
  if (!id) return { error: 'Falta el identificador de la sección.' }
  const slugActual = await slugDe(id)
  if (!slugActual) return { error: 'Esa sección no existe o tu rol no la puede ver.' }
  const { userId } = await requerirPermiso(`informe:${slugActual}`, 'editar')
  const supabase = await createClient()

  const titulo = texto(fd, 'titulo')
  if (!titulo) return { error: 'El título es obligatorio.' }

  const ordenCrudo = Number.parseInt(String(fd.get('orden') ?? ''), 10)
  const parteCruda = String(fd.get('parte') ?? '')

  const { data, error } = await supabase
    .from('informe_secciones')
    .update({
      titulo,
      subtitulo: texto(fd, 'subtitulo'),
      numero: texto(fd, 'numero'),
      parte: PARTES.includes(parteCruda as ParteInforme)
        ? (parteCruda as ParteInforme)
        : 'levantamiento',
      contenido_md: texto(fd, 'contenido_md'),
      orden: Number.isFinite(ordenCrudo) ? ordenCrudo : 100,
      publicado: fd.get('publicado') === 'on',
      updated_by: userId,
    })
    .eq('id', id)
    .select('slug')
    .maybeSingle()

  if (error) return { error: `No se pudo guardar: ${error.message}` }
  // Sin permiso de la base, el update no falla: no toca nada y vuelve vacío.
  if (!data) return { error: 'La base no dejó guardar: tu rol no puede editar esta sección.' }

  revalidarInforme(data?.slug ?? undefined)

  // Se queda en el editor: escribir el informe es iterativo.
  return { ok: true, guardadoEn: new Date().toISOString() }
}

export async function crearSeccion(
  _anterior: EstadoSeccion,
  fd: FormData
): Promise<EstadoSeccion> {
  const { userId } = await requerirPermiso('modulo:informe', 'crear')
  const supabase = await createClient()

  const titulo = texto(fd, 'titulo')
  if (!titulo) return { error: 'El título es obligatorio.' }

  const slugBase = slugificar(texto(fd, 'slug') ?? titulo)
  if (!slugBase) return { error: 'El título no produce una URL válida. Usa letras o números.' }

  const parteCruda = String(fd.get('parte') ?? '')
  const ordenCrudo = Number.parseInt(String(fd.get('orden') ?? ''), 10)

  // Si el slug ya existe se le añade sufijo hasta que sea libre.
  let slug = slugBase
  for (let intento = 2; intento <= 20; intento++) {
    const { data: existente } = await supabase
      .from('informe_secciones')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existente) break
    slug = `${slugBase}-${intento}`
  }

  const { error } = await supabase.from('informe_secciones').insert({
    slug,
    titulo,
    subtitulo: texto(fd, 'subtitulo'),
    numero: texto(fd, 'numero'),
    parte: PARTES.includes(parteCruda as ParteInforme)
      ? (parteCruda as ParteInforme)
      : 'levantamiento',
    contenido_md: texto(fd, 'contenido_md'),
    orden: Number.isFinite(ordenCrudo) ? ordenCrudo : 100,
    publicado: false,
    updated_by: userId,
  })

  if (error) return { error: `No se pudo crear la sección: ${error.message}` }

  revalidarInforme()
  redirect(`/dashboard/informe/${slug}`)
}

export async function alternarPublicacion(fd: FormData) {
  const id = String(fd.get('id') ?? '')
  const slug = await slugDe(id)
  if (!slug) return
  await requerirPermiso(`informe:${slug}`, 'editar')
  const supabase = await createClient()

  const { data: actual } = await supabase
    .from('informe_secciones')
    .select('publicado, slug')
    .eq('id', id)
    .maybeSingle()

  if (!actual) return

  await supabase
    .from('informe_secciones')
    .update({ publicado: !actual.publicado })
    .eq('id', id)

  revalidarInforme(actual.slug)
}

export async function eliminarSeccion(fd: FormData) {
  const id = String(fd.get('id') ?? '')
  const slug = await slugDe(id)
  if (!slug) return
  await requerirPermiso(`informe:${slug}`, 'eliminar')
  const supabase = await createClient()

  await supabase.from('informe_secciones').delete().eq('id', id)

  revalidarInforme()
  redirect('/dashboard/informe')
}
