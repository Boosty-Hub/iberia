import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Rutas accesibles sin sesión. Todo lo demás exige autenticación. */
const RUTAS_PUBLICAS = ['/login', '/auth']

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
