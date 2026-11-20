'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaCorta, fechaHora, numero } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { leerEstado } from '@/lib/plataforma/tabla'
import { todasLasFilas } from '@/lib/plataforma/tabla-servidor'
import { FUENTES } from '@/lib/plataforma/tablas'

/**
 * Exportar y guardar vistas de `TablaDatos`. Solo funciones async.
 */

/**
 * La vista actual a CSV: la misma fuente, los mismos filtros y el mismo orden,
 * con la RLS de quien exporta. Separador `;` y coma decimal, con BOM: así lo abre
 * Excel en español sin pasos de más.
 */
export async function exportarCsv(tabla: string, consulta: string): Promise<{ nombre: string; contenido: string; filas: number; cortado: boolean } | { error: string }> {
  const fuente = FUENTES[tabla]
  if (!fuente) return { error: 'Esa tabla no existe.' }
  await requerirPermiso(fuente.recurso, fuente.accion ?? 'ver')
  const sp = new URLSearchParams(consulta)
  const estado = leerEstado(sp, fuente.columnas, { orden: fuente.orden.columna, dir: fuente.orden.dir, tamano: fuente.tamano })
  const ctx = await leerContexto(Object.fromEntries(sp.entries()))
  const { filas, cortado } = await todasLasFilas(fuente, { ...estado, pagina: 1 }, ctx)
  const cols = estado.columnas.map((c) => fuente.columnas.find((x) => x.clave === c)!).filter(Boolean)

  const celda = (v: unknown, tipo?: string, etiquetas?: Record<string, string>) => {
    if (v === null || v === undefined) return ''
    if (etiquetas && typeof v === 'string') return etiquetas[v] ?? v
    if (tipo === 'entero') return numero(Number(v), 0)
    if (tipo === 'decimal' || tipo === 'porcentaje') return numero(Number(v), 2)
    if (tipo === 'tasa') return numero(Number(v), 8, 2)
    if (tipo === 'fecha') return fechaCorta(String(v))
    if (tipo === 'fechaHora') return fechaHora(String(v))
    return String(v)
  }
  const esc = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lineas = [
    cols.map((c) => esc(c.etiqueta)).join(';'),
    ...filas.map((r) => cols.map((c) => esc(celda(c.etiquetaDe ? (r[c.etiquetaDe] ?? r[c.clave]) : r[c.clave], c.tipo, c.etiquetas))).join(';')),
  ]
  return {
    nombre: `${fuente.id}-${ctx.al}.csv`,
    contenido: '﻿' + lineas.join('\r\n'),
    filas: filas.length,
    cortado,
  }
}

/**
 * Guarda la vista actual. Personal: cualquiera. Compartida: quien ve el módulo.
 * Bloqueada: solo administración (y la RLS lo vuelve a comprobar).
 */
export async function guardarVista(entrada: { tabla: string; nombre: string; alcance: 'personal' | 'compartida' | 'bloqueada'; consulta: string }) {
  const sesion = await requerirSesion()
  const fuente = FUENTES[entrada.tabla]
  if (!fuente) return { error: 'Esa tabla no existe.' }
  if (!puede(sesion, fuente.recurso, fuente.accion ?? 'ver')) return { error: 'No tienes acceso a esta tabla.' }
  const nombre = entrada.nombre.trim()
  if (nombre.length < 2 || nombre.length > 80) return { error: 'El nombre va de 2 a 80 caracteres.' }
  if (entrada.alcance === 'bloqueada' && sesion.rolReal.nivel !== 'admin') return { error: 'Solo administración guarda vistas bloqueadas.' }
  const supabase = await createClient()
  const id = crypto.randomUUID()
  const { error } = await supabase
    .schema('ui')
    .from('vista')
    .insert({
      id,
      tabla: fuente.id,
      modulo: fuente.modulo,
      recurso: fuente.recurso,
      ruta: fuente.ruta,
      nombre,
      alcance: entrada.alcance,
      parametros: { consulta: entrada.consulta.slice(0, 2000) },
      propietario: sesion.userId,
    })
  if (error) return { error: error.code === '42501' ? 'No tienes permiso para guardar esa vista.' : error.message }
  revalidatePath('/sistema', 'layout')
  return { ok: true, id }
}

export async function borrarVista(id: string) {
  await requerirSesion()
  const supabase = await createClient()
  const { error, count } = await supabase.schema('ui').from('vista').delete({ count: 'exact' }).eq('id', id)
  if (error) return { error: error.message }
  // Sin política que lo deje, Postgres no se queja: filtra y borra cero.
  if (!count) return { error: 'No puedes borrar esa vista.' }
  revalidatePath('/sistema', 'layout')
  return { ok: true }
}
