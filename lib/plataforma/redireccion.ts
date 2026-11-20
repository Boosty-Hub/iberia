/**
 * Para las rutas viejas del panel (`/dashboard/**`) que se mudaron a la
 * plataforma: arma la ruta nueva **con los parámetros de la vieja**. Los que
 * cambiaron de nombre se traducen (`estado` → `f.estado`, el filtro en chips de
 * `TablaDatos`); los demás pasan tal cual. Sin `'use client'` ni `'use server'`.
 */
export function rutaNueva(destino: string, sp: Record<string, string | string[] | undefined>, traducir: Record<string, string> = {}): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue
    for (const x of Array.isArray(v) ? v : [v]) if (x !== '') q.append(traducir[k] ?? k, x)
  }
  const s = q.toString()
  return s ? `${destino}${destino.includes('?') ? '&' : '?'}${s}` : destino
}
