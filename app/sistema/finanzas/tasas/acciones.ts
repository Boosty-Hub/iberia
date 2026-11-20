'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { esFecha } from '@/lib/plataforma/formato'

/**
 * La carga manual de una tasa (respaldo, Anexo E §6): exige `sistema:tasas`
 * editar y un motivo. La hace `control.cargar_tasa_manual()`, que reemplaza la
 * vigente de esa fecha valor (la tabla es de solo inserción) y vuelve a pedir
 * el permiso en la base.
 */
export async function cargarTasaManual(_previo: { error?: string; ok?: string } | null, fd: FormData): Promise<{ error?: string; ok?: string }> {
  await requerirPermiso('sistema:tasas', 'editar')
  const tipo = fd.get('tipo') === 'paralelo' ? 'paralelo' : 'oficial'
  const moneda = fd.get('moneda') === 'EUR' ? 'EUR' : 'USD'
  // Se acepta «1.009,62» o «1009.62».
  const crudo = String(fd.get('tasa') ?? '').trim()
  const tasa = Number(crudo.includes(',') ? crudo.replace(/\./g, '').replace(',', '.') : crudo)
  const fecha = String(fd.get('fecha_valor') ?? '')
  const motivo = String(fd.get('motivo') ?? '').trim()
  if (!Number.isFinite(tasa) || tasa <= 0) return { error: 'Escribe una tasa válida, por ejemplo 919,26.' }
  if (!esFecha(fecha)) return { error: 'Elige la fecha valor.' }
  if (motivo.length < 5) return { error: 'El motivo es obligatorio (al menos 5 caracteres).' }
  if (tipo === 'paralelo' && moneda !== 'USD') return { error: 'El paralelo se carga solo en dólares.' }

  const supabase = await createClient()
  const { error } = await supabase.schema('control').rpc('cargar_tasa_manual', {
    p_tipo: tipo,
    p_moneda: moneda,
    p_tasa: tasa,
    p_fecha_valor: fecha,
    p_motivo: motivo,
  })
  if (error) return { error: error.message }
  revalidatePath('/sistema', 'layout')
  return { ok: `Cargada: ${tipo === 'oficial' ? 'BCV' : 'paralelo'} ${moneda} con fecha valor ${fecha.split('-').reverse().join('/')}. Si había otra vigente, quedó reemplazada.` }
}
