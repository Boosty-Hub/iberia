'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hoyCaracas, esFecha, esUuid } from '@/lib/plataforma/formato'
import { ejecutarAccionFicha } from '@/components/sistema/ui/ficha-acciones'
import { responder, type Cita } from '@/lib/ia/preguntar'
import { revisarPlazas } from '@/lib/ia/plazas'
import { clasificarDocumentos } from '@/lib/ia/documentos'
import { COLUMNAS_PROPUESTA, catalogoIa, estadoIa, nombresDe } from '@/lib/ia/servidor'
import { capacidadViva, type EstadoIa, type NivelIa, type PropuestaVista } from '@/lib/ia/niveles'

/**
 * Las acciones de la IA (R4). Cada una vuelve a pedir su permiso y llama a la
 * base con la sesión de quien la usa; la base vuelve a comprobar interruptor,
 * nivel, tope y alcance. Solo exporta funciones async.
 */

type Resultado = { ok?: string; error?: string }

function mensaje(e: { message?: string } | null | undefined): string {
  return (e?.message ?? 'No se pudo completar.').replace(/^.*?ERROR:\s*/, '')
}

/** Preguntas por persona y día (cada una es una llamada al modelo grande). */
const TOPE_PREGUNTAS = 40

export type RespuestaIa = {
  respuesta: string
  suficiente: boolean
  citas: Cita[]
  leidos: number
  costoUsd: number
  error?: string
}

// ── NUC-PRO-IA-01 · Preguntar ──────────────────────────────────────────────
export async function preguntarIa(pregunta: string): Promise<RespuestaIa> {
  const sesion = await requerirSesion()
  const texto = String(pregunta ?? '').trim().slice(0, 500)
  const nada = { respuesta: '', suficiente: false, citas: [], leidos: 0, costoUsd: 0 }
  if (texto.length < 4) return { ...nada, error: 'Escribe la pregunta completa.' }
  if (!puede(sesion, 'sistema:inicio')) return { ...nada, error: 'Tu rol no entra a la plataforma.' }
  const supabase = await createClient()
  const ia = supabase.schema('ia')
  const { data: motivo } = await ia.rpc('motivo_bloqueo', { p_codigo: 'NUC-PRO-IA-01' })
  if (motivo) return { ...nada, error: motivo }

  const inicioDia = new Date(`${hoyCaracas()}T00:00:00-04:00`).toISOString()
  const { count } = await ia
    .from('actividad')
    .select('id', { count: 'exact', head: true })
    .eq('capacidad', 'NUC-PRO-IA-01')
    .eq('pedido_por', sesion.userId)
    .gte('creado_en', inicioDia)
  if ((count ?? 0) >= TOPE_PREGUNTAS) return { ...nada, error: `Llegaste a las ${TOPE_PREGUNTAS} preguntas de hoy. Mañana sigues; mientras, la búsqueda (Ctrl K) funciona sin IA.` }

  const r = await responder(texto)
  if ('error' in r) {
    await ia.rpc('registrar_llamada', {
      p_capacidad: 'NUC-PRO-IA-01',
      p_accion: 'error',
      p_resumen: `Pregunta sin respuesta: ${r.error}`,
      p_evidencia: [],
      p_tokens_entrada: r.medida?.tokensEntrada ?? 0,
      p_tokens_salida: r.medida?.tokensSalida ?? 0,
      p_costo_usd: r.medida?.costoUsd ?? 0,
      p_latencia_ms: r.medida?.latenciaMs ?? 0,
      p_modelo: r.medida?.modelo ?? 'ninguno',
    })
    return { ...nada, error: `La IA no pudo responder: ${r.error}` }
  }
  if (r.medida.modelo) {
    const { error } = await ia.rpc('registrar_llamada', {
      p_capacidad: 'NUC-PRO-IA-01',
      p_accion: 'respondio',
      p_resumen: `Pregunta: «${texto.slice(0, 280)}» · ${r.citas.length} cita(s)${r.suficiente ? '' : ' · dijo que no le alcanzaban los datos'}`,
      // Solo tipo, id y versión: el título se pinta con los permisos de quien mira.
      p_evidencia: r.citas.map((c) => ({ tipo: c.tipo, id: c.id, campo: 'version', valor: c.version ?? c.fecha, fuente: c.codigo ?? c.tipo })),
      p_tokens_entrada: r.medida.tokensEntrada,
      p_tokens_salida: r.medida.tokensSalida,
      p_costo_usd: r.medida.costoUsd,
      p_latencia_ms: r.medida.latenciaMs,
      p_modelo: r.medida.modelo,
    })
    if (error) return { ...nada, error: mensaje(error) }
  }
  return { respuesta: r.respuesta, suficiente: r.suficiente, citas: r.citas, leidos: r.leidos, costoUsd: r.medida.costoUsd }
}

