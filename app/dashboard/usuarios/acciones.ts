'use server'

import { revalidatePath } from 'next/cache'
import { requerirAdmin } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { ROLES, ORGANIZACIONES, type Organizacion, type Rol } from '@/lib/types'

export type EstadoUsuario = { error?: string; ok?: string }

const ROLES_VALIDOS = Object.keys(ROLES) as Rol[]
const ORGS_VALIDAS = Object.keys(ORGANIZACIONES) as Organizacion[]

const LARGO_MINIMO_CLAVE = 10

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

export async function crearUsuario(
  _anterior: EstadoUsuario,
  fd: FormData
): Promise<EstadoUsuario> {
  await requerirAdmin()

  const email = texto(fd, 'email').toLowerCase()
  const password = String(fd.get('password') ?? '')
  const nombre = texto(fd, 'nombre_completo')
  const cargo = texto(fd, 'cargo')
  const rolCrudo = texto(fd, 'rol')
  const orgCruda = texto(fd, 'organizacion')

  if (!email.includes('@')) return { error: 'El correo no es válido.' }
  if (password.length < LARGO_MINIMO_CLAVE) {
    return { error: `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.` }
  }
  if (!ROLES_VALIDOS.includes(rolCrudo as Rol)) return { error: 'Rol no válido.' }
  if (!ORGS_VALIDAS.includes(orgCruda as Organizacion)) {
    return { error: 'Organización no válida.' }
  }

  const admin = createAdminClient()

  // email_confirm: true porque el acceso lo entrega el equipo del programa
  // junto con la contraseña; no hay flujo de verificación por correo.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre_completo: nombre,
      cargo,
      rol: rolCrudo,
      organizacion: orgCruda,
    },
  })

  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      return { error: `Ya existe un usuario con el correo ${email}.` }
    }
    return { error: `No se pudo crear el usuario: ${error.message}` }
  }

  revalidatePath('/dashboard/usuarios')
  return { ok: `Usuario ${email} creado. Entrégale el correo y la contraseña.` }
}

export async function cambiarRol(fd: FormData) {
  const { userId } = await requerirAdmin()
  const supabase = await createClient()

  const id = texto(fd, 'id')
  const rolCrudo = texto(fd, 'rol')

  if (!id || !ROLES_VALIDOS.includes(rolCrudo as Rol)) return

  // Un admin no puede degradarse a sí mismo: dejaría el programa sin nadie
  // capaz de gestionar usuarios.
  if (id === userId && rolCrudo !== 'admin') return

  await supabase
    .from('profiles')
    .update({ rol: rolCrudo as Rol })
    .eq('id', id)

  revalidatePath('/dashboard/usuarios')
}

export async function alternarActivo(fd: FormData) {
  const { userId } = await requerirAdmin()
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  if (!id || id === userId) return

  const { data: actual } = await supabase
    .from('profiles')
    .select('activo')
    .eq('id', id)
    .maybeSingle()

  if (!actual) return

  await supabase.from('profiles').update({ activo: !actual.activo }).eq('id', id)
  revalidatePath('/dashboard/usuarios')
}

export async function eliminarUsuario(fd: FormData) {
  const { userId } = await requerirAdmin()

  const id = String(fd.get('id') ?? '')
  if (!id || id === userId) return

  // Borra en auth.users; el perfil cae por ON DELETE CASCADE.
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(id)

  revalidatePath('/dashboard/usuarios')
}
