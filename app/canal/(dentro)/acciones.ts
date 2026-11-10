'use server'

import { VERSION_NORMAS } from '@/lib/normas'
import { createClient } from '@/lib/supabase/server'

/**
 * Deja constancia de que quien está en el canal aceptó las normas de uso, en los
 * metadatos de su cuenta (`lib/normas.ts`). La llama `AceptarNormas`.
 *
 * No revalida ni redirige: eso haría que Next mandara el canal entero pintado
 * dentro de la respuesta de la acción, que es lo que se cae en una conexión de
 * planta. La pantalla recarga sola al recibir `ok`, y el layout lee la versión
 * aceptada con `getUser()`, que la trae fresca del servidor de Auth.
 *
 * Los metadatos los escribe la propia persona —es lo que permite guardar esto
 * sin migración—, así que solo sirven para lo que son: una constancia de que
 * aceptó, no un permiso. `handle_new_user` lee los metadatos solo al crear la
 * cuenta, no al cambiarlos.
 */
export async function aceptarNormas(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase.auth.updateUser({
    data: {
      normas_aceptadas_version: VERSION_NORMAS,
      normas_aceptadas_en: new Date().toISOString(),
    },
  })
  return { ok: !error }
}
