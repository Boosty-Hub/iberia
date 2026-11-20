import type { FuenteTabla, Fila } from '@/lib/plataforma/tabla-servidor'
import { ESTADO_MODULO } from '@/lib/plataforma/dominios'
import { plano } from '@/lib/plataforma/formato'
import { DUENO_TIPO_ETIQUETA, ESTADO_PENDIENTE_ETIQUETA } from '@/lib/plataforma/hoja-de-ruta-vocabulario'

/**
 * Las fuentes de `TablaDatos` de la hoja de ruta (PRG-PLN): lo que falta
 * (`control.pendiente_plataforma`) y los módulos del plan (`control.modulo`).
 * Son chicas (~30 y 66 filas): se leen una vez por petición con la sesión de
 * quien mira —la RLS esconde lo «solo equipo»— y se filtran en memoria.
 *
 * ⚠️ Lo lee Iberia: nada de dinero ni de régimen contractual en estas filas.
 */

export const TABLA_PENDIENTES_PLATAFORMA: FuenteTabla = {
  id: 'hoja-ruta-pendientes',
  titulo: 'Lo que falta',
  enMemoria: true,
  modulo: 'PRG-PLN',
  recurso: 'modulo:programa',
  ruta: '/sistema/programa/hoja-de-ruta',
  claveFila: 'id',
  busqueda: 'busqueda',
  orden: { columna: 'orden', dir: 'asc' },
  tamano: 50,
  columnas: [
    { clave: 'titulo', etiqueta: 'Qué falta', ancho: 260, envolver: true },
    {
      clave: 'dueno_tipo',
      etiqueta: 'Dueño',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: DUENO_TIPO_ETIQUETA,
      tonos: { iberia: 'azul', gabriel: 'morado', boosty: 'neutro' },
    },
    { clave: 'dueno_cargo', etiqueta: 'Quién', ancho: 150, envolver: true },
    { clave: 'bloquea', etiqueta: 'Qué destraba', ancho: 200, envolver: true },
    { clave: 'plazo', etiqueta: 'Para cuándo', ancho: 110, envolver: true, ayuda: 'La fecha límite, o la condición si el plazo no es un día' },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: ESTADO_PENDIENTE_ETIQUETA,
      tonos: { abierto: 'neutro', resuelto: 'verde' },
    },
    { clave: 'resuelto_en', etiqueta: 'Resuelto', tipo: 'fecha', oculta: true },
    { clave: 'fecha_limite', etiqueta: 'Fecha límite', tipo: 'fecha', oculta: true },
    { clave: 'origen', etiqueta: 'Origen', tipo: 'codigo', oculta: true, ayuda: 'De dónde sale: la dependencia o la pregunta del plan' },
    { clave: 'orden', etiqueta: 'N.º', tipo: 'entero', oculta: true },
  ],
  leer: async (supabase) => {
    const { data } = await supabase
      .schema('control')
      .from('pendiente_plataforma')
      .select('id, clave, titulo, detalle, dueno_tipo, dueno_cargo, bloquea, fecha_limite, fecha_texto, estado, resuelto_en, solo_equipo, origen, orden')
      .order('orden')
      .range(0, 999)
    return (data ?? []).map((p) => ({
      ...p,
      titulo: p.solo_equipo ? `${p.titulo} 🔒` : p.titulo,
      // La fecha manda; si no hay, la condición («antes del primer dato de JD»).
      plazo: p.fecha_limite ? fechaDia(p.fecha_limite) : (p.fecha_texto ?? '—'),
      busqueda: plano([p.titulo, p.detalle, p.dueno_cargo, p.bloquea, p.origen].filter(Boolean).join(' ')),
    })) as Fila[]
  },
  consulta: (supabase, _ctx, select, opciones) =>
    supabase.schema('control').from('pendiente_plataforma').select(select, opciones?.count ? { count: opciones.count } : undefined),
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** 2027-01-11 → «11-ene-2027» (texto: la columna se ordena por `orden`). */
function fechaDia(f: string): string {
  const [a, m, d] = f.slice(0, 10).split('-').map(Number)
  return `${d}-${MESES[m - 1]}-${a}`
}

export const TABLA_MODULOS_PLAN: FuenteTabla = {
  id: 'hoja-ruta-modulos',
  titulo: 'Módulos del plan',
  enMemoria: true,
  modulo: 'PRG-PLN',
  recurso: 'modulo:programa',
  ruta: '/sistema/programa/hoja-de-ruta/modulos',
  claveFila: 'codigo',
  ficha: { tipo: 'modulo', columna: 'ref' },
  busqueda: 'busqueda',
  orden: { columna: 'orden', dir: 'asc' },
  tamano: 100,
  columnas: [
    { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo', ancho: 80 },
    { clave: 'nombre', etiqueta: 'Módulo', ancho: 220, envolver: true },
    { clave: 'dominio', etiqueta: 'Dominio', filtrable: true, agrupable: true, ancho: 170 },
    { clave: 'fase_clave', etiqueta: 'Fase de entrada', etiquetaDe: 'fase_nombre', filtrable: true, agrupable: true, ancho: 190 },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: Object.fromEntries(Object.entries(ESTADO_MODULO).map(([k, v]) => [k, v.etiqueta])),
      tonos: { operando: 'verde', en_construccion: 'ambar', planificado: 'neutro', pausado: 'neutro' },
    },
    { clave: 'fase', etiqueta: 'Cómo crece', ancho: 220, oculta: true, ayuda: 'La fase de entrada y las siguientes, como las dice el plan' },
    { clave: 'dueno', etiqueta: 'Dueño (cargo)', oculta: true, ancho: 200 },
    {
      clave: 'acciones',
      etiqueta: 'Pantalla',
      tipo: 'acciones',
      ordenable: false,
      acciones: [{ clave: 'abrir', etiqueta: 'Abrir', titulo: 'Abrir la pantalla del módulo', href: '{href}' }],
    },
    { clave: 'orden', etiqueta: 'N.º', tipo: 'entero', oculta: true },
  ],
  leer: async (supabase) => {
    const [{ data: modulos }, { data: fases }] = await Promise.all([
      supabase.schema('control').from('modulo').select('codigo, ref, nombre, dominio, fase, fase_clave, estado, ruta, dueno, descripcion, orden, en_plan').eq('en_plan', true).order('orden'),
      supabase.schema('control').from('fase_plataforma').select('clave, nombre'),
    ])
    const nombreFase = new Map((fases ?? []).map((f) => [f.clave, f.nombre]))
    return (modulos ?? []).map((m) => {
      const conPantalla = Boolean(m.ruta) && m.estado !== 'planificado'
      return {
        ...m,
        fase_nombre: m.fase_clave ? (nombreFase.get(m.fase_clave) ?? m.fase_clave) : null,
        href: conPantalla ? m.ruta : null,
        // Solo los que tienen pantalla llevan «Abrir»: la base de la tabla decide los botones.
        acciones: conPantalla ? 'abrir' : '',
        busqueda: plano([m.codigo, m.nombre, m.dominio, m.descripcion, m.dueno].filter(Boolean).join(' ')),
      }
    }) as Fila[]
  },
  consulta: (supabase, _ctx, select, opciones) =>
    supabase.schema('control').from('modulo').select(select, opciones?.count ? { count: opciones.count } : undefined).eq('en_plan', true),
}

export const FUENTES_HOJA_DE_RUTA: Record<string, FuenteTabla> = {
  [TABLA_PENDIENTES_PLATAFORMA.id]: TABLA_PENDIENTES_PLATAFORMA,
  [TABLA_MODULOS_PLAN.id]: TABLA_MODULOS_PLAN,
}
