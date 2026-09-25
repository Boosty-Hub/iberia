'use client'

import { IndiceInforme, type EntradaIndice } from '@/components/indice-informe'
import { MenuMovil } from '@/components/menu-movil'

/**
 * El índice del informe en teléfono y tableta, donde no cabe la columna. Hasta
 * ahora, por debajo de 1024 px la única forma de pasar a otra sección era volver
 * a la portada.
 */
export function MenuInforme({ secciones }: { secciones: EntradaIndice[] }) {
  if (secciones.length === 0) return null
  return (
    <MenuMovil titulo="Índice del informe" etiqueta="Abrir el índice del informe">
      <IndiceInforme secciones={secciones} />
    </MenuMovil>
  )
}
