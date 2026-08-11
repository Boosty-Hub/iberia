'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Registra que esta persona abrió esta publicación.
 *
 * Es lo que convierte el alcance en un dato: hasta ahora Iberia repartía
 * comunicados por correo y cartelera sin saber quién los leía. Se inserta una
 * sola vez por persona y publicación — el índice único de la tabla resuelve el
 * duplicado, así que un conflicto aquí es el resultado esperado, no un fallo.
 */
export function RegistrarLectura({
  publicacionId,
  empleadoId,
}: {
  publicacionId: string
  empleadoId: string
}) {
  const yaRegistrado = useRef(false)

  useEffect(() => {
    if (yaRegistrado.current) return
    yaRegistrado.current = true

    const supabase = createClient()
    void supabase
      .from('publicacion_lecturas')
      .upsert(
        { publicacion_id: publicacionId, empleado_id: empleadoId, origen: 'feed' },
        { onConflict: 'publicacion_id,empleado_id', ignoreDuplicates: true }
      )
  }, [publicacionId, empleadoId])

  return null
}
