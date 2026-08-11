'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  ESTADOS_HALLAZGO,
  NIVELES,
  TIPOS_HALLAZGO,
  type EstadoHallazgo,
  type Nivel,
  type TipoHallazgo,
} from '@/lib/types'

export type EstadoFormularioHallazgo = { error?: string }

const TIPOS = Object.keys(TIPOS_HALLAZGO) as TipoHallazgo[]
const ESTADOS = Object.keys(ESTADOS_HALLAZGO) as EstadoHallazgo[]
const NIVELES_VALIDOS = Object.keys(NIVELES) as Nivel[]

function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function opcion<T extends string>(
  fd: FormData,
  campo: string,
  permitidos: readonly T[]
): T | null {
  const t = texto(fd, campo)
  return t !== null && (permitidos as readonly string[]).includes(t) ? (t as T) : null
}

/** El id del segmento es bigint en la base; llega como texto del formulario. */
function segmentoId(fd: FormData): number | null {
  const t = texto(fd, 'segmento_id')
  if (t === null) return null
  const n = Number.parseInt(t, 10)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function camposComunes(fd: FormData) {
  return {
    entrevista_id: texto(fd, 'entrevista_id'),
    segmento_id: segmentoId(fd),
    area_id: texto(fd, 'area_id'),
    tipo: opcion(fd, 'tipo', TIPOS) ?? 'cuello_botella',
    descripcion: texto(fd, 'descripcion'),
    cita_textual: texto(fd, 'cita_textual'),
    impacto: opcion(fd, 'impacto', NIVELES_VALIDOS),
    esfuerzo: opcion(fd, 'esfuerzo', NIVELES_VALIDOS),
    estado: opcion(fd, 'estado', ESTADOS) ?? 'propuesto',
  }
}

export async function crearHallazgo(
  _anterior: EstadoFormularioHallazgo,
  fd: FormData
): Promise<EstadoFormularioHallazgo> {
  const { userId } = await requerirEditor()
  const supabase = await createClient()

  const titulo = texto(fd, 'titulo')
  if (!titulo) return { error: 'El título del hallazgo es obligatorio.' }

  const { data, error } = await supabase
    .from('hallazgos')
    .insert({ ...camposComunes(fd), titulo, created_by: userId })
    .select('id, entrevista_id')
    .single()

  if (error) return { error: `No se pudo crear el hallazgo: ${error.message}` }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hallazgos')
  if (data.entrevista_id) revalidatePath(`/dashboard/entrevistas/${data.entrevista_id}`)

  redirect(`/dashboard/hallazgos/${data.id}`)
}

export async function actualizarHallazgo(
  _anterior: EstadoFormularioHallazgo,
  fd: FormData
): Promise<EstadoFormularioHallazgo> {
  await requerirEditor()
  const supabase = await createClient()

  const id = texto(fd, 'id')
  if (!id) return { error: 'Falta el identificador del hallazgo.' }

  const titulo = texto(fd, 'titulo')
  if (!titulo) return { error: 'El título del hallazgo es obligatorio.' }

  const { data, error } = await supabase
    .from('hallazgos')
    .update({ ...camposComunes(fd), titulo })
    .eq('id', id)
    .select('entrevista_id')
    .maybeSingle()

  if (error) return { error: `No se pudo guardar: ${error.message}` }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hallazgos')
  revalidatePath(`/dashboard/hallazgos/${id}`)
  if (data?.entrevista_id) revalidatePath(`/dashboard/entrevistas/${data.entrevista_id}`)

  redirect(`/dashboard/hallazgos/${id}`)
}

export async function eliminarHallazgo(fd: FormData) {
  await requerirEditor()
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  if (!id) return

  const { data } = await supabase
    .from('hallazgos')
    .select('entrevista_id')
    .eq('id', id)
    .maybeSingle()

  await supabase.from('hallazgos').delete().eq('id', id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hallazgos')
  if (data?.entrevista_id) revalidatePath(`/dashboard/entrevistas/${data.entrevista_id}`)

  redirect('/dashboard/hallazgos')
}

/** Cambio rápido de estado desde la lista, sin abrir el formulario completo. */
export async function cambiarEstadoHallazgo(fd: FormData) {
  await requerirEditor()
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  const estado = opcion(fd, 'estado', ESTADOS)
  if (!id || !estado) return

  await supabase.from('hallazgos').update({ estado }).eq('id', id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hallazgos')
  revalidatePath(`/dashboard/hallazgos/${id}`)
}
