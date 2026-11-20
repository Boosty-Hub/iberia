import { redirect } from 'next/navigation'

/** Se mudó a la administración única de la plataforma (20-nov-2026). */
export default function Redireccion() {
  redirect('/sistema/administracion/roles')
}
