'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { ORGANIZACIONES, type Organizacion } from '@/lib/types'

export type EstadoUsuario = { error?: string; ok?: string }

const ORGS_VALIDAS = Object.keys(ORGANIZACIONES) as Organizacion[]

const LARGO_MINIMO_CLAVE = 10

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

/** El rol pedido, si existe. Se busca en la base: el formulario no manda. */
async function buscarRol(id: string) {
  if (!id) return null
  const supabase = await createClient()
  const { data } = await supabase.from('roles').select('id, clave, nivel, nombre').eq('id', id).maybeSingle()
  return data
}

/**
 * Enlaza una cuenta con su ficha del padrón.
 *
 * El canal cuelga todo de la ficha —el nombre, el área, lo que publica, el curso—,
 * así que una cuenta sin ficha entra y se queda en «esa cuenta todavía no está
 * asociada a una ficha del padrón». Pasó el 27 de septiembre de 2026 con la
 * primera cuenta de Iberia creada desde aquí para el canal: las cuentas que se
 * acuñan desde el padrón nacen enlazadas, pero las de Usuarios no.
 *
 * Con la clave de servicio, como el enlace del padrón: la política de
 * `empleados` no deja escribir `perfil_id` desde la sesión. Una ficha no se
 * enlaza a dos cuentas, ni una cuenta a dos fichas.
 */
async function enlazar(perfilId: string, empleadoId: string, email: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: ficha } = await admin
    .from('empleados')
    .select('id, nombre_completo, perfil_id, activo, email')
    .eq('id', empleadoId)
    .maybeSingle()
  if (!ficha?.activo) return 'Esa ficha no existe o está inactiva.'
  if (ficha.perfil_id && ficha.perfil_id !== perfilId) {
    return `La ficha de ${ficha.nombre_completo} ya está enlazada a otra cuenta.`
  }

  const { data: otra } = await admin
    .from('empleados')
    .select('nombre_completo')
    .eq('perfil_id', perfilId)
    .neq('id', empleadoId)
    .maybeSingle()
  if (otra) return `Esa cuenta ya está enlazada a la ficha de ${otra.nombre_completo}.`

  const { error } = await admin
    .from('empleados')
    .update({ perfil_id: perfilId, email: ficha.email ?? email })
    .eq('id', empleadoId)
  return error ? `No se pudo enlazar: ${error.message}` : null
}

export async function crearUsuario(_anterior: EstadoUsuario, fd: FormData): Promise<EstadoUsuario> {
  await requerirPermiso('modulo:usuarios', 'crear')

  const email = texto(fd, 'email').toLowerCase()
  const password = String(fd.get('password') ?? '')
  const nombre = texto(fd, 'nombre_completo')
  const cargo = texto(fd, 'cargo')
  const orgCruda = texto(fd, 'organizacion')
  const rol = await buscarRol(texto(fd, 'rol_id'))
  const empleadoId = texto(fd, 'empleado_id')

  if (!email.includes('@')) return { error: 'El correo no es válido.' }
  if (password.length < LARGO_MINIMO_CLAVE) {
    return { error: `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.` }
  }
  if (!rol) return { error: 'Elige un rol que exista.' }
  if (!ORGS_VALIDAS.includes(orgCruda as Organizacion)) {
    return { error: 'Organización no válida.' }
  }

  const admin = createAdminClient()

  // email_confirm: true porque el acceso lo entrega el equipo del programa
  // junto con la contraseña; no hay flujo de verificación por correo. El rol va
  // por su clave: el alta automática lo enlaza y copia su nivel.
  const { data: creado, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre_completo: nombre,
      cargo,
      rol: rol.nivel,
      rol_clave: rol.clave,
      organizacion: orgCruda,
    },
  })

  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      return { error: `Ya existe un usuario con el correo ${email}.` }
    }
    return { error: `No se pudo crear el usuario: ${error.message}` }
  }

  // La ficha del padrón, si se eligió: sin ella la cuenta no entra al canal.
  // Si no se pudo enlazar, la cuenta queda creada igual y se dice por qué.
  const sinEnlace = empleadoId && creado?.user ? await enlazar(creado.user.id, empleadoId, email) : null

  revalidatePath('/dashboard/usuarios')
  revalidatePath('/dashboard/roles')
  revalidatePath('/dashboard/empleados')
  if (sinEnlace) return { error: `Usuario ${email} creado, pero sin ficha: ${sinEnlace}` }
  return { ok: `Usuario ${email} creado con el rol ${rol.nombre}. Entrégale el correo y la contraseña.` }
}

/** Enlaza una cuenta que ya existe con su ficha del padrón. Ver `enlazar`. */
export async function enlazarFicha(fd: FormData) {
  await requerirPermiso('modulo:usuarios', 'editar')
  const id = texto(fd, 'id')
  const empleadoId = texto(fd, 'empleado_id')
  if (!id || !empleadoId) return

  const supabase = await createClient()
  const { data: perfil } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle()
  if (!perfil) return

  const error = await enlazar(id, empleadoId, perfil.email)
  if (error) console.error('[usuarios] no se enlazó la ficha:', error)

  revalidatePath('/dashboard/usuarios')
  revalidatePath('/dashboard/empleados')
}

/**
 * Suelta la cuenta de su ficha, para corregir un enlace equivocado. La ficha y
 * todo lo suyo —lo publicado, el curso— se quedan; lo que se va es la puerta.
 */
export async function desenlazarFicha(fd: FormData) {
  await requerirPermiso('modulo:usuarios', 'editar')
  const id = texto(fd, 'id')
  if (!id) return
  const admin = createAdminClient()
  await admin.from('empleados').update({ perfil_id: null }).eq('perfil_id', id)
  revalidatePath('/dashboard/usuarios')
  revalidatePath('/dashboard/empleados')
}

export async function cambiarRol(fd: FormData) {
  const { userId } = await requerirPermiso('modulo:usuarios', 'editar')
  const supabase = await createClient()

  const id = texto(fd, 'id')
  const rol = await buscarRol(texto(fd, 'rol_id'))
  if (!id || !rol) return

  // Un admin no puede quitarse a sí mismo el nivel administrador: dejaría el
  // programa sin nadie capaz de gestionar usuarios. La base, además, no deja
  // que se quede sin ningún administrador activo.
  if (id === userId && rol.nivel !== 'admin') return

  await supabase.from('profiles').update({ rol_id: rol.id }).eq('id', id)

  revalidatePath('/dashboard/usuarios')
  revalidatePath('/dashboard/roles')
}

export async function alternarActivo(fd: FormData) {
  const { userId } = await requerirPermiso('modulo:usuarios', 'editar')
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  if (!id || id === userId) return

  const { data: actual } = await supabase.from('profiles').select('activo').eq('id', id).maybeSingle()

  if (!actual) return

  await supabase.from('profiles').update({ activo: !actual.activo }).eq('id', id)
  revalidatePath('/dashboard/usuarios')
}

export async function eliminarUsuario(fd: FormData) {
  const { userId } = await requerirPermiso('modulo:usuarios', 'eliminar')

  const id = String(fd.get('id') ?? '')
  if (!id || id === userId) return

  // Borra en auth.users; el perfil cae por ON DELETE CASCADE.
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(id)

  revalidatePath('/dashboard/usuarios')
  revalidatePath('/dashboard/roles')
}
