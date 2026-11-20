import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'

/**
 * Las fuentes de `TablaDatos`: una por tabla de la plataforma. La página la
 * pinta y la exportación la vuelve a consultar con la misma definición, así que
 * lo que se baja es exactamente lo que se ve (y lo que la RLS deja).
 */

export const TABLA_PLAZAS: FuenteTabla = {
  id: 'plazas',
  titulo: 'Plazas',
  modulo: 'NUC-ORG',
  recurso: 'sistema:estructura',
  ruta: '/sistema/nucleo/organizacion/plazas',
  claveFila: 'ref',
  ficha: { tipo: 'plaza', columna: 'ref' },
  busqueda: 'busqueda',
  orden: { columna: 'unidad', dir: 'asc' },
  columnas: [
    { clave: 'unidad', etiqueta: 'Unidad', agrupable: true, ancho: 200 },
    { clave: 'cargo', etiqueta: 'Cargo', agrupable: true, ancho: 200 },
    { clave: 'unidad_tipo', etiqueta: 'Tipo de unidad', filtrable: true, agrupable: true, oculta: true },
    { clave: 'familia', etiqueta: 'Familia', filtrable: true, agrupable: true, oculta: true },
    { clave: 'dotacion', etiqueta: 'Dotación', tipo: 'entero', total: true, ayuda: 'Puestos aprobados en la plaza' },
    { clave: 'ocupadas', etiqueta: 'Ocupadas', tipo: 'entero', total: true, ayuda: 'Titulares al día de los datos' },
    { clave: 'vacantes', etiqueta: 'Vacantes', tipo: 'entero', total: true },
    { clave: 'exceso', etiqueta: 'Por encima', tipo: 'entero', total: true, ayuda: 'Titulares por encima de la dotación' },
    { clave: 'tipo_nomina', etiqueta: 'Nómina', filtrable: true, agrupable: true, etiquetaDe: 'nomina' },
    { clave: 'sede', etiqueta: 'Sede', filtrable: true, agrupable: true, etiquetaDe: 'sede_nombre' },
    {
      clave: 'certeza',
      etiqueta: 'Certeza',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { hecho: 'Hecho', inferencia: 'Inferencia' },
      tonos: { hecho: 'verde', inferencia: 'ambar' },
    },
  ],
  consulta: (supabase, ctx, select, opciones) =>
    supabase
      .schema('ui')
      .rpc('plazas', { p_al: ctx.al, ...(ctx.esc ? { p_escenario: ctx.esc } : {}) }, opciones?.count ? { count: opciones.count } : undefined)
      .select(select),
}

export const TABLA_TASAS: FuenteTabla = {
  id: 'tasas',
  titulo: 'Historial de tasas',
  modulo: 'FIN-TAS',
  recurso: 'sistema:tasas',
  ruta: '/sistema/finanzas/tasas',
  claveFila: 'id',
  orden: { columna: 'fecha_valor', dir: 'desc' },
  tamano: 25,
  columnas: [
    { clave: 'fecha_valor', etiqueta: 'Fecha valor', tipo: 'fecha', ayuda: 'El día desde el que rige: la tasa que el BCV publica hoy vale el día hábil siguiente' },
    {
      clave: 'tipo',
      etiqueta: 'Tipo',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { oficial: 'BCV oficial', paralelo: 'Paralelo · uso interno' },
      tonos: { oficial: 'azul', paralelo: 'ambar' },
    },
    { clave: 'moneda', etiqueta: 'Moneda', filtrable: true, agrupable: true },
    { clave: 'tasa', etiqueta: 'Tasa (Bs)', tipo: 'tasa' },
    {
      clave: 'fuente',
      etiqueta: 'Fuente',
      filtrable: true,
      agrupable: true,
      etiquetas: { bcv_web: 'bcv.org.ve', bcv_xls: 'BCV (Excel)', dolarapi: 'DolarApi', manual: 'Carga manual' },
    },
    { clave: 'verificada_con', etiqueta: 'Verificación', ancho: 180 },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { vigente: 'Vigente', reemplazada: 'Reemplazada' },
      tonos: { vigente: 'verde', reemplazada: 'neutro' },
    },
    { clave: 'capturada_en', etiqueta: 'Capturada', tipo: 'fechaHora' },
    { clave: 'metodo', etiqueta: 'Método', filtrable: true, oculta: true, etiquetas: { web: 'Web', xls: 'Excel', api: 'API', manual: 'Manual', cruce: 'Cruce' } },
    { clave: 'motivo', etiqueta: 'Motivo', oculta: true, ancho: 200 },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase
      .schema('control')
      .from('tasa_cambio')
      .select(select, opciones?.count ? { count: opciones.count } : undefined),
}

export const FUENTES: Record<string, FuenteTabla> = {
  [TABLA_PLAZAS.id]: TABLA_PLAZAS,
  [TABLA_TASAS.id]: TABLA_TASAS,
}
