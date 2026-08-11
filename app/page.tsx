import { redirect } from 'next/navigation'

// El middleware ya garantiza sesión válida antes de llegar aquí.
export default function Home() {
  redirect('/dashboard')
}
