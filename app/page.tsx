import { redirect } from 'next/navigation'
import { destinoInicial, requerirSesion } from '@/lib/auth'

// El middleware ya garantiza sesión válida antes de llegar aquí. Cada quien va a
// su casa: Mi día de la plataforma, el canal, su primera pantalla o el informe.
export default async function Home() {
  redirect(destinoInicial(await requerirSesion()))
}
