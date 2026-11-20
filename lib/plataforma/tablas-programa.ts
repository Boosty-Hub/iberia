import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'
import { CATEGORIAS_ARCHIVO, ESTADOS_ENTREVISTA, SEDES, TIPOS_SESION } from '@/lib/types'

/**
 * Las fuentes de `TablaDatos` del Programa (PRG-LEV · Levantamiento). Leen las
 * vistas `ui.programa_*` (migración `20261120230000_integracion_programa.sql`),
 * que son `security_invoker`: la RLS de quien mira, y además la casilla del
 * módulo. Se registran en `FUENTES` (`lib/plataforma/tablas.ts`), que es lo que
 * leen la exportación y las vistas guardadas.
 *
 * ⚠️ Lo lee Iberia: nada de dinero, y lo «solo Boosty» (notas del consultor,
 * hallazgos sin validar, transcripciones) no viaja en estas filas.
 */

export const SERIES_SESION: Record<string, string> = {
  ENT: 'ENT · Entrevistas',
  SES: 'SES · Reuniones y recorridos',
  FOR: 'FOR · Formaciones',
}

export const TABLA_ENTREVISTAS: FuenteTabla = {
  id: 'programa-entrevistas',
  titulo: 'Entrevistas y sesiones',
  // 43 sesiones: una lectura por petición, y filtros, orden y totales en memoria.
  enMemoria: true,
  modulo: 'PRG-LEV',
  recurso: 'modulo:entrevistas',
  ruta: '/sistema/programa/levantamiento/entrevistas',
  claveFila: 'id',
  ficha: { tipo: 'entrevista', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'fecha', dir: 'desc' },
  tamano: 50,
  columnas: [
    { clave: 'codigo', etiqueta: 'Código', tipo: 'codigo', ancho: 80 },
    { clave: 'titulo', etiqueta: 'Sesión', ancho: 240 },
    { clave: 'entrevistado_cargo', etiqueta: 'Cargo', ancho: 200 },
    {
      clave: 'serie',
      etiqueta: 'Serie',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      // Corta en la celda; el nombre largo va en la ayuda del encabezado.
      etiquetas: { ENT: 'ENT', SES: 'SES', FOR: 'FOR' },
      tonos: { ENT: 'azul', SES: 'neutro', FOR: 'morado' },
      ayuda: 'ENT cuenta contra la meta de ~25 entrevistas; SES son reuniones y recorridos; FOR, formaciones',
    },
    { clave: 'tipo', etiqueta: 'Tipo', filtrable: true, agrupable: true, oculta: true, etiquetas: TIPOS_SESION },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: ESTADOS_ENTREVISTA,
      tonos: { programada: 'neutro', realizada: 'ambar', transcrita: 'azul', analizada: 'verde' },
    },
    { clave: 'area_id', etiqueta: 'Área', etiquetaDe: 'area', filtrable: true, agrupable: true, ancho: 170 },
    { clave: 'sede', etiqueta: 'Sede', filtrable: true, agrupable: true, etiquetas: SEDES },
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha' },
    { clave: 'duracion_minutos', etiqueta: 'Minutos', tipo: 'entero', total: true, ayuda: 'Duración de la sesión' },
    { clave: 'participantes', etiqueta: 'Participantes', tipo: 'entero', total: true, oculta: true },
    {
      clave: 'con_transcripcion',
      etiqueta: 'Transcripción',
      tipo: 'insignia',
      filtrable: true,
      oculta: true,
      etiquetas: { true: 'Sí', false: 'No' },
      tonos: { true: 'verde', false: 'neutro' },
    },
    { clave: 'hallazgos', etiqueta: 'Hallazgos', tipo: 'entero', total: true, ayuda: 'Hallazgos con cita que salieron de la sesión' },
    { clave: 'entrevistador', etiqueta: 'Entrevistador', filtrable: true, oculta: true },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase.schema('ui').from('programa_entrevistas').select(select, opciones?.count ? { count: opciones.count } : undefined),
}

export const TABLA_ARCHIVOS: FuenteTabla = {
  id: 'programa-archivos',
  titulo: 'Archivos del expediente',
  enMemoria: true,
  modulo: 'PRG-LEV',
  recurso: 'modulo:archivos',
  ruta: '/sistema/programa/levantamiento/archivos',
  claveFila: 'id',
  ficha: { tipo: 'archivo', columna: 'id' },
  busqueda: 'busqueda',
  orden: { columna: 'subido_en', dir: 'desc' },
  tamano: 50,
  columnas: [
    { clave: 'extension', etiqueta: 'Tipo', tipo: 'codigo', filtrable: true, ancho: 60 },
    { clave: 'nombre', etiqueta: 'Archivo', ancho: 280 },
    { clave: 'categoria', etiqueta: 'Categoría', tipo: 'insignia', filtrable: true, agrupable: true, etiquetas: CATEGORIAS_ARCHIVO },
    { clave: 'area_id', etiqueta: 'Área', etiquetaDe: 'area', filtrable: true, agrupable: true, ancho: 160 },
    { clave: 'entrevista', etiqueta: 'Sesión', tipo: 'codigo', filtrable: true },
    { clave: 'fase', etiqueta: 'Fase', tipo: 'entero', filtrable: true, oculta: true },
    { clave: 'tamano_bytes', etiqueta: 'Bytes', tipo: 'entero', total: true, oculta: true },
    { clave: 'subido_en', etiqueta: 'Subido', tipo: 'fecha' },
    {
      clave: 'confidencial',
      etiqueta: 'Confidencial',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { true: 'Confidencial', false: 'No' },
      tonos: { true: 'ambar', false: 'neutro' },
    },
    { clave: 'descripcion', etiqueta: 'Descripción', oculta: true, ancho: 260 },
    {
      clave: 'acciones',
      etiqueta: 'Acciones',
      tipo: 'acciones',
      ordenable: false,
      // Solo «Ver»: la descarga es un enlace firmado de 60 s que no se le
      // entrega a un `Link` (lo precargaría); va como enlace simple en la ficha
      // y en el visor.
      acciones: [{ clave: 'ver', etiqueta: 'Ver', titulo: 'Ver el archivo sin descargarlo', href: '/sistema/programa/levantamiento/archivos/{id}' }],
    },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase.schema('ui').from('programa_archivos').select(select, opciones?.count ? { count: opciones.count } : undefined),
}

export const FUENTES_PROGRAMA: Record<string, FuenteTabla> = {
  [TABLA_ENTREVISTAS.id]: TABLA_ENTREVISTAS,
  [TABLA_ARCHIVOS.id]: TABLA_ARCHIVOS,
}
