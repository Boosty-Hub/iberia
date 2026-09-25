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

export async function crearUsuario(_anterior: EstadoUsuario, fd: FormData): Promise<EstadoUsuario> {
  await requerirPermiso('modulo:usuarios', 'crear')

  const email = texto(fd, 'email').toLowerCase()
  const password = String(fd.get('password') ?? '')
  const nombre = texto(fd, 'nombre_completo')
  const cargo = texto(fd, 'cargo')
  const orgCruda = texto(fd, 'organizacion')
  const rol = await buscarRol(texto(fd, 'rol_id'))

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
  const { error } = await admin.auth.admin.createUser({
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

  revalidatePath('/dashboard/usuarios')
  revalidatePath('/dashboard/roles')
  return { ok: `Usuario ${email} creado con el rol ${rol.nombre}. Entrégale el correo y la contraseña.` }
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
