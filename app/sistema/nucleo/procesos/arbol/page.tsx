import { redirect } from 'next/navigation'

/** El «Árbol» de la Etapa 1 es ahora el Catálogo (tabla en orden de árbol). */
export default async function ArbolPage({ searchParams }: PageProps<'/sistema/nucleo/procesos/arbol'>) {
  const sp = await searchParams
  const q = new URLSearchParams()
  if (typeof sp.al === 'string') q.set('al', sp.al)
  if (sp.ficha === 'con') q.set('f.tiene_ficha', 'true')
  if (sp.dueno === 'sin') q.append('f.dueno_estado', 'sin_dueno')
  if (sp.version === 'abiertos') {
    q.append('f.ciclo', 'borrador')
    q.append('f.ciclo', 'en_revision')
  }
  const s = q.toString()
  redirect(`/sistema/nucleo/procesos/catalogo${s ? `?${s}` : ''}`)
}
