import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rutas accesibles sin sesión. Todo lo demás exige autenticación.
 *
 * `/entrar` es la puerta del personal de planta: llega con su enlace personal de
 * WhatsApp y **todavía no tiene sesión** — abrirla es justo lo que hace esa
 * ruta. Si no estuviera aquí, el proxy lo mandaría al login, que es la pantalla
 * que el enlace viene a evitar. La ruta comprueba el token antes de acuñar nada;
 * estar abierta no la deja abierta a cualquiera.
 *
 * `/canal/entrar` es la pantalla donde cae quien llegó con un enlace muerto: si
 * exigiera sesión, el aviso de «este enlace ya no sirve» sería inalcanzable
 * justo para quien necesita leerlo.
 *
 * `/privacidad` es la política de privacidad de la app de iOS: Apple exige una
 * dirección que se abra sin cuenta, y la revisa antes de aprobar la app. Por lo
 * mismo `/soporte` (la URL de soporte de la ficha) y `/normas` (las normas de uso
 * del canal, guía 1.2).
 *
 * `/.well-known/apple-app-site-association` es lo que iOS le pide al sitio para
 * saber qué enlaces abren la app (Universal Links). Lo baja Apple, sin sesión, y
 * no acepta una redirección: mandado al login, los enlaces abrirían Safari.
 * `/.well-known/assetlinks.json` es lo mismo para Android (App Links).
 */
const RUTAS_PUBLICAS = [
  '/login',
  '/auth',
  '/entrar',
  '/canal/entrar',
  '/privacidad',
  '/soporte',
  '/normas',
  '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json',
]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalida el token contra el servidor de Auth. No usar getSession()
  // aquí: lee la cookie sin verificarla.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const esPublica = RUTAS_PUBLICAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  )

  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Se preserva el destino para volver ahí después del login.
    if (pathname !== '/') url.searchParams.set('destino', pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