// ── NUC-ORG-IA-05 · Revisar plazas ─────────────────────────────────────────
export async function revisarPlazasIa(): Promise<Resultado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const r = await revisarPlazas()
  if ('error' in r) return { error: r.error.replace(/^.*?ERROR:\s*/, '') }
  revalidatePath('/sistema', 'layout')
  const costo = r.medida ? ` · US$ ${r.medida.costoUsd.toFixed(3)}` : ''
  return {
    ok: r.nuevas
      ? `La IA marcó ${r.nuevas} plaza(s) nuevas y explicó ${r.explicadas}${costo}. Revisa cada marca ⚑: la decisión es tuya.`
      : 'Sin señales nuevas: las marcas que ya estaban siguen pendientes.',
    error: r.avisoModelo,
  }
}

// ── NUC-DOC-IA-02 · Clasificar documentos ──────────────────────────────────
export async function clasificarDocumentosIa(): Promise<Resultado> {
  await requerirPermiso('sistema:documentos', 'editar')
  const r = await clasificarDocumentos(8)
  if ('error' in r) return { error: r.error.replace(/^.*?ERROR:\s*/, '') }
  revalidatePath('/sistema', 'layout')
  if (!r.leidos) return { ok: r.aviso ?? 'Nada por clasificar.' }
  const costo = r.medida ? ` · US$ ${r.medida.costoUsd.toFixed(3)}` : ''
  return {
    ok: `La IA leyó ${r.leidos} documento(s): ${r.aplicadas ? `aplicó sola ${r.aplicadas} clasificación(es) de metadatos internos (se pueden deshacer 12 horas) y ` : ''}dejó ${r.propuestas} propuesta(s) para que decidas${costo}.`,
  }
}

// ── Decidir una propuesta ──────────────────────────────────────────────────
export async function decidirPropuesta(
  id: string,
  decision: 'aceptada' | 'editada' | 'rechazada',
  motivo?: string,
  cambios?: Record<string, string>
): Promise<Resultado> {
  await requerirSesion()
  if (!esUuid(id) || !['aceptada', 'editada', 'rechazada'].includes(decision)) return { error: 'Propuesta no válida.' }
  const limpio = cambios ? Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 80)])) : undefined
  const supabase = await createClient()
  const { error } = await supabase
    .schema('ia')
    .rpc('decidir_propuesta', { p_id: id, p_decision: decision, p_motivo: motivo?.trim().slice(0, 1000) ?? '', ...(limpio ? { p_cambios: limpio } : {}) })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  return { ok: decision === 'rechazada' ? 'Rechazada. El motivo queda en la actividad de la IA.' : decision === 'editada' ? 'Aplicada con tu cambio.' : 'Aceptada y aplicada.' }
}

/**
 * Aceptar una propuesta de plaza: el ajuste lo hace la acción de la ficha (con
 * fecha, versión nueva, permiso de editar la estructura) y después queda la
 * decisión. Si la persona cambió el valor, la propuesta queda «con cambios».
 */
