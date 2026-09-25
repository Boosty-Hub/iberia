import GithubSlugger from 'github-slugger'

export type Encabezado = { id: string; texto: string }

/** El texto que queda de un encabezado cuando el markdown ya se pintó. */
function textoPlano(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^\p{L}\d])[*_](.+?)[*_](?=[^\p{L}\d]|$)/gu, '$1$2')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/**
 * Los encabezados de un nivel, con el id que les pone `rehype-slug` al pintar.
 *
 * ⚠️ **Un solo `GithubSlugger` para todo el documento y en orden**, recorriendo
 * todos los niveles aunque solo se devuelva uno: así numera `rehype-slug` los
 * repetidos (`-1`, `-2`), y un slugger por encabezado daría el mismo id a dos
 * títulos iguales y el segundo enlace caería en el primero. La auditoría del
 * informe comprueba que cada enlace del índice encuentre su destino.
 */
export function encabezadosDe(md: string | null | undefined, nivel = 2): Encabezado[] {
  if (!md) return []
  const slugger = new GithubSlugger()
  const salida: Encabezado[] = []
  let enCodigo = false

  for (const linea of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(linea)) {
      enCodigo = !enCodigo
      continue
    }
    if (enCodigo) continue
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(linea)
    if (!m) continue
    const texto = textoPlano(m[2])
    const id = slugger.slug(texto)
    if (m[1].length === nivel) salida.push({ id, texto })
  }
  return salida
}

/** Minutos de lectura, a 200 palabras por minuto. Las tablas cuentan: se leen. */
export function minutosDeLectura(md: string | null | undefined): number {
  if (!md) return 0
  const palabras = md.replace(/[#*|`>_-]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(palabras / 200))
}
