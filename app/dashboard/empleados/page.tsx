import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** «Le falta» del padrón viejo → los filtros en chips del padrón nuevo. */
const FALTA: Record<string, [string, string]> = {
  telefono: ['f.con_telefono', 'no'],
  matricula: ['f.curso', 'sin_matricula'],
  enlace: ['f.enlace', 'sin_acunar'],
  envio: ['f.enlace', 'acunado'],
  'sin-entrar': ['f.enlace', 'sin_entrar'],
}

/**
 * El padrón vive ahora en Personas › Padrón y accesos. La dirección vieja
 * redirige con sus parámetros: `q` pasa tal cual, `nivel` va a `f.nivel` y
 * «le falta» se traduce a su filtro.
 */
export default async function EmpleadosViejo({ searchParams }: PageProps<'/dashboard/empleados'>) {
  const { falta, ...resto } = await searchParams
  const filtro = typeof falta === 'string' ? FALTA[falta] : undefined
  if (filtro) resto[filtro[0]] = filtro[1]
  redirect(rutaNueva('/sistema/personas/padron', resto, { nivel: 'f.nivel' }))
}
