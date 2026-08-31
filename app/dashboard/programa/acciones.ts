'use server'

import { revalidatePath } from 'next/cache'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  ENTREGABLES,
  ESTADOS_HITO,
  IMPUTACIONES,
  PERFILES,
  TIPOS_HITO,
  type Entregable,
  type EstadoHito,
  type Imputacion,
  type Perfil,
  type TipoHito,
} from '@/lib/programa'

export type EstadoFormulario = { error?: string; ok?: string }

const PERFILES_VALIDOS = Object.keys(PERFILES) as Perfil[]
const ENTREGABLES_VALIDOS = Object.keys(ENTREGABLES) as Entregable[]
const TIPOS_VALIDOS = Object.keys(TIPOS_HITO) as TipoHito[]
const IMPUTACIONES_VALIDAS = Object.keys(IMPUTACIONES) as Imputacion[]
const ESTADOS_VALIDOS = Object.keys(ESTADOS_HITO) as EstadoHito[]

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

/** Fecha en `YYYY-MM-DD`, o null si no viene o viene rota. */
function fecha(fd: FormData, campo: string): string | null {
  const t = texto(fd, campo)
  return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

export async function cargarHoras(
  _anterior: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const { userId } = await requerirEditor()
  const supabase = await createClient()

  const dia = fecha(fd, 'fecha')
  if (!dia) return { error: 'Falta la fecha.' }

  const perfil = opcion(fd, 'perfil', PERFILES_VALIDOS)
  if (!perfil) return { error: 'Hay que decir con qué perfil se cargan las horas.' }

  const crudas = texto(fd, 'horas')?.replace(',', '.')
  const horas = crudas ? Number(crudas) : NaN
  // El tope es el mismo de la base: caza el cero de más al teclear. Una partida
  // puede ser un bloque de trabajo de varios días, no solo una jornada.
  if (!Number.isFinite(horas) || horas <= 0 || horas > 160) {
    return { error: 'Las horas tienen que ser un número entre 0 y 160.' }
  }

  const descripcion = texto(fd, 'descripcion')
  if (!descripcion) {
    return { error: 'Falta decir en qué se fueron. Sin eso el reporte no se puede escribir.' }
  }

  const { error } = await supabase.from('registros_horas').insert({
    fecha: dia,
    perfil,
    horas,
    descripcion,
    persona: texto(fd, 'persona'),
    entregable: opcion(fd, 'entregable', ENTREGABLES_VALIDOS) ?? 'gestion',
    imputacion: opcion(fd, 'imputacion', IMPUTACIONES_VALIDAS) ?? 'bolsa',
    created_by: userId,
  })

  if (error) return { error: `No se pudo cargar: ${error.message}` }

  revalidatePath('/dashboard/programa')
  return { ok: `Cargadas ${horas} h.` }
}

export async function borrarHoras(fd: FormData) {
  await requerirEditor()
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  if (!id) return

  await supabase.from('registros_horas').delete().eq('id', id)
  revalidatePath('/dashboard/programa')
}

export async function crearHito(
  _anterior: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const { userId } = await requerirEditor()
  const supabase = await createClient()

  const dia = fecha(fd, 'fecha')
  if (!dia) return { error: 'Falta la fecha del hito.' }

  const titulo = texto(fd, 'titulo')
  if (!titulo) return { error: 'Falta el título.' }

  const { error } = await supabase.from('hitos').insert({
    fecha: dia,
    titulo,
    descripcion: texto(fd, 'descripcion'),
    tipo: opcion(fd, 'tipo', TIPOS_VALIDOS) ?? 'hito',
    entregable: opcion(fd, 'entregable', ENTREGABLES_VALIDOS),
    estado: opcion(fd, 'estado', ESTADOS_VALIDOS) ?? 'hecho',
    created_by: userId,
  })

  if (error) return { error: `No se pudo crear el hito: ${error.message}` }

  revalidatePath('/dashboard/programa')
  return { ok: 'Hito añadido a la línea de tiempo.' }
}
