import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * «Mi cargo» en la app: lo que la estructura (NUC-ORG) y el SGC (NUC-PRO,
 * NUC-DOC) saben del puesto de quien mira. Las tres funciones de la base
 * responden SOLO por quien llama (`mi_empleado()`): no reciben a otra persona.
 */

export type PlazaMia = {
  plaza_ref: string
  tipo: string
  tipo_nombre: string
  desde: string | null
  cargo_id: string
  cargo: string
  proposito: string | null
  familia: string | null
  unidad_ref: string | null
  unidad: string | null
  unidad_tipo: string | null
  sede: string | null
  ruta: string[] | null
  reporta_a: { cargo: string; unidad: string | null; personas: string[] } | null
}

export type MiCargo = {
  nombre: string
  cargo_padron: string | null
  area: string | null
  plazas: PlazaMia[]
}

export async function leerMiCargo(): Promise<MiCargo | null> {
  const supabase = await createClient()
  const { data } = await supabase.schema('nucleo').rpc('mi_cargo')
  return (data as MiCargo | null) ?? null
}

export async function leerMisProcesos() {
  const supabase = await createClient()
  const { data } = await supabase.schema('nucleo').rpc('mis_procesos')
  return data ?? []
}

export async function leerMisDocumentos() {
  const supabase = await createClient()
  const { data } = await supabase.schema('nucleo').rpc('mis_documentos')
  return data ?? []
}
