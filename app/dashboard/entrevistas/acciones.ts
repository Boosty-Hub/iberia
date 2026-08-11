'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirEditor } from '@/lib/auth'
import type { MetaTranscripcion } from '@/lib/fireflies'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PREFIJO_CODIGO, TIPOS_SESION, type Database, type TipoSesion } from '@/lib/types'

export type EstadoFormulario = { error?: string; ok?: boolean }

// -----------------------------------------------------------------------------
// Lectura de formularios
// -----------------------------------------------------------------------------

function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function entero(fd: FormData, campo: string, min = 0, max = 100000): number | null {
  const t = texto(fd, campo)
  if (t === null) return null
  const n = Number.parseInt(t, 10)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function opcion<T extends string>(
  fd: FormData,
  campo: string,
  permitidos: readonly T[]
): T | null {
  const t = texto(fd, campo)
  return t !== null && (permitidos as readonly string[]).includes(t) ? (t as T) : null
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function fecha(fd: FormData, campo: string): string | null {
  const t = texto(fd, campo)
  return t !== null && FECHA_ISO.test(t) ? t : null
}

const SEDES = ['caracas', 'cagua', 'remoto'] as const
const ESTADOS = ['programada', 'realizada', 'transcrita', 'analizada'] as const
const TIPOS = Object.keys(TIPOS_SESION) as TipoSesion[]

/**
 * Una sesión necesita algo con qué identificarse. En una entrevista suele ser el
 * entrevistado, pero al programarla todavía puede no conocerse el nombre y solo
 * haber cargo: en ese caso vale el título.
 */
function validarNombre(
  _tipo: TipoSesion,
  nombre: string | null,
  titulo: string | null
): string | null {
  if (!nombre && !titulo) {
    return 'Ponle un título a la sesión o el nombre del entrevistado para poder identificarla.'
  }
  return null
}

// -----------------------------------------------------------------------------
// Código consecutivo (ENT-001, ENT-002, …)
// -----------------------------------------------------------------------------

/**
 * Consecutivo por serie: las entrevistas del diagnóstico llevan ENT- para poder
 * medirlas contra la meta de ~25; reuniones, visitas y talleres van en SES-.
 */
async function siguienteCodigo(
  supabase: SupabaseClient<Database>,
  tipo: TipoSesion
): Promise<string> {
  const prefijo = PREFIJO_CODIGO[tipo] ?? 'SES'

  const { data } = await supabase
    .from('entrevistas')
    .select('codigo')
    .like('codigo', `${prefijo}-%`)
    .order('codigo', { ascending: false })
    .limit(1)

  const ultimo = data?.[0]?.codigo
  const n = ultimo ? Number.parseInt(ultimo.replace(`${prefijo}-`, ''), 10) : 0
  const siguiente = (Number.isFinite(n) ? n : 0) + 1
  return `${prefijo}-${String(siguiente).padStart(3, '0')}`
}

/** Código único con reintento: dos consultores creando a la vez colisionarían. */
const CODIGO_DUPLICADO = '23505'

// -----------------------------------------------------------------------------
// Crear
// -----------------------------------------------------------------------------

export async function crearEntrevista(
  _anterior: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const { userId } = await requerirEditor()
  const supabase = await createClient()

  const tipo = opcion(fd, 'tipo', TIPOS) ?? 'entrevista'
  const nombre = texto(fd, 'entrevistado_nombre')
  const titulo = texto(fd, 'titulo')

  const problema = validarNombre(tipo, nombre, titulo)
  if (problema) return { error: problema }

  const base = {
    tipo,
    titulo,
    entrevistado_nombre: nombre,
    entrevistado_cargo: texto(fd, 'entrevistado_cargo'),
    area_id: texto(fd, 'area_id'),
    sede: opcion(fd, 'sede', SEDES),
    fecha_entrevista: fecha(fd, 'fecha_entrevista'),
    duracion_minutos: entero(fd, 'duracion_minutos', 1, 1440),
    entrevistador: texto(fd, 'entrevistador'),
    estado: opcion(fd, 'estado', ESTADOS) ?? 'programada',
    resumen: texto(fd, 'resumen'),
    notas_consultor: texto(fd, 'notas_consultor'),
    fireflies_url: texto(fd, 'fireflies_url'),
    created_by: userId,
  }

  const codigoManual = texto(fd, 'codigo')
  let creada: { id: string } | null = null

  for (let intento = 0; intento < 5 && !creada; intento++) {
    const codigo = codigoManual ?? (await siguienteCodigo(supabase, tipo))
    const { data, error } = await supabase
      .from('entrevistas')
      .insert({ ...base, codigo })
      .select('id')
      .single()

    if (!error) {
      creada = data
      break
    }
    if (error.code === CODIGO_DUPLICADO) {
      if (codigoManual) return { error: `Ya existe una entrevista con el código ${codigo}.` }
      continue // Otro consultor tomó el consecutivo: se recalcula.
    }
    return { error: `No se pudo crear la entrevista: ${error.message}` }
  }

  if (!creada) {
    return { error: 'No se pudo asignar un código único. Intenta de nuevo.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/entrevistas')
  redirect(`/dashboard/entrevistas/${creada.id}`)
}

// -----------------------------------------------------------------------------
// Actualizar
// -----------------------------------------------------------------------------

export async function actualizarEntrevista(
  _anterior: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  await requerirEditor()
  const supabase = await createClient()

  const id = texto(fd, 'id')
  if (!id) return { error: 'Falta el identificador de la entrevista.' }

  const tipo = opcion(fd, 'tipo', TIPOS) ?? 'entrevista'
  const nombre = texto(fd, 'entrevistado_nombre')
  const titulo = texto(fd, 'titulo')

  const problema = validarNombre(tipo, nombre, titulo)
  if (problema) return { error: problema }

  const codigo = texto(fd, 'codigo')
  if (!codigo) return { error: 'El código es obligatorio.' }

  const { error } = await supabase
    .from('entrevistas')
    .update({
      codigo,
      tipo,
      titulo,
      entrevistado_nombre: nombre,
      entrevistado_cargo: texto(fd, 'entrevistado_cargo'),
      area_id: texto(fd, 'area_id'),
      sede: opcion(fd, 'sede', SEDES),
      fecha_entrevista: fecha(fd, 'fecha_entrevista'),
      duracion_minutos: entero(fd, 'duracion_minutos', 1, 1440),
      entrevistador: texto(fd, 'entrevistador'),
      estado: opcion(fd, 'estado', ESTADOS) ?? 'programada',
      resumen: texto(fd, 'resumen'),
      notas_consultor: texto(fd, 'notas_consultor'),
      fireflies_url: texto(fd, 'fireflies_url'),
    })
    .eq('id', id)

  if (error) {
    if (error.code === CODIGO_DUPLICADO) {
      return { error: `Ya existe otra entrevista con el código ${codigo}.` }
    }
    return { error: `No se pudo guardar: ${error.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/entrevistas')
  revalidatePath(`/dashboard/entrevistas/${id}`)
  redirect(`/dashboard/entrevistas/${id}`)
}

// -----------------------------------------------------------------------------
// Eliminar
// -----------------------------------------------------------------------------

export async function eliminarEntrevista(fd: FormData) {
  await requerirEditor()
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  if (!id) return

  // Los segmentos caen por ON DELETE CASCADE; los hallazgos quedan huérfanos
  // a propósito (SET NULL): un hallazgo validado no se pierde con la entrevista.
  await supabase.from('entrevistas').delete().eq('id', id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/entrevistas')
  redirect('/dashboard/entrevistas')
}

// -----------------------------------------------------------------------------
// Importar transcripción de Fireflies
// -----------------------------------------------------------------------------

/** Forma mínima que el cliente envía tras parsear el archivo en el navegador. */
type SegmentoEntrante = {
  hablante?: string | null
  inicioSegundos?: number | null
  finSegundos?: number | null
  texto?: string
}

const LIMITE_SEGMENTOS = 5000
const LOTE_INSERCION = 500

function normalizarSegmentos(entrantes: unknown): {
  filas: Omit<Database['public']['Tables']['transcripcion_segmentos']['Insert'], 'entrevista_id'>[]
  descartados: number
} {
  if (!Array.isArray(entrantes)) return { filas: [], descartados: 0 }

  const filas: Omit<
    Database['public']['Tables']['transcripcion_segmentos']['Insert'],
    'entrevista_id'
  >[] = []
  let descartados = 0

  for (const crudo of entrantes.slice(0, LIMITE_SEGMENTOS)) {
    const s = crudo as SegmentoEntrante
    const texto = typeof s?.texto === 'string' ? s.texto.trim() : ''
    if (!texto) {
      descartados++
      continue
    }

    const numero = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null

    filas.push({
      indice: filas.length,
      hablante:
        typeof s.hablante === 'string' && s.hablante.trim()
          ? s.hablante.trim().slice(0, 120)
          : null,
      inicio_segundos: numero(s.inicioSegundos),
      fin_segundos: numero(s.finSegundos),
      texto,
    })
  }

  if (Array.isArray(entrantes) && entrantes.length > LIMITE_SEGMENTOS) {
    descartados += entrantes.length - LIMITE_SEGMENTOS
  }

  return { filas, descartados }
}

export type ResultadoImportacion = {
  error?: string
  ok?: boolean
  segmentosGuardados?: number
  descartados?: number
}

/**
 * Crea la entrevista y su transcripción de una sola vez, a partir del archivo
 * de Fireflies ya interpretado en el navegador. Es el camino por defecto:
 * cargar el archivo y no escribir nada.
 */
export async function crearEntrevistaDesdeArchivo(payload: {
  tipo?: string | null
  titulo?: string | null
  entrevistadoNombre: string
  entrevistadoCargo?: string | null
  entrevistador?: string | null
  areaId?: string | null
  sede?: string | null
  fecha?: string | null
  duracionMinutos?: number | null
  resumen?: string | null
  firefliesUrl?: string | null
  meta?: MetaTranscripcion | null
  segmentos: SegmentoEntrante[]
}): Promise<{ error?: string; id?: string; codigo?: string; segmentos?: number }> {
  const { userId } = await requerirEditor()
  const supabase = await createClient()

  const nombre = payload.entrevistadoNombre?.trim()
  if (!nombre) return { error: 'Falta el nombre del entrevistado.' }

  const tipo: TipoSesion = TIPOS.includes(payload.tipo as TipoSesion)
    ? (payload.tipo as TipoSesion)
    : 'entrevista'

  const { filas } = normalizarSegmentos(payload.segmentos)

  const base = {
    tipo,
    titulo: payload.titulo?.trim() || null,
    entrevistado_nombre: nombre.slice(0, 200),
    entrevistado_cargo: payload.entrevistadoCargo?.trim() || null,
    entrevistador: payload.entrevistador?.trim() || null,
    area_id: payload.areaId || null,
    sede:
      payload.sede && (SEDES as readonly string[]).includes(payload.sede)
        ? payload.sede
        : null,
    fecha_entrevista: payload.fecha && FECHA_ISO.test(payload.fecha) ? payload.fecha : null,
    duracion_minutos:
      typeof payload.duracionMinutos === 'number' &&
      payload.duracionMinutos > 0 &&
      payload.duracionMinutos <= 1440
        ? Math.round(payload.duracionMinutos)
        : null,
    resumen: payload.resumen?.trim() || null,
    fireflies_url: payload.firefliesUrl?.trim() || null,
    fireflies_meta: payload.meta ?? null,
    // Sin turnos no hay transcripción: queda como realizada, no como transcrita.
    estado: filas.length > 0 ? ('transcrita' as const) : ('realizada' as const),
    created_by: userId,
  }

  let creada: { id: string; codigo: string } | null = null

  for (let intento = 0; intento < 5 && !creada; intento++) {
    const codigo = await siguienteCodigo(supabase, tipo)
    const { data, error } = await supabase
      .from('entrevistas')
      .insert({ ...base, codigo })
      .select('id, codigo')
      .single()

    if (!error) {
      creada = data
      break
    }
    if (error.code === CODIGO_DUPLICADO) continue
    return { error: `No se pudo crear la entrevista: ${error.message}` }
  }

  if (!creada) return { error: 'No se pudo asignar un código único. Intenta de nuevo.' }

  const entrevistaId = creada.id

  for (let i = 0; i < filas.length; i += LOTE_INSERCION) {
    const lote = filas
      .slice(i, i + LOTE_INSERCION)
      .map((f) => ({ ...f, entrevista_id: entrevistaId }))

    const { error } = await supabase.from('transcripcion_segmentos').insert(lote)
    if (error) {
      // Media entrevista es peor que ninguna: se deshace.
      await supabase.from('entrevistas').delete().eq('id', entrevistaId)
      return { error: `Falló la carga de la transcripción: ${error.message}` }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/entrevistas')

  return { id: creada.id, codigo: creada.codigo, segmentos: filas.length }
}

export async function guardarTranscripcion(payload: {
  entrevistaId: string
  segmentos: SegmentoEntrante[]
  resumen?: string | null
  duracionMinutos?: number | null
  firefliesUrl?: string | null
  meta?: MetaTranscripcion | null
  sobrescribirResumen?: boolean
}): Promise<ResultadoImportacion> {
  await requerirEditor()
  const supabase = await createClient()

  const { entrevistaId } = payload
  if (!entrevistaId) return { error: 'Falta la entrevista de destino.' }

  const { data: entrevista, error: errorLectura } = await supabase
    .from('entrevistas')
    .select('id, resumen, duracion_minutos, fireflies_url, estado')
    .eq('id', entrevistaId)
    .maybeSingle()

  if (errorLectura) return { error: `No se pudo leer la entrevista: ${errorLectura.message}` }
  if (!entrevista) return { error: 'La entrevista no existe o no tienes acceso.' }

  const { filas, descartados } = normalizarSegmentos(payload.segmentos)
  if (filas.length === 0) {
    return { error: 'La transcripción no contiene texto aprovechable.' }
  }

  // Reemplazo completo: importar de nuevo corrige un import anterior.
  const { error: errorBorrado } = await supabase
    .from('transcripcion_segmentos')
    .delete()
    .eq('entrevista_id', entrevistaId)

  if (errorBorrado) {
    return { error: `No se pudo limpiar la transcripción anterior: ${errorBorrado.message}` }
  }

  for (let i = 0; i < filas.length; i += LOTE_INSERCION) {
    const lote = filas
      .slice(i, i + LOTE_INSERCION)
      .map((f) => ({ ...f, entrevista_id: entrevistaId }))

    const { error } = await supabase.from('transcripcion_segmentos').insert(lote)
    if (error) {
      return {
        error: `Falló la inserción de segmentos (a partir del ${i + 1}): ${error.message}`,
      }
    }
  }

  // Los datos existentes no se pisan salvo que se pida explícitamente.
  const cambios: Database['public']['Tables']['entrevistas']['Update'] = {
    estado: entrevista.estado === 'analizada' ? 'analizada' : 'transcrita',
    fireflies_meta: payload.meta ?? null,
  }

  const resumenNuevo = payload.resumen?.trim()
  if (resumenNuevo && (payload.sobrescribirResumen || !entrevista.resumen)) {
    cambios.resumen = resumenNuevo
  }
  if (payload.duracionMinutos && !entrevista.duracion_minutos) {
    cambios.duracion_minutos = payload.duracionMinutos
  }
  if (payload.firefliesUrl && !entrevista.fireflies_url) {
    cambios.fireflies_url = payload.firefliesUrl
  }

  const { error: errorUpdate } = await supabase
    .from('entrevistas')
    .update(cambios)
    .eq('id', entrevistaId)

  if (errorUpdate) {
    return {
      error: `Segmentos guardados, pero no se pudo actualizar la entrevista: ${errorUpdate.message}`,
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/entrevistas')
  revalidatePath(`/dashboard/entrevistas/${entrevistaId}`)

  return { ok: true, segmentosGuardados: filas.length, descartados }
}
