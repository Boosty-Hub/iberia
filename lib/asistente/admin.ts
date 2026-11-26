import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ConfigVista, PoliticaFila } from '@/components/sistema/asistente/admin-formularios'

/** Lo que leen las pantallas de Administración › Asistente de IA, con la sesión de quien mira (la RLS pide la casilla). */
export async function leerConfig(): Promise<ConfigVista | null> {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('config').select('*').eq('id', true).maybeSingle()
  if (!data) return null
  return {
    motor: data.motor as ConfigVista['motor'],
    encendido: data.encendido,
    tope_mensual_empresa_usd: Number(data.tope_mensual_empresa_usd),
    modelo_anthropic: data.modelo_anthropic,
    modelo_openai: data.modelo_openai,
    esfuerzo_defecto: data.esfuerzo_defecto as ConfigVista['esfuerzo_defecto'],
    tope_diario_usd: Number(data.tope_diario_usd),
    tope_mensual_usd: Number(data.tope_mensual_usd),
    cuota_mb: data.cuota_mb,
    esfuerzo_max: data.esfuerzo_max as ConfigVista['esfuerzo_max'],
    instrucciones_empresa: data.instrucciones_empresa,
    programador_pausado: data.programador_pausado,
    max_tareas: data.max_tareas,
    frecuencia_min_min: data.frecuencia_min_min,
    tope_investigacion_usd: Number(data.tope_investigacion_usd),
    correo_remitente: data.correo_remitente,
    correo_nombre: data.correo_nombre,
    whatsapp_plantilla: data.whatsapp_plantilla,
    local_url: data.local_url,
    local_modo: data.local_modo as ConfigVista['local_modo'],
  }
}

export async function leerModelosAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('modelo').select('*').order('orden')
  return data ?? []
}

const vacia = (): PoliticaFila => ({ modelos: null, esfuerzo_max: null, tope_diario_usd: null, tope_mensual_usd: null, cuota_mb: null, puede_programar: null, max_tareas: null })

/** Los roles, si tienen la casilla del asistente, cuántas personas activas tienen y su política. */
export async function leerRolesYPoliticas() {
  const supabase = await createClient()
  const [{ data: roles }, { data: permisos }, { data: perfiles }, { data: politicas }, { data: excepciones }] = await Promise.all([
    supabase.from('roles').select('id, nombre, nivel, clave').order('nombre'),
    supabase.from('rol_permisos').select('rol_id, ver').eq('recurso', 'sistema:asistente'),
    supabase.from('profiles').select('id, nombre_completo, email, rol_id, rol, activo').eq('activo', true).order('nombre_completo'),
    supabase.schema('asistente').from('politica_rol').select('*'),
    supabase.schema('asistente').from('politica_usuario').select('*'),
  ])
  const ver = new Map((permisos ?? []).map((p) => [p.rol_id, p.ver]))
  const porRol = new Map<string, number>()
  for (const p of perfiles ?? []) porRol.set(p.rol_id, (porRol.get(p.rol_id) ?? 0) + 1)
  const pol = new Map((politicas ?? []).map((p) => [p.rol_id, p]))
  return {
    roles: (roles ?? []).map((r) => {
      const p = pol.get(r.id)
      return {
        id: r.id,
        nombre: r.nombre,
        habilitado: r.nivel === 'admin' || !!ver.get(r.id),
        personas: porRol.get(r.id) ?? 0,
        politica: p
          ? { modelos: p.modelos, esfuerzo_max: p.esfuerzo_max as PoliticaFila['esfuerzo_max'], tope_diario_usd: p.tope_diario_usd === null ? null : Number(p.tope_diario_usd), tope_mensual_usd: p.tope_mensual_usd === null ? null : Number(p.tope_mensual_usd), cuota_mb: p.cuota_mb, puede_programar: p.puede_programar, max_tareas: p.max_tareas }
          : vacia(),
      }
    }),
    personas: (perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre_completo || p.email || 'Sin nombre' })),
    excepciones: (excepciones ?? []).map((e) => ({
      perfil_id: e.perfil_id,
      habilitado: e.habilitado,
      nota: e.nota,
      modelos: e.modelos,
      esfuerzo_max: e.esfuerzo_max as PoliticaFila['esfuerzo_max'],
      tope_diario_usd: e.tope_diario_usd === null ? null : Number(e.tope_diario_usd),
      tope_mensual_usd: e.tope_mensual_usd === null ? null : Number(e.tope_mensual_usd),
      cuota_mb: e.cuota_mb,
      puede_programar: e.puede_programar,
      max_tareas: e.max_tareas,
    })),
  }
}

export type ConsumoPersona = {
  perfil_id: string
  nombre: string
  turnos: number
  fallidos: number
  costo_usd: number
  tokens_entrada: number
  tokens_salida: number
  primer_token_p90_ms: number | null
  a_favor: number
  en_contra: number
}

/** El consumo desde una fecha, por persona y por eje (modelo, categoría o día). Cifras, nunca contenido. */
export async function leerConsumo(desde: string) {
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: personas }, { data: modelos }, { data: categorias }, { data: dias }] = await Promise.all([
    db.rpc('consumo', { p_desde: desde }),
    db.rpc('consumo_por', { p_desde: desde, p_eje: 'modelo' }),
    db.rpc('consumo_por', { p_desde: desde, p_eje: 'categoria' }),
    db.rpc('consumo_por', { p_desde: desde, p_eje: 'dia' }),
  ])
  const num = <T extends Record<string, unknown>>(xs: T[] | null) => (xs ?? []).map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && k !== 'clave' ? Number(v) : v])))
  return {
    personas: num(personas as Record<string, unknown>[] | null) as unknown as ConsumoPersona[],
    modelos: num(modelos as Record<string, unknown>[] | null) as unknown as { clave: string; turnos: number; costo_usd: number; primer_token_p90_ms: number | null }[],
    categorias: num(categorias as Record<string, unknown>[] | null) as unknown as { clave: string; turnos: number; costo_usd: number }[],
    dias: num(dias as Record<string, unknown>[] | null) as unknown as { clave: string; turnos: number; costo_usd: number }[],
  }
}

/** El primer día del mes en Caracas, como marca de tiempo. */
export function inicioDelMes(): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit' }).format(new Date())
  return `${hoy}-01T00:00:00-04:00`
}
