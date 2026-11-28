'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/database.types'
import { crearHijo } from '@/lib/plataforma/fichas/procesos'

/**
 * Acciones del rediseño de Procesos (28-nov-2026): confirmar los enlaces sugeridos y editar un documento por
 * secciones. Cada una vuelve a pedir su permiso y la base lo vuelve a preguntar (las funciones `sgc.*` son la única
 * puerta de escritura). Solo funciones async.
 */

export type Resultado = { error?: string; ok?: string; version?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mensaje(e: { message?: string } | null): string {
  const m = e?.message ?? 'No se pudo.'
  return m.replace(/^.*?:\s*(?=[A-ZÁÉÍÓÚ])/, '')
}

export async function confirmarEnlace(id: string, proceso?: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(id) || (proceso && !UUID.test(proceso))) return { error: 'Enlace no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('confirmar_enlace', { p_id: id, p_proceso: proceso ?? undefined })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  revalidatePath('/sistema/nucleo/documentos', 'layout')
  return { ok: 'Enlace confirmado.' }
}

export async function descartarEnlace(id: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(id)) return { error: 'Enlace no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('descartar_enlace', { p_id: id })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ok: 'Enlace descartado.' }
}

export async function confirmarEnlacesProceso(proceso: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(proceso)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('sgc').rpc('confirmar_enlaces_proceso', { p_proceso: proceso })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ok: `${data ?? 0} enlaces confirmados.` }
}

const TIPOS_BLOQUE = new Set(['parrafo', 'lista', 'tabla', 'paso', 'decision', 'referencia'])

/** Guarda una sección en el borrador propio (lo abre si no existe). `seccion = -1` agrega una nueva al final. */
export async function guardarSeccion(documento: string, seccion: number, titulo: string, bloques: unknown, motivo?: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:documentos')
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'No tienes permiso para editar documentos.' }
  if (!UUID.test(documento) || !Number.isInteger(seccion)) return { error: 'Documento no válido.' }
  if (!Array.isArray(bloques) || bloques.some((b) => !b || typeof b !== 'object' || !TIPOS_BLOQUE.has((b as { tipo?: string }).tipo ?? ''))) {
    return { error: 'La sección viene mal formada.' }
  }
  if (JSON.stringify(bloques).length > 200_000) return { error: 'La sección es demasiado larga.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('sgc').rpc('guardar_seccion_documento', {
    p_documento: documento, p_seccion: seccion, p_titulo: titulo.trim().slice(0, 300), p_bloques: bloques as Json, p_motivo: motivo?.trim() || undefined,
  })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  return { ok: 'Borrador guardado.', version: data as string }
}

export async function descartarBorrador(documento: string, version: string): Promise<Resultado> {
  await requerirPermiso('sistema:documentos')
  if (!UUID.test(version)) return { error: 'Versión no válida.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('descartar_borrador_documento', { p_version: version })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  return { ok: 'Borrador descartado.' }
}

/** Envía a revisión un borrador propio o una transcripción por validar. Entra a la ruta dueño del proceso → Calidad. */
export async function enviarDocumento(documento: string, version: string, motivo: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:documentos')
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'No tienes permiso para editar documentos.' }
  if (!UUID.test(version)) return { error: 'Versión no válida.' }
  if (motivo.trim().length < 3) return { error: 'Escribe el motivo del cambio.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('enviar_documento', { p_version: version, p_motivo: motivo.trim().slice(0, 1000) })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  revalidatePath('/sistema/bandeja')
  return { ok: 'Enviado a revisión: le llega al dueño del proceso en su bandeja.' }
}

// ── La caracterización del proceso, editada en su página (28-nov-2026) ──────

const CAMPOS_TEXTO = new Set(['objetivo', 'alcance', 'evaluacion', 'mejora', 'estado_hoy', 'dueno'])
const CAMPOS_LISTA = new Set(['proveedores', 'entradas', 'salidas', 'clientes', 'recursos', 'responsabilidades', 'riesgos', 'oportunidades', 'criterios', 'brechas'])
const FASES = new Set(['planificar', 'hacer', 'verificar', 'actuar'])

/** El borrador abierto del proceso, o uno nuevo desde la vigente (`sgc.nuevo_borrador`). */
async function borradorProceso(ref: string) {
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const { data: id, error } = await sgc.rpc('nuevo_borrador', { p_ref: ref })
  if (error || !id) return { error: mensaje(error) }
  const { data } = await sgc.from('proceso').select('id, ficha, estado, version').eq('id', id as string).maybeSingle()
  if (!data) return { error: 'No se encontró el borrador.' }
  if (data.estado !== 'borrador') return { error: 'Este proceso tiene una versión en revisión: espera la decisión antes de cambiarlo.' }
  return { supabase, b: data }
}

/** Guarda un campo de la caracterización en el borrador. Listas: un renglón por elemento. Indicadores: «nombre | fórmula | meta | frecuencia». */
export async function guardarCampoProceso(ref: string, clave: string, texto: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(ref)) return { error: 'Proceso no válido.' }
  if (texto.length > 20_000) return { error: 'El texto es demasiado largo.' }
  const r = await borradorProceso(ref)
  if ('error' in r) return { error: r.error }
  const ficha = { ...((r.b.ficha ?? {}) as Record<string, unknown>) }
  const lineas = texto.replace(/\r/g, '').split('\n').map((l) => l.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean)
  const [campo, sub] = clave.split('.')
  if (CAMPOS_TEXTO.has(clave)) ficha[clave] = texto.trim() || null
  else if (CAMPOS_LISTA.has(clave)) ficha[clave] = lineas.length ? lineas : null
  else if (campo === 'actividades' && FASES.has(sub)) {
    const act = (ficha.actividades && !Array.isArray(ficha.actividades) ? { ...(ficha.actividades as Record<string, unknown>) } : {}) as Record<string, string[]>
    act[sub] = lineas
    ficha.actividades = act
  } else if (clave === 'indicadores') {
    ficha.indicadores = lineas.map((l) => {
      const [nombre, formula, meta, frecuencia] = l.split('|').map((x) => x.trim() || null)
      return { nombre, formula, meta, frecuencia }
    })
  } else return { error: 'Ese campo no se edita aquí.' }
  const fuentes = { ...((ficha.fuentes ?? {}) as Record<string, string>) }
  fuentes[campo] = `Editado en la plataforma por ${sesion.perfil.nombre_completo ?? sesion.email} el ${new Date().toISOString().slice(0, 10).split('-').reverse().join('/')}`
  ficha.fuentes = fuentes
  const { error } = await r.supabase.schema('sgc').from('proceso').update({ ficha: ficha as Json }).eq('id', r.b.id).eq('estado', 'borrador')
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/procesos/${ref}`)
  return { ok: 'Guardado en el borrador.' }
}

/** Envía el borrador de la caracterización a la ruta de aprobación de los procesos. */
export async function enviarCaracterizacion(ref: string, motivo: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(ref)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const { data: b } = await sgc.from('proceso').select('id, version').eq('ref', ref).is('escenario_id', null).eq('estado', 'borrador').maybeSingle()
  if (!b) return { error: 'No hay un borrador abierto.' }
  if (motivo.trim()) await sgc.from('proceso').update({ nota: motivo.trim().slice(0, 1000) }).eq('id', b.id).eq('estado', 'borrador')
  const { error } = await sgc.rpc('enviar_proceso', { p_id: b.id })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/procesos/${ref}`)
  return { ok: `Versión ${b.version} enviada a revisión: le llega a quien aprueba en su bandeja.` }
}

