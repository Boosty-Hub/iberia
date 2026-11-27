'use server'

import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TIPOS_ENLACE } from './tipos'

/** Solo rutas internas: un `siguiente` armado por otro no saca a la persona del sitio. */
function rutaInterna(r: string | null | undefined, porDefecto: string): string {
  return r && r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/\\') ? r : porDefecto
}

/**
 * Usa el enlace del correo (`/auth/continuar`) cuando la persona toca «Continuar»:
 * abre la sesión con `verifyOtp` y la manda a `siguiente`. Si venció o ya se usó, no
 * dice cuál de las dos (igual que `/auth/confirmar`).
 */
export async function usarEnlace(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '')
  const tipo = String(formData.get('type') ?? '') as EmailOtpType
  const siguiente = rutaInterna(String(formData.get('siguiente') ?? ''), tipo === 'recovery' || tipo === 'invite' ? '/login/nueva-clave' : '/')

  if (tokenHash && (TIPOS_ENLACE as readonly string[]).includes(tipo)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
    if (!error) redirect(siguiente)
  }
  redirect('/login/recuperar?aviso=vencido')
}
