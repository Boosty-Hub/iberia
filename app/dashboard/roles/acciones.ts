'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { ACCIONES, NIVELES, techoPermite, type Nivel, type Permiso } from '@/lib/permisos'
import { leerInventario, leerMatriz } from '@/lib/permisos-servidor'
import { createClient } from '@/lib/supabase/server'

export type EstadoRol = { error?: string; ok?: string }

const NIVELES_VALIDOS = Object.keys(NIVELES) as Nivel[]

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

/** «Supervisores de planta» → `supervisores-de-planta`. */
function claveDe(nombre: string): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'rol'
  )
}

/** Traduce los rechazos de la base a algo que se pueda leer en pantalla. */
function mensajeDe(error: { message: string; code?: string }): string {
  if (error.code === '23505') return 'Ya existe un rol con ese nombre.'
  if (error.code === '23503') return 'Ese rol tiene gente asignada: muévela a otro rol antes de borrarlo.'
  return error.message
}

export async function crearRol(_anterior: EstadoRol, fd: FormData): Promise<EstadoRol> {
  await requerirPermiso('modulo:roles', 'crear')
  const supabase = await createClient()

  const nombre = texto(fd, 'nombre')
  const descripcion = texto(fd, 'descripcion') || null
  const nivel = texto(fd, 'nivel') as Nivel
  const copiarDe = texto(fd, 'copiar_de')

  if (nombre.length < 2) return { error: 'El nombre necesita al menos dos letras.' }
  if (!NIVELES_VALIDOS.includes(nivel)) return { error: 'Elige un nivel.' }

  // La clave sale del nombre; si ya existe, se numera.
  const base = claveDe(nombre)
  const { data: parecidas } = await supabase.from('roles').select('clave').like('clave', `${base}%`)
  const usadas = new Set((parecidas ?? []).map((r) => r.clave))
  let clave = base
  for (let n = 2; usadas.has(clave); n++) clave = `${base}-${n}`

  const id = crypto.randomUUID()
  const { error } = await supabase.from('roles').insert({ id, clave, nombre, descripcion, nivel })
  if (error) return { error: mensajeDe(error) }

  // Partir de otro rol ahorra marcar cuarenta casillas. Se copia lo que el nivel
  // nuevo deja tener: de un consultor a un lector pasa solo el «ver».
  if (copiarDe && nivel !== 'admin') {
    const { data: origen } = await supabase.from('roles').select('nivel').eq('id', copiarDe).maybeSingle()
    if (origen) {
      const inventario = await leerInventario()
      const matriz = origen.nivel === 'admin' ? null : await leerMatriz(copiarDe)
      const filas = inventario
        .map((r) => {
          const fila: Permiso = { ver: false, crear: false, editar: false, eliminar: false }
          for (const a of ACCIONES) {
            // Del nivel administrador, que no tiene matriz porque lo puede todo,
            // se copia todo lo que el nivel nuevo permita.
            const tenia = matriz ? Boolean(matriz[r.clave]?.[a]) : true
            fila[a] = tenia && techoPermite(nivel, r, a)
          }
          return { rol_id: id, recurso: r.clave, ...fila }
        })
        .filter((f) => f.ver || f.crear || f.editar || f.eliminar)
      if (filas.length) {
        const { error: e2 } = await supabase.from('rol_permisos').insert(filas)
        if (e2) return { error: `El rol se creó, pero no se pudieron copiar los permisos: ${e2.message}` }
      }
    }
  }

  revalidatePath('/dashboard/roles')
  redirect(`/dashboard/roles/${id}?creado=1`)
}

export async function actualizarRol(_anterior: EstadoRol, fd: FormData): Promise<EstadoRol> {
  const sesion = await requerirPermiso('modulo:roles', 'editar')
  const supabase = await createClient()

  const id = texto(fd, 'id')
  const nombre = texto(fd, 'nombre')
  const descripcion = texto(fd, 'descripcion') || null
  const nivel = texto(fd, 'nivel') as Nivel

  const { data: actual } = await supabase.from('roles').select('sistema, nivel').eq('id', id).maybeSingle()
  if (!actual) return { error: 'Ese rol ya no existe.' }
  if (nombre.length < 2) return { error: 'El nombre necesita al menos dos letras.' }

  const cambios: { nombre: string; descripcion: string | null; nivel?: Nivel } = { nombre, descripcion }
  if (!actual.sistema && NIVELES_VALIDOS.includes(nivel) && nivel !== actual.nivel) {
    // Quien administra no se quita a sí mismo el nivel administrador por la
    // puerta de atrás, cambiándole el nivel a su propio rol.
    if (id === sesion.rol.id && nivel !== 'admin') {
      return { error: 'Es tu propio rol: si le quitas el nivel administrador te quedas sin poder administrar.' }
    }
    cambios.nivel = nivel
  }

  const { error } = await supabase.from('roles').update(cambios).eq('id', id)
  if (error) return { error: mensajeDe(error) }

  revalidatePath('/dashboard/roles')
  revalidatePath(`/dashboard/roles/${id}`)
  return { ok: cambios.nivel ? `Guardado. El nivel pasó a ${NIVELES[cambios.nivel]}.` : 'Guardado.' }
}

