import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types'

/** Cliente para Server Components, Server Actions y Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Los Server Components no pueden escribir cookies: el refresh de
            // sesión ya lo hace el middleware, así que este caso es inocuo.
          }
        },
      },
    }
  )
}

/**
 * Cliente administrativo con la secret key: BYPASSEA RLS y habilita `auth.admin`.
 * Solo para provisionar usuarios y mantenimiento en el servidor — nunca se
 * expone al navegador ni se usa para leer datos por cuenta del usuario.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('Falta SUPABASE_SECRET_KEY en el entorno')

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