export async function aceptarPropuestaPlaza(id: string, entrada: { dotacion?: string; fecha?: string }): Promise<Resultado & { href?: string }> {
  await requerirPermiso('sistema:estructura', 'editar')
  if (!esUuid(id)) return { error: 'Propuesta no válida.' }
  const supabase = await createClient()
  const { data: p } = await supabase.schema('ia').from('propuesta').select('id, objeto_id, regla, payload, estado').eq('id', id).maybeSingle()
  if (!p) return { error: 'Esa propuesta no está a tu alcance.' }
  if (p.estado !== 'pendiente') return { error: 'Esa propuesta ya se decidió.' }
  const fecha = entrada.fecha && esFecha(entrada.fecha) ? entrada.fecha : hoyCaracas()
  const payload = (p.payload ?? {}) as { accion?: string; dotacion_propuesta?: number }
  const ficha = `plaza:${p.objeto_id}`
  let decision: 'aceptada' | 'editada' = 'aceptada'
  let cambios: Record<string, string | number> = { fecha }

  if (payload.accion === 'editar_dotacion') {
    const valor = String(entrada.dotacion ?? payload.dotacion_propuesta ?? '')
    const r = await ejecutarAccionFicha(ficha, 'plaza.dotacion', { valor, fecha })
    if (r.error) return { error: r.error }
    if (Number(valor) !== Number(payload.dotacion_propuesta)) decision = 'editada'
    cambios = { dotacion: Number(valor), fecha }
  } else if (payload.accion === 'confirmar') {
    const r = await ejecutarAccionFicha(ficha, 'plaza.confirmar', { fecha })
    if (r.error) return { error: r.error }
    cambios = { certeza: 'hecho', fecha }
  } else {
    // Sin titular: aceptar es ir a pedir la requisición (o cerrar la plaza desde su ficha).
    cambios = { siguiente: 'requisicion' }
  }
  const { error } = await supabase.schema('ia').rpc('decidir_propuesta', { p_id: id, p_decision: decision, p_motivo: '', p_cambios: cambios })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  if (payload.accion === 'revisar_vacante') return { ok: 'Aceptada: abre la requisición para cubrirla.', href: '/sistema/nucleo/organizacion/requisiciones/nueva' }
  return { ok: decision === 'editada' ? 'Aplicado con tu cambio. La versión anterior quedó en el historial.' : 'Aplicado con fecha. La versión anterior quedó en el historial.' }
}