export async function eliminarRol(_anterior: EstadoRol, fd: FormData): Promise<EstadoRol> {
  await requerirPermiso('modulo:roles', 'eliminar')
  const supabase = await createClient()
  const id = texto(fd, 'id')

  const { data: rol } = await supabase.from('roles').select('sistema').eq('id', id).maybeSingle()
  if (!rol) return { error: 'Ese rol ya no existe.' }
  if (rol.sistema) return { error: 'Los roles de fábrica no se borran.' }

  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('rol_id', id)
  if (count) return { error: `Ese rol lo tienen ${count} persona(s): muévelas a otro rol antes de borrarlo.` }

  const { error, data } = await supabase.from('roles').delete().eq('id', id).select('id')
  if (error) return { error: mensajeDe(error) }
  // Sin política que lo deje, Postgres no se queja: filtra la fila y no borra.
  if (!data?.length) return { error: 'La base no dejó borrarlo.' }

  revalidatePath('/dashboard/roles')
  redirect('/dashboard/roles?borrado=1')
}

export type FilaMatriz = { recurso: string } & Permiso

/**
 * Guarda la matriz entera de un rol.
 *
 * Cada fila se valida contra el inventario y el techo del nivel antes de
 * escribir: una casilla que no aplica o que el nivel no permite se descarta
 * aquí, y si algo se cuela, la base la rechaza. Las filas sin nada marcado se
 * borran, igual que las de recursos que ya no existen.
 */
export async function guardarMatriz(rolId: string, filas: FilaMatriz[]): Promise<EstadoRol> {
  await requerirPermiso('modulo:roles', 'editar')
  const supabase = await createClient()

  const { data: rol } = await supabase.from('roles').select('id, nivel').eq('id', rolId).maybeSingle()
  if (!rol) return { error: 'Ese rol ya no existe.' }
  if (rol.nivel === 'admin') return { error: 'El nivel administrador lo puede todo: su matriz no se guarda.' }

  const nivel = rol.nivel as Nivel
  const inventario = await leerInventario()
  const porClave = new Map(inventario.map((r) => [r.clave, r]))
  const pedidas = new Map(filas.map((f) => [f.recurso, f]))

  const guardar = inventario
    .map((r) => {
      const pedida = pedidas.get(r.clave)
      const fila: Permiso = { ver: false, crear: false, editar: false, eliminar: false }
      for (const a of ACCIONES) fila[a] = Boolean(pedida?.[a]) && techoPermite(nivel, r, a)
      fila.ver = fila.ver || fila.crear || fila.editar || fila.eliminar
      return { rol_id: rolId, recurso: r.clave, ...fila }
    })
    .filter((f) => f.ver)

  const { error: e1 } = await supabase.from('rol_permisos').upsert(guardar, { onConflict: 'rol_id,recurso' })
  if (e1) return { error: e1.message }

  // Lo que ya no se marca, o ya no existe en el inventario, sale de la matriz.
  const { data: actuales } = await supabase.from('rol_permisos').select('recurso').eq('rol_id', rolId)
  const quedan = new Set(guardar.map((f) => f.recurso))
  const sobran = (actuales ?? []).map((f) => f.recurso).filter((r) => !quedan.has(r) || !porClave.has(r))
  if (sobran.length) {
    const { error: e2 } = await supabase.from('rol_permisos').delete().eq('rol_id', rolId).in('recurso', sobran)
    if (e2) return { error: e2.message }
  }

  revalidatePath(`/dashboard/roles/${rolId}`)
  revalidatePath('/dashboard/roles')
  return { ok: `Permisos guardados: ${guardar.length} recurso(s) habilitados.` }
}
