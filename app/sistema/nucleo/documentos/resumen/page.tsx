import { redirect } from 'next/navigation'

/** Rediseño del 28-nov-2026 (Gabriel): los documentos viven en el mapa de procesos; esta vista ya no existe. */
export default function Pagina() {
  redirect('/sistema/nucleo/procesos')
}
