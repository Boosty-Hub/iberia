/**
 * La fuente de un dato como se lee: «Organigrama General y Direcciones
 * II-21-14-010 · 2026», nunca la ruta del disco donde estaba el archivo. Es la
 * gemela de `ui.fuente_legible()` en la base (migración R1): si cambia una,
 * cambia la otra. Sin `'use client'` ni `'use server'`.
 */

const EXT = /^(.*?\.(pdf|docx|doc|xlsx|xls|md|pptx|ppt|txt))(\s|$)/i

export function fuenteLegible(texto: string | null | undefined): string | null {
  if (!texto || !texto.trim()) return null
  if (!/[\\/]/.test(texto)) return texto
  const salida: string[] = []
  for (const parte of texto.trim().split(/\s+;\s+/)) {
    const m = parte.match(EXT)
    const ruta = m ? m[1] : parte
    const resto = m ? parte.slice(ruta.length).trim() || null : null
    let base = ruta.replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]{2,4}$/, '')
    let uno: string
    if (/_trabajo/i.test(ruta) && /organizacion/i.test(base)) {
      uno = 'Levantamiento de estructura del equipo consultor'
    } else {
      const codigo = base.match(/II-\d{2}-\d{2}-\d{3}/)?.[0] ?? null
      const anios = base.match(/20\d{2}/g)
      const anio = anios ? anios[anios.length - 1] : null
      if (codigo) base = base.replace(codigo, '')
      const titulo = base
        .replace(/\(?\s*rev\.?\s*\d+[^)]*\)?/gi, '')
        .replace(/20\d{2}/g, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s\-_.]+|[\s\-_.]+$/g, '')
      uno = [[titulo, codigo].filter(Boolean).join(' ').trim(), anio].filter(Boolean).join(' · ') || 'Documento de Iberia'
    }
    if (resto) uno = `${uno} ${resto}`
    if (!salida.includes(uno)) salida.push(uno)
  }
  return salida.join('; ')
}