export async function deshacerPropuesta(id: string, motivo?: string): Promise<Resultado> {
  await requerirSesion()
  if (!esUuid(id)) return { error: 'Propuesta no válida.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('ia').rpc('deshacer', { p_id: id, p_motivo: motivo?.trim().slice(0, 500) ?? '' })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  return { ok: 'Deshecho: el documento volvió a como estaba.' }
}

// ── La pestaña IA de la ficha ──────────────────────────────────────────────
export type IaDeObjeto = {
  estado: EstadoIa | null
  propuestas: (PropuestaVista & { decidido_por_nombre: string | null })[]
  capacidades: { codigo: string; nombre: string; que_hace: string; nivel: NivelIa; techo: NivelIa; encendida: boolean; viva: boolean }[]
  puedeDecidir: boolean
}

const EDITA: Record<string, [string, 'editar']> = {
  plaza: ['sistema:estructura', 'editar'],
  unidad: ['sistema:estructura', 'editar'],
  cargo: ['sistema:estructura', 'editar'],
  documento: ['sistema:documentos', 'editar'],
  proceso: ['sistema:procesos', 'editar'],
}

export async function cargarIaObjeto(tipo: string, id: string): Promise<IaDeObjeto | null> {
  const sesion = await requerirSesion()
  if (!esUuid(id) || !/^[a-z]+$/.test(tipo)) return null
  const supabase = await createClient()
  const [estado, catalogo, { data }] = await Promise.all([
    estadoIa(),
    catalogoIa(),
    supabase.schema('ia').from('propuesta').select(COLUMNAS_PROPUESTA).eq('objeto_tipo', tipo).eq('objeto_id', id).order('creado_en', { ascending: false }).range(0, 29),
  ])
  const propuestas = (data ?? []) as unknown as PropuestaVista[]
  const nombres = await nombresDe(propuestas.map((p) => p.decidido_por))
  const permiso = EDITA[tipo]
  return {
    estado,
    propuestas: propuestas.map((p) => ({ ...p, decidido_por_nombre: p.decidido_por ? (nombres.get(p.decidido_por) ?? null) : null })),
    capacidades: catalogo
      .filter((c) => c.objeto_tipos.includes(tipo))
      .map((c) => ({ codigo: c.codigo, nombre: c.nombre, que_hace: c.que_hace, nivel: c.nivel_actual, techo: c.techo, encendida: c.encendida, viva: capacidadViva(estado, c.codigo) })),
    puedeDecidir: permiso ? puede(sesion, permiso[0], permiso[1]) : false,
  }
}

// ── Gobierno de IA ─────────────────────────────────────────────────────────
export async function fijarInterruptorGeneral(encendido: boolean, motivo: string): Promise<Resultado> {
  await requerirPermiso('sistema:ia', 'editar')
  const supabase = await createClient()
  const { error } = await supabase.schema('ia').rpc('fijar_interruptor', { p_encendido: Boolean(encendido), p_motivo: String(motivo ?? '').slice(0, 500) })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  return { ok: encendido ? 'La IA quedó encendida en la plataforma.' : 'La IA quedó apagada en toda la plataforma. Todo sigue funcionando por el camino manual.' }
}

export async function encenderCapacidad(codigo: string, encendida: boolean, motivo: string): Promise<Resultado> {
  await requerirPermiso('sistema:ia', 'editar')
  const supabase = await createClient()
  const { error } = await supabase.schema('ia').rpc('encender', { p_codigo: codigo, p_encendida: Boolean(encendida), p_motivo: String(motivo ?? '').slice(0, 500) })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  return { ok: encendida ? `${codigo} encendida.` : `${codigo} apagada.` }
}

export async function pedirCambioNivel(codigo: string, nivel: string, motivo: string, evidencia: string): Promise<Resultado> {
  await requerirPermiso('sistema:ia', 'editar')
  const supabase = await createClient()
  const { data: antes } = await supabase.schema('ia').from('capacidad').select('nivel_actual').eq('codigo', codigo).maybeSingle()
  const { error } = await supabase
    .schema('ia')
    .rpc('pedir_cambio_nivel', { p_codigo: codigo, p_nivel: nivel, p_motivo: String(motivo ?? '').slice(0, 1000), p_evidencia: String(evidencia ?? '').slice(0, 2000) })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  const baja = antes && Number(nivel.slice(1)) < Number(antes.nivel_actual.slice(1))
  return {
    ok: baja
      ? `${codigo} bajó a ${nivel}. Bajar es inmediato y queda registrado.`
      : `Solicitud enviada: el Gerente de TI revisa y el Gerente General aprueba. ${codigo} sigue en ${antes?.nivel_actual ?? 'su nivel'} hasta entonces.`,
  }
}

export async function fijarTopeDiario(usd: number, motivo: string): Promise<Resultado> {
  await requerirPermiso('sistema:ia', 'editar')
  const supabase = await createClient()
  const { error } = await supabase.schema('ia').rpc('fijar_tope', { p_usd: Number(usd), p_motivo: String(motivo ?? '').slice(0, 200) })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema', 'layout')
  return { ok: `Tope diario: US$ ${Number(usd).toFixed(2)}.` }
}

/** Para pintar o esconder las superficies de IA en el navegador. */
export async function leerEstadoIa(): Promise<EstadoIa | null> {
  await requerirSesion()
  return estadoIa()
}
