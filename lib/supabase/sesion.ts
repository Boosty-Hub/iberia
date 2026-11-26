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
  // La captura de tasas la llama el programador, sin sesión: la ruta exige su
  // propio secreto (`TASAS_SECRETO`) y sin él responde 401.
  '/api/tasas/capturar',
  // Las fuentes del asistente de IA las pide el ejecutor del turno, sin cookies:
  // la ruta exige `ASISTENTE_SECRETO` y el token de la sesión de quien pregunta,
  // con el que corre cada consulta (la RLS de siempre).
  '/api/asistente/fuente',
  '/api/asistente/programador',
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

  // getClaims() verifica la firma del JWT (ES256, con la JWKS del proyecto en
  // caché) sin ir al servidor de Auth, y refresca la sesión si venció. Es la
  // puerta, no la autorización: cada página y acción vuelve a validar con
  // `getUser()` (`obtenerSesion`) y la base aplica RLS. Con getUser() aquí cada
  // petición —también cada server action— pagaba una vuelta más a us-east-1
  // (R6, 20-nov-2026). No usar getSession(): lee la cookie sin verificarla.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims?.sub ? data.claims : null

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
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
