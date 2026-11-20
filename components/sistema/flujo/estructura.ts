/**
 * Ayudas de estructura para las pantallas de flujos: ordenar unidades como
 * árbol y saber quién desciende de quién. Sin directiva: sirve en las dos orillas.
 */

export type UnidadArbol = { ref: string; nombre: string; padre_ref: string | null; orden?: number | null }

/** Las unidades en orden de árbol (padre, luego sus hijas), con su profundidad. */
export function ordenarArbol<T extends UnidadArbol>(unidades: T[]): (T & { nivel: number })[] {
  const refs = new Set(unidades.map((u) => u.ref))
  const hijas = new Map<string | null, T[]>()
  for (const u of unidades) {
    const padre = u.padre_ref && refs.has(u.padre_ref) ? u.padre_ref : null
    if (!hijas.has(padre)) hijas.set(padre, [])
    hijas.get(padre)!.push(u)
  }
  for (const l of hijas.values()) l.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
  const salida: (T & { nivel: number })[] = []
  const vistos = new Set<string>()
  const recorrer = (padre: string | null, nivel: number) => {
    for (const u of hijas.get(padre) ?? []) {
      if (vistos.has(u.ref)) continue
      vistos.add(u.ref)
      salida.push({ ...u, nivel })
      recorrer(u.ref, nivel + 1)
    }
  }
  recorrer(null, 0)
  // Lo que quedó fuera (un ciclo en los datos) se muestra igual, al final.
  for (const u of unidades) if (!vistos.has(u.ref)) salida.push({ ...u, nivel: 0 })
  return salida
}

/** Todas las refs que descienden de `ref` (sin incluirla). */
export function descendientes(unidades: UnidadArbol[], ref: string): Set<string> {
  const salida = new Set<string>()
  const pila = [ref]
  while (pila.length) {
    const actual = pila.pop()!
    for (const u of unidades) {
      if (u.padre_ref === actual && !salida.has(u.ref)) {
        salida.add(u.ref)
        pila.push(u.ref)
      }
    }
  }
  return salida
}

/** Sangría para un `<option>`: el espacio fino no colapsa dentro de la opción. */
export function sangria(nivel: number): string {
  return ' '.repeat(Math.min(nivel, 8))
}

/** «Gerencia de Compras» → `gerencia-de-compras`, para las claves. */
export function claveDe(nombre: string, largo = 60): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, largo)
      .replace(/-+$/g, '') || 'nuevo'
  )
}