export async function descartarCaracterizacion(ref: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'eliminar')) return { error: 'Descartar un borrador pide el permiso de eliminar procesos.' }
  if (!UUID.test(ref)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const { error, count } = await supabase.schema('sgc').from('proceso').delete({ count: 'exact' }).eq('ref', ref).is('escenario_id', null).eq('estado', 'borrador')
  if (error) return { error: mensaje(error) }
  if (!count) return { error: 'No hay un borrador que descartar.' }
  revalidatePath(`/sistema/nucleo/procesos/${ref}`)
  return { ok: 'Borrador descartado. Rige la versión vigente.' }
}


// ── Estructura: renombrar, mover y crear un subproceso (en el borrador, con aprobación) ──

export async function renombrarProceso(ref: string, nombre: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(ref)) return { error: 'Proceso no válido.' }
  if (nombre.trim().length < 3) return { error: 'El nombre necesita al menos tres letras.' }
  const r = await borradorProceso(ref)
  if ('error' in r) return { error: r.error }
  const { error } = await r.supabase.schema('sgc').from('proceso').update({ nombre: nombre.trim().slice(0, 200) }).eq('id', r.b.id).eq('estado', 'borrador')
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/procesos/${ref}`)
  return { ok: 'Renombrado en el borrador. Rige cuando se apruebe.' }
}

export async function moverProceso(ref: string, padre: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(ref) || !UUID.test(padre)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const [{ data: yo }, { data: p }] = await Promise.all([
    sgc.from('proceso').select('nivel').eq('ref', ref).is('escenario_id', null).eq('estado', 'vigente').maybeSingle(),
    sgc.from('proceso').select('nivel').eq('ref', padre).is('escenario_id', null).eq('estado', 'vigente').maybeSingle(),
  ])
  if (!yo || !p || p.nivel !== yo.nivel - 1) return { error: 'Solo puede colgar de un proceso del nivel de arriba.' }
  const r = await borradorProceso(ref)
  if ('error' in r) return { error: r.error }
  const { error } = await sgc.from('proceso').update({ padre_ref: padre }).eq('id', r.b.id).eq('estado', 'borrador')
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ok: 'Movido en el borrador. Rige cuando se apruebe.' }
}

export async function crearSubproceso(ref: string, nombre: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'crear')) return { error: 'No tienes permiso para crear procesos.' }
  if (!UUID.test(ref)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const r = await crearHijo(supabase, ref, nombre)
  if (r.error) return { error: r.error }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ok: 'Subproceso creado como borrador: aparece cuando se apruebe.' }
}


/** Corrige una sección de un registro (formato lleno transcrito). La versión anterior queda en la auditoría. */
export async function editarRegistro(documento: string, registro: string, seccion: number, titulo: string, bloques: unknown): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:documentos')
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'No tienes permiso para editar documentos.' }
  if (!UUID.test(registro) || !Number.isInteger(seccion)) return { error: 'Registro no válido.' }
  if (!Array.isArray(bloques) || bloques.some((b) => !b || typeof b !== 'object' || !TIPOS_BLOQUE.has((b as { tipo?: string }).tipo ?? ''))) return { error: 'La sección viene mal formada.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('editar_registro', { p_id: registro, p_seccion: seccion, p_titulo: titulo.trim().slice(0, 300), p_bloques: bloques as Json })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  return { ok: 'Registro corregido. La versión anterior queda en el historial.' }
}
