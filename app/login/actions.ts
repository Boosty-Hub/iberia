'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { destinoInicial, obtenerSesion } from '@/lib/auth'
import { olvidarEsteTelefono } from '@/lib/notificaciones'
import { createClient } from '@/lib/supabase/server'

/** `destino` sale solo cuando entró: la página navega ahí con una carga completa. */
export type EstadoLogin = { error?: string; destino?: string }

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
  if (!valor) return DESTINO_POR_DEFECTO
  if (!valor.startsWith('/') || valor.startsWith('//')) return DESTINO_POR_DEFECTO
  return valor
}

/** El que pone la página del login cuando no llega `?destino=`. */
const DESTINO_POR_DEFECTO = '/'

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

  // ⚠️ No se redirige desde aquí (10 de noviembre de 2026). Con `redirect()`, Next
  // pinta el destino entero —el canal, con sus consultas— y lo manda dentro de la
  // respuesta de la acción; en la WebView del iPhone, con la red de planta, esa
  // respuesta larga se cortaba y salía «TypeError: Load failed». La acción solo
  // dice a dónde ir y el formulario navega con una carga normal de la página.
  //
  // Sin destino pedido, se ahorra el salto por `/`: el mismo
  // `destinoInicial()` al que esa página manda a quien no tiene panel. El perfil
  // se valida en obtenerSesion(): si está inactivo, el destino lo devuelve al login.
  if (destino === DESTINO_POR_DEFECTO) {
    const sesion = await obtenerSesion().catch(() => null)
    if (sesion) return { destino: destinoInicial(sesion) }
  }
  return { destino }
}

// ── Recuperar la contraseña ─────────────────────────────────────────────────

export type EstadoRecuperacion = { error?: string; enviado?: boolean }

/**
 * Pide el correo de recuperación. **Siempre contesta lo mismo** —exista o no la
 * cuenta—: decir «ese correo no está registrado» convierte el formulario en una
 * forma de averiguar quién tiene cuenta, la misma regla de `/entrar/[token]`.
 *
 * El enlace vuelve **al origen de la petición**: el verificador PKCE queda en una
 * cookie de este host, y mandarlo a otro lo dejaría sin sesión. Ese origen tiene
 * que estar en las URLs de redirección de Supabase o Supabase manda a su Site URL.
 */
export async function pedirRecuperacion(
  _anterior: EstadoRecuperacion,
  formData: FormData
): Promise<EstadoRecuperacion> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Escribe el correo de tu cuenta.' }

  const cabeceras = await headers()
  const origen = cabeceras.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origen}/auth/confirmar?siguiente=/login/nueva-clave`,
  })

  // Solo el límite de envíos se dice: no revela si la cuenta existe y evita que
  // alguien se quede esperando un correo que no va a salir.
  if (error && /rate limit|too many|security purposes/i.test(error.message)) {
    return { error: 'Ya se mandaron varios correos seguidos. Espera unos minutos y vuelve a probar.' }
  }
  return { enviado: true }
}

export type EstadoNuevaClave = { error?: string }

const LARGO_MINIMO = 8

/** Traduce los rechazos de Supabase al cambiar la contraseña. */
function traducirErrorClave(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('different from the old'))
    return 'La contraseña nueva tiene que ser distinta de la que tenías.'
  if (m.includes('at least') || m.includes('weak') || m.includes('should contain'))
    return `La contraseña es muy débil: usa al menos ${LARGO_MINIMO} caracteres, con letras y números.`
  if (m.includes('session') || m.includes('jwt') || m.includes('not authenticated'))
    return 'El enlace ya venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».'
  return 'No se pudo guardar la contraseña. Intenta de nuevo.'
}

/**
 * Guarda la contraseña nueva. Corre con la sesión que abrió el enlace del correo
 * (`/auth/confirmar`), así que solo la cambia quien recibió ese correo.
 */
export async function cambiarClave(
  _anterior: EstadoNuevaClave,
  formData: FormData
): Promise<EstadoNuevaClave> {
  const clave = String(formData.get('clave') ?? '')
  const repetida = String(formData.get('repetida') ?? '')

  if (clave.length < LARGO_MINIMO)
    return { error: `La contraseña necesita al menos ${LARGO_MINIMO} caracteres.` }
  if (clave !== repetida) return { error: 'Las dos contraseñas no coinciden.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: traducirErrorClave('not authenticated') }

  const { error } = await supabase.auth.updateUser({ password: clave })
  if (error) return { error: traducirErrorClave(error.message) }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function cerrarSesion() {
  const supabase = await createClient()
  // En la app de iOS, el teléfono deja de recibir los avisos de esta cuenta. Va
  // antes de salir: después ya no hay sesión con la que borrar lo propio.
  await olvidarEsteTelefono(supabase)
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
