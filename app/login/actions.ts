'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type EstadoLogin = { error?: string }

/** Traduce los mensajes de Supabase Auth a algo que el usuario entienda. */
function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed'))
    return 'La cuenta aún no está confirmada. Escríbele al administrador del programa.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  return 'No se pudo iniciar sesión. Intenta de nuevo.'
}

/** Solo rutas internas: evita que ?destino= se use para redirigir fuera del sitio. */
function destinoSeguro(valor: string | null): string {
  if (!valor) return '/dashboard'
  if (!valor.startsWith('/') || valor.startsWith('//')) return '/dashboard'
  return valor
}

export async function iniciarSesion(
  _anterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')
  const destino = destinoSeguro(formData.get('destino') as string | null)

  if (!email || !password) {
    return { error: 'Ingresa tu correo y tu contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: traducirError(error.message) }
  }

  // El perfil se valida en obtenerSesion(): si está inactivo, no pasa del login.
  revalidatePath('/', 'layout')
  redirect(destino)
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
