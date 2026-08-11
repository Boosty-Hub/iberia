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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
