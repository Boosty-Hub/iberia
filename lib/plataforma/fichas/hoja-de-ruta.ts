import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ESTADO_MODULO, PESTANAS, hrefModulo, type EstadoModulo } from '@/lib/plataforma/dominios'
import type { DatoFicha, Ficha, ResultadoAccionFicha, TonoFicha } from '@/lib/plataforma/ficha-tipos'
import type { ManejadorFicha } from '@/lib/plataforma/fichas/acciones'
import { revalidatePath } from 'next/cache'

/**
 * La ficha de un módulo del plan (`modulo:<ref>`), desde la hoja de ruta:
 * propósito, frontera, dueño, fase, estado, pantalla y lo que ya está
 * construido. Lee `control.modulo` con la sesión de quien mira y pide
 * `modulo:programa` · ver. El estado se edita con `modulo:programa` · editar.
 *
 * ⚠️ Lo lee Iberia: el régimen contractual del módulo no se muestra.
 */

const UUID = /^[0-9a-f-]{36}$/i

const TONO_ESTADO: Record<EstadoModulo, TonoFicha> = { operando: 'verde', en_construccion: 'ambar', planificado: 'neutro', pausado: 'neutro' }

export async function fichaModulo(sesion: Sesion, ref: string): Promise<Ficha | null> {
  if (!UUID.test(ref) || !puede(sesion, 'modulo:programa')) return null
  const supabase = await createClient()
  const { data: m } = await supabase
    .schema('control')
    .from('modulo')
    .select('codigo, ref, nombre, dominio, fase, fase_clave, estado, ruta, recurso, descripcion, frontera, dueno, construido, orden')
    .eq('ref', ref)
    .maybeSingle()
  if (!m) return null
  const { data: fase } = m.fase_clave
    ? await supabase.schema('control').from('fase_plataforma').select('nombre, periodo_texto, estado').eq('clave', m.fase_clave).maybeSingle()
    : { data: null }
  const estado = m.estado as EstadoModulo
  const editar = puede(sesion, 'modulo:programa', 'editar')
  const href = hrefModulo({ codigo: m.codigo, ruta: m.ruta, estado })
  const conPantalla = Boolean(m.ruta) && estado !== 'planificado'
  const pestanas = PESTANAS[m.codigo] ?? []

  const datos: DatoFicha[] = [
    { etiqueta: 'Código', valor: m.codigo, mono: true },
    { etiqueta: 'Dominio', valor: m.dominio },
    {
      etiqueta: 'Estado',
      valor: ESTADO_MODULO[estado]?.etiqueta ?? m.estado,
      ...(editar
        ? {
            editar: {
              accion: 'campo:estado',
              control: 'opciones' as const,
              valor: m.estado,
              opciones: Object.entries(ESTADO_MODULO).map(([valor, x]) => ({ valor, etiqueta: x.etiqueta })),
              ayuda: 'Operando: en producción y en uso. En construcción: una parte opera y otra está por hacer. El cambio queda en la auditoría.',
            },
          }
        : {}),
    },
    { etiqueta: 'Fase de entrada', valor: fase ? `${fase.nombre}${fase.periodo_texto ? ` · ${fase.periodo_texto}` : ''}` : '—' },
    { etiqueta: 'Cómo crece', valor: m.fase ?? '—' },
    { etiqueta: 'Propósito', valor: m.descripcion?.trim() || '—' },
    { etiqueta: 'Frontera', valor: m.frontera?.trim() || '—' },
    { etiqueta: 'Dueño (cargo)', valor: m.dueno?.trim() || '—' },
    { etiqueta: 'Lo que ya está construido', valor: m.construido?.trim() || (estado === 'planificado' ? 'Todavía nada: espera su fase.' : '—') },
    { etiqueta: 'Pantalla', valor: conPantalla ? (m.ruta as string) : 'Sin pantalla todavía', mono: conPantalla },
  ]

  return {
    tipo: 'modulo',
    id: ref,
    tipoEtiqueta: 'Módulo de la plataforma',
    titulo: m.nombre,
    subtitulo: [m.dominio, fase?.nombre].filter(Boolean).join(' · ') || null,
    codigo: m.codigo,
    estado: { etiqueta: ESTADO_MODULO[estado]?.etiqueta ?? m.estado, tono: TONO_ESTADO[estado] ?? 'neutro' },
    hrefModulo: '/sistema/programa/hoja-de-ruta/modulos',
    datos,
    acciones: conPantalla ? [{ href, etiqueta: 'Abrir el módulo', tono: 'principal' }] : [{ href, etiqueta: 'Ver su anatomía' }],
    relaciones: pestanas.map((p) => ({ tipo: 'Pantalla', titulo: p.etiqueta, href: p.href })),
    linea: [],
    lineaVisible: false,
    documentos: [],
    aprobaciones: [],
    perimetro: false,
  }
}

/** El estado de un módulo: `control.modulo` deja escribir solo esa columna, con la casilla. */
export const manejarModulo: ManejadorFicha = async (sesion, ref, accion, entrada): Promise<ResultadoAccionFicha> => {
  if (!puede(sesion, 'modulo:programa', 'editar')) return { error: 'Tu rol no actualiza la hoja de ruta.' }
  if (!UUID.test(ref)) return { error: 'No se encontró el módulo.' }
  if (accion !== 'campo:estado') return { error: 'Ese campo no se edita desde aquí.' }
  const valor = entrada.valor ?? ''
  if (!(valor in ESTADO_MODULO)) return { error: 'Ese estado no existe.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('control').from('modulo').update({ estado: valor }).eq('ref', ref).select('codigo')
  if (error) return { error: 'No se pudo guardar el estado.' }
  if (!data?.length) return { error: 'No se guardó: tu sesión no puede cambiar ese módulo.' }
  revalidatePath('/sistema', 'layout')
  return { ok: 'Guardado.', ficha: `modulo:${ref}` }
}
