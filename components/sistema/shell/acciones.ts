'use server'

import { cookies } from 'next/headers'
import { COOKIE_VER_COMO, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cargarFicha as armarFicha } from '@/lib/plataforma/fichas'
import { leerFicha, type Ficha } from '@/lib/plataforma/ficha-tipos'
import { enlaceObjeto } from '@/components/sistema/flujo/formato'

/**
 * Las acciones del armazón. Solo exporta funciones async ('use server'): los
 * tipos y constantes viven en `lib/plataforma/*`.
 */

const UN_ANO = 60 * 60 * 24 * 365

export async function fijarMoneda(moneda: 'VES' | 'USD') {
  await requerirSesion()
  ;(await cookies()).set('moneda', moneda === 'USD' ? 'USD' : 'VES', { path: '/', maxAge: UN_ANO, sameSite: 'lax' })
}

/** El riel con nombres (por defecto) o solo iconos. Se recuerda por persona y navegador. */
export async function fijarRiel(modo: 'nombres' | 'iconos') {
  await requerirSesion()
  ;(await cookies()).set('riel', modo === 'iconos' ? 'iconos' : 'nombres', { path: '/sistema', maxAge: UN_ANO, sameSite: 'lax' })
}

export async function fijarColumna(modo: 'abierta' | 'plegada') {
  await requerirSesion()
  ;(await cookies()).set('columna', modo === 'plegada' ? 'plegada' : 'abierta', { path: '/sistema', maxAge: UN_ANO, sameSite: 'lax' })
}

/**
 * «Ver como»: solo quien es administrador **de verdad** (`rolReal`), aunque ya
 * esté previsualizando otro rol. No da permisos: `obtenerSesion` solo recorta, y
 * la base sigue respondiendo con el usuario real.
 */
export async function fijarVerComo(rolId: string | null) {
  const sesion = await requerirSesion()
  const jar = await cookies()
  if (!rolId || rolId === sesion.rolReal.id) {
    jar.delete({ name: COOKIE_VER_COMO, path: '/sistema' })
    return { ok: true }
  }
  if (sesion.rolReal.nivel !== 'admin') return { error: 'Solo el nivel administrador puede ver como otro rol.' }
  if (!/^[0-9a-f-]{36}$/i.test(rolId)) return { error: 'Rol no válido.' }
  jar.set(COOKIE_VER_COMO, rolId, { path: '/sistema', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8 })
  return { ok: true }
}

export type ResultadoBusqueda = { tipo: string; id: string; codigo: string | null; titulo: string; detalle: string | null; href: string }

/** La búsqueda de la paleta: `ui.buscar()` con la RLS de quien busca. */
export async function buscar(q: string): Promise<ResultadoBusqueda[]> {
  await requerirSesion()
  const texto = q.trim().slice(0, 80)
  if (texto.length < 2 && !/^\d+$/.test(texto)) return []
  const supabase = await createClient()
  const { data, error } = await supabase.schema('ui').rpc('buscar', { p_q: texto, p_limite: 5 })
  if (error) return []
  return (data ?? []).map((r) => ({ tipo: r.tipo, id: r.id, codigo: r.codigo, titulo: r.titulo, detalle: r.detalle, href: r.href }))
}

export type Pendiente = { id: string; titulo: string; paso: string; desde: string; href: string | null; pidio: string | null }

/** Lo que me toca decidir (la misma `flujo.bandeja()` de «Mis aprobaciones»). */
export async function misPendientes(): Promise<Pendiente[]> {
  await requerirSesion()
  const supabase = await createClient()
  const { data } = await supabase.schema('flujo').rpc('bandeja')
  const filas = data ?? []
  const procesos = filas.filter((p) => p.tipo_objeto === 'proceso').map((p) => p.objeto_id)
  const { data: refs } = procesos.length ? await supabase.schema('sgc').from('proceso').select('id, ref').in('id', procesos) : { data: [] }
  const refDe = new Map((refs ?? []).map((p) => [p.id, p.ref]))
  return filas.map((p) => ({
    id: p.paso_id,
    titulo: p.titulo,
    paso: p.paso,
    desde: p.esperando_desde,
    href: enlaceObjeto(p.tipo_objeto, p.objeto_id, refDe.get(p.objeto_id)),
    pidio: p.pedido_por_nombre,
  }))
}

/** La ficha de un objeto para el panel lateral (`?ficha=tipo:id`). */
export async function cargarFicha(valor: string): Promise<{ ficha: Ficha | null }> {
  const sesion = await requerirSesion()
  const f = leerFicha(valor)
  if (!f) return { ficha: null }
  return { ficha: await armarFicha(sesion, f.tipo, f.id) }
}
