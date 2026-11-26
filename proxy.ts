import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/sesion'

/**
 * Sustituye al antiguo `middleware.ts` (deprecado en Next 16). Refresca la
 * sesión de Supabase en cada navegación y bloquea las rutas sin autenticar.
 */
export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todo excepto assets estáticos e imágenes. El informe y el dashboard
     * quedan cubiertos: ninguna ruta de contenido se sirve sin sesión.
     */
    // `.netlify/` son las funciones de Netlify (la de fondo del asistente): las llama el servidor con su secreto,
    // sin sesión de navegador. Hasta el 26-nov-2026 el proxy las mandaba a /login y los turnos se quedaban en cola.
    '/((?!_next/static|_next/image|\\.netlify/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
