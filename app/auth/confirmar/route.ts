import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * La puerta del enlace que manda Supabase al pedir «olvidé mi contraseña».
 *
 * Acepta las dos formas en que puede llegar:
 *
 * - **`?code=`** — la del correo de fábrica de Supabase con PKCE. Solo funciona en
 *   el mismo navegador donde se pidió: el verificador quedó en una cookie de ese
 *   navegador.
 * - **`?token_hash=…&type=recovery`** — la de una plantilla de correo que apunte
 *   aquí con `{{ .TokenHash }}`. Funciona aunque el correo se abra en otro equipo,
 *   que es lo normal: se pide en la computadora y se abre en el teléfono.
 *
 * Con la sesión de recuperación abierta manda a `siguiente` (solo rutas
 * internas). Si el enlace venció o ya se usó, no dice cuál de las dos: vuelve a
 * pedir uno, igual que `/entrar/[token]`.
 *
 * Redirige al origen de la petición, por lo mismo que `/entrar/[token]`: la cookie
 * de sesión se pone en este host.
 */
export async function GET(peticion: NextRequest) {
  const busqueda = peticion.nextUrl.searchParams
  const siguienteParam = busqueda.get('siguiente') ?? '/login/nueva-clave'
  const siguiente =
    siguienteParam.startsWith('/') && !siguienteParam.startsWith('//') ? siguienteParam : '/login/nueva-clave'

  const ir = (ruta: string) => {
    const url = peticion.nextUrl.clone()
    const [pathname, query = ''] = ruta.split('?')
    url.pathname = pathname
    url.search = query ? `?${query}` : ''
    return NextResponse.redirect(url)
  }

  const supabase = await createClient()
  const code = busqueda.get('code')
  const tokenHash = busqueda.get('token_hash')
  const tipo = busqueda.get('type') as EmailOtpType | null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return ir(siguiente)
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
    if (!error) return ir(siguiente)
  }

  return ir('/login/recuperar?aviso=vencido')
}
