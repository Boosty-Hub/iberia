import { redirect } from 'next/navigation'
import { destinoInicial, inicioDelPanel, puede, requerirSesion } from '@/lib/auth'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/**
 * La portada del panel viejo se mudó a la plataforma (20-nov-2026): quien tiene
 * `modulo:panel` cae en Mi día (`/sistema`), con los parámetros (el `aviso`).
 * Quien no la tiene va, como antes, a su primera pantalla del panel (que ahora
 * vive en la plataforma) y, si no tiene ninguna, a su destino (canal, informe).
 */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  if (puede(sesion, 'modulo:panel')) redirect(rutaNueva('/sistema', sp))
  redirect(inicioDelPanel(sesion) ?? destinoInicial(sesion))
}
