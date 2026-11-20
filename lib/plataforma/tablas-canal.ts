import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'

/**
 * Las tablas de la administración del canal (NUC-CAN). Salen de funciones que
 * piden la casilla `modulo:reportes` adentro y devuelven cuentas: de los
 * mensajes, cuántos y cuándo; nunca qué dicen ni entre quiénes.
 */

export const TABLA_CANAL_GRUPOS: FuenteTabla = {
  id: 'canal-grupos',
  titulo: 'Grupos del canal',
  enMemoria: true,
  modulo: 'NUC-CAN',
  recurso: 'modulo:reportes',
  ruta: '/sistema/nucleo/canal/grupos',
  claveFila: 'id',
  busqueda: 'busqueda',
  orden: { columna: 'miembros', dir: 'desc' },
  columnas: [
    { clave: 'nombre', etiqueta: 'Grupo', ancho: 200 },
    { clave: 'proposito', etiqueta: 'Propósito', ancho: 220, ordenable: false },
    {
      clave: 'tipo',
      etiqueta: 'Tipo',
      tipo: 'insignia',
      filtrable: true,
      agrupable: true,
      etiquetas: { abierto: 'Abierto', cerrado: 'Cerrado' },
      tonos: { abierto: 'verde', cerrado: 'neutro' },
      ayuda: 'Abierto: cualquiera se une. Cerrado: lo arma quien lo coordina.',
    },
    {
      clave: 'activo',
      etiqueta: 'Estado',
      tipo: 'insignia',
      filtrable: true,
      etiquetas: { true: 'Activo', false: 'Desactivado' },
      tonos: { true: 'verde', false: 'neutro' },
    },
    { clave: 'area', etiqueta: 'Área', filtrable: true, agrupable: true },
    { clave: 'miembros', etiqueta: 'Miembros', tipo: 'entero', total: true },
    { clave: 'coordinadores', etiqueta: 'Coordinan', ancho: 200, ordenable: false },
    { clave: 'mensajes_30d', etiqueta: 'Mensajes · 30 días', tipo: 'entero', total: true, ayuda: 'Solo la cuenta: el contenido no se lee desde aquí' },
    { clave: 'ultimo_mensaje', etiqueta: 'Último mensaje', tipo: 'fechaHora' },
    { clave: 'creado_en', etiqueta: 'Creado', tipo: 'fecha', oculta: true },
  ],
  consulta: (supabase, _ctx, select, opciones) =>
    supabase.schema('ui').rpc('canal_grupos', undefined, opciones?.count ? { count: opciones.count } : undefined).select(select),
}

export const TABLA_CANAL_USO: FuenteTabla = {
  id: 'canal-uso',
  titulo: 'Uso del canal',
  enMemoria: true,
  modulo: 'NUC-CAN',
  recurso: 'modulo:reportes',
  ruta: '/sistema/nucleo/canal/uso',
  claveFila: 'clave',
  busqueda: 'busqueda',
  orden: { columna: 'en_padron', dir: 'desc' },
  tamano: 100,
  columnas: [
    { clave: 'area', etiqueta: 'Área', filtrable: true, agrupable: true, ancho: 180 },
    { clave: 'sede', etiqueta: 'Sede', filtrable: true, agrupable: true, etiquetaDe: 'sede_nombre' },
    { clave: 'nivel', etiqueta: 'Nivel', filtrable: true, agrupable: true, etiquetaDe: 'nivel_nombre' },
    { clave: 'en_padron', etiqueta: 'En el padrón', tipo: 'entero', total: true, ayuda: 'Personas activas en el padrón' },
    { clave: 'con_cuenta', etiqueta: 'Con cuenta', tipo: 'entero', total: true, ayuda: 'Con la cuenta enlazada a su ficha (enlace acuñado o cuenta creada)' },
    { clave: 'entraron', etiqueta: 'Entraron', tipo: 'entero', total: true, ayuda: 'Iniciaron sesión al menos una vez' },
    { clave: 'activas_30d', etiqueta: 'Activas · 30 días', tipo: 'entero', total: true, ayuda: 'Con alguna acción en el canal en los 30 días que terminan en «Datos al» (la métrica «Personas activas en el canal»)' },
    { clave: 'adopcion', etiqueta: 'Activas / padrón', tipo: 'porcentaje' },
    { clave: 'mensajes_30d', etiqueta: 'Mensajes · 30 días', tipo: 'entero', total: true, ayuda: 'Solo la cuenta de los que escribió ese grupo de personas' },
    { clave: 'lecturas_30d', etiqueta: 'Lecturas · 30 días', tipo: 'entero', total: true, ayuda: 'Publicaciones abiertas' },
  ],
  consulta: (supabase, ctx, select, opciones) =>
    supabase.schema('ui').rpc('canal_uso', { p_al: ctx.al }, opciones?.count ? { count: opciones.count } : undefined).select(select),
}

export const FUENTES_CANAL: Record<string, FuenteTabla> = {
  [TABLA_CANAL_GRUPOS.id]: TABLA_CANAL_GRUPOS,
  [TABLA_CANAL_USO.id]: TABLA_CANAL_USO,
}
